import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AppearancePanelService, COLOR_THEMES, ThemeService, texture } from '@admin-template/theme-pack';
import { IdentitySwitcherService } from '@admin-template/access';
import { ZH_TW } from '../../../core/i18n/zh-tw';
import { HeaderTitleSlot } from '../../../layout/header/header-title';
import { SettingsPageComponent } from './settings-page.component';

// jsdom 不會下載樣式表：手動送出按需質地 <link> 的 load 事件（ADR 0010），再等 setParadigm 的 promise 跑完。
async function loadTexture(id: string): Promise<void> {
  document.head
    .querySelector(`link[rel="stylesheet"][data-texture-css="${id}"]`)
    ?.dispatchEvent(new Event('load'));
  await new Promise((resolve) => setTimeout(resolve));
}

describe('SettingsPageComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [SettingsPageComponent] });
  });

  afterEach(() => {
    document.head.querySelectorAll('link[data-texture-css], link[data-texture-prefetch]').forEach((l) => l.remove());
  });

  it('顯示外觀設定文案', () => {
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('外觀設定');
    expect(text).toContain('質地');
    expect(text).toContain('配色');
  });

  it('頁首標題登記為「設定」，頁面本身不渲染 h1', () => {
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();

    expect(TestBed.inject(HeaderTitleSlot).entry()?.value).toEqual({
      title: ZH_TW.settingsPage.title,
      breadcrumbs: [],
    });
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('h1')).toHaveLength(0);
  });

  it('顯示所有質地與目前質地的相容配色（不相容的隱藏）', () => {
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    const compatible = TestBed.inject(ThemeService).compatibleThemes().map((c) => c.id);

    for (const option of texture) {
      expect(text).toContain(option.label);
    }
    for (const option of COLOR_THEMES) {
      if (compatible.includes(option.id)) {
        expect(text).toContain(option.label);
      } else {
        expect(text).not.toContain(option.label);
      }
    }
    expect(compatible.length).toBeLessThan(COLOR_THEMES.length);
  });

  it('選擇配色與質地會更新 ThemeService 並標示目前選項', async () => {
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    const theme = TestBed.inject(ThemeService);
    const color = COLOR_THEMES.find((option) => option.id === 'midnight') ?? COLOR_THEMES[0];
    const paradigm = texture.find((option) => option.id !== theme.paradigm()) ?? texture[0];

    (fixture.nativeElement.querySelector(`[data-theme-id="${color.id}"]`) as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector(`[data-paradigm-id="${paradigm.id}"]`) as HTMLButtonElement).click();
    await loadTexture(paradigm.id);
    fixture.detectChanges();

    expect(theme.theme()).toBe(color.id);
    expect(theme.paradigm()).toBe(paradigm.id);
    expect(
      fixture.nativeElement.querySelector(`[data-theme-id="${color.id}"]`).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      fixture.nativeElement
        .querySelector(`[data-paradigm-id="${paradigm.id}"]`)
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('ADR 0007：選 Soft UI 後，配色列只顯示相容配色，Sandstone／Verdant 被隱藏', async () => {
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-paradigm-id="soft-ui"]') as HTMLButtonElement).click();
    await loadTexture('soft-ui');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-theme-id="sandstone"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-theme-id="verdant"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-theme-id="cool-grey"]')).not.toBeNull();
  });

  it('ADR 0007：從 Soft UI × Sandstone 的已存組合重新載入，變成 Soft UI 的預設配色', async () => {
    localStorage.setItem('app.paradigm', 'soft-ui');
    localStorage.setItem('app.theme', 'sandstone');

    const theme = TestBed.inject(ThemeService);
    const ready = theme.init();
    await loadTexture('soft-ui');
    await ready;
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();

    expect(theme.theme()).toBe('cool-grey');
    expect(
      fixture.nativeElement.querySelector('[data-theme-id="cool-grey"]').getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('ticket 03：顯示「顯示外觀浮動面板」開關，切換會更新 AppearancePanelService', () => {
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('顯示外觀浮動面板');

    const panel = TestBed.inject(AppearancePanelService);
    expect(panel.visible()).toBe(false);

    const toggle = fixture.nativeElement.querySelector('.appearance-panel-toggle mat-slide-toggle button') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    expect(panel.visible()).toBe(true);
  });

  it('ticket 03：AppearancePanelService 已是開啟狀態時，設定頁載入就顯示開關為開', () => {
    TestBed.inject(AppearancePanelService).setVisible(true);
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();

    const toggle = fixture.nativeElement.querySelector('.appearance-panel-toggle mat-slide-toggle button') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('「切換身分」小工具開關：切換會更新 IdentitySwitcherService，並存在 app.identitySwitcher', () => {
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('顯示「切換身分」小工具');
    const service = TestBed.inject(IdentitySwitcherService);
    expect(service.visible()).toBe(false);

    const toggle = fixture.nativeElement.querySelector('.identity-switcher-toggle mat-slide-toggle button') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    expect(service.visible()).toBe(true);
    expect(localStorage.getItem('app.identitySwitcher')).toBe('1');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });
});
