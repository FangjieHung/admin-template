import { Type } from '@angular/core';
import type { AccessCheck } from '@admin-template/access';

/**
 * 展示 app 的元件目錄：側欄、路由、首頁的元件表都從這份清單產生，新增一個展示頁只要在這裡加一筆。
 * 這個檔案在 Initial bundle 裡（側欄、路由），所以只放名稱、圖示與 `load`（動態 import），不要直接 import 任何頁面元件；
 * 說明文字與規劃中清單放在 showcase-catalog.ts，只有展示頁（lazy chunk）會用到。
 */

export type ShowcaseGroupId = 'overview' | 'data' | 'input' | 'feedback' | 'layout' | 'access' | 'templates';

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
  { id: 'access', label: '權限', icon: 'shield_person' },
  { id: 'templates', label: '頁面樣板', icon: 'web' },
];

export interface ShowcaseEntry {
  /** 網址片段：`/components/<id>`（有 `path` 時只當識別）。 */
  id: string;
  title: string;
  group: ShowcaseGroupId;
  icon: string;
  /** 展示頁：路由 `/components/<id>` 由這份清單產生。 */
  load?: () => Promise<Type<unknown>>;
  /** 頁面樣板：路由自己宣告在 app.routes.ts，這裡只給側欄與首頁連過去的網址（不含開頭的 /）。 */
  path?: string;
  /** 需要的權限：沒有時側欄不列出、直接開網址顯示「沒有權限」頁（libs/access）。 */
  access?: AccessCheck;
  /** 頁面有未儲存的變更時，離開前先確認（頁面實作 HasUnsavedChanges）。 */
  guardUnsaved?: boolean;
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
    title: '頁首工具列',
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
    id: 'activity-log',
    title: '活動紀錄',
    group: 'data',
    icon: 'history',
    load: () => import('../features/activity-log/activity-log-page.component').then((m) => m.ActivityLogPageComponent),
  },
  {
    id: 'charts',
    title: '數字小卡與圖表',
    group: 'data',
    icon: 'monitoring',
    load: () => import('../features/charts/charts-page.component').then((m) => m.ChartsPageComponent),
  },
  {
    id: 'relation-select',
    title: '關聯選擇欄位',
    group: 'input',
    icon: 'person_search',
    load: () =>
      import('../features/relation-select/relation-select-page.component').then((m) => m.RelationSelectPageComponent),
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
    id: 'feedback-states',
    title: '載入、空白、錯誤',
    group: 'feedback',
    icon: 'hourglass_empty',
    load: () =>
      import('../features/feedback-states/feedback-states-page.component').then((m) => m.FeedbackStatesPageComponent),
  },
  {
    id: 'toast',
    title: '提示訊息',
    group: 'feedback',
    icon: 'notifications',
    load: () => import('../features/toast/toast-page.component').then((m) => m.ToastPageComponent),
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
    id: 'detail-layout',
    title: '詳情頁版型',
    group: 'layout',
    icon: 'article',
    load: () => import('../features/detail-layout/detail-layout-page.component').then((m) => m.DetailLayoutPageComponent),
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
  {
    id: 'access-control',
    title: '權限控制',
    group: 'access',
    icon: 'shield_person',
    load: () => import('../features/access-control/access-control-page.component').then((m) => m.AccessControlPageComponent),
  },
  {
    id: 'roles',
    title: '角色與權限',
    group: 'templates',
    icon: 'admin_panel_settings',
    access: 'settings:view',
    guardUnsaved: true,
    load: () => import('../features/roles/roles-page.component').then((m) => m.RolesPageComponent),
  },
  {
    id: 'error-pages',
    title: '錯誤頁',
    group: 'templates',
    icon: 'error',
    load: () => import('../features/error-pages/error-pages-page.component').then((m) => m.ErrorPagesPageComponent),
  },
  { id: 'dashboard', title: '儀表板', group: 'templates', icon: 'dashboard', path: 'templates/dashboard', access: 'ticket:view' },
  // 工單的列表、詳情、表單三頁串成一個流程（features/tickets，路由在 tickets.routes.ts）。
  { id: 'ticket-list', title: '列表頁', group: 'templates', icon: 'list_alt', path: 'templates/tickets', access: 'ticket:view' },
  { id: 'ticket-detail', title: '詳情頁', group: 'templates', icon: 'article', path: 'templates/tickets/TK-2048', access: 'ticket:view' },
  { id: 'ticket-form', title: '表單頁', group: 'templates', icon: 'edit_document', path: 'templates/tickets/TK-2048/edit', access: 'ticket:edit' },
  { id: 'login', title: '登入', group: 'templates', icon: 'login', path: 'login' },
  { id: 'settings-template', title: '設定頁', group: 'templates', icon: 'manage_accounts', path: 'templates/settings' },
  { id: 'blank-page', title: '空白頁', group: 'templates', icon: 'note_add', path: 'templates/blank' },
];

export function showcaseRoute(entry: ShowcaseEntry): string {
  return entry.path ? `/${entry.path}` : `/components/${entry.id}`;
}
