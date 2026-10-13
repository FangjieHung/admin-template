import { Routes } from '@angular/router';
import { SHOWCASE_ENTRIES } from './showcase/showcase-registry';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home-page.component').then((m) => m.HomePageComponent),
  },
  // 每個元件一頁：/components/<id>，清單在 showcase-registry.ts。
  ...SHOWCASE_ENTRIES.map((entry) => ({ path: `components/${entry.id}`, loadComponent: entry.load })),
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
  // 舊網址（清單元件示範頁）與其他不認得的網址一律回首頁。
  { path: 'dev/data-table', redirectTo: 'components/data-table' },
  { path: '**', redirectTo: '' },
];
