import { EnvironmentInjector, Injectable, afterNextRender, inject, signal } from '@angular/core';
// 只拿型別（編譯後消失）：這個服務在 Initial bundle 裡，不能真的 import @admin-template/ui（整個 barrel 會跟著進來）。
import type { NewNotification, NotificationItem, NotificationSource } from '@admin-template/ui';
import type { WritableSignal } from '@angular/core';

/** 示範通知的執行期（demo-notifications.ts，lazy 載入）。 */
export interface NotificationRuntime {
  readonly source: NotificationSource;
  /** 示範：每 45 秒送達一則新通知（`setAutoPush` 改它）。 */
  readonly autoPush: WritableSignal<boolean>;
  /** 馬上送達 `count` 則示範通知。 */
  push(count?: number): void;
  /** 送達一則指定內容的通知（例：工單留言 @提及；鈴鐺數字加一，面板關著時跳提示訊息）。 */
  notify(item: NewNotification): NotificationItem;
  setAutoPush(on: boolean): void;
}

/**
 * 頁首鈴鐺的狀態：未讀數與面板開關。這個服務在 Initial bundle，所以只有兩個 signal 與兩個動態載入：
 * - `load()`：資料來源與示範資料（core/notifications/demo-notifications.ts）；頁面第一次繪製後就載入，鈴鐺才有未讀數。
 * - `toggle()`：面板、overlay 與 lib-notification-list（layout/notification-bell），第一次打開時才載入。
 */
@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  /** 未讀數（鈴鐺上的數字）。 */
  readonly unread = signal(0);
  /** 面板開著：新通知改由面板裡的清單念出，不再跳提示訊息。由面板自己更新，要開關請呼叫 `toggle()`。 */
  readonly panelOpen = signal(false);

  private readonly injector = inject(EnvironmentInjector);
  private runtime: Promise<NotificationRuntime> | null = null;

  constructor() {
    afterNextRender(() => this.load());
  }

  load(): Promise<NotificationRuntime> {
    return (this.runtime ??= import('./demo-notifications').then((m) => m.startDemoNotifications(this, this.injector)));
  }

  /** 打開（true）、關上（false）或切換頁首的通知面板。 */
  toggle(open = !this.panelOpen()): void {
    void import('../../layout/notification-bell/notification-panel-host').then((m) => m.setNotificationPanel(open, this.injector));
  }
}
