import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { expectExportMatchesDisplay } from '@admin-template/ui/testing';
import { SplitPanelPageComponent } from './split-panel-page.component';

describe('SplitPanelPageComponent（分割檢視展示頁）', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  const settle = async () => {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  };
  const rows = () => Array.from(el.querySelectorAll<HTMLTableRowElement>('lib-data-table tbody tr'));
  const heading = () => el.querySelector('.responsive-panel__heading')?.textContent?.trim();
  const field = (name: string) => el.querySelector<HTMLInputElement>(`[data-demo="edit-form"] input[formcontrolname="${name}"]`)!;
  const url = () => TestBed.inject(Router).url;

  async function open(path: string): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(path, SplitPanelPageComponent);
    el = harness.routeNativeElement as HTMLElement;
    await settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: SplitPanelPageComponent }])] });
  });

  it('沒有 ?edit：只有清單，面板關著、沒有目前列', async () => {
    await open('/components/split-panel');
    expect(rows()).toHaveLength(6);
    expect(el.querySelector('[data-demo="edit-form"]')).toBeNull();
    expect(el.querySelectorAll('tbody tr[aria-current]')).toHaveLength(0);
    expect(el.querySelector('[data-state="edit-param"]')?.textContent).toContain('（無）');
  });

  it('網址帶 ?edit=c2：打開那一筆的編輯面板，表單帶入資料，表格標出那一列', async () => {
    await open('/components/split-panel?edit=c2');
    expect(heading()).toBe('編輯 陳大同');
    expect(field('name').value).toBe('陳大同');
    expect(field('email').value).toBe('datong@example.com');
    const active = rows().filter((r) => r.getAttribute('aria-current') === 'true');
    expect(active).toHaveLength(1);
    expect(active[0].textContent).toContain('陳大同');
  });

  it('焦點：直接開 ?edit= 不搶焦點；點一列時移進面板，關閉後回到那一列', async () => {
    (document.activeElement as HTMLElement | null)?.blur();
    await open('/components/split-panel?edit=c2');
    expect(document.activeElement).toBe(document.body);

    el.querySelector<HTMLButtonElement>('.responsive-panel__close')!.click();
    await settle();
    const row = rows()[3];
    row.focus();
    row.click();
    await settle();
    expect(document.activeElement).toBe(el.querySelector('.responsive-panel__close'));

    el.querySelector<HTMLButtonElement>('.responsive-panel__close')!.click();
    await settle();
    expect(document.activeElement).toBe(rows()[3]);
  });

  it('點一列：網址改成那一筆、面板換內容、目前列跟著換', async () => {
    await open('/components/split-panel?edit=c2');
    rows()[2].click();
    await settle();
    expect(url()).toContain('edit=c3');
    expect(heading()).toBe('編輯 林美惠');
    expect(rows()[2].getAttribute('aria-current')).toBe('true');
    expect(rows()[1].hasAttribute('aria-current')).toBe(false);
  });

  it('儲存：清單更新、面板關閉、網址拿掉 ?edit；必填沒填時不存', async () => {
    await open('/components/split-panel?edit=c1');
    const name = field('name');
    name.value = '';
    name.dispatchEvent(new Event('input'));
    el.querySelector<HTMLFormElement>('[data-demo="edit-form"]')!.dispatchEvent(new Event('submit'));
    await settle();
    expect(url()).toContain('edit=c1');
    expect(el.querySelector('mat-error')?.textContent).toContain('請輸入姓名');

    name.value = '王大明';
    name.dispatchEvent(new Event('input'));
    el.querySelector<HTMLFormElement>('[data-demo="edit-form"]')!.dispatchEvent(new Event('submit'));
    await settle();
    expect(url()).not.toContain('edit=');
    expect(el.querySelector('[data-demo="edit-form"]')).toBeNull();
    expect(rows()[0].textContent).toContain('王大明');
    expect(el.querySelector('[data-state="last-saved"]')?.textContent).toContain('王大明');
  });

  it('關閉鈕與取消都會關面板並拿掉 ?edit；其他 query 參數保留', async () => {
    await open('/components/split-panel?edit=c4&tab=x');
    el.querySelector<HTMLButtonElement>('.responsive-panel__close')!.click();
    await settle();
    expect(url()).not.toContain('edit=');
    expect(url()).toContain('tab=x');
    expect(el.querySelector('[data-demo="edit-form"]')).toBeNull();
  });

  it('儲存後清單的畫面值與匯出值仍然一致', async () => {
    await open('/components/split-panel?edit=c3');
    const name = field('name');
    name.value = '林美惠（主管）';
    name.dispatchEvent(new Event('input'));
    el.querySelector<HTMLFormElement>('[data-demo="edit-form"]')!.dispatchEvent(new Event('submit'));
    await settle();
    const page = harness.routeDebugElement!.componentInstance as SplitPanelPageComponent;
    expectExportMatchesDisplay(el.querySelector('lib-data-table')!, page.columns, page.contacts());
    expect(rows()[2].textContent).toContain('林美惠（主管）');
  });

  it('?edit 找不到那一筆：自動拿掉參數，面板不開', async () => {
    await open('/components/split-panel?edit=nope');
    await settle();
    expect(url()).not.toContain('edit=');
    expect(el.querySelector('[data-demo="edit-form"]')).toBeNull();
  });
});
