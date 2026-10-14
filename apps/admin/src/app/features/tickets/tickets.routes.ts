import { Route, Routes } from '@angular/router';
import { ACCESS_DATA_KEY, AccessCheck, accessGuard, unsavedChangesGuard } from '@admin-template/access';

/**
 * 工單樣板的路由（app.routes.ts 用 loadChildren 掛在 /templates/tickets，整份都是 lazy）：
 * 列表 → 詳情 → 編輯，列表的「新增」→ 空白表單、「匯入」→ 匯入精靈。每一頁依 libs/access 的「工單」功能守門：
 * 沒有權限時顯示「沒有權限」頁（網址不變）；表單有未存的變更時離開前先確認（unsavedChangesGuard）。
 */
function guarded(access: AccessCheck): Partial<Route> {
  return { canActivate: [accessGuard], data: { [ACCESS_DATA_KEY]: access }, runGuardsAndResolvers: 'always' };
}

const loadForm = () => import('./ticket-form/ticket-form-page.component').then((m) => m.TicketFormPageComponent);

export const TICKET_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./ticket-list/ticket-list-page.component').then((m) => m.TicketListPageComponent),
    ...guarded('ticket:view'),
  },
  { path: 'new', loadComponent: loadForm, ...guarded('ticket:create'), canDeactivate: [unsavedChangesGuard] },
  // 匯入：跟「新增」同一個權限；要放在 :id 前面，否則 import 會被當成工單編號。
  {
    path: 'import',
    loadComponent: () => import('./ticket-import/ticket-import-page.component').then((m) => m.TicketImportPageComponent),
    ...guarded('ticket:create'),
  },
  {
    path: ':id',
    loadComponent: () => import('./ticket-detail/ticket-detail-page.component').then((m) => m.TicketDetailPageComponent),
    ...guarded('ticket:view'),
  },
  { path: ':id/edit', loadComponent: loadForm, ...guarded('ticket:edit'), canDeactivate: [unsavedChangesGuard] },
];
