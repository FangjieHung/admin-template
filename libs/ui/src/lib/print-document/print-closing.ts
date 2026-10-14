import { InjectionToken, Signal, TemplateRef } from '@angular/core';

/**
 * lib-print-document 與它裡面的 lib-print-table 之間的約定（內部用）：單據的「結尾」（備註、簽名欄、頁尾）
 * 由最後一張明細表畫在自己最後一個 `<tbody>` 裡，跟最後幾列明細、合計列一起 `break-inside: avoid`。
 *
 * 為什麼不讓它們留在表格後面、用 `break-before: avoid` 黏上去：實測 Chrome 149 只在同一個表格區段裡守住「不換頁」，
 * 表格後面的區塊放不下時，它寧可把合計拆開、把簽名欄切成兩半，也不會回頭把最後幾列一起帶到下一頁。
 */
export interface PrintClosingHost {
  /** 結尾的範本（lib-print-document 的 view 裡）。 */
  readonly closingTemplate: Signal<TemplateRef<unknown> | undefined>;
  /** 負責畫結尾的明細表（最後登記的那一張）；沒有明細表時由單據自己畫。 */
  readonly closingTable: Signal<object | null>;
  registerTable(table: object): void;
  unregisterTable(table: object): void;
}

export const PRINT_CLOSING_HOST = new InjectionToken<PrintClosingHost>('PRINT_CLOSING_HOST');
