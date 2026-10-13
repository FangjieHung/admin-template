import { Injectable } from '@angular/core';
import { isOnDemandTexture, textureStylesheetHref } from './theme.token';
import { OnDemandStylesheetKind, OnDemandStylesheetLoader, TEXTURE_BOOT_SCRIPT_ID } from './on-demand-stylesheet-loader';

export { TEXTURE_BOOT_SCRIPT_ID } from './on-demand-stylesheet-loader';

/** 開機腳本（apps/admin/src/index.html）與這個 loader 共用的標記：`<link data-texture-css="<id>">`。 */
export const TEXTURE_LINK_ATTR = 'data-texture-css';
/** 開機時質地樣式載入失敗，開機腳本會把失敗的 id 記在 `<html data-texture-fallback>`，交給 ThemeService.init() 提示。 */
export const TEXTURE_FALLBACK_ATTR = 'data-texture-fallback';

const TEXTURE_KIND: OnDemandStylesheetKind = {
  label: '質地',
  linkAttr: TEXTURE_LINK_ATTR,
  prefetchAttr: 'data-texture-prefetch',
  isOnDemand: isOnDemandTexture,
  href: textureStylesheetHref,
};

/**
 * ADR 0010：按需質地的樣式檔管理（`texture-<id>.css`）。
 *
 * 插入位置固定在主樣式之前（開機腳本後面、按需配色之前）：舊版所有質地都編在主樣式裡、排在配色／component／
 * 組合層之前，也排在執行期才插入的元件樣式（Angular 的 `<style>`）之前。放在同一個位置，同權重規則的勝負就跟
 * 以前一樣；若改成 append 到 `<head>` 最後，會排到已存在的元件樣式後面，同權重時反過來蓋掉元件樣式。
 */
@Injectable({ providedIn: 'root' })
export class TextureStylesheetLoader extends OnDemandStylesheetLoader {
  protected readonly kind = TEXTURE_KIND;

  protected insertionPoint(): Element | null {
    const links = this.stylesheetLinks();
    if (links.length > 0) {
      return links[links.length - 1];
    }
    return this.doc.getElementById(TEXTURE_BOOT_SCRIPT_ID);
  }
}
