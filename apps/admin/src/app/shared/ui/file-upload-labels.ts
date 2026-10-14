import { Provider } from '@angular/core';
import { FILE_UPLOAD_LABELS, FileUploadLabels } from '@admin-template/ui';

/**
 * 附件上傳（lib-file-upload）與它的拍照、預覽對話框的畫面文字。用到它的頁面在自己的 `providers` 加上這組；
 * 不放 app.config 根層，理由同 component-label-providers.ts。
 *
 * 文字直接寫在這裡、不放 core/i18n/zh-tw.ts：那份字典被殼層 import，整份在 Initial bundle 裡
 * （esbuild 把每個中文字輸出成 6 bytes 的跳脫序列），這些句子只有用到上傳的頁面（lazy chunk）需要。
 */
export const ZH_TW_FILE_UPLOAD: FileUploadLabels = {
  dropAction: '選擇檔案',
  dropInstructions: '或把檔案拖放到這裡',
  pasteHint: '選取這個區塊後也可以直接貼上圖片',
  dropActive: '放開以加入檔案',
  camera: '拍照',
  limitSize: '每個檔案 {max} 以內',
  limitCount: '最多 {max} 個',
  listLabel: '已選擇的檔案',
  readonlyEmpty: '沒有附件',
  statusQueued: '等待上傳',
  statusUploading: '上傳中 {percent}%',
  statusDone: '已上傳',
  statusFailed: '上傳失敗',
  progressLabel: '{name} 上傳進度',
  rejectType: '不支援這種檔案類型',
  rejectSize: '超過 {max}，無法上傳',
  rejectCount: '超過 {max} 個檔案的上限',
  retry: '重試',
  retryFile: '重試上傳 {name}',
  cancelFile: '取消上傳 {name}',
  removeFile: '移除 {name}',
  previewFile: '預覽 {name}',
  downloadFile: '下載 {name}',
  announceDone: '已上傳 {name}',
  announceFailed: '上傳失敗：{name}，{reason}',
  announceRejected: '無法加入 {name}：{reason}',
  announceRemoved: '已移除 {name}',
  announceCanceled: '已取消上傳 {name}',
  cameraTitle: '拍照',
  cameraStarting: '正在開啟相機…',
  cameraCapture: '拍攝',
  cameraRetake: '重拍',
  cameraUse: '使用這張',
  cameraSwitch: '切換鏡頭',
  cameraDenied: '沒有相機權限。請在瀏覽器網址列旁的設定允許使用相機，或改選擇檔案。',
  cameraUnavailable: '找不到可以使用的相機，請改選擇檔案。',
  cameraFallback: '改為選擇檔案',
  close: '關閉',
  previewPrevious: '上一張',
  previewNext: '下一張',
  previewCounter: '{current}／{total}',
};

export const FILE_UPLOAD_LABEL_PROVIDERS: Provider[] = [{ provide: FILE_UPLOAD_LABELS, useValue: ZH_TW_FILE_UPLOAD }];
