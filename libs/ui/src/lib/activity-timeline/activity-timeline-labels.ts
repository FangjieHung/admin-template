import { InjectionToken } from '@angular/core';

/**
 * 活動紀錄（lib-activity-timeline）的畫面文字。libs/ui 不內建使用者可見字串，由使用端在 `providers` 提供一次。
 * 相對時間（「3 分鐘前」）由 `Intl.RelativeTimeFormat` 依 I18nService 目前的語言產生，不放在這裡。
 */
export interface ActivityTimelineLabels {
  /** 日期分組標題：今天，例：「今天」。 */
  today: string;
  /** 日期分組標題：昨天，例：「昨天」。 */
  yesterday: string;
  /** 其他日期的分組標題，`{date}` 是 I18nService 的日期格式、`{weekday}` 是星期，例：「{date}（{weekday}）」。 */
  dayHeading: string;
  /** 沒有操作者（系統自動產生）的紀錄，圓章的名稱，例：「系統」。 */
  system: string;
  /** 例：「載入更多」。 */
  loadMore: string;
  /** 變更超過 3 筆時的展開鈕，`{count}` 是筆數，例：「展開 {count} 筆變更」。 */
  expandChanges: string;
  /** 例：「收合變更」。 */
  collapseChanges: string;
  /** 變更前或變更後是空值時顯示的字，例：「（空白）」。 */
  emptyValue: string;
  /** 舊值與新值之間（畫面上是箭頭，這句只給報讀器念），例：「改成」。 */
  changedTo: string;
  /** 沒有任何紀錄，例：「還沒有活動紀錄」。 */
  empty: string;
  /** 篩選後沒有紀錄（目前不是第一個篩選），例：「沒有符合篩選條件的紀錄」。 */
  emptyFiltered: string;
  /** 篩選 chip 群組的無障礙名稱，例：「篩選活動紀錄」。 */
  filters: string;
  /** 第一次載入的骨架給報讀器念的字，例：「載入中」。 */
  loading: string;
}

export const ACTIVITY_TIMELINE_LABELS = new InjectionToken<ActivityTimelineLabels>('ACTIVITY_TIMELINE_LABELS');

const KEYS: readonly (keyof ActivityTimelineLabels)[] = [
  'today',
  'yesterday',
  'dayHeading',
  'system',
  'loadMore',
  'expandChanges',
  'collapseChanges',
  'emptyValue',
  'changedTo',
  'empty',
  'emptyFiltered',
  'filters',
  'loading',
];

/** 開發期設定錯誤（忘了提供文字或少了某一句）時直接丟出明確訊息，不靜默顯示空白。 */
export function assertActivityTimelineLabels(labels: Partial<ActivityTimelineLabels> | null): ActivityTimelineLabels {
  if (!labels) throw new Error('ActivityTimeline：缺少畫面文字。請在 providers 提供 ACTIVITY_TIMELINE_LABELS。');
  const missing = KEYS.filter((key) => !labels[key]);
  if (missing.length > 0) {
    throw new Error(`ActivityTimeline：ACTIVITY_TIMELINE_LABELS 缺少 ${missing.map((k) => `「${k}」`).join('')}。`);
  }
  return labels as ActivityTimelineLabels;
}
