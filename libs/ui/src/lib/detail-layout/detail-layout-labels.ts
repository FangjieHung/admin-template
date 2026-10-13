import { InjectionToken } from '@angular/core';

/** 詳情頁版型（lib-detail-layout）的畫面文字。libs/ui 不內建使用者可見字串，由使用端在 `providers` 提供一次。 */
export interface DetailLayoutLabels {
  /** 「更多」選單按鈕的無障礙名稱，例：「更多動作」。 */
  more: string;
  /** 載入中的骨架給報讀器念的字，例：「載入中」。 */
  loading: string;
}

export const DETAIL_LAYOUT_LABELS = new InjectionToken<DetailLayoutLabels>('DETAIL_LAYOUT_LABELS');

const KEYS: readonly (keyof DetailLayoutLabels)[] = ['more', 'loading'];

/** 開發期設定錯誤（忘了提供文字或少了某一句）時直接丟出明確訊息，不靜默顯示空白。 */
export function assertDetailLayoutLabels(labels: Partial<DetailLayoutLabels> | null): DetailLayoutLabels {
  if (!labels) throw new Error('DetailLayout：缺少畫面文字。請在 providers 提供 DETAIL_LAYOUT_LABELS。');
  const missing = KEYS.filter((key) => !labels[key]);
  if (missing.length > 0) {
    throw new Error(`DetailLayout：DETAIL_LAYOUT_LABELS 缺少 ${missing.map((k) => `「${k}」`).join('')}。`);
  }
  return labels as DetailLayoutLabels;
}
