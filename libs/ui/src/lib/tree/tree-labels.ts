import { InjectionToken } from '@angular/core';

/**
 * 樹狀選單（lib-tree）與樹狀表（lib-tree-table）共用的畫面文字。libs/ui 不內建使用者可見字串，由使用端在 `providers` 提供一次。
 * 帶參數的句子用 `{name}` 佔位（同其他 libs/ui 元件）：`{name}` 換成節點名稱、`{query}` 換成搜尋文字。
 */
export interface TreeLabels {
  /** 延遲載入中，轉圈旁給報讀器念的字（畫面上只有轉圈），例：「載入中」。 */
  loading: string;
  /** 延遲載入失敗時節點下方的訊息，例：「無法載入「{name}」的內容」。 */
  loadFailed: string;
  /** 重試按鈕，例：「重試」。 */
  retry: string;
  /** 載入失敗時給鍵盤使用者的提示（接在錯誤訊息後面念），例：「按右方向鍵重試」。 */
  retryHint: string;
  /** 搜尋沒有結果，例：「找不到符合「{query}」的項目」。 */
  noResults: string;
  /** 只用在樹狀表：沒有任何資料列，例：「沒有資料」。 */
  noRows: string;
}

export const TREE_LABELS = new InjectionToken<TreeLabels>('TREE_LABELS');

const KEYS: readonly (keyof TreeLabels)[] = ['loading', 'loadFailed', 'retry', 'retryHint', 'noResults', 'noRows'];

/** 開發期設定錯誤（忘了提供文字或少了某一句）時直接丟出明確訊息，不靜默顯示空白。 */
export function assertTreeLabels(labels: Partial<TreeLabels> | null, owner = 'Tree'): TreeLabels {
  if (!labels) throw new Error(`${owner}：缺少畫面文字。請在 providers 提供 TREE_LABELS。`);
  const missing = KEYS.filter((key) => !labels[key]);
  if (missing.length > 0) {
    throw new Error(`${owner}：TREE_LABELS 缺少 ${missing.map((k) => `「${k}」`).join('')}。`);
  }
  return labels as TreeLabels;
}

/** 把 `{name}` 換成對應的值。 */
export function formatTreeLabel(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}
