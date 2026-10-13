import { Injector } from '@angular/core';
import { ToastRef, ToastService } from '@admin-template/ui';
import { COLOR_FALLBACK_MESSAGE, TEXTURE_FALLBACK_MESSAGE } from '@admin-template/theme-pack';
import { TOAST_PROVIDERS } from './component-label-providers';

/**
 * 按需質地（ADR 0010）或按需配色（ADR 0013）載入失敗、退回常駐外觀時的提示。app.config.ts 只在失敗時才動態
 * import 這個檔案，所以 libs/ui 的提示元件與 MatSnackBar 不進 Initial bundle。用警告類型：外觀仍可用，6 秒後自動消失。
 */
export function notifyTextureFallback(parent: Injector): ToastRef {
  return warn(parent, TEXTURE_FALLBACK_MESSAGE);
}

/** 按需配色載入失敗、退回常駐配色（Verdant）時的提示（ADR 0013）。 */
export function notifyColorFallback(parent: Injector): ToastRef {
  return warn(parent, COLOR_FALLBACK_MESSAGE);
}

function warn(parent: Injector, message: string): ToastRef {
  const injector = Injector.create({ providers: TOAST_PROVIDERS, parent });
  return injector.get(ToastService).warning(message);
}
