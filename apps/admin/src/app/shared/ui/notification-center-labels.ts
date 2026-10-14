import { Provider } from '@angular/core';
import { NOTIFICATION_CENTER_LABELS, NotificationCategory, NotificationCenterLabels } from '@admin-template/ui';

/**
 * 通知中心（lib-notification-list）的畫面文字。用到它的頁面（頁首的通知面板、全部通知頁、展示頁）在自己的
 * `providers` 加上這組；不放 app.config 根層，理由同 component-label-providers.ts。
 *
 * 文字直接寫在這裡、不放 core/i18n/zh-tw.ts：那份字典被殼層 import，整份在 Initial bundle 裡
 * （esbuild 把每個中文字輸出成 6 bytes 的跳脫序列），這些句子只有通知面板與頁面（lazy chunk）需要。
 */
export const ZH_TW_NOTIFICATION_CENTER: NotificationCenterLabels = {
  list: '通知',
  filterGroup: '顯示哪些通知',
  filterAll: '全部',
  filterUnread: '未讀',
  categoryGroup: '通知類別',
  categoryAll: '所有類別',
  markAllRead: '全部標為已讀',
  markRead: '將「{title}」標為已讀',
  markUnread: '將「{title}」標為未讀',
  remove: '移除「{title}」',
  unread: '未讀',
  today: '今天',
  yesterday: '昨天',
  earlier: '更早',
  loadMore: '載入更多',
  loading: '載入中',
  empty: '沒有通知',
  emptyUnread: '沒有未讀通知',
  emptyDetail: '有新的指派、提及或系統公告時會出現在這裡',
  error: '通知載入失敗',
  errorHint: '請確認網路連線後再試一次',
  retry: '重試',
  actionFailed: '沒有完成，請再試一次',
  announceNew: '有 {count} 則新通知：{title}',
  announceAllRead: '已將全部通知標為已讀',
  announceRead: '已將「{title}」標為已讀',
  announceUnread: '已將「{title}」標為未讀',
  announceRemoved: '已移除「{title}」',
};

export const NOTIFICATION_CENTER_LABEL_PROVIDERS: Provider[] = [
  { provide: NOTIFICATION_CENTER_LABELS, useValue: ZH_TW_NOTIFICATION_CENTER },
];

/** 示範資料的類別（全部通知頁、展示頁的類別篩選）。 */
export const DEMO_NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  { id: 'assigned', label: '指派給我' },
  { id: 'mention', label: '提及' },
  { id: 'status', label: '狀態變更' },
  { id: 'system', label: '系統' },
];

/** 通知面板與全部通知頁殼的文字。 */
export const ZH_TW_NOTIFICATION_PANEL = {
  title: '通知',
  close: '關閉通知',
  viewAll: '查看全部通知',
  toastNew: '新通知：{title}',
  toastMany: '有 {count} 則新通知',
  toastView: '查看',
} as const;
