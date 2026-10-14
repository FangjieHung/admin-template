/**
 * 匯入精靈的 CSV 讀寫（不依賴任何套件）：
 * - `decodeText`：先用 UTF-8 解碼，出現無法解碼的字元（U+FFFD）時改用 Big5 重試（台灣的 Excel 預設存成 Big5）。
 * - `sniffDelimiter`：從前幾列猜分隔符號（逗號、分號、Tab）。
 * - `parseCsv`：處理雙引號、引號裡的跳脫引號（""）、引號裡的換行、CRLF、開頭的 BOM。
 * - `toCsv`：寫出 CSV（需要時加引號），`withBom` 讓 Excel 正確開啟中文。
 */

export type CsvDelimiter = ',' | ';' | '\t';

const BOM = '\uFEFF';
const REPLACEMENT = '\uFFFD';

/** 位元組 → 文字：UTF-8（含 BOM）優先；解出 U+FFFD 時改用 Big5（瀏覽器不支援 Big5 時維持 UTF-8 的結果）。 */
export function decodeText(bytes: Uint8Array): { text: string; encoding: 'utf-8' | 'big5' } {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  if (!utf8.includes(REPLACEMENT)) return { text: stripBom(utf8), encoding: 'utf-8' };
  try {
    const big5 = new TextDecoder('big5').decode(bytes);
    if (countOf(big5, REPLACEMENT) < countOf(utf8, REPLACEMENT)) return { text: stripBom(big5), encoding: 'big5' };
  } catch {
    // 不支援 Big5 的環境：用 UTF-8 的結果（壞字會出現在預覽裡，使用者看得出來）。
  }
  return { text: stripBom(utf8), encoding: 'utf-8' };
}

function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(1) : text;
}

function countOf(text: string, char: string): number {
  let n = 0;
  for (const c of text) if (c === char) n++;
  return n;
}

/**
 * 猜分隔符號：看前 10 個實際的列（引號裡的不算），哪個符號每列出現的次數最一致、而且大於 0。
 * 都沒有時用逗號（只有一欄的檔案）。
 */
export function sniffDelimiter(text: string): CsvDelimiter {
  const candidates: CsvDelimiter[] = [',', ';', '\t'];
  const lines = logicalLines(text, 10);
  let best: CsvDelimiter = ',';
  let bestScore = 0;
  for (const delimiter of candidates) {
    const counts = lines.map((line) => countOutsideQuotes(line, delimiter));
    if (!counts.length || counts[0] === 0) continue;
    const consistent = counts.filter((c) => c === counts[0]).length;
    const score = consistent * 1000 + counts[0];
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }
  return best;
}

/** 前 `max` 個實際的列（引號裡的換行不算新的一列），去掉空白列。 */
function logicalLines(text: string, max: number): string[] {
  const lines: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < text.length && lines.length < max; i++) {
    const c = text[i];
    if (c === '"') quoted = !quoted;
    if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      if (current.trim()) lines.push(current);
      current = '';
      continue;
    }
    current += c;
  }
  if (current.trim() && lines.length < max) lines.push(current);
  return lines;
}

function countOutsideQuotes(line: string, delimiter: string): number {
  let n = 0;
  let quoted = false;
  for (const c of line) {
    if (c === '"') quoted = !quoted;
    else if (!quoted && c === delimiter) n++;
  }
  return n;
}

/**
 * 解析 CSV：回傳每一列的欄位文字。完全空白的列略過；列尾少的欄位不補（由使用端當成空字串）。
 * `delimiter` 不給時自動判斷。
 */
export function parseCsv(input: string, delimiter: CsvDelimiter = sniffDelimiter(stripBom(input))): string[][] {
  const text = stripBom(input);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let fieldStarted = false;

  const endField = () => {
    row.push(field);
    field = '';
    fieldStarted = false;
  };
  const endRow = () => {
    endField();
    if (row.some((value) => value.trim() !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"' && !fieldStarted) {
      quoted = true;
      fieldStarted = true;
    } else if (c === delimiter) {
      endField();
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else {
      field += c;
      fieldStarted = true;
    }
  }
  if (field !== '' || row.length) endRow();
  return rows;
}

/** 一格要不要加引號：含分隔符號、引號、換行，或前後有空白。 */
function quote(value: string, delimiter: string): string {
  if (value.includes(delimiter) || /["\r\n]/.test(value) || value !== value.trim()) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** 寫出 CSV（CRLF 換行，Excel 的預設）。`withBom` 預設 true：Excel 才會用 UTF-8 開啟中文。 */
export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[], withBom = true): string {
  const body = rows
    .map((row) => row.map((cell) => quote(cell === null || cell === undefined ? '' : String(cell), ',')).join(','))
    .join('\r\n');
  return (withBom ? BOM : '') + body + '\r\n';
}
