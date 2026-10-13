import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { AccessService, provideAccess } from '@admin-template/access';
import { CONFIRM_DIALOG_LABELS } from '@admin-template/ui';
import { DEMO_ACCESS_CONFIG } from '../../core/access/demo-access';
import { ZH_TW } from '../../core/i18n/zh-tw';
import { RolesPageComponent } from './roles-page.component';

describe('RolesPageComponent（角色與權限）', () => {
  let confirmAnswer: boolean;
  let dialogOpen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    confirmAnswer = true;
    dialogOpen = vi.fn(() => ({ afterClosed: () => of(confirmAnswer) }));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideAccess(DEMO_ACCESS_CONFIG), { provide: MatDialog, useValue: { open: dialogOpen } }],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(RolesPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r));
      fixture.detectChanges();
    };
    return { fixture, el, settle, access: TestBed.inject(AccessService), page: fixture.componentInstance };
  }

  it('預設角色唯讀：矩陣沒有勾選框；沒有自訂角色時顯示空狀態', async () => {
    const { el } = await render();
    expect(el.querySelector('#role-editor-title')?.textContent).toBe('系統管理員');
    expect(el.querySelectorAll('lib-permission-matrix input')).toHaveLength(0);
    expect(el.textContent).toContain('預設角色不能修改');
    expect(el.querySelector('lib-empty-state')?.textContent).toContain('還沒有自訂角色');
  });

  it('複製成自訂角色後可以編輯；儲存才寫回 AccessService', async () => {
    const { el, settle, access } = await render();
    (el.querySelector('[data-role-id="manager"]') as HTMLButtonElement).click();
    await settle();
    (el.querySelector('[data-action="copy"]') as HTMLButtonElement).click();
    await settle();

    expect(el.querySelector('#role-editor-title')?.textContent).toBe('主管（副本）');
    const custom = access.roles().find((r) => r.name === '主管（副本）');
    expect(custom?.preset).toBe(false);
    const cell = el.querySelector('input[data-permission="ticket:delete"]') as HTMLInputElement;
    expect(cell.checked).toBe(true);

    cell.click();
    await settle();
    expect(el.textContent).toContain('尚未儲存');
    expect(access.role(custom?.id ?? '')?.permissions).toContain('ticket:delete');

    (el.querySelector('[data-action="save"]') as HTMLButtonElement).click();
    await settle();
    expect(access.role(custom?.id ?? '')?.permissions).not.toContain('ticket:delete');
    expect(el.textContent).not.toContain('尚未儲存');
  });

  it('有未儲存的變更時換角色或離開：先確認；選「繼續編輯」就留下', async () => {
    const { el, settle, page } = await render();
    (el.querySelector('[data-action="copy"]') as HTMLButtonElement).click();
    await settle();
    (el.querySelector('input[data-permission="report:view"]') as HTMLInputElement).click();
    await settle();

    confirmAnswer = false;
    (el.querySelector('[data-role-id="viewer"]') as HTMLButtonElement).click();
    await settle();
    expect(dialogOpen).toHaveBeenCalledTimes(1);
    expect(el.querySelector('#role-editor-title')?.textContent).toBe('系統管理員（副本）');
    expect(await page.canLeave()).toBe(false);

    confirmAnswer = true;
    expect(await page.canLeave()).toBe(true);
    expect(el.querySelector('#role-editor-title')?.textContent).toBe('系統管理員（副本）');
    await settle();
    expect(el.textContent).not.toContain('尚未儲存');
    // 沒有變更時直接離開，不再問。
    dialogOpen.mockClear();
    expect(await page.canLeave()).toBe(true);
    expect(dialogOpen).not.toHaveBeenCalled();
  });

  it('「還原示範資料」的確認對話框帶有頁面 providers 提供的按鈕文字，並用頁面的 injector 開（不再是空白對話框）', async () => {
    const { el, settle } = await render();
    const button = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === '還原示範資料');
    button?.click();
    await settle();
    expect(dialogOpen).toHaveBeenCalledTimes(1);
    const config = dialogOpen.mock.calls[0][1];
    expect(config.data).toMatchObject({ confirmLabel: '還原', cancelLabel: ZH_TW.common.cancel });
    // 對話框的 injector 是頁面的 injector：對話框元件自己 inject CONFIRM_DIALOG_LABELS 也找得到。
    expect(config.injector.get(CONFIRM_DIALOG_LABELS)).toEqual({ confirm: ZH_TW.common.confirm, cancel: ZH_TW.common.cancel });
  });

  it('指派角色：勾選後使用者的角色與實際權限更新；刪除自訂角色時一併拿掉', async () => {
    const { el, settle, access } = await render();
    (el.querySelector('[data-action="copy"]') as HTMLButtonElement).click();
    await settle();
    const copyId = access.roles().at(-1)?.id ?? '';
    (el.querySelector(`input[data-assign="u-member:${copyId}"]`) as HTMLInputElement).click();
    await settle();
    expect(access.users().find((u) => u.id === 'u-member')?.roleIds).toEqual(['member', copyId]);

    (el.querySelector('[data-action="delete"]') as HTMLButtonElement).click();
    await settle();
    expect(access.role(copyId)).toBeUndefined();
    expect(access.users().find((u) => u.id === 'u-member')?.roleIds).toEqual(['member']);
    expect(el.querySelector('#role-editor-title')?.textContent).toBe('系統管理員');
  });

  it('只有「設定・檢視」的檢視者：整頁唯讀，修改的按鈕不出現', async () => {
    TestBed.inject(AccessService).signIn('u-viewer');
    const { el } = await render();
    expect(el.querySelector('[data-readonly-note]')).not.toBeNull();
    expect(el.querySelector('[data-action="copy"]')).toBeNull();
    expect(el.querySelectorAll('input[data-assign]')).toHaveLength(0);
    expect(el.textContent).not.toContain('還原示範資料');
  });
});
