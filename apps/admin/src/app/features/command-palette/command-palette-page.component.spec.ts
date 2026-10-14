import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { provideAccess } from '@admin-template/access';
import { DEMO_ACCESS_CONFIG } from '../../core/access/demo-access';
import { isCommandPaletteOpen, toggleCommandPalette } from '../../layout/command-palette/command-palette-host';
import { CommandPalettePageComponent } from './command-palette-page.component';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('CommandPalettePageComponent（指令面板展示頁）', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  const demo = (id: string) => el.querySelector<HTMLElement>(`[data-demo="${id}"]`)!;
  const settle = async (ms = 0) => {
    harness.detectChanges();
    await sleep(ms);
    harness.detectChanges();
  };
  const titles = (scope: HTMLElement) =>
    Array.from(scope.querySelectorAll('[lib-command-option] .co-title')).map((e) => e.textContent!.trim());
  function type(scope: HTMLElement, text: string): void {
    const input = scope.querySelector('input')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    harness.detectChanges();
  }
  function press(scope: HTMLElement, key: string): void {
    scope.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    harness.detectChanges();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: CommandPalettePageComponent }]), provideAccess(DEMO_ACCESS_CONFIG)],
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/components/command-palette', CommandPalettePageComponent);
    el = harness.routeNativeElement as HTMLElement;
    await settle();
  });

  afterEach(() => {
    toggleCommandPalette(TestBed.inject(EnvironmentInjector), false);
    TestBed.inject(OverlayContainer).getContainerElement().innerHTML = '';
  });

  it('三個示範：全域面板的按鈕、嵌在頁面裡的面板、慢的與會失敗的來源', () => {
    for (const id of ['global', 'inline', 'states']) expect(demo(id)).not.toBeNull();
    // 查詢空白：建議的動作。
    expect(titles(demo('inline'))).toEqual(['新增聯絡人', '匯出聯絡人名單', '切換檢視']);
  });

  it('嵌在頁面裡：聯絡人立刻出現，專案停手後才出現；Enter 執行並記進最近使用', async () => {
    type(demo('inline'), '王');
    expect(titles(demo('inline'))).toEqual(['王小明']);
    expect(demo('inline').querySelector('[data-group="projects-400"] .cmdk-status')?.textContent).toContain('搜尋中');
    await settle(650);
    expect(titles(demo('inline'))).toEqual(['王小明', '官網改版']);
    press(demo('inline'), 'Enter');
    expect(demo('inline').querySelector('[data-demo-state="log"]')?.textContent).toBe('打開聯絡人「王小明」');
    type(demo('inline'), '');
    await settle();
    expect(demo('inline').querySelector('.cmdk-group__heading')?.textContent).toBe('最近使用');
  });

  it('慢的與會失敗的來源：聯絡人已列出、專案還在載入、封存資料只在那一組顯示錯誤', async () => {
    await settle(900);
    const states = demo('states');
    expect(titles(states)).toEqual(['王小明']);
    expect(states.querySelector('[data-group="projects-2500"] .cmdk-status')?.textContent).toContain('搜尋中');
    expect(states.querySelector('[data-group="archive"] .cmdk-status--error')?.textContent).toContain('封存資料暫時無法搜尋');
  });

  it('「打開全域指令面板」打開頁首的同一個對話框', async () => {
    el.querySelector<HTMLButtonElement>('[data-demo-action="open-global"]')!.click();
    await settle(80);
    expect(isCommandPaletteOpen()).toBe(true);
    expect(TestBed.inject(OverlayContainer).getContainerElement().querySelector('app-command-palette-dialog')).not.toBeNull();
  });
});
