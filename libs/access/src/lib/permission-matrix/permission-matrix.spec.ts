import { describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AccessRole, Permission } from '../access.model';
import { AccessService } from '../access.service';
import { IdentitySwitcherComponent } from '../identity-switcher/identity-switcher.component';
import { TEST_ACCESS_CONFIG, provideTestAccess } from '../testing/access-fixture';
import { PERMISSION_MATRIX_LABELS, PermissionMatrixComponent } from './permission-matrix.component';
import { RoleDraft } from './role-draft';
import { unsavedChangesGuard } from './unsaved-changes.guard';

const LABELS = {
  feature: '功能',
  cell: '{feature}：{action}',
  toggleRow: '{feature}：全部動作',
  toggleColumn: '所有功能：{action}',
  granted: '有',
  notGranted: '沒有',
  notApplicable: '不適用',
};

@Component({
  imports: [PermissionMatrixComponent],
  template: `<lib-permission-matrix
    [features]="features"
    [actionLabels]="actionLabels"
    [value]="value()"
    [readonly]="readonly()"
    caption="主管的權限"
    (valueChange)="value.set($event)"
  />`,
})
class HostComponent {
  readonly features = TEST_ACCESS_CONFIG.features;
  readonly actionLabels = TEST_ACCESS_CONFIG.labels.actions;
  readonly value = signal<Permission[]>(['ticket:view']);
  readonly readonly = signal(false);
}

function render() {
  TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [{ provide: PERMISSION_MATRIX_LABELS, useValue: LABELS }],
  });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const input = (label: string) => el.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
  return { fixture, el, input, host: fixture.componentInstance };
}

describe('lib-permission-matrix', () => {
  it('功能是列、動作是欄；不適用的格子沒有勾選框、有報讀文字', () => {
    const { el, input } = render();
    expect(Array.from(el.querySelectorAll('thead th')).map((th) => th.textContent?.trim())).toEqual(['功能', '檢視', '建立', '編輯', '刪除', '核准']);
    expect(el.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(input('工單：檢視').checked).toBe(true);
    expect(input('報表：編輯')).toBeNull();
    expect(el.querySelector('tr[data-feature="report"] td[data-action="edit"]')?.textContent).toContain('不適用');
    expect(el.querySelector('caption')?.textContent).toBe('主管的權限');
  });

  it('單格切換、整列切換（半選→全勾→全取消）、整欄切換', async () => {
    const { fixture, host, input } = render();
    expect(input('工單：全部動作').indeterminate).toBe(true);

    input('工單：全部動作').click();
    await fixture.whenStable();
    expect(host.value().filter((p) => p.startsWith('ticket:'))).toHaveLength(5);
    expect(input('工單：全部動作').checked).toBe(true);
    expect(input('工單：全部動作').indeterminate).toBe(false);

    input('工單：全部動作').click();
    await fixture.whenStable();
    expect(host.value()).toEqual([]);

    input('所有功能：編輯').click();
    await fixture.whenStable();
    expect([...host.value()].sort()).toEqual(['project:edit', 'settings:edit', 'ticket:edit']);
    expect(input('所有功能：編輯').checked).toBe(true);

    input('專案：核准').click();
    await fixture.whenStable();
    expect(host.value()).toContain('project:approve');
    expect(input('所有功能：核准').indeterminate).toBe(true);
  });

  it('方向鍵在勾選框之間移動，跳過不適用的格子', () => {
    const { el, input } = render();
    const press = (from: HTMLElement, key: string) => {
      from.focus();
      from.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      return document.activeElement as HTMLInputElement;
    };
    document.body.appendChild(el);
    expect(press(input('工單：檢視'), 'ArrowRight').getAttribute('aria-label')).toBe('工單：建立');
    expect(press(input('工單：檢視'), 'ArrowLeft').getAttribute('aria-label')).toBe('工單：全部動作');
    expect(press(input('工單：檢視'), 'ArrowUp').getAttribute('aria-label')).toBe('所有功能：檢視');
    // 專案：編輯 往下是報表（沒有編輯）→ 跳到設定：編輯
    expect(press(input('專案：編輯'), 'ArrowDown').getAttribute('aria-label')).toBe('設定：編輯');
    el.remove();
  });

  it('readonly：沒有任何勾選框，改成「有／沒有」', async () => {
    const { fixture, el, host } = render();
    host.readonly.set(true);
    await fixture.whenStable();
    expect(el.querySelectorAll('input')).toHaveLength(0);
    expect(el.querySelector('tr[data-feature="ticket"] td[data-action="view"]')?.textContent).toContain('有');
    expect(el.querySelector('tr[data-feature="ticket"] td[data-action="edit"]')?.textContent).toContain('沒有');
  });
});

describe('RoleDraft 與未儲存變更守門', () => {
  const role: AccessRole = { id: 'c1', name: '外包', preset: false, permissions: ['ticket:view'] };

  it('改名或改權限才算有變更；改回原狀、重設、重新載入都清除', () => {
    const draft = new RoleDraft();
    draft.load(role);
    expect(draft.dirty()).toBe(false);
    draft.name.set(' 外包 ');
    expect(draft.dirty()).toBe(false);
    draft.permissions.set(['ticket:view', 'ticket:edit']);
    expect(draft.dirty()).toBe(true);
    draft.permissions.set(['ticket:view']);
    expect(draft.dirty()).toBe(false);
    draft.name.set('外包商');
    expect(draft.dirty()).toBe(true);
    draft.reset();
    expect(draft.name()).toBe('外包');
    expect(draft.dirty()).toBe(false);
    draft.name.set('外包商');
    draft.load({ ...role, name: '外包商' });
    expect(draft.dirty()).toBe(false);
  });

  it('canLeave 回 false（或 Promise false）就留在原頁', async () => {
    const run = (component: unknown) =>
      TestBed.runInInjectionContext(() => unsavedChangesGuard(component as never, null as never, null as never, null as never));
    expect(run({ canLeave: () => true })).toBe(true);
    expect(run({ canLeave: () => false })).toBe(false);
    await expect(run({ canLeave: () => Promise.resolve(false) })).resolves.toBe(false);
    expect(run(null)).toBe(true);
  });
});

describe('lib-identity-switcher', () => {
  it('按鈕顯示目前的名字與角色；選單點一下就換身分', async () => {
    TestBed.configureTestingModule({ imports: [IdentitySwitcherComponent], providers: provideTestAccess() });
    const fixture = TestBed.createComponent(IdentitySwitcherComponent);
    fixture.componentRef.setInput('labels', { trigger: '切換身分', menuTitle: '示範帳號', signedOut: '未登入', noRoles: '沒有角色', separator: '、' });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const trigger = el.querySelector('.ids-trigger') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-label')).toBe('切換身分：林雅婷（系統管理員）');

    trigger.click();
    await fixture.whenStable();
    const items = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
    expect(items.map((i) => i.querySelector('.ids-item-name')?.textContent)).toEqual(['林雅婷', '陳志明', '王小明', '張美玲', '李佩君']);
    expect(items[0].getAttribute('aria-checked')).toBe('true');
    expect(items[4].textContent).toContain('成員、檢視者');

    items[4].click();
    await fixture.whenStable();
    expect(TestBed.inject(AccessService).currentUser()?.id).toBe('u-multi');
    expect(el.querySelector('.ids-roles')?.textContent).toBe('成員、檢視者');
  });
});
