import {
  ApplicationConfig,
  inject,
  Injector,
  Provider,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { COLOR_FALLBACK_NOTIFIER, TEXTURE_FALLBACK_NOTIFIER, ThemeService } from '@admin-template/theme-pack';
import { provideAccess } from '@admin-template/access';
import { DEMO_ACCESS_CONFIG } from './core/access/demo-access';

/**
 * ADR 0010：按需質地載入失敗、退回 Material 時的提示。theme-pack 不依賴 libs/ui，只透過這個 token 通知，
 * 由 app 用 libs/ui 的 ToastService（警告）顯示。提示元件只在失敗時才動態載入，不進初始 bundle。
 */
export const TEXTURE_FALLBACK_TOAST: Provider = {
  provide: TEXTURE_FALLBACK_NOTIFIER,
  useFactory: () => {
    const injector = inject(Injector);
    return () => void import('./shared/ui/texture-fallback-toast').then((m) => m.notifyTextureFallback(injector));
  },
};

/** ADR 0013：按需配色載入失敗、退回 Verdant 時的提示，做法同 TEXTURE_FALLBACK_TOAST（同一個動態載入的檔案）。 */
export const COLOR_FALLBACK_TOAST: Provider = {
  provide: COLOR_FALLBACK_NOTIFIER,
  useFactory: () => {
    const injector = inject(Injector);
    return () => void import('./shared/ui/texture-fallback-toast').then((m) => m.notifyColorFallback(injector));
  },
};

// 根層刻意不 import @admin-template/ui：barrel 一旦被主 bundle 靜態引入，所有元件都會進 Initial bundle。
// 各展示頁在自己的 providers 提供元件需要的文字（shared/ui/*-labels.ts）。
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAppInitializer(() => inject(ThemeService).init()),
    TEXTURE_FALLBACK_TOAST,
    COLOR_FALLBACK_TOAST,
    // 權限（libs/access 的核心 barrel 很小：模型、服務、守門、指令）。示範用的功能、角色、使用者在 demo-access.ts。
    provideAccess(DEMO_ACCESS_CONFIG),
  ],
};
