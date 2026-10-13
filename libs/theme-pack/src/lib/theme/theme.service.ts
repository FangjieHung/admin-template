import { Injectable, InjectionToken, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  COLOR_THEMES,
  DEFAULT_PARADIGM,
  DEFAULT_THEME,
  PARADIGM_KEY,
  THEME_KEY,
  getDefaultThemeId,
  isOnDemandTexture,
  isThemeCompatible,
  resolveParadigmId,
  texture,
  type ThemeOption,
} from './theme.token';
import { TEXTURE_FALLBACK_ATTR, TextureStylesheetLoader } from './texture-stylesheet-loader';

/** 按需質地載入失敗、退回常駐質地時給使用者看的訊息（ADR 0010）。 */
export const TEXTURE_FALLBACK_MESSAGE = '外觀載入失敗，暫時使用預設外觀';

/**
 * 按需質地載入失敗時要怎麼告訴使用者。theme-pack 不依賴任何 app 的提示元件，由 app 自己提供
 * （admin 在 app.config.ts 用 MatSnackBar 顯示 TEXTURE_FALLBACK_MESSAGE）。沒有提供時只做退回、不提示。
 */
export const TEXTURE_FALLBACK_NOTIFIER = new InjectionToken<(failedTextureId: string) => void>(
  'TEXTURE_FALLBACK_NOTIFIER',
);

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private doc = inject(DOCUMENT);
  private loader = inject(TextureStylesheetLoader);
  private notifier = inject(TEXTURE_FALLBACK_NOTIFIER, { optional: true });
  private injector = inject(Injector);
  // 每次 setParadigm 遞增；載入完成時若已經不是最新的請求（使用者又點了別的質地），就不套用。
  private switchSeq = 0;

  readonly paradigm = signal(DEFAULT_PARADIGM);
  readonly theme = signal(DEFAULT_THEME);
  /** 已選、樣式還在下載、尚未套用的質地；沒有進行中的切換時是 null（ADR 0010：舊外觀維持到新樣式載入完成）。 */
  readonly pendingParadigm = signal<string | null>(null);

  // ADR 0007：質地是主軸，配色只顯示目前質地的相容清單。ticket 03 的外觀浮動面板重用這個 computed，不重抄過濾邏輯。
  readonly compatibleThemes = computed<ThemeOption[]>(() => {
    const paradigmId = this.paradigm();
    return COLOR_THEMES.filter((c) => isThemeCompatible(paradigmId, c.id));
  });

  /**
   * App 啟動時呼叫（admin 的 provideAppInitializer 會等它完成才渲染畫面）。
   *
   * ADR 0010：index.html 的開機腳本已經依 localStorage 設好 data-paradigm／data-theme，並以會擋住渲染的
   * `<link>` 載入按需質地的樣式，所以這裡通常只是同步狀態、不會再下載。開機腳本載入失敗時，它已退回
   * Material 並在 `<html data-texture-fallback>` 留下失敗的 id，這裡負責提示。沒有開機腳本時（例如單元測試）
   * 由這裡載入，載入完成前不渲染。
   */
  async init(): Promise<void> {
    const html = this.doc.documentElement;
    const bootFailedId = html.getAttribute(TEXTURE_FALLBACK_ATTR);
    html.removeAttribute(TEXTURE_FALLBACK_ATTR);
    let failedId = bootFailedId && isOnDemandTexture(bootFailedId) ? bootFailedId : null;

    // 已刪除或不認得的質地 id 一律退回預設質地，並覆寫掉殘值；否則整頁會失去質地樣式且沒有任何錯誤。
    let paradigmId = resolveParadigmId(localStorage.getItem(PARADIGM_KEY));
    try {
      await this.loader.ensure(paradigmId);
    } catch {
      failedId = paradigmId;
      paradigmId = DEFAULT_PARADIGM;
    }
    this.applyParadigm(paradigmId);

    // 載入時若已存的組合不相容，自動校正為該質地的預設配色（setTheme 會一併持久化）。
    const storedThemeId = localStorage.getItem(THEME_KEY) ?? DEFAULT_THEME;
    const themeId = isThemeCompatible(paradigmId, storedThemeId)
      ? storedThemeId
      : getDefaultThemeId(paradigmId);
    this.setTheme(themeId);

    if (failedId) {
      // 啟動階段還沒有畫面可以掛提示，等第一次渲染後再提示。
      afterNextRender(() => this.notifyFallback(failedId as string), { injector: this.injector });
    }
  }

  /**
   * 切換質地。按需質地先下載樣式，下載完成才一次切換 data-paradigm（期間維持舊外觀），再移除舊質地的樣式；
   * 下載失敗時退回常駐質地、校正 localStorage 與 dataset，並提示使用者。
   */
  async setParadigm(requestedId: string): Promise<void> {
    const id = resolveParadigmId(requestedId);
    const seq = ++this.switchSeq;
    if (id === this.paradigm()) {
      this.pendingParadigm.set(null);
      return;
    }
    this.pendingParadigm.set(id);

    let loaded = true;
    try {
      await this.loader.ensure(id);
    } catch {
      loaded = false;
    }

    if (seq !== this.switchSeq) {
      // 已被之後的請求取代：沒套用的樣式不留在頁面上（除非它正是目前或最新請求的質地）。
      if (loaded && id !== this.paradigm() && id !== this.pendingParadigm()) {
        this.loader.remove(id);
      }
      return;
    }
    this.pendingParadigm.set(null);

    const previous = this.paradigm();
    const next = loaded ? id : DEFAULT_PARADIGM;
    this.applyParadigm(next);
    // 切換質地時，若目前配色不相容新質地，改用該質地的預設配色。
    if (!isThemeCompatible(next, this.theme())) {
      this.setTheme(getDefaultThemeId(next));
    }
    if (previous !== next) {
      // 新質地已經套用之後才拿掉舊的，畫面不會有一瞬間沒有質地樣式。
      this.loader.remove(previous);
    }
    if (!loaded) {
      this.notifyFallback(id);
    }
  }

  setTheme(id: string): void {
    this.theme.set(id);
    this.doc.documentElement.dataset['theme'] = id;
    localStorage.setItem(THEME_KEY, id);
  }

  /** 外觀面板打開時呼叫：背景預先下載所有按需質地的樣式，之後切換時不用等網路。 */
  prefetchTextures(): void {
    this.loader.prefetch(texture.map((t) => t.id));
  }

  private applyParadigm(id: string): void {
    this.paradigm.set(id);
    this.doc.documentElement.dataset['paradigm'] = id;
    localStorage.setItem(PARADIGM_KEY, id);
  }

  private notifyFallback(failedId: string): void {
    this.notifier?.(failedId);
  }
}
