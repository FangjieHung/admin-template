import { InjectionToken } from '@angular/core';

/**
 * 通知中心（lib-notification-list）的畫面文字。libs/ui 不內建使用者可見字串，由使用端在 `providers` 提供一次。
 * `{title}` 換成通知標題、`{count}` 換成數量。相對時間（「3 分鐘前」）由 `Intl.RelativeTimeFormat` 依 I18nService
 * 目前的語言產生，不放在這裡。
 */
export interface NotificationCenterLabels {
  /** 清單的無障礙名稱，例：「通知」。 */
  list: string;
  /** 「全部／未讀」切換的群組名稱，例：「顯示哪些通知」。 */
  filterGroup: string;
  /** 例：「全部」。 */
  filterAll: string;
  /** 例：「未讀」。 */
  filterUnread: string;
  /** 類別篩選的群組名稱，例：「通知類別」。 */
  categoryGroup: string;
  /** 不限類別的那一顆，例：「所有類別」。 */
  categoryAll: string;
  /** 例：「全部標為已讀」。 */
  markAllRead: string;
  /** 每一則的動作鈕（無障礙名稱），例：「將「{title}」標為已讀」。 */
  markRead: string;
  /** 例：「將「{title}」標為未讀」。 */
  markUnread: string;
  /** 例：「移除「{title}」」。 */
  remove: string;
  /** 未讀圓點旁只給報讀器的字（不只靠顏色），例：「未讀」。 */
  unread: string;
  /** 分組標題，例：「今天」。 */
  today: string;
  /** 例：「昨天」。 */
  yesterday: string;
  /** 例：「更早」。 */
  earlier: string;
  /** 例：「載入更多」。 */
  loadMore: string;
  /** 骨架給報讀器念的字，例：「載入中」。 */
  loading: string;
  /** 沒有任何通知，例：「沒有通知」。 */
  empty: string;
  /** 「未讀」底下沒有通知，例：「沒有未讀通知」。 */
  emptyUnread: string;
  /** 空狀態的補充說明，例：「有新的指派、提及或系統公告時會出現在這裡」。 */
  emptyDetail: string;
  /** 例：「通知載入失敗」。 */
  error: string;
  /** 例：「請確認網路連線後再試一次」。 */
  errorHint: string;
  /** 例：「重試」。 */
  retry: string;
  /** 標為已讀、移除等動作失敗時報讀器念的字，例：「沒有完成，請再試一次」。 */
  actionFailed: string;
  /** 新通知送達時報讀器念的字，例：「有 {count} 則新通知：{title}」。 */
  announceNew: string;
  /** 例：「已將全部通知標為已讀」。 */
  announceAllRead: string;
  /** 例：「已將「{title}」標為已讀」。 */
  announceRead: string;
  /** 例：「已將「{title}」標為未讀」。 */
  announceUnread: string;
  /** 例：「已移除「{title}」」。 */
  announceRemoved: string;
}

export const NOTIFICATION_CENTER_LABELS = new InjectionToken<NotificationCenterLabels>('NOTIFICATION_CENTER_LABELS');

const KEYS: readonly (keyof NotificationCenterLabels)[] = [
  'list',
  'filterGroup',
  'filterAll',
  'filterUnread',
  'categoryGroup',
  'categoryAll',
  'markAllRead',
  'markRead',
  'markUnread',
  'remove',
  'unread',
  'today',
  'yesterday',
  'earlier',
  'loadMore',
  'loading',
  'empty',
  'emptyUnread',
  'emptyDetail',
  'error',
  'errorHint',
  'retry',
  'actionFailed',
  'announceNew',
  'announceAllRead',
  'announceRead',
  'announceUnread',
  'announceRemoved',
];

/** 開發期設定錯誤（忘了提供文字或少了某一句）時直接丟出明確訊息，不靜默顯示空白。 */
export function assertNotificationCenterLabels(
  labels: Partial<NotificationCenterLabels> | null,
): NotificationCenterLabels {
  if (!labels) throw new Error('NotificationCenter：缺少畫面文字。請在 providers 提供 NOTIFICATION_CENTER_LABELS。');
  const missing = KEYS.filter((key) => !labels[key]);
  if (missing.length > 0) {
    throw new Error(`NotificationCenter：NOTIFICATION_CENTER_LABELS 缺少 ${missing.map((k) => `「${k}」`).join('')}。`);
  }
  return labels as NotificationCenterLabels;
}

/** 把 `{name}` 換成對應的值。 */
export function formatNotificationLabel(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}
