import { InjectionToken } from '@angular/core';
import type { DataTableLabels } from '../data-table/data-table.types';

/**
 * 匯入精靈（lib-import-wizard）的畫面文字。libs/ui 不內建使用者可見字串，由使用端在 `providers` 提供一次。
 * 精靈裡面還用到步驟精靈、附件上傳與確認對話框，所以頁面也要提供 `STEP_WIZARD_LABELS`、`FILE_UPLOAD_LABELS`、
 * `CONFIRM_DIALOG_LABELS`。大括號裡的名稱會換成數字或文字（每一句的說明寫了有哪些）。
 */
export interface ImportWizardLabels {
  // ---- 步驟 ----
  /** 例：「上傳檔案」。 */
  stepUpload: string;
  /** 例：「欄位對應」。 */
  stepMapping: string;
  /** 例：「預覽與檢查」。 */
  stepPreview: string;
  /** 例：「匯入」。 */
  stepImport: string;
  uploadDescription: string;
  mappingDescription: string;
  previewDescription: string;
  importDescription: string;

  // ---- 1. 上傳 ----
  /** 上傳欄位的標籤，例：「匯入檔案」。 */
  fileLabel: string;
  /** 例：「CSV、TSV 或 Excel（.xlsx、.xls）」。 */
  fileHint: string;
  /** 沒選檔案就按下一步，例：「請選擇要匯入的檔案」。 */
  fileRequired: string;
  /** 例：「下載範本檔」。 */
  downloadTemplate: string;
  /** 範本鈕旁的說明，例：「照範本的欄位填寫，就不必手動對應」。 */
  templateHint: string;
  /** 範本檔的檔名，例：「匯入範本.csv」（可以用 `templateFileName` 輸入換掉）。 */
  templateFileName: string;
  /** 例：「無法讀取這個檔案，請確認是 CSV 或 Excel 格式」。 */
  readFailed: string;
  /** 例：「檔案裡沒有資料」。 */
  emptyFile: string;
  /** `{max}` 上限、`{count}` 這個檔案的列數。 */
  tooManyRows: string;
  /** 例：「工作表」。 */
  sheet: string;
  /** 例：「第一列是欄位名稱」。 */
  hasHeader: string;
  /** `{rows}` 資料列數、`{columns}` 欄數，例：「{rows} 列資料 · {columns} 個欄位」。 */
  fileSummary: string;
  /** 用 Big5 讀取時的說明，例：「以 Big5 編碼讀取（Excel 存的中文 CSV）」。 */
  encodingBig5: string;
  /** 沒有標題的欄位名稱，`{n}` 第幾欄，例：「第 {n} 欄」。 */
  columnName: string;

  // ---- 2. 欄位對應 ----
  /** 表頭，例：「匯入欄位」。 */
  mappingField: string;
  /** 表頭，例：「檔案中的欄位」。 */
  mappingSource: string;
  /** 表頭，例：「範例值」。 */
  mappingSamples: string;
  /** 下拉的「不匯入」選項，也是沒有對應的檔案欄位的標示，例：「不匯入」。 */
  notImported: string;
  /** 必填欄位的報讀文字（畫面上是 *），例：「必填」。 */
  requiredMark: string;
  /** 必填欄位沒選，例：「請選擇對應的欄位」。 */
  mappingRequired: string;
  /** 例：「不匯入的欄位」。 */
  unusedColumns: string;
  /** 例：「檔案裡的每一欄都有對應」。 */
  unusedNone: string;
  /** 例：「記住這次的對應，下次自動套用」。 */
  rememberMapping: string;
  /** `{count}` 自動對應到的欄位數，`{total}` 欄位總數。 */
  autoMapped: string;
  /** 這一欄沒有任何值，例：「（空白）」。 */
  noSamples: string;

  // ---- 3. 預覽與檢查 ----
  /** `{count}`，例：「可匯入 {count} 列」。 */
  countReady: string;
  /** `{count}`，例：「有問題 {count} 列」。 */
  countProblem: string;
  /** `{count}`，例：「重複 {count} 列」。 */
  countDuplicate: string;
  /** 例：「只看有問題的列」。 */
  onlyProblems: string;
  /** 把焦點移到下一個有錯的儲存格，例：「下一個問題」。 */
  nextProblem: string;
  /** `{count}` 有問題的列數，例：「略過有問題的列（{count} 列不匯入）」。 */
  skipInvalid: string;
  /** 還有問題又沒勾略過時，錯誤摘要的說明。`{count}`。 */
  blockedByProblems: string;
  /** 表頭，例：「列」。 */
  rowNumber: string;
  /** 表頭，例：「狀態」。 */
  rowStatus: string;
  /** 例：「可匯入」。 */
  statusReady: string;
  /** 例：「有問題」。 */
  statusProblem: string;
  /** `{row}`，例：「與第 {row} 列重複」。 */
  statusDuplicateFile: string;
  /** 例：「已存在」。 */
  statusDuplicateExisting: string;
  /** 儲存格按鈕的無障礙名稱，`{field}`、`{row}`、`{value}`，例：「第 {row} 列 {field}：{value}，按下修改」。 */
  editCell: string;
  /** 修改中的輸入框名稱，`{field}`、`{row}`，例：「修改第 {row} 列的{field}（Enter 確定，Esc 取消）」。 */
  editInput: string;
  /** 空白儲存格顯示的字，例：「（空白）」。 */
  emptyCell: string;
  /** 修好之後念的字，`{field}`、`{row}`。 */
  cellFixed: string;
  /** 還是有錯時念的字，`{field}`、`{message}`。 */
  cellStillInvalid: string;
  /** `{count}`、`{field}`，例：「{count} 列重複（依「{field}」判斷）」。 */
  duplicatesTitle: string;
  /** 例：「略過，不匯入」。 */
  duplicateSkip: string;
  /** 例：「更新現有的資料」。 */
  duplicateUpdate: string;
  /** 例：「仍然新增一筆」。 */
  duplicateCreate: string;
  /** 例：「正在比對現有資料…」。 */
  checkingExisting: string;
  /** 例：「無法比對現有資料，只檢查檔案內的重複」。 */
  existingFailed: string;
  /** 只看有問題、但已經沒有問題時，例：「沒有需要修正的列」。 */
  noProblems: string;

  // ---- 4. 匯入 ----
  /** `{create}`、`{update}`、`{skip}`，例：「將新增 {create} 筆、更新 {update} 筆，略過 {skip} 筆」。 */
  importSummary: string;
  /** 「完成」鈕換成這句，`{count}`，例：「開始匯入 {count} 筆」。 */
  start: string;
  /** 例：「沒有可以匯入的資料」。 */
  nothingToImport: string;
  /** 進度條的名稱，例：「匯入進度」。 */
  progressLabel: string;
  /** `{done}`、`{total}`，例：「已處理 {done}／{total} 筆」。 */
  progressText: string;
  /** 例：「停止匯入」。 */
  stop: string;
  /** 確認對話框標題，例：「停止匯入？」。 */
  stopTitle: string;
  /** 例：「已經匯入的資料會保留，還沒匯入的不會匯入。」。 */
  stopMessage: string;
  /** 對話框的確認鈕，例：「停止匯入」。 */
  stopConfirm: string;
  /** `{count}` 已匯入（新增＋更新）的筆數。 */
  canceledNote: string;
  /** 例：「匯入完成」。 */
  resultTitle: string;
  /** 例：「已停止匯入」。 */
  resultCanceledTitle: string;
  resultCreated: string;
  resultUpdated: string;
  resultSkipped: string;
  resultFailed: string;
  /** 例：「匯入失敗的列」。 */
  failedRows: string;
  /** `{row}`、`{message}`，例：「第 {row} 列：{message}」。 */
  failedRow: string;
  /** 例：「下載錯誤報告」。 */
  downloadReport: string;
  /** 例：「列出失敗與略過的列和原因，修正後可以再匯入。」。 */
  reportHint: string;
  /** 錯誤報告的檔名，例：「匯入錯誤報告.csv」。 */
  reportFileName: string;
  /** 錯誤報告的欄位名稱，例：「列號」。 */
  reportRow: string;
  /** 例：「原因」。 */
  reportReason: string;
  /** `{row}`。 */
  reasonDuplicateFile: string;
  /** `{field}`，例：「已有相同的{field}」。 */
  reasonDuplicateExisting: string;
  /** 例：「已停止匯入，沒有匯入」。 */
  reasonNotSent: string;
  /** 一整批失敗時每一列的原因，例：「匯入失敗，請稍後再試」。 */
  batchFailed: string;
  /** 例：「完成」。 */
  done: string;
  /** 例：「再匯入一個檔案」。 */
  importAnother: string;
  /** 結果念出的字，`{created}`、`{updated}`、`{skipped}`、`{failed}`。 */
  announceResult: string;

  // ---- 驗證訊息 ----
  errorRequired: string;
  errorNumber: string;
  errorDate: string;
  errorEmail: string;
  errorPhone: string;
  /** `{options}` 換成選項清單。 */
  errorOption: string;

  /** 預覽表格（lib-data-table）的文字，必須含 `paging`。 */
  table: DataTableLabels;
}

export const IMPORT_WIZARD_LABELS = new InjectionToken<ImportWizardLabels>('IMPORT_WIZARD_LABELS');

const KEYS: readonly (keyof ImportWizardLabels)[] = [
  'stepUpload', 'stepMapping', 'stepPreview', 'stepImport',
  'uploadDescription', 'mappingDescription', 'previewDescription', 'importDescription',
  'fileLabel', 'fileHint', 'fileRequired', 'downloadTemplate', 'templateHint', 'templateFileName',
  'readFailed', 'emptyFile', 'tooManyRows', 'sheet', 'hasHeader', 'fileSummary', 'encodingBig5', 'columnName',
  'mappingField', 'mappingSource', 'mappingSamples', 'notImported', 'requiredMark', 'mappingRequired',
  'unusedColumns', 'unusedNone', 'rememberMapping', 'autoMapped', 'noSamples',
  'countReady', 'countProblem', 'countDuplicate', 'onlyProblems', 'nextProblem', 'skipInvalid', 'blockedByProblems',
  'rowNumber', 'rowStatus', 'statusReady', 'statusProblem', 'statusDuplicateFile', 'statusDuplicateExisting',
  'editCell', 'editInput', 'emptyCell', 'cellFixed', 'cellStillInvalid',
  'duplicatesTitle', 'duplicateSkip', 'duplicateUpdate', 'duplicateCreate', 'checkingExisting', 'existingFailed', 'noProblems',
  'importSummary', 'start', 'nothingToImport', 'progressLabel', 'progressText', 'stop', 'stopTitle', 'stopMessage',
  'stopConfirm', 'canceledNote', 'resultTitle', 'resultCanceledTitle', 'resultCreated', 'resultUpdated', 'resultSkipped',
  'resultFailed', 'failedRows', 'failedRow', 'downloadReport', 'reportHint', 'reportFileName', 'reportRow', 'reportReason',
  'reasonDuplicateFile', 'reasonDuplicateExisting', 'reasonNotSent', 'batchFailed', 'done', 'importAnother', 'announceResult',
  'errorRequired', 'errorNumber', 'errorDate', 'errorEmail', 'errorPhone', 'errorOption',
  'table',
];

/** 開發期設定錯誤（忘了提供文字或少了某一句）時直接丟出明確訊息，不靜默顯示空白。 */
export function assertImportWizardLabels(labels: Partial<ImportWizardLabels> | null): ImportWizardLabels {
  if (!labels) throw new Error('ImportWizard：缺少畫面文字。請在 providers 提供 IMPORT_WIZARD_LABELS。');
  const missing = KEYS.filter((key) => !labels[key]);
  if (labels.table && !labels.table.paging) missing.push('table');
  if (missing.length > 0) {
    throw new Error(`ImportWizard：IMPORT_WIZARD_LABELS 缺少 ${missing.map((k) => `「${k}」`).join('')}。`);
  }
  return labels as ImportWizardLabels;
}

/** 把 `{name}` 換成對應的值。 */
export function formatImportLabel(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}
