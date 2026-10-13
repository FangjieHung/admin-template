import { Injectable, signal } from '@angular/core';

export const IDENTITY_SWITCHER_KEY = 'app.identitySwitcher';

function read(): boolean {
  try {
    return globalThis.localStorage?.getItem(IDENTITY_SWITCHER_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * 「切換身分」小工具的開關（跟外觀面板的 AppearancePanelService 同一個做法）：設定頁切換，
 * 殼層用 `@defer (when switcher.visible())` 決定要不要載入小工具本身；關著時不進 Initial bundle。
 */
@Injectable({ providedIn: 'root' })
export class IdentitySwitcherService {
  readonly visible = signal(read());

  setVisible(value: boolean): void {
    this.visible.set(value);
    try {
      globalThis.localStorage?.setItem(IDENTITY_SWITCHER_KEY, value ? '1' : '0');
    } catch {
      // 存不了就只在這次開啟期間有效。
    }
  }
}
