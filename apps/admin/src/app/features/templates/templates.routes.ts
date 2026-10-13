import { Route, Routes } from '@angular/router';
import { ACCESS_DATA_KEY, AccessCheck, accessGuard } from '@admin-template/access';

/**
 * 頁面樣板的路由（app.routes.ts 用 loadChildren 掛在 /templates，整份都是 lazy，不佔 Initial bundle）：
 * 規劃中清單、儀表板、工單（列表、詳情、表單，路由在 tickets.routes.ts）。
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
  {
    path: 'tickets',
    loadChildren: () => import('../tickets/tickets.routes').then((m) => m.TICKET_ROUTES),
  },
];
