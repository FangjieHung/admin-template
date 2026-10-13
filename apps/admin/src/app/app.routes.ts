import { Route, Routes } from '@angular/router';
import { ACCESS_DATA_KEY, accessGuard, permissionOf, unsavedChangesGuard } from '@admin-template/access';
import { DEMO_FEATURES } from './core/access/demo-access';
import { SHOWCASE_ENTRIES, ShowcaseEntry } from './showcase/showcase-registry';

/** 受權限保護的路由：沒有權限顯示「沒有權限」頁；換身分時重新檢查（runGuardsAndResolvers）。 */
function guarded(access: ShowcaseEntry['access']): Partial<Route> {
  return access
    ? { canActivate: [accessGuard], data: { [ACCESS_DATA_KEY]: access }, runGuardsAndResolvers: 'always' }
    : {};
}

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home-page.component').then((m) => m.HomePageComponent),
  },
  // 每個元件一頁：/components/<id>，清單在 showcase-registry.ts。
  ...SHOWCASE_ENTRIES.flatMap((entry): Route[] =>
    entry.load
      ? [
          {
            path: `components/${entry.id}`,
            loadComponent: entry.load,
            ...guarded(entry.access),
            ...(entry.guardUnsaved ? { canDeactivate: [unsavedChangesGuard] } : {}),
          },
        ]
      : [],
  ),
  // 「權限控制」展示頁的路由守門示範：每個示範功能一頁，需要該功能的「檢視」。
  ...DEMO_FEATURES.map(
    (feature): Route => ({
      path: `access-demo/${feature.id}`,
      loadComponent: () =>
        import('./features/access-control/access-demo-page.component').then((m) => m.AccessDemoPageComponent),
      ...guarded(permissionOf(feature.id, 'view')),
    }),
  ),
  // 頁面樣板：工單的列表、詳情、表單（權限與離開提醒在 tickets.routes.ts）。
  {
    path: 'templates/tickets',
    loadChildren: () => import('./features/tickets/tickets.routes').then((m) => m.TICKET_ROUTES),
  },
  {
    path: 'templates',
    loadComponent: () =>
      import('./features/templates/templates-page.component').then((m) => m.TemplatesPageComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/pages/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/pages/settings-page.component').then(
        (m) => m.SettingsPageComponent,
      ),
  },
  // 沒有權限（accessGuard 導過來，網址列維持原本的網址）。
  {
    path: 'forbidden',
    loadComponent: () => import('./features/errors/forbidden-page.component').then((m) => m.ForbiddenPageComponent),
  },
  // 舊網址（清單元件示範頁）。
  { path: 'dev/data-table', redirectTo: 'components/data-table' },
  // 其他不認得的網址：找不到頁面。
  {
    path: '**',
    loadComponent: () => import('./features/errors/not-found-page.component').then((m) => m.NotFoundPageComponent),
  },
];
