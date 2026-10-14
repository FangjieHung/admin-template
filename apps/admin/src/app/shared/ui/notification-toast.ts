import { Injector } from '@angular/core';
import { NotificationItem, ToastService, formatNotificationLabel } from '@admin-template/ui';
import { TOAST_PROVIDERS } from './component-label-providers';
import { ZH_TW_NOTIFICATION_PANEL } from './notification-center-labels';

/**
 * 通知面板關著時，新通知用提示訊息告知（資訊類型，4 秒，「查看」打開面板）。示範執行期在新通知送達時才動態
 * import 這個檔案，所以提示元件與 MatSnackBar 不進 Initial bundle。提示訊息本身經過 snackbar 的 live region 念出，
 * 面板關著時清單不在畫面上，不會重複念。
 */
export function notifyNewNotifications(parent: Injector, items: readonly NotificationItem[], view: () => void): void {
  const newest = items[items.length - 1];
  if (!newest) return;
  const t = ZH_TW_NOTIFICATION_PANEL;
  const message =
    items.length > 1
      ? formatNotificationLabel(t.toastMany, { count: items.length })
      : formatNotificationLabel(t.toastNew, { title: newest.title });
  const injector = Injector.create({ providers: TOAST_PROVIDERS, parent });
  void injector
    .get(ToastService)
    .info(message, { action: t.toastView })
    .actionClicked.then((clicked) => clicked && view());
}
