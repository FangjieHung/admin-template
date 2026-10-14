import { Provider } from '@angular/core';
import { PRINT_DOCUMENT_LABELS, PrintDocumentLabels } from '@admin-template/ui';

/**
 * 列印版面（lib-print-document、lib-print-table）的畫面文字。用到它們的頁面在自己的 `providers` 加上這組；
 * 不放 app.config 根層，理由同 component-label-providers.ts（只有列印頁面的 lazy chunk 需要）。
 */
export const ZH_TW_PRINT_DOCUMENT: PrintDocumentLabels = {
  toolbar: '列印工具',
  print: '列印',
  downloadPdf: '下載 PDF',
  pdfHint: '「下載 PDF」會打開列印對話框：目的地選「另存為 PDF」就能存檔（文字可以選取、搜尋）。',
  preview: '{title}的列印預覽',
  pageEstimate: '預覽約 {pages} 頁',
  pageGuide: '第 {page} 頁',
  pageCounter: '第 {page} 頁，共 {pages} 頁',
  numberLabel: '單號',
  dateLabel: '日期',
  signatureDate: '日期',
  fileName: '{number}-{title}',
  noItems: '沒有明細',
};

export const PRINT_DOCUMENT_LABEL_PROVIDERS: Provider[] = [{ provide: PRINT_DOCUMENT_LABELS, useValue: ZH_TW_PRINT_DOCUMENT }];
