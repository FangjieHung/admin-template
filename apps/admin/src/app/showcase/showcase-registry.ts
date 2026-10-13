import { Type } from '@angular/core';

/**
 * 展示 app 的元件目錄：側欄、路由、首頁的元件表都從這份清單產生，新增一個展示頁只要在這裡加一筆。
 * 這個檔案在 Initial bundle 裡（側欄、路由），所以只放名稱、圖示與 `load`（動態 import），不要直接 import 任何頁面元件；
 * 說明文字與規劃中清單放在 showcase-catalog.ts，只有展示頁（lazy chunk）會用到。
 */

export type ShowcaseGroupId = 'overview' | 'data' | 'input' | 'feedback' | 'layout';

export interface ShowcaseGroup {
  id: ShowcaseGroupId;
  label: string;
  icon: string;
}

export const SHOWCASE_GROUPS: readonly ShowcaseGroup[] = [
  { id: 'overview', label: '總覽', icon: 'home' },
  { id: 'data', label: '資料呈現', icon: 'table_view' },
  { id: 'input', label: '表單與輸入', icon: 'edit_note' },
  { id: 'feedback', label: '回饋', icon: 'chat_info' },
  { id: 'layout', label: '版面與導覽', icon: 'space_dashboard' },
];

export interface ShowcaseEntry {
  /** 網址片段：`/components/<id>`。 */
  id: string;
  title: string;
  group: ShowcaseGroupId;
  icon: string;
  load: () => Promise<Type<unknown>>;
}

export const SHOWCASE_ENTRIES: readonly ShowcaseEntry[] = [
  {
    id: 'material',
    title: 'Material 元件總覽',
    group: 'overview',
    icon: 'widgets',
    load: () => import('../features/material-overview/material-overview-page.component').then((m) => m.MaterialOverviewPageComponent),
  },
  {
    id: 'data-table',
    title: '資料表',
    group: 'data',
    icon: 'table',
    load: () => import('../features/data-table/data-table-page.component').then((m) => m.DataTablePageComponent),
  },
  {
    id: 'page-toolbar',
    title: '頁首工具列與快速篩選',
    group: 'data',
    icon: 'search',
    load: () => import('../features/page-toolbar/page-toolbar-page.component').then((m) => m.PageToolbarPageComponent),
  },
  {
    id: 'advanced-filter',
    title: '進階篩選',
    group: 'data',
    icon: 'filter_alt',
    load: () => import('../features/advanced-filter/advanced-filter-page.component').then((m) => m.AdvancedFilterPageComponent),
  },
  {
    id: 'saved-views',
    title: '已儲存檢視',
    group: 'data',
    icon: 'bookmarks',
    load: () => import('../features/saved-views/saved-views-page.component').then((m) => m.SavedViewsPageComponent),
  },
  {
    id: 'status-chip',
    title: '狀態標籤',
    group: 'data',
    icon: 'label',
    load: () => import('../features/status-chip/status-chip-page.component').then((m) => m.StatusChipPageComponent),
  },
  {
    id: 'date-range-picker',
    title: '雙月日期區間',
    group: 'input',
    icon: 'date_range',
    load: () =>
      import('../features/date-range-picker/date-range-picker-page.component').then((m) => m.DateRangePickerPageComponent),
  },
  {
    id: 'signature-pad',
    title: '簽名板',
    group: 'input',
    icon: 'signature',
    load: () => import('../features/signature-pad/signature-pad-page.component').then((m) => m.SignaturePadPageComponent),
  },
  {
    id: 'language-switcher',
    title: '語言切換',
    group: 'input',
    icon: 'translate',
    load: () =>
      import('../features/language-switcher/language-switcher-page.component').then((m) => m.LanguageSwitcherPageComponent),
  },
  {
    id: 'confirm-dialog',
    title: '確認對話框',
    group: 'feedback',
    icon: 'help',
    load: () => import('../features/confirm-dialog/confirm-dialog-page.component').then((m) => m.ConfirmDialogPageComponent),
  },
  {
    id: 'responsive-panel',
    title: '響應式側板',
    group: 'layout',
    icon: 'right_panel_open',
    load: () =>
      import('../features/responsive-panel/responsive-panel-page.component').then((m) => m.ResponsivePanelPageComponent),
  },
  {
    id: 'scroll-shadow',
    title: '捲動陰影',
    group: 'layout',
    icon: 'gradient',
    load: () => import('../features/scroll-shadow/scroll-shadow-page.component').then((m) => m.ScrollShadowPageComponent),
  },
  {
    id: 'appearance-panel',
    title: '外觀面板',
    group: 'layout',
    icon: 'palette',
    load: () =>
      import('../features/appearance-panel/appearance-panel-page.component').then((m) => m.AppearancePanelPageComponent),
  },
];

export function showcaseRoute(entry: ShowcaseEntry): string {
  return `/components/${entry.id}`;
}
