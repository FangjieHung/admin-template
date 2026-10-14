/**
 * 附件上傳用的小工具：檔案大小、類型比對、類型圖示、長檔名的前後兩段、圖片縮小。都是純函式（縮小圖片除外），沒有畫面文字。
 */

const UNITS = ['KB', 'MB', 'GB', 'TB'];

/** 檔案大小：1024 進位、小數一位（`512 B`、`1.2 KB`、`3.4 MB`）。整數時不寫 `.0`。 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} ${UNITS[unit]}`;
}

/**
 * 檔案是否符合 `accept`（同 `<input accept>` 的寫法：逗號分隔的 MIME（`image/png`）、萬用 MIME（`image/*`）、副檔名（`.pdf`））。
 * 空字串表示什麼都可以。比對不分大小寫；沒有 MIME 的檔案只能靠副檔名比對。
 */
export function matchesAccept(file: { name: string; type: string }, accept: string): boolean {
  const rules = accept
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (rules.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return rules.some((rule) => {
    if (rule.startsWith('.')) return name.endsWith(rule);
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

/** `accept` 有沒有允許圖片（決定要不要出現拍照鈕；空字串＝全部允許）。 */
export function acceptsImages(accept: string): boolean {
  return matchesAccept({ name: 'photo.jpg', type: 'image/jpeg' }, accept);
}

export function isImageType(type: string): boolean {
  return type.toLowerCase().startsWith('image/');
}

/** 檔案類型的 Material Symbols 圖示名稱（非圖片或圖片沒有網址時用）。 */
export function fileTypeIcon(file: { name: string; type: string }): string {
  const type = (file.type || '').toLowerCase();
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (type.startsWith('image/')) return 'image';
  if (type === 'application/pdf' || ext === 'pdf') return 'picture_as_pdf';
  if (type.startsWith('video/')) return 'movie';
  if (type.startsWith('audio/')) return 'audio_file';
  if (/sheet|excel|csv/.test(type) || ['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'table_chart';
  if (/presentation|powerpoint/.test(type) || ['ppt', 'pptx', 'key', 'odp'].includes(ext)) return 'slideshow';
  if (/zip|compressed|tar|rar|7z/.test(type) || ['zip', 'rar', '7z', 'gz', 'tar'].includes(ext)) return 'folder_zip';
  if (/word|document|text/.test(type) || ['doc', 'docx', 'txt', 'md', 'odt', 'rtf'].includes(ext)) return 'description';
  return 'draft';
}

/**
 * 長檔名的「中間省略」：切成前段（太長時由 CSS 省略）與固定顯示的後段（最後幾個字＋副檔名），
 * 讓「報價單-2026-最終版.pdf」窄的時候顯示成「報價單-20…最終版.pdf」，副檔名永遠看得到。
 */
export function splitFileName(name: string, tail = 6): { start: string; end: string } {
  const dot = name.lastIndexOf('.');
  const extLength = dot > 0 && name.length - dot <= 8 ? name.length - dot : 0;
  const keep = Math.min(name.length, extLength + tail);
  if (name.length <= keep + 2) return { start: '', end: name };
  return { start: name.slice(0, name.length - keep), end: name.slice(name.length - keep) };
}

/** 縮小時保留原本的格式（JPEG／PNG／WebP）；其他格式（GIF 動畫、HEIC、SVG）不縮。 */
const RESIZABLE = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * 把圖片的長邊縮到 `maxDimension` 以內再上傳（照片動輒 4000px、好幾 MB）。依照片的 EXIF 方向轉正
 * （`createImageBitmap(..., { imageOrientation: 'from-image' })`），格式與檔名不變。
 * 不需要縮、格式不支援、瀏覽器沒有 `createImageBitmap`／canvas，或縮完反而更大時，原檔照傳。
 */
export async function downscaleImage(file: File, maxDimension: number): Promise<File> {
  if (!(maxDimension > 0) || !RESIZABLE.includes(file.type) || typeof createImageBitmap !== 'function') return file;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= maxDimension) return file;
    const scale = maxDimension / longest;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, file.type, file.type === 'image/png' ? undefined : 0.9),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
