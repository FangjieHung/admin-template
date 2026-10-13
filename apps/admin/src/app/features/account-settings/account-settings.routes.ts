import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '@admin-template/access';
import { AccountSettingsPageComponent } from './account-settings-page.component';

/**
 * 設定頁樣板的路由（templates.routes.ts 用 loadChildren 掛在 /templates/settings，整份都是 lazy）。
 * 每個分組一個子路由，網址就是目前的分組（重新整理後還原）；每個分組各自一個 lazy chunk。
 * 明確存檔的分組（個人資料、安全性、偏好）有 canDeactivate：切換分組或離開頁面時，有未存的變更就先問。
 */
export const ACCOUNT_SETTINGS_ROUTES: Routes = [
  {
    path: '',
    component: AccountSettingsPageComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'profile' },
      {
        path: 'profile',
        loadComponent: () => import('./sections/profile-section.component').then((m) => m.ProfileSectionComponent),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./sections/notifications-section.component').then((m) => m.NotificationsSectionComponent),
      },
      {
        path: 'security',
        loadComponent: () => import('./sections/security-section.component').then((m) => m.SecuritySectionComponent),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'preferences',
        loadComponent: () =>
          import('./sections/preferences-section.component').then((m) => m.PreferencesSectionComponent),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'advanced',
        loadComponent: () => import('./sections/advanced-section.component').then((m) => m.AdvancedSectionComponent),
      },
      // 打錯的分組名稱：回到第一組。
      { path: '**', redirectTo: 'profile' },
    ],
  },
];
