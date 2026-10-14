import { ImportField, ImportMapping, ImportSchema } from './import-wizard.types';

/**
 * 比對用的正規化：全形轉半形（NFKC）、轉小寫、拿掉空白與常見的標記（必填的 *、冒號、- _ .）。
 * 「Ｅ－ｍａｉｌ＊」「e mail」「E_MAIL」都會變成 `email`。
 */
export function normalizeHeader(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s*:：\-_.()（）]/g, '');
}

/** 一般值的正規化（重複比對、選項比對）：全形轉半形、去頭尾空白、轉小寫。 */
export function normalizeValue(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

/** 這個欄位接受哪些標題名稱（正規化後）：key、label、synonyms。 */
function namesOf(field: ImportField): string[] {
  return [field.label, field.key, ...(field.synonyms ?? [])].map(normalizeHeader).filter(Boolean);
}

/**
 * 自動對應：每個 schema 欄位找名稱相符的檔案欄位（標題列的索引）；一個檔案欄位只對應一次，
 * 先比對 label，再比對 key 與 synonyms。`remembered`（上次記住的對應，欄位 key → 標題文字）優先。
 * 回傳欄位 key → 檔案欄位索引；沒有對應到的欄位不在裡面。
 */
export function autoMap(
  schema: ImportSchema,
  headers: readonly string[],
  remembered: ImportMapping | null = null,
): Record<string, number> {
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const result: Record<string, number> = {};
  const take = (key: string, index: number) => {
    if (index < 0 || used.has(index) || key in result) return;
    result[key] = index;
    used.add(index);
  };

  if (remembered) {
    for (const field of schema.fields) {
      const header = remembered[field.key];
      if (header) take(field.key, normalized.indexOf(normalizeHeader(header)));
    }
  }
  // 兩輪：先讓每個欄位用自己的 label 比對（最明確），再用 key 與同義詞。
  for (const field of schema.fields) take(field.key, normalized.indexOf(normalizeHeader(field.label)));
  for (const field of schema.fields) {
    if (field.key in result) continue;
    const names = namesOf(field);
    const index = normalized.findIndex((header, i) => !used.has(i) && names.includes(header));
    take(field.key, index);
  }
  return result;
}

/** 必填但還沒對應到的欄位。 */
export function missingRequired(schema: ImportSchema, mapping: Readonly<Record<string, number | null>>): ImportField[] {
  return schema.fields.filter((field) => field.required && (mapping[field.key] === null || mapping[field.key] === undefined));
}

/** 某一欄前幾個不重複、非空白的值（欄位對應畫面的範例）。 */
export function sampleValues(rows: readonly (readonly string[])[], column: number, count = 3): string[] {
  const samples: string[] = [];
  for (const row of rows) {
    const value = (row[column] ?? '').trim();
    if (value && !samples.includes(value)) samples.push(value);
    if (samples.length >= count) break;
  }
  return samples;
}

/** 把「欄位 key → 檔案欄位索引」轉成「欄位 key → 標題文字」（記住對應用）。 */
export function mappingToHeaders(mapping: Readonly<Record<string, number | null>>, headers: readonly string[]): ImportMapping {
  const result: Record<string, string> = {};
  for (const [key, index] of Object.entries(mapping)) {
    if (index !== null && index !== undefined && headers[index] !== undefined) result[key] = headers[index];
  }
  return result;
}

/** 標題列：第一列是標題時就用它（空白的用「第 N 欄」）；沒有標題列時全部用「第 N 欄」。 */
export function headersOf(
  rows: readonly (readonly string[])[],
  hasHeader: boolean,
  columnName: (n: number) => string,
): string[] {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const first = hasHeader ? (rows[0] ?? []) : [];
  return Array.from({ length: width }, (_, i) => (first[i] ?? '').trim() || columnName(i + 1));
}

/** 示範用的對應記憶：存在 localStorage（私密模式或被封鎖時安靜地不存）。正式專案可以換成存到使用者設定。 */
export function createLocalStorageMappingStore(prefix = 'lib-import-mapping'): {
  load(id: string): ImportMapping | null;
  save(id: string, mapping: ImportMapping): void;
} {
  return {
    load(id) {
      try {
        const raw = localStorage.getItem(`${prefix}.${id}`);
        const parsed = raw ? (JSON.parse(raw) as unknown) : null;
        return parsed && typeof parsed === 'object' ? (parsed as ImportMapping) : null;
      } catch {
        return null;
      }
    },
    save(id, mapping) {
      try {
        localStorage.setItem(`${prefix}.${id}`, JSON.stringify(mapping));
      } catch {
        // 不能用 localStorage 就不記。
      }
    },
  };
}
