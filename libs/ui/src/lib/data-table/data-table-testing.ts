import { rowsToAoa } from './data-table-export';
import { DataTableColumn } from './data-table.types';

/**
 * 頁面測試用的 lib-data-table 輔助函式（只給 spec 用）。
 *
 * 從 `@admin-template/ui/testing` 匯入，**不從 index.ts 匯出**：這個檔案只在測試裡用到，不該進 production bundle。
 */

/** 某一欄的畫面值與匯出值刻意不同的理由；`when` 可以把例外限縮到特定資料列。 */
export interface DisplayExportException<T> {
  reason: string;
  when?: (row: T, rowIndex: number) => boolean;
}

/**
 * 欄位 key → 為什麼這一欄的畫面值與匯出值刻意不同（例：畫面加單位、Excel 存可計算的裸數字）。
 * 字串＝整欄例外；物件可以用 `when` 只放過部分資料列。理由不可以是空字串。
 */
export type DisplayExportExceptions<T> = Readonly<Record<string, string | DisplayExportException<T>>>;

/**
 * 儲存格裡不是「值」的部分：編輯提示的鉛筆、儲存中／存好的圖示、目前格子的框線、已修改的角落標記與報讀器文字、
 * 錯誤訊息、打字開始編輯的鍵盤接收器、開關的軌道，以及 dtCell 裡的圖示字（Material Symbols 的 ligature 文字，
 * 例如 `arrow_upward`，畫面上是圖示不是字）。比對前先拿掉，只留使用者讀到的值。
 */
const DECORATION_SELECTOR = [
  '.material-symbols-rounded',
  '.material-symbols-outlined',
  '.material-symbols-sharp',
  '.material-icons',
  'mat-icon',
  '.dt-edit-icon',
  '.dt-cell-status',
  '.dt-ring',
  '.dt-cell-deco',
  '.dt-sr-only',
  '.dt-cell-error',
  '.dt-switch__track',
  'input',
].join(', ');

function fail(message: string): never {
  throw new Error(message);
}

/** 空白一律收成一個半形空格、去掉頭尾（畫面上看不出差別的空白不算不一致）。 */
function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function cellText(cell: Element): string {
  const clone = cell.cloneNode(true) as Element;
  clone.querySelectorAll(DECORATION_SELECTOR).forEach((node) => node.remove());
  return normalize(clone.textContent ?? '');
}

function exceptionApplies<T>(
  exception: string | DisplayExportException<T> | undefined,
  key: string,
  row: T,
  rowIndex: number,
): boolean {
  if (exception === undefined) return false;
  const reason = typeof exception === 'string' ? exception : exception.reason;
  if (!reason.trim()) fail(`「${key}」列為例外，但沒有寫理由。`);
  return typeof exception === 'string' || exception.when?.(row, rowIndex) === true;
}

function tableOf(root: Element): HTMLTableElement {
  const tables = root.matches('lib-data-table')
    ? [root.querySelector<HTMLTableElement>('table.dt-table')]
    : Array.from(root.querySelectorAll<HTMLTableElement>('lib-data-table table.dt-table'));
  const found = tables.filter((t): t is HTMLTableElement => t !== null);
  if (found.length === 0) fail('找不到 lib-data-table 的表格（table.dt-table）。');
  if (found.length > 1) {
    fail(`範圍內有 ${found.length} 個 lib-data-table，請傳入只包住其中一個的元素（例如那張表格的 .ui-card）。`);
  }
  return found[0];
}

/**
 * 斷言「畫面上每一格的值」等於「匯出 Excel 時寫進去的值」。
 *
 * 匯出讀的是資料（`exportValue`／`value`／`row[key]`），畫面讀的是 dtCell 範本；兩邊各自維護，
 * 改了一邊忘了另一邊時不會有任何錯誤。這個斷言用跟真正匯出同一份程式（`rowsToAoa`）算出 Excel 的內容，
 * 逐格和畫面比對；刻意不同的欄位要寫進 `exceptions` 並附理由。
 *
 * - `root`：包住一個 lib-data-table 的元素（或 lib-data-table 本身）。
 * - `columns`：傳給表格的 columns。畫面上沒顯示的欄（欄位選擇面板隱藏的）不比對，順序照畫面——跟匯出一樣。
 * - `rows`：畫面上這一頁的資料列，**照畫面順序**（有分頁時只傳目前這一頁，排序過就傳排序後的）。
 *
 * 會檢查：列數一致、畫面上的每一欄都在 columns 裡、例外的 key 真的是一個欄位、每一格的文字（拿掉編輯提示等裝飾）
 * 等於匯出值。`exportSkip` 的欄（操作欄）不比對。
 */
export function expectExportMatchesDisplay<T>(
  root: Element,
  columns: readonly DataTableColumn<T>[],
  rows: readonly T[],
  exceptions: DisplayExportExceptions<T> = {},
): void {
  const keys = new Set(columns.map((c) => c.key));
  for (const key of Object.keys(exceptions)) {
    if (!keys.has(key)) fail(`例外表的「${key}」不是任何一個欄位的 key（欄位改名或刪掉了？）。`);
  }

  const table = tableOf(root);
  const renderedRows = Array.from(table.querySelectorAll<HTMLTableRowElement>(':scope > tbody > tr')).filter(
    (tr) => !tr.classList.contains('dt-skeleton-row'),
  );
  if (renderedRows.length !== rows.length) {
    fail(`畫面上有 ${renderedRows.length} 列，但傳入 ${rows.length} 列（有分頁時只傳目前這一頁）。`);
  }
  if (rows.length === 0) return;

  // 畫面上的欄位順序（第一列每格的 data-label；勾選欄的 data-label 是空字串，展開鈕、手機編輯鈕沒有 data-label）。
  const labels = Array.from(renderedRows[0].querySelectorAll(':scope > td[data-label]'))
    .map((td) => td.getAttribute('data-label') ?? '')
    .filter((label) => label !== '');
  const shown = labels.map((label) => {
    const matches = columns.filter((c) => c.label === label);
    if (matches.length === 0) fail(`畫面上有「${label}」欄，但傳入的 columns 裡沒有這個標題。`);
    if (matches.length > 1) fail(`columns 裡有 ${matches.length} 欄的標題都是「${label}」，無法對應。`);
    return matches[0];
  });
  const exported = shown.filter((c) => !c.exportSkip);
  const aoa = rowsToAoa(exported, rows);

  renderedRows.forEach((tr, rowIndex) => {
    const row = rows[rowIndex];
    const cells = Array.from(tr.querySelectorAll(':scope > td[data-label]'));
    exported.forEach((col, colIndex) => {
      if (exceptionApplies(exceptions[col.key], col.key, row, rowIndex)) return;
      const cell = cells.find((td) => td.getAttribute('data-label') === col.label);
      if (!cell) fail(`第 ${rowIndex + 1} 列找不到「${col.label}」欄的儲存格。`);
      const displayed = cellText(cell);
      const value = normalize(String(aoa[rowIndex + 1][colIndex]));
      if (displayed !== value) {
        fail(
          `第 ${rowIndex + 1} 列的「${col.label}」欄不一致：畫面顯示「${displayed}」、匯出寫入「${value}」。` +
            `若是刻意的，把 '${col.key}' 加進例外表並寫明理由。`,
        );
      }
    });
  });
}
