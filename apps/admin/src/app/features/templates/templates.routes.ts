import { Route, Routes } from '@angular/router';
import { ACCESS_DATA_KEY, AccessCheck, accessGuard } from '@admin-template/access';

/**
 * 頁面樣板的路由（app.routes.ts 用 loadChildren 掛在 /templates，整份都是 lazy，不佔 Initial bundle）：
 * 規劃中清單、儀表板、排程、工單（列表、詳情、表單、匯入、看板，路由在 tickets.routes.ts）、設定頁（分組子路由在 account-settings.routes.ts）、全部通知、空白頁。
 */
function guarded(access: AccessCheck): Partial<Route> {
  return { canActivate: [accessGuard], data: { [ACCESS_DATA_KEY]: access }, runGuardsAndResolvers: 'always' };
}

export const TEMPLATE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./templates-page.component').then((m) => m.TemplatesPageComponent),
  },
  // 儀表板：資料來自工單 repository；檢視者也看得到（「工單・檢視」）。
  {
    path: 'dashboard',
    loadComponent: () => import('../dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent),
    ...guarded('ticket:view'),
  },
  // 排程：工程師一人一列的資源排程，工單排在到期日；檢視者唯讀（沒有「工單・編輯」不能拖）。
  {
    path: 'schedule',
    loadComponent: () => import('../schedule/schedule-page.component').then((m) => m.SchedulePageComponent),
    ...guarded('ticket:view'),
  },
  {
    path: 'tickets',
    loadChildren: () => import('../tickets/tickets.routes').then((m) => m.TICKET_ROUTES),
  },
  // 設定頁：每個使用者都能改自己的設定，不另外守門。
  {
    path: 'settings',
    loadChildren: () => import('../account-settings/account-settings.routes').then((m) => m.ACCOUNT_SETTINGS_ROUTES),
  },
  // 全部通知：頁首鈴鐺面板的「查看全部通知」連到這裡（與鈴鐺共用資料來源）。
  {
    path: 'notifications',
    loadComponent: () =>
      import('../notifications/notifications-page.component').then((m) => m.NotificationsPageComponent),
  },
  {
    path: 'blank',
    loadComponent: () => import('../blank-page/blank-page.component').then((m) => m.BlankPageComponent),
  },
];
