import { InjectionToken } from '@angular/core';

/**
 * 載入／空白／錯誤三態元件的內建文字。libs/ui 不內建使用者可見字串，由使用端在 `providers` 提供一次；
 * 每個元件也有對應的 input 可以逐一覆寫（例：`<lib-error-state retryLabel="重新整理">`）。
 */
export interface FeedbackStateLabels {
  /** 骨架的無障礙名稱（畫面上看不到，報讀器會念），例：「載入中」。 */
  loading: string;
  /** 錯誤狀態的重試鈕，例：「重試」。 */
  retry: string;
  /** 展開錯誤詳細資訊的按鈕，例：「顯示詳細資訊」。 */
  showDetails: string;
  /** 收合錯誤詳細資訊的按鈕，例：「隱藏詳細資訊」。 */
  hideDetails: string;
}

export const FEEDBACK_STATE_LABELS = new InjectionToken<FeedbackStateLabels>('FEEDBACK_STATE_LABELS');

/** 開發期設定錯誤（忘了提供文字），直接丟出明確訊息，不靜默顯示空白。 */
export function missingFeedbackLabel(component: string, name: keyof FeedbackStateLabels): never {
  throw new Error(`${component}：缺少「${name}」文字。請提供 FEEDBACK_STATE_LABELS，或用 input 直接給。`);
}
