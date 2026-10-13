import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** 開機腳本的 `<script id>`；執行期插入的按需樣式 `<link>` 一律排在它後面（主樣式之前），見各 loader 的 insertionPoint()。 */
export const TEXTURE_BOOT_SCRIPT_ID = 'app-texture-boot';

/** 一種按需樣式（質地、配色）的登錄方式：`<link>` 上的標記、網址、哪些 id 要按需下載。 */
export interface OnDemandStylesheetKind {
  /** 錯誤訊息裡的名稱（「質地」「配色」）。 */
  readonly label: string;
  /** `<link rel="stylesheet">` 上記錄 id 的屬性，開機腳本也用同一個（例如 `data-texture-css`）。 */
  readonly linkAttr: string;
  /** `<link rel="prefetch">` 上記錄 id 的屬性（例如 `data-texture-prefetch`）。 */
  readonly prefetchAttr: string;
  isOnDemand(id: string): boolean;
  href(id: string): string;
}

/**
 * ADR 0010／0013：按需樣式檔（`texture-<id>.css`、`color-<id>.css`）的管理。只碰 `<head>` 裡的 `<link>`，
 * 不碰 `data-paradigm`／`data-theme`——何時切換由 ThemeService 決定（舊外觀維持到新樣式載入完成）。
 * 插入位置由子類別決定（insertionPoint），讓層疊順序跟「全部編在主樣式裡」的時候一樣。
 */
@Injectable()
export abstract class OnDemandStylesheetLoader {
  protected readonly doc = inject(DOCUMENT);
  protected abstract readonly kind: OnDemandStylesheetKind;
  private readonly pending = new Map<string, { promise: Promise<void>; cancel: () => void }>();

  /**
   * 確保樣式已套用：常駐（或不認得）的 id 立即完成；按需的 id 等 `<link>` 的 load，失敗（error）時移除該 `<link>`
   * 並 reject。下載中被 remove() 拿掉時也會 reject，等待它的切換不會永遠卡住。
   */
  ensure(id: string): Promise<void> {
    if (!this.kind.isOnDemand(id)) {
      return Promise.resolve();
    }
    const existing = this.findLink(id);
    if (existing && this.isLoaded(existing)) {
      return Promise.resolve();
    }
    const inFlight = this.pending.get(id);
    if (inFlight) {
      return inFlight.promise;
    }
    const link = existing ?? this.createLink(id);
    let cancel = (): void => undefined;
    const promise = new Promise<void>((resolve, reject) => {
      const onLoad = (): void => {
        link.removeEventListener('error', onError);
        link.dataset['state'] = 'loaded';
        this.pending.delete(id);
        resolve();
      };
      const onError = (): void => {
        link.removeEventListener('load', onLoad);
        link.remove();
        this.pending.delete(id);
        reject(new Error(`無法載入${this.kind.label}樣式 ${this.kind.href(id)}`));
      };
      cancel = () => {
        link.removeEventListener('load', onLoad);
        link.removeEventListener('error', onError);
        reject(new Error(`已取消載入${this.kind.label}樣式 ${this.kind.href(id)}`));
      };
      link.addEventListener('load', onLoad, { once: true });
      link.addEventListener('error', onError, { once: true });
    });
    // 被取代的切換可能沒有人等這個 promise（例如下載中就被 retainOnly 取消），不要變成 unhandled rejection；
    // 有 await 的呼叫端照樣會收到 reject。
    promise.catch(() => undefined);
    this.pending.set(id, { promise, cancel });
    if (!existing) {
      this.insert(link);
    }
    return promise;
  }

  /** 移除某個 id 的 `<link>`（切走之後呼叫；不再套用的樣式不留在頁面上）。常駐的 id 不受影響。 */
  remove(id: string): void {
    if (!this.kind.isOnDemand(id)) {
      return;
    }
    this.findLink(id)?.remove();
    this.cancelPending(id);
  }

  /** 只留下某個 id 的 `<link>`，其他這一類的 `<link rel="stylesheet">` 全部移除（套用新外觀之後呼叫）。 */
  retainOnly(id: string): void {
    for (const link of Array.from(this.stylesheetLinks())) {
      const linkId = link.getAttribute(this.kind.linkAttr) ?? '';
      if (linkId !== id) {
        link.remove();
        this.cancelPending(linkId);
      }
    }
  }

  /**
   * 外觀面板打開時，背景預先下載所有尚未載入的按需樣式（`<link rel="prefetch">`，低優先、不套用樣式）。
   * 之後真的切換時，`<link rel="stylesheet">` 會直接用到 HTTP 快取。每個 id 只放一次。
   */
  prefetch(ids: readonly string[]): void {
    const head = this.doc.head;
    for (const id of ids) {
      if (!this.kind.isOnDemand(id) || this.findLink(id)) {
        continue;
      }
      if (head.querySelector(`link[rel="prefetch"][${this.kind.prefetchAttr}="${id}"]`)) {
        continue;
      }
      const link = this.doc.createElement('link');
      link.rel = 'prefetch';
      link.setAttribute('as', 'style');
      link.href = this.kind.href(id);
      link.setAttribute(this.kind.prefetchAttr, id);
      head.appendChild(link);
    }
  }

  /** 這一類樣式目前在 `<head>` 裡的所有 `<link rel="stylesheet">`（依文件順序）。 */
  protected stylesheetLinks(): NodeListOf<HTMLLinkElement> {
    return this.doc.head.querySelectorAll<HTMLLinkElement>(`link[rel="stylesheet"][${this.kind.linkAttr}]`);
  }

  /** 新的 `<link>` 要接在哪個元素後面；null 表示沒有開機腳本（例如單元測試），排在第一個樣式表之前。 */
  protected abstract insertionPoint(): Element | null;

  private cancelPending(id: string): void {
    const inFlight = this.pending.get(id);
    this.pending.delete(id);
    inFlight?.cancel();
  }

  private findLink(id: string): HTMLLinkElement | null {
    return this.doc.head.querySelector<HTMLLinkElement>(`link[rel="stylesheet"][${this.kind.linkAttr}="${id}"]`);
  }

  // 開機腳本寫入的 `<link>` 在 Angular 啟動前就已載入完（它會擋住 module script 執行），
  // 但 load 事件可能早於我們掛 listener，所以同時看 `sheet`（同源樣式表載入後才有）與 data-state。
  private isLoaded(link: HTMLLinkElement): boolean {
    return link.dataset['state'] === 'loaded' || link.sheet !== null;
  }

  private createLink(id: string): HTMLLinkElement {
    const link = this.doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = this.kind.href(id);
    link.setAttribute(this.kind.linkAttr, id);
    return link;
  }

  private insert(link: HTMLLinkElement): void {
    const head = this.doc.head;
    const anchor = this.insertionPoint();
    if (anchor) {
      anchor.after(link);
    } else {
      const firstStyle = head.querySelector('link[rel="stylesheet"], style');
      head.insertBefore(link, firstStyle);
    }
  }
}
