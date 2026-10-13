import { describe, expect, it, vi } from 'vitest';
import { Location } from '@angular/common';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RedirectCommand, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { accessGuard, accessMatchGuard, rerunGuardsOnAccessChange } from './access.guard';
import { AccessService } from './access.service';
import { CanDirective } from './can.directive';
import { DisabledUnlessDirective } from './disabled-unless.directive';
import { provideTestAccess } from './testing/access-fixture';

@Component({ template: 'page' })
class PageComponent {}

@Component({ template: 'forbidden' })
class ForbiddenComponent {}

@Component({
  imports: [CanDirective, DisabledUnlessDirective],
  template: `
    <button id="create" *libCan="'ticket:create'">新增</button>
    <span id="delete" *libCan="'ticket:delete'; else readOnly">刪除</span>
    <ng-template #readOnly><span id="read-only">唯讀</span></ng-template>
    <button id="approve" type="button" [libDisabledUnless]="'ticket:approve'" (click)="clicks.set(clicks() + 1)">核准</button>
    <button id="custom" type="button" [libDisabledUnless]="'settings:edit'" libDisabledUnlessHint="請找系統管理員">設定</button>
  `,
})
class HostComponent {
  readonly clicks = signal(0);
}

function guardResult(data: Record<string, unknown>) {
  const route = { data } as unknown as ActivatedRouteSnapshot;
  return TestBed.runInInjectionContext(() => accessGuard(route, {} as RouterStateSnapshot));
}

describe('路由守門', () => {
  function configure() {
    TestBed.configureTestingModule({
      providers: [
        ...provideTestAccess(),
        provideRouter([
          { path: 'reports', component: PageComponent, canActivate: [accessGuard], runGuardsAndResolvers: 'always', data: { access: 'report:view' } },
          { path: 'open', component: PageComponent },
          { path: 'forbidden', component: ForbiddenComponent },
        ]),
      ],
    });
    return TestBed.inject(AccessService);
  }

  it('沒有要求的路由一律放行；有權限放行', () => {
    configure();
    expect(guardResult({})).toBe(true);
    expect(guardResult({ access: 'report:view' })).toBe(true);
  });

  it('沒有權限：導向 /forbidden，網址列不變（skipLocationChange），帶上需要的權限', () => {
    const access = configure();
    access.signIn('u-member');
    const result = guardResult({ access: ['report:view', { feature: 'settings', action: 'view' }] });
    expect(result).toBeInstanceOf(RedirectCommand);
    const command = result as RedirectCommand;
    expect(TestBed.inject(Router).serializeUrl(command.redirectTo)).toBe('/forbidden?need=report:view,settings:view');
    expect(command.navigationBehaviorOptions?.skipLocationChange).toBe(true);

    const match = TestBed.runInInjectionContext(() => accessMatchGuard({ data: { access: 'report:view' } }, [], {} as never));
    expect(match).toBeInstanceOf(RedirectCommand);
  });

  it('實際導覽：成員打開 /reports 看到沒有權限頁；換成有權限的身分後自動回到原頁', async () => {
    const access = configure();
    const router = TestBed.inject(Router);
    TestBed.runInInjectionContext(() => rerunGuardsOnAccessChange());
    TestBed.tick();

    access.signIn('u-member');
    TestBed.tick();
    await router.navigateByUrl('/reports');
    expect(router.url).toBe('/forbidden?need=report:view');

    // 測試環境的 Location 沒有真的網址列：模擬「網址列仍是 /reports」。
    vi.spyOn(TestBed.inject(Location), 'path').mockReturnValue('/reports');
    access.signIn('u-viewer');
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
    expect(router.url).toBe('/reports');
  });
});

describe('*libCan 與 [libDisabledUnless]', () => {
  function render() {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: provideTestAccess() });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return { fixture, access: TestBed.inject(AccessService), el: fixture.nativeElement as HTMLElement };
  }

  it('有權限時顯示；沒有時隱藏或改顯示 else；換身分立刻更新', async () => {
    const { fixture, access, el } = render();
    expect(el.querySelector('#create')).not.toBeNull();
    expect(el.querySelector('#delete')).not.toBeNull();
    expect(el.querySelector('#read-only')).toBeNull();

    access.signIn('u-viewer');
    await fixture.whenStable();
    expect(el.querySelector('#create')).toBeNull();
    expect(el.querySelector('#delete')).toBeNull();
    expect(el.querySelector('#read-only')?.textContent).toBe('唯讀');

    access.signIn('u-member');
    await fixture.whenStable();
    expect(el.querySelector('#create')).not.toBeNull();
    expect(el.querySelectorAll('#read-only')).toHaveLength(1);
  });

  it('沒有權限：按鈕仍可聚焦（沒有 disabled 屬性）、aria-disabled、提示「需要主管權限」、點擊不觸發', async () => {
    const { fixture, access, el } = render();
    const approve = el.querySelector('#approve') as HTMLButtonElement;
    const tooltip = fixture.debugElement.query(By.css('#approve')).injector.get(MatTooltip);

    approve.click();
    expect(fixture.componentInstance.clicks()).toBe(1);
    expect(approve.getAttribute('aria-disabled')).toBeNull();
    expect(tooltip.disabled).toBe(true);

    access.signIn('u-member');
    await fixture.whenStable();
    expect(approve.hasAttribute('disabled')).toBe(false);
    expect(approve.getAttribute('aria-disabled')).toBe('true');
    expect(approve.style.opacity).toBe('var(--app-disabled-opacity)');
    expect(tooltip.message).toBe('需要主管權限');
    expect(tooltip.disabled).toBe(false);
    approve.click();
    expect(fixture.componentInstance.clicks()).toBe(1);

    const custom = fixture.debugElement.query(By.css('#custom')).injector.get(MatTooltip);
    expect(custom.message).toBe('請找系統管理員');

    access.signIn('u-manager');
    await fixture.whenStable();
    approve.click();
    expect(fixture.componentInstance.clicks()).toBe(2);
    expect(approve.getAttribute('aria-disabled')).toBeNull();
  });
});
