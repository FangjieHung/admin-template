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
import { TEXTURE_FALLBACK_NOTIFIER, ThemeService } from '@admin-template/theme-pack';

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

// 根層刻意不 import @admin-template/ui：barrel 一旦被主 bundle 靜態引入，所有元件都會進 Initial bundle。
// 各展示頁在自己的 providers 提供元件需要的文字（shared/ui/*-labels.ts）。
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAppInitializer(() => inject(ThemeService).init()),
    TEXTURE_FALLBACK_TOAST,
  ],
};
