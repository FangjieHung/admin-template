import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { isOnDemandTexture, textureStylesheetHref } from './theme.token';

/** 開機腳本（apps/admin/src/index.html）與這個 loader 共用的標記：`<link data-texture-css="<id>">`。 */
export const TEXTURE_LINK_ATTR = 'data-texture-css';
/** 開機腳本的 `<script id>`；執行期插入的質地 `<link>` 一律排在它後面（主樣式之前），見 insertionPoint()。 */
export const TEXTURE_BOOT_SCRIPT_ID = 'app-texture-boot';
/** 開機時質地樣式載入失敗，開機腳本會把失敗的 id 記在 `<html data-texture-fallback>`，交給 ThemeService.init() 提示。 */
export const TEXTURE_FALLBACK_ATTR = 'data-texture-fallback';

/**
 * ADR 0010：按需質地的樣式檔管理。只碰 `<head>` 裡的 `<link>`，不碰 `data-paradigm`——
 * 何時切換由 ThemeService 決定（舊外觀維持到新樣式載入完成）。
 *
 * 插入位置固定在主樣式之前（開機腳本後面）：舊版所有質地都編在主樣式裡、排在配色／component／組合層之前，
 * 也排在執行期才插入的元件樣式（Angular 的 `<style>`）之前。放在同一個位置，同權重規則的勝負就跟以前一樣；
 * 若改成 append 到 `<head>` 最後，會排到已存在的元件樣式後面，同權重時反過來蓋掉元件樣式。
 */
@Injectable({ providedIn: 'root' })
export class TextureStylesheetLoader {
  private readonly doc = inject(DOCUMENT);
  private readonly pending = new Map<string, Promise<void>>();

  /** 確保質地的樣式已套用：常駐質地立即完成；按需質地等 `<link>` 的 load，失敗（error）時移除該 `<link>` 並 reject。 */
  ensure(id: string): Promise<void> {
    if (!isOnDemandTexture(id)) {
      return Promise.resolve();
    }
    const existing = this.findLink(id);
    if (existing && this.isLoaded(existing)) {
      return Promise.resolve();
    }
    const inFlight = this.pending.get(id);
    if (inFlight) {
      return inFlight;
    }
    const link = existing ?? this.createLink(id);
    const promise = new Promise<void>((resolve, reject) => {
      link.addEventListener(
        'load',
        () => {
          link.dataset['state'] = 'loaded';
          this.pending.delete(id);
          resolve();
        },
        { once: true },
      );
      link.addEventListener(
        'error',
        () => {
          link.remove();
          this.pending.delete(id);
          reject(new Error(`無法載入質地樣式 ${textureStylesheetHref(id)}`));
        },
        { once: true },
      );
    });
    this.pending.set(id, promise);
    if (!existing) {
      this.insert(link);
    }
    return promise;
  }

  /** 移除某個質地的 `<link>`（切走之後呼叫；clay 的 body 光暈與 keyframes 不再留在頁面上）。 */
  remove(id: string): void {
    if (!isOnDemandTexture(id)) {
      return;
    }
    this.findLink(id)?.remove();
    this.pending.delete(id);
  }

  /**
   * 外觀面板打開時，背景預先下載所有尚未載入的按需質地（`<link rel="prefetch">`，低優先、不套用樣式）。
   * 之後真的切換時，`<link rel="stylesheet">` 會直接用到 HTTP 快取。每個 id 只放一次。
   */
  prefetch(ids: readonly string[]): void {
    const head = this.doc.head;
    for (const id of ids) {
      if (!isOnDemandTexture(id) || this.findLink(id)) {
        continue;
      }
      const href = textureStylesheetHref(id);
      if (head.querySelector(`link[rel="prefetch"][data-texture-prefetch="${id}"]`)) {
        continue;
      }
      const link = this.doc.createElement('link');
      link.rel = 'prefetch';
      link.setAttribute('as', 'style');
      link.href = href;
      link.dataset['texturePrefetch'] = id;
      head.appendChild(link);
    }
  }

  private findLink(id: string): HTMLLinkElement | null {
    return this.doc.head.querySelector<HTMLLinkElement>(`link[rel="stylesheet"][${TEXTURE_LINK_ATTR}="${id}"]`);
  }

  // 開機腳本寫入的 `<link>` 在 Angular 啟動前就已載入完（它會擋住 module script 執行），
  // 但 load 事件可能早於我們掛 listener，所以同時看 `sheet`（同源樣式表載入後才有）與 data-state。
  private isLoaded(link: HTMLLinkElement): boolean {
    return link.dataset['state'] === 'loaded' || link.sheet !== null;
  }

  private createLink(id: string): HTMLLinkElement {
    const link = this.doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = textureStylesheetHref(id);
    link.setAttribute(TEXTURE_LINK_ATTR, id);
    return link;
  }

  private insert(link: HTMLLinkElement): void {
    const head = this.doc.head;
    const anchor = this.insertionPoint();
    if (anchor) {
      anchor.after(link);
    } else {
      // 沒有開機腳本（例如單元測試）：排在第一個樣式表之前，找不到就放最後。
      const firstStyle = head.querySelector('link[rel="stylesheet"], style');
      head.insertBefore(link, firstStyle);
    }
  }

  private insertionPoint(): Element | null {
    const links = this.doc.head.querySelectorAll(`link[${TEXTURE_LINK_ATTR}]`);
    if (links.length > 0) {
      return links[links.length - 1];
    }
    return this.doc.getElementById(TEXTURE_BOOT_SCRIPT_ID);
  }
}
