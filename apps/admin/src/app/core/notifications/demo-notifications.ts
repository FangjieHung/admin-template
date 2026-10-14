import { DestroyRef, EnvironmentInjector, signal } from '@angular/core';
import { NotificationItem, createDemoNotificationSource } from '@admin-template/ui';
import type { NotificationCenterService, NotificationRuntime } from './notification-center.service';
import { demoNotifications, incomingNotification } from './demo-notification-data';

/** 示範：開著 app 時每隔多久送達一則新通知。 */
export const DEMO_PUSH_INTERVAL = 45_000;

/**
 * 示範通知的執行期（NotificationCenterService.load() 動態載入，不在 Initial bundle）：建立示範資料來源、
 * 同步鈴鐺的未讀數、定時送達新通知；面板關著時用提示訊息告知（提示訊息元件也是用到時才載入）。
 */
export function startDemoNotifications(center: NotificationCenterService, injector: EnvironmentInjector): NotificationRuntime {
  const source = createDemoNotificationSource(demoNotifications(Date.now()), { latencyMs: 350, idPrefix: 'push-' });
  const autoPush = signal(true);
  let stopped = false;
  let seq = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const syncCount = () => void source.unreadCount().then((n) => center.unread.set(n));
  const sub = source.changes.subscribe(syncCount);
  syncCount();

  const deliver = (count: number) => {
    const items: NotificationItem[] = [];
    for (let i = 0; i < Math.max(1, count); i++) items.push(source.push(incomingNotification(++seq)));
    if (!center.panelOpen()) {
      void import('../../shared/ui/notification-toast').then(
        (m) => stopped || m.notifyNewNotifications(injector, items, () => center.toggle(true)),
      );
    }
  };

  const setAutoPush = (on: boolean) => {
    autoPush.set(on);
    if (timer) clearInterval(timer);
    timer = on ? setInterval(() => deliver(1), DEMO_PUSH_INTERVAL) : null;
  };
  setAutoPush(true);

  const stop = () => {
    stopped = true;
    setAutoPush(false);
    sub.unsubscribe();
  };
  try {
    injector.get(DestroyRef).onDestroy(stop);
  } catch {
    // 動態載入完成前 app 已經被銷毀（例如單元測試結束）：不要留下計時器。
    stop();
  }

  return { source, autoPush, push: deliver, setAutoPush };
}
