import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { COLOR_THEMES, texture } from '../theme/theme.token';
import { ThemeService } from '../theme/theme.service';
import { AppearancePanelService } from '../theme/appearance-panel.service';
import { FloatingAppearancePanelComponent } from './floating-appearance-panel.component';

describe('FloatingAppearancePanelComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [FloatingAppearancePanelComponent] });
  });

  function create() {
    const fixture = TestBed.createComponent(FloatingAppearancePanelComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('AppearancePanelService.visible 為 false 時，任何頁面都不渲染按鈕', () => {
    const fixture = create();
    expect((fixture.nativeElement as HTMLElement).querySelector('.appearance-fab')).toBeNull();
  });

  it('AppearancePanelService.visible 為 true 時渲染按鈕；點擊開啟面板，質地與配色選項都在', () => {
    TestBed.inject(AppearancePanelService).setVisible(true);
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector('.appearance-fab') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-controls')).toBe('appearance-floating-panel');

    btn.click();
    fixture.detectChanges();

    expect(btn.getAttribute('aria-expanded')).toBe('true');
    const panel = el.querySelector('#appearance-floating-panel');
    expect(panel).not.toBeNull();
    for (const option of [...texture, ...COLOR_THEMES]) {
      expect(panel?.textContent).toContain(option.label);
    }
  });

  it('點選質地／配色會更新 ThemeService 並標示 aria-pressed', () => {
    TestBed.inject(AppearancePanelService).setVisible(true);
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.appearance-fab') as HTMLButtonElement).click();
    fixture.detectChanges();

    const theme = TestBed.inject(ThemeService);
    (el.querySelector('[data-theme-id="midnight"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(theme.theme()).toBe('midnight');
    expect(el.querySelector('[data-theme-id="midnight"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('ADR 0007：切到 Soft UI 後配色列只顯示相容配色（跟設定頁一致，重用 ThemeService.compatibleThemes）', () => {
    TestBed.inject(AppearancePanelService).setVisible(true);
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.appearance-fab') as HTMLButtonElement).click();
    fixture.detectChanges();

    (el.querySelector('[data-paradigm-id="soft-ui"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('[data-theme-id="sandstone"]')).toBeNull();
    expect(el.querySelector('[data-theme-id="cool-grey"]')).not.toBeNull();
  });

  it('Esc 關閉面板並把焦點還給觸發按鈕', () => {
    TestBed.inject(AppearancePanelService).setVisible(true);
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector('.appearance-fab') as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();

    const panel = el.querySelector('#appearance-floating-panel') as HTMLElement;
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(el.querySelector('#appearance-floating-panel')).toBeNull();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(btn);
  });

  it('方向鍵在選項之間移動焦點', () => {
    TestBed.inject(AppearancePanelService).setVisible(true);
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.appearance-fab') as HTMLButtonElement).click();
    fixture.detectChanges();

    const panel = el.querySelector('#appearance-floating-panel') as HTMLElement;
    const options = Array.from(panel.querySelectorAll<HTMLButtonElement>('button.theme-pill'));
    options[0].focus();
    expect(document.activeElement).toBe(options[0]);

    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(options[1]);

    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(options[0]);
  });

  it('點面板與按鈕以外的地方會關閉面板', () => {
    TestBed.inject(AppearancePanelService).setVisible(true);
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.appearance-fab') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('#appearance-floating-panel')).not.toBeNull();

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(el.querySelector('#appearance-floating-panel')).toBeNull();
  });
});
