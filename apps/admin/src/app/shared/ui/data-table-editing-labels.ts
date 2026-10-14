import { DataTableEditingLabels, DataTableLabels } from '@admin-template/ui';
import { ADMIN_DATA_TABLE_LABELS } from './data-table-labels';

/**
 * 資料表「表格內直接編輯」的畫面文字（columns 有 editor 時 labels.editing 必填）。
 * 文字直接寫在這裡、不放 core/i18n/zh-tw.ts：那份字典被殼層 import，整份在 Initial bundle 裡，這些句子只有可編輯的表格需要。
 */
export const ZH_TW_DATA_TABLE_EDITING: DataTableEditingLabels = {
  editCell: '修改{row}的{column}',
  readOnly: '這一格不能修改',
  required: '必填',
  invalidNumber: '請輸入數字',
  invalidDate: '請輸入日期，例如 2026-10-14',
  invalidOption: '「{text}」不是可選的值',
  notFound: '找不到「{text}」',
  toggleOn: '是',
  toggleOff: '否',
  saving: '儲存中',
  saved: '已儲存{column}',
  saveFailed: '儲存失敗，已還原',
  saveFailedToast: '{column}儲存失敗',
  retry: '重試',
  undo: '復原',
  undone: '已復原{column}',
  dirty: '已修改',
  dirtyCount: '已修改 {count} 格',
  errorCount: '有 {count} 個錯誤',
  discard: '捨棄',
  saveAll: '儲存全部',
  nextError: '跳到下一個錯誤',
  barLabel: '未儲存的修改',
  batchSaved: '已儲存 {count} 格',
  batchSaveFailed: '儲存失敗，修改的內容還在',
  discarded: '已捨棄修改',
  pasted: '已貼上 {count} 格',
  pasteErrors: '{count} 格有錯誤',
  pasteSkipped: '{count} 格不能修改，已略過',
  editRow: '編輯',
  editRowLabel: '編輯{row}',
  save: '儲存',
  cancel: '取消',
};

/** 可編輯的表格用這一份（一般文字＋編輯文字）。 */
export const ADMIN_EDITABLE_TABLE_LABELS: DataTableLabels = {
  ...ADMIN_DATA_TABLE_LABELS,
  editing: ZH_TW_DATA_TABLE_EDITING,
};
