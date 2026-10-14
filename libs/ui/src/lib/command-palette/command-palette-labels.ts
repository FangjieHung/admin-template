import { InjectionToken } from '@angular/core';

/**
 * 指令面板（lib-command-palette）的畫面文字。libs/ui 不內建使用者可見字串，由使用端在 `providers` 提供一次。
 * `{query}` 換成使用者輸入的字、`{title}` 換成項目或子清單的名稱、`{group}` 換成分組名稱、`{count}` 換成數量。
 * 分組名稱（「頁面」「工單」「動作」）是資料來源（`CommandProvider.label`）自己帶的，不放在這裡。
 */
export interface CommandPaletteLabels {
  /** 搜尋框的無障礙名稱，例：「搜尋頁面、資料或動作」。 */
  input: string;
  /** 搜尋框的提示字，例：「搜尋頁面、工單或動作…」。 */
  placeholder: string;
  /** 在兩段式動作的子清單裡的提示字，例：「在「{title}」中搜尋…」。 */
  subPlaceholder: string;
  /** 結果清單的無障礙名稱，例：「搜尋結果」。 */
  results: string;
  /** 空白查詢時的「最近使用」分組，例：「最近使用」。 */
  recent: string;
  /** 非同步分組的載入列，例：「搜尋中…」。 */
  loading: string;
  /** 某一組搜尋失敗（其他組照常顯示），例：「{group}暫時無法搜尋」。 */
  groupError: string;
  /** 全部都沒有結果，例：「找不到「{query}」」。 */
  noResults: string;
  /** 沒有結果時的補充說明，例：「換個關鍵字，或輸入工單編號試試」。 */
  noResultsHint: string;
  /** 結果數（念給報讀器），例：「{count} 個結果」。 */
  resultCount: string;
  /** 目前使用中的項目（列尾打勾，報讀器念這句），例：「目前使用中」。 */
  current: string;
  /** 兩段式動作的子清單（有下一層）提示，例：「有子選項」。 */
  hasChildren: string;
  /** 子清單麵包屑的返回按鈕，例：「返回上一層（{title}）」。 */
  back: string;
  /** 對話框在觸控裝置與窄螢幕上的關閉鈕，例：「取消」。 */
  close: string;
  /** 底部提示：上下鍵，例：「選擇」。 */
  hintNavigate: string;
  /** 底部提示：Enter，例：「執行」。 */
  hintRun: string;
  /** 底部提示：Esc，例：「關閉」。 */
  hintClose: string;
  /** 底部提示：在子清單裡的 Backspace，例：「返回」。 */
  hintBack: string;
}

export const COMMAND_PALETTE_LABELS = new InjectionToken<CommandPaletteLabels>('COMMAND_PALETTE_LABELS');

const KEYS: readonly (keyof CommandPaletteLabels)[] = [
  'input',
  'placeholder',
  'subPlaceholder',
  'results',
  'recent',
  'loading',
  'groupError',
  'noResults',
  'noResultsHint',
  'resultCount',
  'current',
  'hasChildren',
  'back',
  'close',
  'hintNavigate',
  'hintRun',
  'hintClose',
  'hintBack',
];

/** 開發期設定錯誤（忘了提供文字或少了某一句）時直接丟出明確訊息，不靜默顯示空白。 */
export function assertCommandPaletteLabels(labels: Partial<CommandPaletteLabels> | null): CommandPaletteLabels {
  if (!labels) throw new Error('CommandPalette：缺少畫面文字。請在 providers 提供 COMMAND_PALETTE_LABELS。');
  const missing = KEYS.filter((key) => !labels[key]);
  if (missing.length > 0) {
    throw new Error(`CommandPalette：COMMAND_PALETTE_LABELS 缺少 ${missing.map((k) => `「${k}」`).join('')}。`);
  }
  return labels as CommandPaletteLabels;
}

/** 把 `{name}` 換成對應的值。 */
export function formatCommandLabel(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}
