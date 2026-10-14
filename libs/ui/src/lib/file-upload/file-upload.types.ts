import type { UploadedFile } from './upload-adapter';

/** 清單上每一列的狀態：等待上傳（同時上傳數已滿）、上傳中、完成、失敗（可重試）、無法加入（類型、大小、個數）。 */
export type FileUploadStatus = 'queued' | 'uploading' | 'done' | 'failed' | 'rejected';

/** 無法加入的原因。 */
export type FileRejectReason = 'type' | 'size' | 'count';

/** `(rejected)` 送出的內容：哪個檔案、為什麼不能加入。 */
export interface FileRejection {
  file: File;
  reason: FileRejectReason;
}

/** 清單呈現：`list` 一列一個檔案（附件、文件）；`grid` 縮圖方塊（照片）。 */
export type FileUploadLayout = 'list' | 'grid';

/** 拍照鈕：`off` 不顯示；`auto` 允許圖片且裝置有相機時顯示；`only` 只顯示拍照鈕（沒有拖放區）。 */
export type FileUploadCameraMode = 'off' | 'auto' | 'only';

/** 元件內部的一列（不從 index.ts 匯出）。 */
export interface FileUploadItem {
  readonly key: string;
  readonly name: string;
  readonly size: number;
  readonly type: string;
  /** 使用者這次選的檔案；表單一開始就有的附件（writeValue）是 null。 */
  readonly file: File | null;
  readonly status: FileUploadStatus;
  /** 0–1。 */
  readonly progress: number;
  /** 失敗或無法加入的原因（給使用者看的字）。 */
  readonly error: string;
  readonly result: UploadedFile | null;
  /** 本機圖片的 object URL（上傳中就能看到縮圖）；移除或元件銷毀時釋放。 */
  readonly localUrl: string | null;
}
