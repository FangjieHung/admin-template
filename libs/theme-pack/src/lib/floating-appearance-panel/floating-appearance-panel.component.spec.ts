import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { COLOR_THEMES, DEFAULT_PARADIGM, DEFAULT_THEME, isThemeCompatible, texture } from '../theme/theme.token';
import { ThemeService } from '../theme/theme.service';
import { AppearancePanelService } from '../theme/appearance-panel.service';
import { FloatingAppearancePanelComponent } from './floating-appearance-panel.component';
import { POSITION_STORAGE_KEY } from './floating-appearance-panel.position';

// jsdom 不會下載樣式表：手動送出按需質地／按需配色 <link> 的 load 事件（ADR 0010、0013），再等切換的 promise 跑完。
async function loadPendingStyles(): Promise<void> {
  document.head
    .querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][data-texture-css], link[rel="stylesheet"][data-color-css]')
    .forEach((l) => l.dataset['state'] !== 'loaded' && l.dispatchEvent(new Event('load')));
  await new Promise((resolve) => setTimeout(resolve));
}

describe('FloatingAppearancePanelComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [FloatingAppearancePanelComponent] });
  });

  afterEach(() => {
    document.head
      .querySelectorAll('link[data-texture-css], link[data-texture-prefetch], link[data-color-css], link[data-color-prefetch]')
      .forEach((l) => l.remove());
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

  it('AppearancePanelService.visible 為 true 時渲染按鈕；點擊開啟面板，列出全部質地與目前質地的相容配色', () => {
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
    for (const option of texture) {
      expect(panel?.textContent).toContain(option.label);
    }
    for (const option of COLOR_THEMES) {
      if (isThemeCompatible(DEFAULT_PARADIGM, option.id)) {
        expect(panel?.textContent).toContain(option.label);
      } else {
        expect(panel?.textContent).not.toContain(option.label);
      }
    }
  });

  it('點選質地／配色會更新 ThemeService 並標示 aria-pressed', async () => {
    TestBed.inject(AppearancePanelService).setVisible(true);
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.appearance-fab') as HTMLButtonElement).click();
    fixture.detectChanges();

    const theme = TestBed.inject(ThemeService);
    (el.querySelector('[data-theme-id="midnight"]') as HTMLButtonElement).click();
    // ADR 0013：配色樣式載入完成前維持舊配色。
    expect(theme.theme()).toBe('verdant');
    await loadPendingStyles();
    fixture.detectChanges();

    expect(theme.theme()).toBe('midnight');
    expect(el.querySelector('[data-theme-id="midnight"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('ADR 0010／0013：打開面板就在背景預先下載所有按需質地與按需配色的樣式', () => {
    TestBed.inject(AppearancePanelService).setVisible(true);
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    expect(document.head.querySelector('link[rel="prefetch"]')).toBeNull();

    (el.querySelector('.appearance-fab') as HTMLButtonElement).click();
    fixture.detectChanges();

    const prefetched = Array.from(
      document.head.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"][data-texture-prefetch]'),
    ).map((l) => l.dataset['texturePrefetch']);
    expect(prefetched).toEqual(texture.map((t) => t.id).filter((id) => id !== DEFAULT_PARADIGM));
    const colors = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"][data-color-prefetch]')).map(
      (l) => l.dataset['colorPrefetch'],
    );
    expect(colors).toEqual(COLOR_THEMES.map((c) => c.id).filter((id) => id !== DEFAULT_THEME));
  });

  it('ADR 0007：切到 Soft UI 後配色列只顯示相容配色（跟設定頁一致，重用 ThemeService.compatibleThemes）', async () => {
    TestBed.inject(AppearancePanelService).setVisible(true);
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.appearance-fab') as HTMLButtonElement).click();
    fixture.detectChanges();

    (el.querySelector('[data-paradigm-id="soft-ui"]') as HTMLButtonElement).click();
    // ADR 0010：樣式載入完成前維持舊質地。
    expect(TestBed.inject(ThemeService).paradigm()).toBe(DEFAULT_PARADIGM);
    await loadPendingStyles();
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

  describe('位置：拖曳／鍵盤移動的持久化與夾回', () => {
    it('沒有存過位置時，預設位移量是 {0,0}（原生右下角 16px 內縮）', () => {
      TestBed.inject(AppearancePanelService).setVisible(true);
      const fixture = create();
      expect((fixture.componentInstance as unknown as { offset: () => { x: number; y: number } }).offset()).toEqual(
        { x: 0, y: 0 },
      );
    });

    it('localStorage 存過合法位置時，初始化直接套用', () => {
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify({ x: -100, y: -50 }));
      TestBed.inject(AppearancePanelService).setVisible(true);
      const fixture = create();
      expect((fixture.componentInstance as unknown as { offset: () => { x: number; y: number } }).offset()).toEqual(
        { x: -100, y: -50 },
      );
    });

    it('localStorage 存的位置在目前視窗外，初始化時會被夾回視窗內', () => {
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify({ x: -999999, y: 0 }));
      TestBed.inject(AppearancePanelService).setVisible(true);
      const fixture = create();
      const offset = (fixture.componentInstance as unknown as { offset: () => { x: number; y: number } }).offset();
      const left = window.innerWidth - 16 - 44 + offset.x;
      expect(left).toBeGreaterThanOrEqual(0);
    });

    it('localStorage 存壞掉的 JSON，當作沒存過，退回預設位置', () => {
      localStorage.setItem(POSITION_STORAGE_KEY, '{not json');
      TestBed.inject(AppearancePanelService).setVisible(true);
      const fixture = create();
      expect((fixture.componentInstance as unknown as { offset: () => { x: number; y: number } }).offset()).toEqual(
        { x: 0, y: 0 },
      );
    });

    it('觸發按鈕聚焦時 Alt+方向鍵移動 16px 一步，並存進 localStorage', () => {
      TestBed.inject(AppearancePanelService).setVisible(true);
      const fixture = create();
      const el = fixture.nativeElement as HTMLElement;
      const btn = el.querySelector('.appearance-fab') as HTMLButtonElement;

      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
      fixture.detectChanges();

      const offset = (fixture.componentInstance as unknown as { offset: () => { x: number; y: number } }).offset();
      expect(offset).toEqual({ x: 16, y: 0 });
      expect(JSON.parse(localStorage.getItem(POSITION_STORAGE_KEY) ?? '{}')).toEqual({ x: 16, y: 0 });
    });

    it('Shift+方向鍵也能移動（不只 Alt）', () => {
      TestBed.inject(AppearancePanelService).setVisible(true);
      const fixture = create();
      const btn = (fixture.nativeElement as HTMLElement).querySelector('.appearance-fab') as HTMLButtonElement;

      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true }));
      fixture.detectChanges();

      expect((fixture.componentInstance as unknown as { offset: () => { x: number; y: number } }).offset()).toEqual({
        x: 0,
        y: -16,
      });
    });

    it('沒按 Alt／Shift 的方向鍵不會移動按鈕（留給瀏覽器/其他行為）', () => {
      TestBed.inject(AppearancePanelService).setVisible(true);
      const fixture = create();
      const btn = (fixture.nativeElement as HTMLElement).querySelector('.appearance-fab') as HTMLButtonElement;

      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      fixture.detectChanges();

      expect((fixture.componentInstance as unknown as { offset: () => { x: number; y: number } }).offset()).toEqual({
        x: 0,
        y: 0,
      });
    });

    it('面板裡的「重設位置」清掉自訂位置，回到預設值', () => {
      TestBed.inject(AppearancePanelService).setVisible(true);
      const fixture = create();
      const el = fixture.nativeElement as HTMLElement;
      const btn = el.querySelector('.appearance-fab') as HTMLButtonElement;

      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
      fixture.detectChanges();
      expect(localStorage.getItem(POSITION_STORAGE_KEY)).not.toBeNull();

      btn.click();
      fixture.detectChanges();
      const resetBtn = el.querySelector('.reset-position-btn') as HTMLButtonElement;
      expect(resetBtn).not.toBeNull();
      resetBtn.click();
      fixture.detectChanges();

      expect(localStorage.getItem(POSITION_STORAGE_KEY)).toBeNull();
      expect((fixture.componentInstance as unknown as { offset: () => { x: number; y: number } }).offset()).toEqual({
        x: 0,
        y: 0,
      });
    });
  });
});
