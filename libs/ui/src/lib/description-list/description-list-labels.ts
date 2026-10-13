import { InjectionToken } from '@angular/core';

/**
 * 描述清單（lib-description-list）的畫面文字。libs/ui 不內建使用者可見字串，由使用端在 `providers` 提供一次。
 * `{label}` 換成那一列的標籤。
 */
export interface DescriptionListLabels {
  /** 值是 null 或空字串時顯示的字，例：「—」「未填」。 */
  empty: string;
  /** 複製鈕的無障礙名稱，例：「複製{label}」。 */
  copy: string;
  /** 複製完成後按鈕旁的提示（報讀器也會念），例：「已複製」。 */
  copied: string;
}

export const DESCRIPTION_LIST_LABELS = new InjectionToken<DescriptionListLabels>('DESCRIPTION_LIST_LABELS');

const KEYS: readonly (keyof DescriptionListLabels)[] = ['empty', 'copy', 'copied'];

/** 開發期設定錯誤（忘了提供文字或少了某一句）時直接丟出明確訊息，不靜默顯示空白。 */
export function assertDescriptionListLabels(labels: Partial<DescriptionListLabels> | null): DescriptionListLabels {
  if (!labels) throw new Error('DescriptionList：缺少畫面文字。請在 providers 提供 DESCRIPTION_LIST_LABELS。');
  const missing = KEYS.filter((key) => !labels[key]);
  if (missing.length > 0) {
    throw new Error(`DescriptionList：DESCRIPTION_LIST_LABELS 缺少 ${missing.map((k) => `「${k}」`).join('')}。`);
  }
  return labels as DescriptionListLabels;
}
