import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';

/** 麵包屑的一個節點；群組本身沒有對應頁面時不給 `route`，畫面上就不可點。 */
export interface HeaderBreadcrumb {
  label: string;
  route?: string;
}

export interface HeaderTitleData {
  /** 這一頁的名字，頁首唯一的 h1。 */
  title: string;
  /** 上層路徑，由外往內排序；不含目前這一頁（目前頁就是 title，由 h1 顯示）。 */
  breadcrumbs: HeaderBreadcrumb[];
  /**
   * 「← 返回」圖示按鈕的目的地；只有跟麵包屑的上一層不同時才需要給
   * （例如詳情頁要回「來源頁」，不一定是列表頁）。不給就不顯示返回按鈕。
   */
  backTo?: string;
}

interface HeaderTitleEntry {
  owner: object;
  value: HeaderTitleData;
}

/**
 * Topbar 的標題／麵包屑插槽：頁面把自己的標題登記進來，蓋過側欄選單推得的預設值。
 * 比照 HeaderToolbarSlot（header-toolbar-slot.ts）的作法，由 HeaderComponent 讀取渲染。
 */
@Injectable({ providedIn: 'root' })
export class HeaderTitleSlot {
  readonly entry = signal<HeaderTitleEntry | null>(null);
}

/**
 * 頁面元件在 constructor 呼叫，登記自己的頁首標題／麵包屑，取代側欄選單推得的預設值。
 * `source` 可以讀頁面自己的 signal，標題會隨資料變動（例如詳情頁的資料名稱）。
 *
 * 離開頁面時自動清空——用 owner 身分判斷是否仍是自己登記的值才清空，避免換頁時
 * 「下一頁先建立、這一頁才銷毀」的順序把新頁面剛設定的標題誤蓋掉（比照 HeaderToolbarDirective）。
 */
export function provideHeaderTitle(source: () => HeaderTitleData): void {
  const slot = inject(HeaderTitleSlot);
  const owner = {};
  effect(() => slot.entry.set({ owner, value: source() }));
  inject(DestroyRef).onDestroy(() => {
    if (slot.entry()?.owner === owner) slot.entry.set(null);
  });
}
