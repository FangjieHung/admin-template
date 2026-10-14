/** 紙張：A4（210 × 297 mm）或美規 Letter（8.5 × 11 in＝215.9 × 279.4 mm）。 */
export type PrintPaper = 'A4' | 'Letter';

/** 直式或橫式。 */
export type PrintOrientation = 'portrait' | 'landscape';

/** 四邊的頁邊（mm）。 */
export interface PrintMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** 明細表的一欄。 */
export interface PrintTableColumn<T> {
  /** 欄位鍵：預設顯示 `row[key]`，也是 `<ng-template libPrintCell="key">` 對應的名字。 */
  key: string;
  /** 表頭文字（每一頁都會重印）。 */
  label: string;
  /** 對齊：數字欄用 `'end'`（靠右、等寬數字）。 */
  align?: 'start' | 'center' | 'end';
  /** 欄寬（CSS 長度，例：`'12mm'`、`'18%'`）；不給就依內容分配。 */
  width?: string;
  /** 改寫顯示文字（例：千分位、單位）；不給就用 `row[key]`。 */
  value?: (row: T, index: number) => string | number | null | undefined;
}

/** 明細表下方的小計、稅額、合計列。值由使用端格式化好（幣別、千分位）。 */
export interface PrintSummaryRow {
  label: string;
  value: string;
  /** 最後的總計：粗體、上方粗線。 */
  emphasis?: boolean;
}
