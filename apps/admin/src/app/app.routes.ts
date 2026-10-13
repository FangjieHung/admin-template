import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
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
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page.component').then(
        (m) => m.DashboardPageComponent,
      ),
  },
  {
    path: 'vehicles',
    loadComponent: () =>
      import('./features/vehicles/pages/vehicles-page.component').then(
        (m) => m.VehiclesPageComponent,
      ),
  },
  {
    path: 'vehicles/:id',
    loadComponent: () =>
      import('./features/vehicles/pages/vehicle-detail-page.component').then(
        (m) => m.VehicleDetailPageComponent,
      ),
  },
  {
    path: 'members',
    loadComponent: () =>
      import('./features/members/pages/members-page.component').then(
        (m) => m.MembersPageComponent,
      ),
  },
  // 舊網址（更名前的書籤）轉到新位置
  { path: 'orders/members', redirectTo: 'members' },
  { path: 'bookings', redirectTo: 'orders' },
  {
    path: 'orders',
    loadChildren: () => import('./features/orders/orders.routes').then((m) => m.ORDER_ROUTES),
  },
  {
    path: 'pricing',
    loadComponent: () =>
      import('./features/pricing/pages/pricing-page.component').then(
        (m) => m.PricingPageComponent,
      ),
  },
  {
    path: 'pricing/calendar',
    loadComponent: () =>
      import('./features/pricing/pages/pricing-calendar-page.component').then(
        (m) => m.PricingCalendarPageComponent,
      ),
  },
  {
    path: 'add-ons',
    loadComponent: () =>
      import('./features/add-ons/pages/add-ons-page.component').then(
        (m) => m.AddOnsPageComponent,
      ),
  },
  {
    path: 'coupons',
    loadComponent: () =>
      import('./features/coupons/pages/coupons-page.component').then(
        (m) => m.CouponsPageComponent,
      ),
  },
  {
    path: 'partners',
    loadComponent: () =>
      import('./features/partners/pages/partners-page.component').then(
        (m) => m.PartnersPageComponent,
      ),
  },
  {
    path: 'commission',
    loadComponent: () =>
      import('./features/commission/pages/commission-page.component').then(
        (m) => m.CommissionPageComponent,
      ),
  },
  // 清單元件示範（中性假資料，不在側欄）：之後若改由元件展示 app 承接，連同 features/component-demo 一起刪除。
  {
    path: 'dev/data-table',
    loadComponent: () =>
      import('./features/component-demo/data-table-demo-page.component').then(
        (m) => m.DataTableDemoPageComponent,
      ),
  },
];
