import { formatLabel } from './data-table-query';
import { DataTableEditingLabels, DataTableEditor } from './data-table.types';

// 表格內直接編輯的純函式（不碰 Angular）：文字與值的轉換、檢查、解析剪貼簿。只有編輯控制器（lazy chunk）用；
// 資料表本身只需要「哪一格能改」，放在 data-table-editor-access.ts（小檔案：esbuild 以檔案為單位分 chunk，
// 這份放進資料表的 chunk 的話，沒有編輯的表格也要下載轉換與貼上的程式）。

export { editKeyOf, editorOf, hasEditableColumns, isCellEditable, readEditValue } from './data-table-editor-access';

/** 空值：null、undefined、空白字串。 */
export function isEmptyEditValue(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

/** 兩個值相同（空值彼此視為相同：把空白改成 null 不算修改）。 */
export function sameEditValue(a: unknown, b: unknown): boolean {
  if (isEmptyEditValue(a) && isEmptyEditValue(b)) return true;
  return Object.is(a, b);
}

/** 值 → 編輯器裡的文字（下拉是選項文字、開關是「是／否」）。 */
export function formatEditValue<T>(editor: DataTableEditor<T>, value: unknown, labels: DataTableEditingLabels): string {
  if (editor.format) return editor.format(value);
  if (value === null || value === undefined) return '';
  if (editor.type === 'select') return editor.options.find((o) => o.value === value)?.label ?? String(value);
  if (editor.type === 'toggle') return value ? labels.toggleOn : labels.toggleOff;
  return String(value);
}

export type EditParseResult = { ok: true; value: unknown } | { ok: false; error: string };

const TRUE_WORDS = ['true', '1', 'yes', 'y', 'on', '✓'];
const FALSE_WORDS = ['false', '0', 'no', 'n', 'off', ''];

/**
 * 輸入或貼上的文字 → 值。數字去掉千分位逗號；日期接受 YYYY-MM-DD 與 YYYY/M/D；下拉比對選項文字或值（不分大小寫）；
 * 開關接受「是／否」與 true/false/1/0。關聯欄要查資料來源，這裡不處理（回傳原文字）。
 */
export function parseEditText<T>(editor: DataTableEditor<T>, text: string, labels: DataTableEditingLabels): EditParseResult {
  if (editor.parse) {
    try {
      return { ok: true, value: editor.parse(text) };
    } catch (e) {
      return { ok: false, error: (e as Error)?.message || labels.invalidOption.replace('{text}', text) };
    }
  }
  const trimmed = text.trim();
  switch (editor.type) {
    case 'number': {
      if (!trimmed) return { ok: true, value: null };
      const n = Number(trimmed.replace(/[,\s]/g, ''));
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: labels.invalidNumber };
    }
    case 'date': {
      if (!trimmed) return { ok: true, value: null };
      const date = normalizeDate(trimmed);
      return date ? { ok: true, value: date } : { ok: false, error: labels.invalidDate };
    }
    case 'select': {
      if (!trimmed) return { ok: true, value: null };
      const key = trimmed.toLocaleLowerCase();
      const option = editor.options.find(
        (o) => o.label.toLocaleLowerCase() === key || String(o.value).toLocaleLowerCase() === key,
      );
      return option ? { ok: true, value: option.value } : { ok: false, error: formatLabel(labels.invalidOption, { text: trimmed }) };
    }
    case 'toggle': {
      const key = trimmed.toLocaleLowerCase();
      if (key === labels.toggleOn.toLocaleLowerCase() || TRUE_WORDS.includes(key)) return { ok: true, value: true };
      if (key === labels.toggleOff.toLocaleLowerCase() || FALSE_WORDS.includes(key)) return { ok: true, value: false };
      return { ok: false, error: formatLabel(labels.invalidOption, { text: trimmed }) };
    }
    default:
      return { ok: true, value: text };
  }
}

/** 檢查值：必填，再跑欄位自己的 validate。回傳錯誤訊息或 null。 */
export function validateEditValue<T>(
  editor: DataTableEditor<T>,
  value: unknown,
  row: T,
  labels: DataTableEditingLabels,
): string | null {
  if (editor.required && isEmptyEditValue(value)) return labels.required;
  return editor.validate ? editor.validate(value, row) : null;
}

/** YYYY-MM-DD 或 YYYY/M/D（Excel 常見）→ 'YYYY-MM-DD'；不是真的日期回傳 null。 */
export function normalizeDate(text: string): string | null {
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * 解析從 Excel／Google 試算表複製的文字：欄用 Tab、列用換行分隔；雙引號包起來的欄位可以含換行與 Tab（"" 是一個引號）。
 * 最後一個換行（Excel 複製時會多一個）不算一列。
 */
export function parseClipboardGrid(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let atFieldStart = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && atFieldStart) {
      quoted = true;
      atFieldStart = false;
    } else if (ch === '\t') {
      row.push(field);
      field = '';
      atFieldStart = true;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      atFieldStart = true;
    } else {
      field += ch;
      atFieldStart = false;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** 剪貼簿是不是一整塊（多格）：有 Tab 或換行（結尾那一個換行不算）。 */
export function isMultiCellPaste(text: string): boolean {
  const grid = parseClipboardGrid(text);
  return grid.length > 1 || (grid[0]?.length ?? 0) > 1;
}
