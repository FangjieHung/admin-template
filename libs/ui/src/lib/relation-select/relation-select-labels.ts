import { InjectionToken } from '@angular/core';

/**
 * 關聯選擇欄位的畫面文字。libs/ui 不內建使用者可見字串，由使用端在 `providers` 提供一次。
 * `{query}` 換成使用者輸入的字、`{id}` 換成找不到的那筆 id。
 */
export interface RelationSelectLabels {
  /** 搜尋或解析初始值時的「載入中」（清單裡那一行、報讀器也念它）。 */
  loading: string;
  /** 沒有輸入、也沒有任何可選的項目，例：「沒有可選擇的項目」。 */
  empty: string;
  /** 例：「找不到符合「{query}」的項目」。 */
  noResults: string;
  /** 結果超過顯示上限時清單底部的提示，例：「還有更多，請輸入更多字縮小範圍」。 */
  hasMore: string;
  /** `allowCreate` 時的建立選項，例：「建立「{query}」」。 */
  create: string;
  /** 例：「搜尋失敗」。 */
  searchFailed: string;
  /** 搜尋失敗後的重試選項，例：「重試」。 */
  retry: string;
  /** 清除鈕的無障礙名稱，例：「清除」。 */
  clear: string;
  /** 初始值查不到時欄位下方的提示，例：「找不到這筆資料（{id}）」。 */
  resolveFailed: string;
}

export const RELATION_SELECT_LABELS = new InjectionToken<RelationSelectLabels>('RELATION_SELECT_LABELS');

const KEYS: readonly (keyof RelationSelectLabels)[] = [
  'loading',
  'empty',
  'noResults',
  'hasMore',
  'create',
  'searchFailed',
  'retry',
  'clear',
  'resolveFailed',
];

/** 開發期設定錯誤（忘了提供文字或少了某一句）時直接丟出明確訊息，不靜默顯示空白。 */
export function assertRelationSelectLabels(labels: Partial<RelationSelectLabels> | null): RelationSelectLabels {
  if (!labels) throw new Error('RelationSelect：缺少畫面文字。請在 providers 提供 RELATION_SELECT_LABELS。');
  const missing = KEYS.filter((key) => !labels[key]);
  if (missing.length > 0) {
    throw new Error(`RelationSelect：RELATION_SELECT_LABELS 缺少 ${missing.map((k) => `「${k}」`).join('')}。`);
  }
  return labels as RelationSelectLabels;
}

/** 把 `{name}` 換成對應的值。 */
export function formatRelationLabel(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole);
}
