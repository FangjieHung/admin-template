import { toCsv } from './import-csv';
import { normalizeValue } from './import-mapping';
import {
  ImportDuplicateMode,
  ImportField,
  ImportRecord,
  ImportResult,
  ImportRow,
  ImportSchema,
  ImportTarget,
} from './import-wizard.types';

/** 驗證訊息（來自畫面文字）。`{options}` 換成選項清單、`{max}` 換成上限。 */
export interface ImportValidationMessages {
  required: string;
  number: string;
  date: string;
  email: string;
  phone: string;
  option: string;
}

/** 從檔案的資料列取出每個欄位的文字：`mapping` 是欄位 key → 檔案欄位索引。 */
export function extractRaw(
  schema: ImportSchema,
  mapping: Readonly<Record<string, number | null>>,
  row: readonly string[],
): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const field of schema.fields) {
    const index = mapping[field.key];
    if (index === null || index === undefined) continue;
    raw[field.key] = (row[index] ?? '').trim();
  }
  return raw;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 型別的預設轉換：成功回傳值，失敗丟出給使用者看的訊息。空字串在這之前就處理掉了。 */
function convert(field: ImportField, text: string, messages: ImportValidationMessages): unknown {
  const half = text.normalize('NFKC').trim();
  switch (field.type) {
    case 'number': {
      const n = Number(half.replace(/,/g, ''));
      if (!Number.isFinite(n) || half === '') throw new Error(messages.number);
      return n;
    }
    case 'date':
      return parseDate(half) ?? fail(messages.date);
    case 'email': {
      const email = half.toLocaleLowerCase();
      return EMAIL.test(email) ? email : fail(messages.email);
    }
    case 'phone': {
      const digits = half.replace(/\D/g, '').length;
      return /^\+?[\d\s\-()#]+$/.test(half) && digits >= 7 && digits <= 15 ? half : fail(messages.phone);
    }
    case 'enum': {
      const wanted = normalizeValue(half);
      const option = (field.options ?? []).find((o) =>
        [o.value, o.label, ...(o.synonyms ?? [])].some((name) => normalizeValue(name) === wanted),
      );
      if (option) return option.value;
      const options = (field.options ?? []).map((o) => o.label).join('、');
      return fail(messages.option.replace('{options}', options));
    }
    default:
      return text;
  }
}

function fail(message: string): never {
  throw new Error(message);
}

/**
 * 日期：接受 2026-03-08、2026/3/8、2026.3.8、2026年3月8日，回傳 'YYYY-MM-DD'；不是真的日期（2 月 30 日）回 null。
 */
export function parseDate(text: string): string | null {
  const match = /^(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?$/.exec(text.normalize('NFKC').trim());
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 驗證一列：每個欄位先檢查必填、型別轉換、`transform`，最後跑 `validate`。 */
export function validateRow(
  schema: ImportSchema,
  raw: Readonly<Record<string, string>>,
  messages: ImportValidationMessages,
): { value: Record<string, unknown>; errors: Record<string, string> } {
  const value: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const field of schema.fields) {
    if (!(field.key in raw)) continue;
    const text = raw[field.key] ?? '';
    if (text.trim() === '') {
      if (field.required) errors[field.key] = messages.required;
      else value[field.key] = null;
      continue;
    }
    try {
      let converted = convert(field, text, messages);
      if (field.transform) converted = field.transform(converted);
      value[field.key] = converted;
    } catch (error) {
      errors[field.key] = error instanceof Error && error.message ? error.message : messages.required;
    }
  }
  for (const field of schema.fields) {
    if (!field.validate || field.key in errors || !(field.key in raw)) continue;
    const message = field.validate(value[field.key], value);
    if (message) errors[field.key] = message;
  }
  return { value, errors };
}

/** 一列的 key（判斷重複用）；key 欄位沒有值或有錯時是 null。 */
export function keyOf(schema: ImportSchema, row: Pick<ImportRow, 'value' | 'errors'>): string | null {
  const key = schema.key;
  if (!key || key in row.errors) return null;
  const value = row.value[key];
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

/**
 * 標出重複：只看沒有錯誤的列。與檔案裡前面某一列相同 → `file`；與現有資料相同 → `existing`
 * （`existing` 是 `findExisting` 回傳的 key）。比對時不分大小寫、全形半形。
 */
export function markDuplicates(schema: ImportSchema, rows: readonly ImportRow[], existing: ReadonlySet<string>): ImportRow[] {
  const seen = new Map<string, number>();
  const existingNormalized = new Set([...existing].map(normalizeValue));
  return rows.map((row) => {
    const key = Object.keys(row.errors).length ? null : keyOf(schema, row);
    if (key === null) return row.duplicate ? { ...row, duplicate: null } : row;
    const normalized = normalizeValue(key);
    const first = seen.get(normalized);
    let duplicate: ImportRow['duplicate'] = null;
    if (first !== undefined) duplicate = { kind: 'file', firstRow: first };
    else {
      seen.set(normalized, row.row);
      if (existingNormalized.has(normalized)) duplicate = { kind: 'existing' };
    }
    return sameDuplicate(row.duplicate, duplicate) ? row : { ...row, duplicate };
  });
}

function sameDuplicate(a: ImportRow['duplicate'], b: ImportRow['duplicate']): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  return a.kind === 'existing' || (b.kind === 'file' && a.firstRow === b.firstRow);
}

/** 從檔案資料列建立所有列（還沒標重複）。`firstRow` 是第一個資料列的列號（有標題列時是 2）。 */
export function buildRows(
  schema: ImportSchema,
  mapping: Readonly<Record<string, number | null>>,
  dataRows: readonly (readonly string[])[],
  firstRow: number,
  messages: ImportValidationMessages,
): ImportRow[] {
  return dataRows.map((cells, index) => {
    const raw = extractRaw(schema, mapping, cells);
    return { index, row: firstRow + index, raw, ...validateRow(schema, raw, messages), duplicate: null };
  });
}

/** 修改一格之後重新驗證那一列（重複要由呼叫端對整份重新標）。 */
export function editCell(
  schema: ImportSchema,
  row: ImportRow,
  key: string,
  text: string,
  messages: ImportValidationMessages,
): ImportRow {
  const raw = { ...row.raw, [key]: text.trim() };
  return { ...row, raw, ...validateRow(schema, raw, messages) };
}

/** 匯入計畫：哪些列要送出（新增或更新）、哪些略過。 */
export interface ImportPlan<T = Record<string, unknown>> {
  records: ImportRecord<T>[];
  /** 有問題而略過的列。 */
  invalid: ImportRow[];
  /** 重複而略過的列（選「略過」時）。 */
  duplicates: ImportRow[];
  create: number;
  update: number;
}

export function planImport<T = Record<string, unknown>>(
  rows: readonly ImportRow[],
  mode: ImportDuplicateMode,
): ImportPlan<T> {
  const plan: ImportPlan<T> = { records: [], invalid: [], duplicates: [], create: 0, update: 0 };
  for (const row of rows) {
    if (Object.keys(row.errors).length) {
      plan.invalid.push(row);
      continue;
    }
    let action: 'create' | 'update' = 'create';
    if (row.duplicate) {
      if (mode === 'skip') {
        plan.duplicates.push(row);
        continue;
      }
      if (mode === 'update') action = 'update';
    }
    plan.records.push({ row: row.row, value: row.value as T, action });
    if (action === 'create') plan.create++;
    else plan.update++;
  }
  return plan;
}

export interface RunImportOptions {
  mode: ImportDuplicateMode;
  batchSize: number;
  signal: AbortSignal;
  /** 已處理幾筆、共幾筆。 */
  onProgress(done: number, total: number): void;
  /** 一整批失敗（`importBatch` 丟出錯誤）時，每一列的失敗原因。 */
  batchFailedMessage: string;
}

/** 已停止、沒有送出的列（錯誤報告寫原因用）。 */
export interface ImportRunResult extends ImportResult {
  notSent: readonly number[];
}

/**
 * 分批匯入：每批 `batchSize` 筆依序呼叫 `importBatch`。`signal` abort 後不再送下一批
 * （正在送的那一批等它回來，已送出的算數），沒送的列算略過。
 */
export async function runImport<T>(
  target: ImportTarget<T>,
  records: readonly ImportRecord<T>[],
  options: RunImportOptions,
): Promise<ImportRunResult> {
  const size = Math.max(1, Math.floor(options.batchSize));
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const failed: { row: number; message: string }[] = [];
  let done = 0;
  options.onProgress(0, records.length);
  for (let start = 0; start < records.length; start += size) {
    if (options.signal.aborted) break;
    const batch = records.slice(start, start + size);
    try {
      const result = await target.importBatch(batch, {
        mode: options.mode,
        signal: options.signal,
        onProgress: (n) => options.onProgress(Math.min(records.length, done + Math.max(0, n)), records.length),
      });
      created += result.created;
      updated += result.updated;
      skipped += result.skipped;
      failed.push(...result.failed);
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'AbortError') break;
      failed.push(...batch.map((r) => ({ row: r.row, message: options.batchFailedMessage })));
    }
    done += batch.length;
    options.onProgress(done, records.length);
  }
  const notSent = records.slice(done).map((r) => r.row);
  return {
    created,
    updated,
    skipped: skipped + notSent.length,
    failed,
    canceled: options.signal.aborted,
    notSent,
  };
}

/** 錯誤報告的一列：列號、原因。 */
export interface ImportReportEntry {
  row: number;
  reason: string;
}

/**
 * 錯誤報告（CSV，含 BOM）：列號、每個欄位當時的文字、原因。依列號排序。
 * `rowsByNumber` 用來找回每一列的原始文字。
 */
export function buildErrorReport(
  schema: ImportSchema,
  entries: readonly ImportReportEntry[],
  rowsByNumber: ReadonlyMap<number, ImportRow>,
  headers: { row: string; reason: string },
): string {
  const sorted = [...entries].sort((a, b) => a.row - b.row);
  const header = [headers.row, ...schema.fields.map((f) => f.label), headers.reason];
  const body = sorted.map((entry) => {
    const row = rowsByNumber.get(entry.row);
    return [entry.row, ...schema.fields.map((f) => row?.raw[f.key] ?? ''), entry.reason];
  });
  return toCsv([header, ...body]);
}

/** 一列有問題的原因：「Email：格式不正確；生日：日期格式不正確」。 */
export function describeErrors(schema: ImportSchema, row: ImportRow, separator = '；'): string {
  return schema.fields
    .filter((f) => f.key in row.errors)
    .map((f) => `${f.label}：${row.errors[f.key]}`)
    .join(separator);
}

/**
 * 範本檔（CSV，含 BOM）：標題列是欄位名稱（必填加 *），第二列是範例（`example`，選項欄位沒給時用第一個選項）。
 */
export function buildTemplateCsv(schema: ImportSchema): string {
  const header = schema.fields.map((f) => (f.required ? `${f.label}*` : f.label));
  const example = schema.fields.map((f) => f.example ?? (f.type === 'enum' ? (f.options?.[0]?.label ?? '') : ''));
  return toCsv([header, example]);
}
