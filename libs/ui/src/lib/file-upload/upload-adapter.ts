/**
 * 附件上傳（lib-file-upload）的上傳介面。元件只認得 `upload`，不管檔案送到哪裡（自己的 API、S3 預簽網址、雲端硬碟）。
 *
 * - `upload` 收到一個檔案與 `signal`、`onProgress`：按「取消」時元件會 abort `signal`，接伺服器時把它傳給
 *   `fetch`／`XMLHttpRequest`（`xhr.abort()`）即可；`onProgress(0..1)` 有就呼叫，沒有進度可報也可以不呼叫。
 * - 成功時回傳 `UploadedFile`：表單的值只存這份「參照」（id、名稱、網址），不會存檔案內容或 base64。
 * - 失敗時 reject；丟 `uploadError(原因)` 時原因會顯示在那一列（給使用者看的字），其他錯誤只顯示「上傳失敗」。
 * - `release`（選填）：元件不再顯示某個檔案時呼叫（使用者移除，或元件被銷毀），用來釋放本機資源（例如 object URL）。
 *   不要在這裡刪除伺服器上的檔案：表單還沒送出前移除的檔案要不要刪，由頁面看 `(removed)` 決定。
 */
export interface UploadedFile {
  id: string;
  name: string;
  /** bytes。 */
  size: number;
  /** MIME type，例：`image/jpeg`、`application/pdf`。 */
  type: string;
  /** 下載或開啟的網址（唯讀模式的下載連結、圖片的預覽）。 */
  url?: string;
  /** 縮圖網址；沒有時圖片用 `url`。 */
  thumbnailUrl?: string;
}

export interface UploadOptions {
  signal: AbortSignal;
  onProgress(fraction: number): void;
}

export interface UploadAdapter {
  upload(file: File, options: UploadOptions): Promise<UploadedFile>;
  release?(file: UploadedFile): void;
}

/**
 * 給使用者看的上傳失敗原因（例：「檔案已存在」「伺服器空間不足」）：`reject(uploadError('檔案已存在'))`。
 * 是一般的 Error，name 是 `UploadError`。
 */
export function uploadError(message: string): Error {
  const error = new Error(message);
  error.name = 'UploadError';
  return error;
}

/** 是不是 `uploadError()` 建立的錯誤（它的 message 會顯示在那一列）。 */
export function isUploadError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'UploadError';
}

/** 上傳被取消（`AbortSignal`）時丟的錯誤；元件看到它就安靜略過，不顯示「上傳失敗」。 */
export function isUploadAbortError(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === 'AbortError';
}

export interface DemoUploadAdapterOptions {
  /** 每個檔案從 0 到 100% 花多久（毫秒），預設 1200。 */
  delayMs?: number;
  /** 進度回報幾次，預設 10。 */
  steps?: number;
  /** 0–1：隨機失敗的機率，預設 0。示範固定結果時用 `failNames`。 */
  failRate?: number;
  /** 檔名包含其中任一字串時，第一次上傳到一半失敗（按「重試」就會成功）。 */
  failNames?: readonly string[];
  /** 失敗時的原因（會顯示在那一列）；不給時元件顯示「上傳失敗」。 */
  failMessage?: string;
}

/**
 * 示範用的假上傳：照 `delayMs` 回報進度，完成時回傳指向本機檔案的 object URL（不送到任何地方）。
 * 元件移除檔案或被銷毀時會呼叫 `release`，這裡把 object URL 釋放掉。正式專案換成自己呼叫 API 的 adapter。
 */
export function createDemoUploadAdapter(options: DemoUploadAdapterOptions = {}): UploadAdapter {
  const delay = Math.max(0, options.delayMs ?? 1200);
  const steps = Math.max(1, options.steps ?? 10);
  const failRate = Math.min(1, Math.max(0, options.failRate ?? 0));
  const failNames = options.failNames ?? [];
  /** 已經故意失敗過一次的檔名：重試時成功。 */
  const failedOnce = new Set<string>();
  const urls = new Map<string, string>();
  let seq = 0;

  return {
    upload(file, { signal, onProgress }) {
      return new Promise<UploadedFile>((resolve, reject) => {
        if (signal.aborted) return reject(abortError());
        const byName = failNames.some((part) => file.name.includes(part)) && !failedOnce.has(file.name);
        const fails = byName || (failRate > 0 && Math.random() < failRate);
        let step = 0;
        const timer = setInterval(() => {
          step += 1;
          if (fails && step >= Math.ceil(steps / 2)) {
            clearInterval(timer);
            failedOnce.add(file.name);
            reject(options.failMessage ? uploadError(options.failMessage) : new Error('demo upload failed'));
            return;
          }
          onProgress(step / steps);
          if (step < steps) return;
          clearInterval(timer);
          const id = `demo-file-${++seq}`;
          const url = URL.createObjectURL(file);
          urls.set(id, url);
          resolve({ id, name: file.name, size: file.size, type: file.type, url });
        }, delay / steps);
        signal.addEventListener('abort', () => {
          clearInterval(timer);
          reject(abortError());
        });
      });
    },
    release(file) {
      const url = urls.get(file.id);
      if (!url) return;
      URL.revokeObjectURL(url);
      urls.delete(file.id);
    },
  };
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}
