import { InjectionToken } from '@angular/core';

/**
 * 附件上傳（lib-file-upload）與它的拍照、預覽對話框的畫面文字。libs/ui 不內建使用者可見字串，由使用端在 `providers` 提供一次。
 * 佔位字：`{name}` 檔名、`{size}` 檔案大小、`{max}` 上限（大小或個數）、`{percent}` 上傳百分比、
 * `{reason}` 無法加入的原因、`{current}`／`{total}` 預覽的第幾張／共幾張。
 */
export interface FileUploadLabels {
  /** 拖放區的主要文字（也是它的無障礙名稱），例：「選擇檔案」。 */
  dropAction: string;
  /** 拖放區主要文字旁的說明，例：「或把檔案拖放到這裡」。 */
  dropInstructions: string;
  /** 拖放區聚焦時可以貼上圖片的提示，例：「選取這個區塊後也可以直接貼上圖片」。 */
  pasteHint: string;
  /** 檔案拖到拖放區上方時的文字，例：「放開以加入檔案」。 */
  dropActive: string;
  /** 拍照按鈕，例：「拍照」。 */
  camera: string;
  /** 限制說明：大小，例：「每個檔案 {max} 以內」。 */
  limitSize: string;
  /** 限制說明：個數，例：「最多 {max} 個」。 */
  limitCount: string;
  /** 檔案清單的無障礙名稱，例：「附件」。 */
  listLabel: string;
  /** 唯讀模式沒有任何附件時，例：「沒有附件」。 */
  readonlyEmpty: string;

  /** 等待上傳（同時上傳數已滿），例：「等待上傳」。 */
  statusQueued: string;
  /** 上傳中，例：「上傳中 {percent}%」。 */
  statusUploading: string;
  /** 上傳完成，例：「已上傳」。 */
  statusDone: string;
  /** 上傳失敗（adapter 丟出的錯誤沒有給原因時），例：「上傳失敗」。 */
  statusFailed: string;
  /** 進度條的無障礙名稱，例：「{name} 上傳進度」。 */
  progressLabel: string;

  /** 無法加入：類型不符，例：「不支援這種檔案類型」。 */
  rejectType: string;
  /** 無法加入：太大，例：「超過 {max}」。 */
  rejectSize: string;
  /** 無法加入：超過個數上限，例：「超過 {max} 個檔案的上限」。 */
  rejectCount: string;

  /** 重試鈕的字，例：「重試」。 */
  retry: string;
  /** 重試鈕的無障礙名稱，例：「重試上傳 {name}」。 */
  retryFile: string;
  /** 取消上傳鈕的無障礙名稱，例：「取消上傳 {name}」。 */
  cancelFile: string;
  /** 移除鈕的無障礙名稱，例：「移除 {name}」。 */
  removeFile: string;
  /** 縮圖按鈕（打開預覽）的無障礙名稱，例：「預覽 {name}」。 */
  previewFile: string;
  /** 下載連結的無障礙名稱，例：「下載 {name}」。 */
  downloadFile: string;

  /** 報讀器：上傳完成，例：「已上傳 {name}」。 */
  announceDone: string;
  /** 報讀器：上傳失敗，例：「上傳失敗：{name}，{reason}」。 */
  announceFailed: string;
  /** 報讀器：無法加入，例：「無法加入 {name}：{reason}」。 */
  announceRejected: string;
  /** 報讀器：已移除，例：「已移除 {name}」。 */
  announceRemoved: string;
  /** 報讀器：已取消上傳，例：「已取消上傳 {name}」。 */
  announceCanceled: string;

  /** 拍照對話框標題，例：「拍照」。 */
  cameraTitle: string;
  /** 正在開啟相機，例：「正在開啟相機…」。 */
  cameraStarting: string;
  /** 拍攝鈕，例：「拍攝」。 */
  cameraCapture: string;
  /** 重拍鈕，例：「重拍」。 */
  cameraRetake: string;
  /** 使用拍好的照片，例：「使用這張」。 */
  cameraUse: string;
  /** 切換前後鏡頭，例：「切換鏡頭」。 */
  cameraSwitch: string;
  /** 沒有相機權限時的說明，例：「沒有相機權限。請在瀏覽器允許使用相機，或改選擇檔案。」 */
  cameraDenied: string;
  /** 找不到相機、瀏覽器不支援時的說明，例：「找不到可以使用的相機，請改選擇檔案。」 */
  cameraUnavailable: string;
  /** 改用選擇檔案的按鈕，例：「改為選擇檔案」。 */
  cameraFallback: string;
  /** 拍照、預覽對話框的關閉鈕，例：「關閉」。 */
  close: string;

  /** 預覽上一張，例：「上一張」。 */
  previewPrevious: string;
  /** 預覽下一張，例：「下一張」。 */
  previewNext: string;
  /** 預覽的第幾張，例：「{current}／{total}」。 */
  previewCounter: string;
}

export const FILE_UPLOAD_LABELS = new InjectionToken<FileUploadLabels>('FILE_UPLOAD_LABELS');

const KEYS: readonly (keyof FileUploadLabels)[] = [
  'dropAction',
  'dropInstructions',
  'pasteHint',
  'dropActive',
  'camera',
  'limitSize',
  'limitCount',
  'listLabel',
  'readonlyEmpty',
  'statusQueued',
  'statusUploading',
  'statusDone',
  'statusFailed',
  'progressLabel',
  'rejectType',
  'rejectSize',
  'rejectCount',
  'retry',
  'retryFile',
  'cancelFile',
  'removeFile',
  'previewFile',
  'downloadFile',
  'announceDone',
  'announceFailed',
  'announceRejected',
  'announceRemoved',
  'announceCanceled',
  'cameraTitle',
  'cameraStarting',
  'cameraCapture',
  'cameraRetake',
  'cameraUse',
  'cameraSwitch',
  'cameraDenied',
  'cameraUnavailable',
  'cameraFallback',
  'close',
  'previewPrevious',
  'previewNext',
  'previewCounter',
];

/** 開發期設定錯誤（忘了提供文字或少了某一句）時直接丟出明確訊息，不靜默顯示空白。 */
export function assertFileUploadLabels(labels: Partial<FileUploadLabels> | null): FileUploadLabels {
  if (!labels) throw new Error('FileUpload：缺少畫面文字。請在 providers 提供 FILE_UPLOAD_LABELS。');
  const missing = KEYS.filter((key) => !labels[key]);
  if (missing.length > 0) {
    throw new Error(`FileUpload：FILE_UPLOAD_LABELS 缺少 ${missing.map((k) => `「${k}」`).join('')}。`);
  }
  return labels as FileUploadLabels;
}

/** 把 `{name}` 換成對應的值。 */
export function formatFileUploadLabel(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}
