import { Injectable, InjectionToken, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  COLOR_THEMES,
  DEFAULT_PARADIGM,
  DEFAULT_THEME,
  PARADIGM_KEY,
  THEME_KEY,
  getDefaultThemeId,
  isOnDemandColorTheme,
  isOnDemandTexture,
  isThemeCompatible,
  resolveParadigmId,
  resolveThemeId,
  texture,
  type ThemeOption,
} from './theme.token';
import { TEXTURE_FALLBACK_ATTR, TextureStylesheetLoader } from './texture-stylesheet-loader';
import { COLOR_FALLBACK_ATTR, ColorStylesheetLoader } from './color-stylesheet-loader';

/** 按需質地載入失敗、退回常駐質地時給使用者看的訊息（ADR 0010）。 */
export const TEXTURE_FALLBACK_MESSAGE = '外觀載入失敗，暫時使用預設外觀';
/** 按需配色載入失敗、退回常駐配色時給使用者看的訊息（ADR 0013）。 */
export const COLOR_FALLBACK_MESSAGE = '配色載入失敗，暫時使用預設配色';

/**
 * 按需質地載入失敗時要怎麼告訴使用者。theme-pack 不依賴任何 app 的提示元件，由 app 自己提供
 * （admin 在 app.config.ts 用 libs/ui 的 ToastService 以警告提示顯示 TEXTURE_FALLBACK_MESSAGE，提示元件動態載入）。
 * 沒有提供時只做退回、不提示。
 */
export const TEXTURE_FALLBACK_NOTIFIER = new InjectionToken<(failedTextureId: string) => void>(
  'TEXTURE_FALLBACK_NOTIFIER',
);

/** 按需配色載入失敗時要怎麼告訴使用者（ADR 0013，比照 TEXTURE_FALLBACK_NOTIFIER；admin 顯示 COLOR_FALLBACK_MESSAGE）。 */
export const COLOR_FALLBACK_NOTIFIER = new InjectionToken<(failedThemeId: string) => void>('COLOR_FALLBACK_NOTIFIER');

/** 一次外觀切換的目標。`explicitTheme`：配色是使用者選的（不是因為不相容而被換成質地的預設配色）。 */
interface AppearanceRequest {
  readonly paradigm: string;
  readonly theme: string;
  readonly explicitTheme: boolean;
}

/** 兩個樣式檔都下載（或失敗）之後，實際要套用的組合。 */
interface AppearanceOutcome {
  readonly paradigm: string;
  readonly theme: string;
  readonly textureFailed: boolean;
  readonly colorFailed: boolean;
}

const succeeded = (p: Promise<void>): Promise<boolean> => p.then(
  () => true,
  () => false,
);

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private doc = inject(DOCUMENT);
  private textures = inject(TextureStylesheetLoader);
  private colors = inject(ColorStylesheetLoader);
  private textureNotifier = inject(TEXTURE_FALLBACK_NOTIFIER, { optional: true });
  private colorNotifier = inject(COLOR_FALLBACK_NOTIFIER, { optional: true });
  private injector = inject(Injector);
  // 每次切換（質地或配色）遞增；載入完成時若已經不是最新的請求（使用者又點了別的），就不套用。
  private switchSeq = 0;
  // 使用者在 setTheme 選了、還在下載的配色。下載期間又切質地時沿用它，而不是沿用舊配色。
  private explicitPendingTheme: string | null = null;

  readonly paradigm = signal(DEFAULT_PARADIGM);
  readonly theme = signal(DEFAULT_THEME);
  /** 已選、樣式還在下載、尚未套用的質地；沒有進行中的切換時是 null（ADR 0010：舊外觀維持到新樣式載入完成）。 */
  readonly pendingParadigm = signal<string | null>(null);
  /** 已選（或因質地切換而要換成）、樣式還在下載、尚未套用的配色；沒有時是 null（ADR 0013）。 */
  readonly pendingTheme = signal<string | null>(null);

  // ADR 0007：質地是主軸，配色只顯示目前質地的相容清單。ticket 03 的外觀浮動面板重用這個 computed，不重抄過濾邏輯。
  readonly compatibleThemes = computed<ThemeOption[]>(() => {
    const paradigmId = this.paradigm();
    return COLOR_THEMES.filter((c) => isThemeCompatible(paradigmId, c.id));
  });

  /**
   * App 啟動時呼叫（admin 的 provideAppInitializer 會等它完成才渲染畫面）。
   *
   * ADR 0010／0013：index.html 的開機腳本已經依 localStorage 設好 data-paradigm／data-theme，並以會擋住渲染的
   * `<link>` 載入按需質地與按需配色的樣式，所以這裡通常只是同步狀態、不會再下載。開機腳本載入失敗時，它已退回
   * 常駐質地／常駐配色並在 `<html data-texture-fallback>`／`<html data-color-fallback>` 留下失敗的 id，這裡負責提示。
   * 沒有開機腳本時（例如單元測試），或存的組合不相容、要換成質地的預設配色時，由這裡載入，載入完成前不渲染。
   */
  async init(): Promise<void> {
    const html = this.doc.documentElement;
    const bootTexture = html.getAttribute(TEXTURE_FALLBACK_ATTR);
    const bootColor = html.getAttribute(COLOR_FALLBACK_ATTR);
    html.removeAttribute(TEXTURE_FALLBACK_ATTR);
    html.removeAttribute(COLOR_FALLBACK_ATTR);

    // 已刪除或不認得的 id 一律退回預設值，並覆寫掉殘值；否則整頁會失去質地或配色樣式且沒有任何錯誤。
    const paradigmId = resolveParadigmId(localStorage.getItem(PARADIGM_KEY));
    // 載入時若已存的組合不相容，自動校正為該質地的預設配色（apply 會一併持久化）。
    const storedThemeId = resolveThemeId(localStorage.getItem(THEME_KEY));
    const themeId = isThemeCompatible(paradigmId, storedThemeId) ? storedThemeId : getDefaultThemeId(paradigmId);

    const request: AppearanceRequest = { paradigm: paradigmId, theme: themeId, explicitTheme: true };
    const outcome = this.resolveOutcome(request, ...(await this.load(request)));
    this.apply(outcome);

    const failedTexture = outcome.textureFailed ? paradigmId : bootTexture && isOnDemandTexture(bootTexture) ? bootTexture : null;
    const failedColor = outcome.colorFailed ? themeId : bootColor && isOnDemandColorTheme(bootColor) ? bootColor : null;
    if (failedTexture || failedColor) {
      // 啟動階段還沒有畫面可以掛提示，等第一次渲染後再提示。
      afterNextRender(
        () => {
          if (failedTexture) this.textureNotifier?.(failedTexture);
          if (failedColor) this.colorNotifier?.(failedColor);
        },
        { injector: this.injector },
      );
    }
  }

  /**
   * 切換質地。按需質地先下載樣式，下載完成才一次切換 data-paradigm（期間維持舊外觀），再移除舊質地的樣式；
   * 下載失敗時退回常駐質地、校正 localStorage 與 dataset，並提示使用者。
   * 目前配色若不相容新質地，改用該質地的預設配色：兩個樣式檔都下載完才一起套用（ADR 0013）。
   */
  setParadigm(requestedId: string): Promise<void> {
    const id = resolveParadigmId(requestedId);
    const wanted = this.explicitPendingTheme ?? this.theme();
    const keep = isThemeCompatible(id, wanted);
    return this.switchTo({ paradigm: id, theme: keep ? wanted : getDefaultThemeId(id), explicitTheme: keep });
  }

  /**
   * 切換配色（ADR 0013）。按需配色先下載樣式，下載完成才切換 data-theme（期間維持舊配色），再移除舊配色的樣式；
   * 下載失敗時退回常駐配色、校正 localStorage 與 dataset，並提示使用者。不檢查相容性（選單只列相容配色）。
   */
  setTheme(requestedId: string): Promise<void> {
    const id = resolveThemeId(requestedId);
    return this.switchTo({ paradigm: this.pendingParadigm() ?? this.paradigm(), theme: id, explicitTheme: true });
  }

  /** 外觀面板打開時呼叫：背景預先下載所有按需質地的樣式，之後切換時不用等網路。 */
  prefetchTextures(): void {
    this.textures.prefetch(texture.map((t) => t.id));
  }

  /** 外觀面板打開時呼叫：背景預先下載所有按需配色的樣式（ADR 0013）。 */
  prefetchColors(): void {
    this.colors.prefetch(COLOR_THEMES.map((c) => c.id));
  }

  private async switchTo(request: AppearanceRequest): Promise<void> {
    const seq = ++this.switchSeq;
    if (request.paradigm === this.paradigm() && request.theme === this.theme()) {
      // 點回目前的外觀：取消進行中的切換（下載完成的樣式由那個請求自己清掉）。
      this.clearPending();
      return;
    }
    this.pendingParadigm.set(request.paradigm !== this.paradigm() ? request.paradigm : null);
    this.pendingTheme.set(request.theme !== this.theme() ? request.theme : null);
    this.explicitPendingTheme = request.explicitTheme && request.theme !== this.theme() ? request.theme : null;

    const [textureLoaded, colorLoaded] = await this.load(request);

    if (seq !== this.switchSeq) {
      // 已被之後的請求取代：沒套用的樣式不留在頁面上（除非它正是目前或最新請求要用的）。
      if (request.paradigm !== this.paradigm() && request.paradigm !== this.pendingParadigm()) {
        this.textures.remove(request.paradigm);
      }
      if (request.theme !== this.theme() && request.theme !== this.pendingTheme()) {
        this.colors.remove(request.theme);
      }
      return;
    }
    this.clearPending();

    const outcome = this.resolveOutcome(request, textureLoaded, colorLoaded);
    this.apply(outcome);
    if (outcome.textureFailed) {
      this.textureNotifier?.(request.paradigm);
    }
    if (outcome.colorFailed) {
      this.colorNotifier?.(request.theme);
    }
  }

  /** 兩個樣式檔同時下載；回傳各自是否成功（常駐的 id 立即成功）。 */
  private load(request: AppearanceRequest): Promise<[boolean, boolean]> {
    return Promise.all([
      succeeded(this.textures.ensure(request.paradigm)),
      succeeded(this.colors.ensure(request.theme)),
    ]);
  }

  /**
   * 決定實際套用的組合。質地失敗 → 常駐質地；配色沿用使用者選的（或切換前的）配色，不相容常駐質地就用它的預設配色
   * （常駐配色）。配色失敗 → 常駐配色（即使它不在目前質地的相容清單內：常駐配色是唯一保證有樣式的配色）。
   */
  private resolveOutcome(request: AppearanceRequest, textureLoaded: boolean, colorLoaded: boolean): AppearanceOutcome {
    if (textureLoaded) {
      return {
        paradigm: request.paradigm,
        theme: colorLoaded ? request.theme : DEFAULT_THEME,
        textureFailed: false,
        colorFailed: !colorLoaded,
      };
    }
    // 配色是因為不相容才被換掉的：質地沒換成，就回到切換前的配色（它一定已經載入）。
    const colorFailed = request.explicitTheme && !colorLoaded;
    const base = !request.explicitTheme ? this.theme() : colorLoaded ? request.theme : DEFAULT_THEME;
    return {
      paradigm: DEFAULT_PARADIGM,
      theme: isThemeCompatible(DEFAULT_PARADIGM, base) ? base : getDefaultThemeId(DEFAULT_PARADIGM),
      textureFailed: true,
      colorFailed,
    };
  }

  /** 一次寫入 signal、dataset 與 localStorage，再拿掉不再使用的樣式檔（新樣式已套用，畫面不會有一瞬間沒有樣式）。 */
  private apply(outcome: AppearanceOutcome): void {
    this.paradigm.set(outcome.paradigm);
    this.theme.set(outcome.theme);
    const html = this.doc.documentElement;
    html.dataset['paradigm'] = outcome.paradigm;
    html.dataset['theme'] = outcome.theme;
    localStorage.setItem(PARADIGM_KEY, outcome.paradigm);
    localStorage.setItem(THEME_KEY, outcome.theme);
    this.textures.retainOnly(outcome.paradigm);
    this.colors.retainOnly(outcome.theme);
  }

  private clearPending(): void {
    this.pendingParadigm.set(null);
    this.pendingTheme.set(null);
    this.explicitPendingTheme = null;
  }
}
