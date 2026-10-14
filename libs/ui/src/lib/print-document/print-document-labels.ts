import { InjectionToken } from '@angular/core';

/**
 * 列印版面（lib-print-document、lib-print-table）的畫面文字。libs/ui 不內建使用者可見字串，由使用端在 `providers` 提供一次。
 * 帶參數的句子用 `{name}` 佔位（同其他 libs/ui 元件）：`{title}` 單據標題、`{number}` 單號、`{page}` 第幾頁、`{pages}` 總頁數。
 */
export interface PrintDocumentLabels {
  /** 工具列的無障礙名稱，例：「列印工具」。 */
  toolbar: string;
  /** 列印按鈕，例：「列印」。 */
  print: string;
  /** 下載 PDF 按鈕，例：「下載 PDF」。 */
  downloadPdf: string;
  /** 下載 PDF 的說明（按鈕旁邊的小字，也是按鈕的 aria-describedby），例：「會打開列印對話框，目的地選『另存為 PDF』」。 */
  pdfHint: string;
  /** 紙張預覽的無障礙名稱，例：「{title}的列印預覽」。 */
  preview: string;
  /** 工具列上的頁數估計（螢幕預覽），例：「預覽約 {pages} 頁」。 */
  pageEstimate: string;
  /** 預覽的分頁參考線旁的字，例：「第 {page} 頁」。 */
  pageGuide: string;
  /** 列印時每頁頁尾的頁碼（印在 @page 的頁邊），例：「第 {page} 頁，共 {pages} 頁」。 */
  pageCounter: string;
  /** 頁首的單號標籤，例：「單號」。 */
  numberLabel: string;
  /** 頁首的日期標籤，例：「日期」。 */
  dateLabel: string;
  /** 簽名欄裡的日期欄，例：「日期」。 */
  signatureDate: string;
  /** 列印時暫時換上的 document.title（存成 PDF 時的預設檔名），例：「{number}-{title}」；沒有單號時只用標題。 */
  fileName: string;
  /** 明細表沒有任何資料列，例：「沒有明細」。 */
  noItems: string;
}

export const PRINT_DOCUMENT_LABELS = new InjectionToken<PrintDocumentLabels>('PRINT_DOCUMENT_LABELS');

const KEYS: readonly (keyof PrintDocumentLabels)[] = [
  'toolbar',
  'print',
  'downloadPdf',
  'pdfHint',
  'preview',
  'pageEstimate',
  'pageGuide',
  'pageCounter',
  'numberLabel',
  'dateLabel',
  'signatureDate',
  'fileName',
  'noItems',
];

/** 開發期設定錯誤（忘了提供文字或少了某一句）時直接丟出明確訊息，不靜默顯示空白。 */
export function assertPrintDocumentLabels(
  labels: Partial<PrintDocumentLabels> | null,
  owner = 'PrintDocument',
): PrintDocumentLabels {
  if (!labels) throw new Error(`${owner}：缺少畫面文字。請在 providers 提供 PRINT_DOCUMENT_LABELS。`);
  const missing = KEYS.filter((key) => !labels[key]);
  if (missing.length > 0) {
    throw new Error(`${owner}：PRINT_DOCUMENT_LABELS 缺少 ${missing.map((k) => `「${k}」`).join('')}。`);
  }
  return labels as PrintDocumentLabels;
}

/** 把 `{name}` 換成對應的值；沒給的佔位原樣留著。 */
export function formatPrintLabel(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}
