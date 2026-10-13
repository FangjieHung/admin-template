import { Injectable } from '@angular/core';
import { colorThemeStylesheetHref, isOnDemandColorTheme } from './theme.token';
import { OnDemandStylesheetKind, OnDemandStylesheetLoader, TEXTURE_BOOT_SCRIPT_ID } from './on-demand-stylesheet-loader';
import { TEXTURE_LINK_ATTR } from './texture-stylesheet-loader';

/** 開機腳本（apps/admin/src/index.html）與這個 loader 共用的標記：`<link data-color-css="<id>">`。 */
export const COLOR_LINK_ATTR = 'data-color-css';
/** 開機時配色樣式載入失敗，開機腳本會把失敗的 id 記在 `<html data-color-fallback>`，交給 ThemeService.init() 提示。 */
export const COLOR_FALLBACK_ATTR = 'data-color-fallback';

const COLOR_KIND: OnDemandStylesheetKind = {
  label: '配色',
  linkAttr: COLOR_LINK_ATTR,
  prefetchAttr: 'data-color-prefetch',
  isOnDemand: isOnDemandColorTheme,
  href: colorThemeStylesheetHref,
};

/**
 * ADR 0013：按需配色的樣式檔管理（`color-<id>.css`），比照 TextureStylesheetLoader。
 *
 * 插入位置：按需質地的 `<link>` 之後、主樣式之前（沒有質地 `<link>` 時接在開機腳本後面）。全部常駐的時候，
 * 主樣式裡配色排在質地之後；按需檔案維持「質地 → 配色」的順序，同權重的「質地 recipe」與「配色裡的元件覆寫」
 * （例如 `:root[data-theme='cool-grey'] .avatar`）勝負不變。配色規則改排到主樣式（Material 質地、component、
 * choice-controls）之前也不影響結果：配色只在 `:root[data-theme]`（0-2-0 以上）下定義，主樣式裡沒有同權重、
 * 同屬性的規則（ADR 0008：質地層與配色層不定義同一個變數），由計算樣式比對驗證（ADR 0013）。
 */
@Injectable({ providedIn: 'root' })
export class ColorStylesheetLoader extends OnDemandStylesheetLoader {
  protected readonly kind = COLOR_KIND;

  protected insertionPoint(): Element | null {
    const own = this.stylesheetLinks();
    if (own.length > 0) {
      return own[own.length - 1];
    }
    const textureLinks = this.doc.head.querySelectorAll(`link[rel="stylesheet"][${TEXTURE_LINK_ATTR}]`);
    if (textureLinks.length > 0) {
      return textureLinks[textureLinks.length - 1];
    }
    return this.doc.getElementById(TEXTURE_BOOT_SCRIPT_ID);
  }
}
