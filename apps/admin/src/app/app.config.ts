import {
  ApplicationConfig,
  inject,
  Injector,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { TEXTURE_FALLBACK_MESSAGE, TEXTURE_FALLBACK_NOTIFIER, ThemeService } from '@car-rental/theme-pack';

// 根層刻意不 import @car-rental/ui：barrel 一旦被主 bundle 靜態引入，所有元件都會進 Initial bundle。
// 各展示頁在自己的 providers 提供元件需要的文字（shared/ui/*-labels.ts）。
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAppInitializer(() => inject(ThemeService).init()),
    // ADR 0010：按需質地載入失敗、退回 Material 時的提示（theme-pack 不依賴 Material 的 snackbar，由 app 提供）。
    {
      provide: TEXTURE_FALLBACK_NOTIFIER,
      // snackbar 只在失敗時才動態載入，不進初始 bundle（主程式原本就沒有 MatSnackBar）。
      useFactory: () => {
        const injector = inject(Injector);
        return () =>
          void import('@angular/material/snack-bar').then(({ MatSnackBar }) =>
            injector.get(MatSnackBar).open(TEXTURE_FALLBACK_MESSAGE, undefined, { duration: 3000 }),
          );
      },
    },
  ],
};
