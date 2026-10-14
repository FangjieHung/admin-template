import { Provider } from '@angular/core';
import { FILE_UPLOAD_LABELS, IMPORT_WIZARD_LABELS, ImportWizardLabels, STEP_WIZARD_LABELS } from '@admin-template/ui';
import { ADMIN_DATA_TABLE_LABELS } from './data-table-labels';
import { CONFIRM_DIALOG_LABEL_PROVIDERS } from './component-label-providers';
import { ZH_TW_STEP_WIZARD } from './step-wizard-labels';
import { ZH_TW_FILE_UPLOAD } from './file-upload-labels';

/**
 * 匯入精靈（lib-import-wizard）的畫面文字。用到它的頁面在自己的 `providers` 加上 `IMPORT_WIZARD_LABEL_PROVIDERS`
 * （已包含精靈裡用到的步驟精靈、附件上傳、確認對話框的文字）；不放 app.config 根層，理由同 component-label-providers.ts。
 *
 * 文字直接寫在這裡、不放 core/i18n/zh-tw.ts：那份字典被殼層 import，整份在 Initial bundle 裡，這些句子只有匯入頁需要。
 */
export const ZH_TW_IMPORT_WIZARD: ImportWizardLabels = {
  stepUpload: '上傳檔案',
  stepMapping: '欄位對應',
  stepPreview: '預覽與檢查',
  stepImport: '匯入',
  uploadDescription: '選擇 CSV 或 Excel 檔案。檔案只在瀏覽器裡讀取，按下「開始匯入」之前不會存進任何地方。',
  mappingDescription: '確認檔案裡的每一欄要匯入成哪個欄位；名稱相符的已經自動對應好了。',
  previewDescription: '有問題的格子會標出原因，點一下就能直接修改。',
  importDescription: '確認數量後開始匯入；匯入中可以隨時停止。',

  fileLabel: '匯入檔案',
  fileHint: 'CSV、TSV 或 Excel（.xlsx、.xls）',
  fileRequired: '請選擇要匯入的檔案',
  downloadTemplate: '下載範本檔',
  templateHint: '照範本的欄位填寫，就不必手動對應。',
  templateFileName: '匯入範本.csv',
  readFailed: '無法讀取這個檔案，請確認是 CSV 或 Excel 格式',
  emptyFile: '檔案裡沒有資料',
  tooManyRows: '超過一次 {max} 列的上限（這個檔案有 {count} 列），請分成幾個檔案匯入',
  sheet: '工作表',
  hasHeader: '第一列是欄位名稱',
  fileSummary: '{rows} 列資料 · {columns} 個欄位',
  encodingBig5: '以 Big5 編碼讀取（Excel 存的中文 CSV）',
  columnName: '第 {n} 欄',

  mappingField: '匯入欄位',
  mappingSource: '檔案中的欄位',
  mappingSamples: '範例值',
  notImported: '不匯入',
  requiredMark: '必填',
  mappingRequired: '請選擇對應的欄位',
  unusedColumns: '不匯入的欄位',
  unusedNone: '檔案裡的每一欄都有對應',
  rememberMapping: '記住這次的對應，下次自動套用',
  autoMapped: '已自動對應 {count}／{total} 個欄位',
  noSamples: '（空白）',

  countReady: '可匯入 {count} 列',
  countProblem: '有問題 {count} 列',
  countDuplicate: '重複 {count} 列',
  onlyProblems: '只看有問題的列',
  nextProblem: '下一個問題',
  skipInvalid: '略過有問題的列（{count} 列不匯入）',
  blockedByProblems: '還有 {count} 列有問題：修正後再繼續，或勾選「略過有問題的列」。',
  rowNumber: '列',
  rowStatus: '狀態',
  statusReady: '可匯入',
  statusProblem: '有問題',
  statusDuplicateFile: '與第 {row} 列重複',
  statusDuplicateExisting: '已存在',
  editCell: '第 {row} 列 {field}：{value}，按下修改',
  editInput: '修改第 {row} 列的{field}（Enter 確定，Esc 取消）',
  emptyCell: '（空白）',
  cellFixed: '第 {row} 列的{field}已修正',
  cellStillInvalid: '{field}還有問題：{message}',
  duplicatesTitle: '{count} 列重複（依「{field}」判斷），要怎麼處理？',
  duplicateSkip: '略過，不匯入',
  duplicateUpdate: '更新現有的資料',
  duplicateCreate: '仍然新增一筆',
  checkingExisting: '正在比對現有資料…',
  existingFailed: '無法比對現有資料，只檢查檔案內的重複',
  noProblems: '沒有需要修正的列',

  importSummary: '將新增 {create} 筆、更新 {update} 筆，略過 {skip} 筆',
  start: '開始匯入 {count} 筆',
  nothingToImport: '沒有可以匯入的資料：回到上一步修正，或取消勾選「略過」。',
  progressLabel: '匯入進度',
  progressText: '已處理 {done}／{total} 筆',
  stop: '停止匯入',
  stopTitle: '停止匯入？',
  stopMessage: '已經匯入的資料會保留，還沒匯入的不會匯入。',
  stopConfirm: '停止匯入',
  canceledNote: '停止前已匯入的 {count} 筆會保留；沒有匯入的列寫在錯誤報告裡。',
  resultTitle: '匯入完成',
  resultCanceledTitle: '已停止匯入',
  resultCreated: '新增',
  resultUpdated: '更新',
  resultSkipped: '略過',
  resultFailed: '失敗',
  failedRows: '匯入失敗的列',
  failedRow: '第 {row} 列：{message}',
  downloadReport: '下載錯誤報告',
  reportHint: '列出失敗與略過的列和原因，修正後可以再匯入。',
  reportFileName: '匯入錯誤報告.csv',
  reportRow: '列號',
  reportReason: '原因',
  reasonDuplicateFile: '與第 {row} 列重複',
  reasonDuplicateExisting: '已有相同的{field}',
  reasonNotSent: '已停止匯入，沒有匯入',
  batchFailed: '匯入失敗，請稍後再試',
  done: '完成',
  importAnother: '再匯入一個檔案',
  announceResult: '新增 {created} 筆、更新 {updated} 筆、略過 {skipped} 筆、失敗 {failed} 筆',

  errorRequired: '必填',
  errorNumber: '請填數字',
  errorDate: '日期格式不正確，請寫成 2026-03-08',
  errorEmail: 'Email 格式不正確',
  errorPhone: '電話格式不正確',
  errorOption: '請填 {options} 其中之一',

  table: ADMIN_DATA_TABLE_LABELS,
};

/** 匯入時「上傳」其實是在瀏覽器裡讀檔：把附件上傳的幾句狀態換成「讀取」。 */
const IMPORT_FILE_UPLOAD = {
  ...ZH_TW_FILE_UPLOAD,
  statusQueued: '等待讀取',
  statusUploading: '讀取中 {percent}%',
  statusDone: '已讀取',
  statusFailed: '無法讀取',
  progressLabel: '{name} 讀取進度',
  rejectSize: '超過 {max}，無法匯入',
  announceDone: '已讀取 {name}',
  announceFailed: '無法讀取 {name}：{reason}',
  cancelFile: '取消讀取 {name}',
  retryFile: '重新讀取 {name}',
};

export const IMPORT_WIZARD_LABEL_PROVIDERS: Provider[] = [
  // 「開始匯入」按下後的忙碌文字。
  { provide: STEP_WIZARD_LABELS, useValue: { ...ZH_TW_STEP_WIZARD, submitting: '匯入中…' } },
  ...CONFIRM_DIALOG_LABEL_PROVIDERS,
  { provide: FILE_UPLOAD_LABELS, useValue: IMPORT_FILE_UPLOAD },
  { provide: IMPORT_WIZARD_LABELS, useValue: ZH_TW_IMPORT_WIZARD },
];
