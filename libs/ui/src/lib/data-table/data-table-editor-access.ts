import { DataTableColumn, DataTableEditor, DataTableKey } from './data-table.types';

// 資料表本身用得到的編輯小工具（哪一格能改、讀哪個屬性）。轉換、檢查、貼上在 data-table-editing.ts（只有 lazy 的編輯控制器用）。

/** 這一欄的編輯器（沒有就是 null）。 */
export function editorOf<T>(col: DataTableColumn<T>): DataTableEditor<T> | null {
  return (col.editor as DataTableEditor<T> | undefined) ?? null;
}

/** 編輯時讀寫的屬性：一般欄是 key，虛擬欄是 editor.field。 */
export function editKeyOf<T>(col: DataTableColumn<T>): DataTableKey<T> | null {
  if (!col.editor) return null;
  return col.virtual ? col.editor.field : (col.key as DataTableKey<T>);
}

/** 任何一欄有 editor。 */
export function hasEditableColumns<T>(columns: readonly DataTableColumn<T>[]): boolean {
  return columns.some((c) => !!c.editor);
}

/** 這一格能不能改：有 editor，而且 canEdit（沒給時一律可以）。 */
export function isCellEditable<T>(col: DataTableColumn<T>, row: T): boolean {
  const editor = editorOf(col);
  return !!editor && (editor.canEdit ? editor.canEdit(row) : true);
}

/** 讀出這一格的值（row[editKey]）。 */
export function readEditValue<T>(col: DataTableColumn<T>, row: T): unknown {
  const key = editKeyOf(col);
  return key === null ? undefined : (row as Record<string, unknown>)[key];
}

