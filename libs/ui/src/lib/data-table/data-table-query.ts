import {
  DataTableCellValue,
  DataTableColumn,
  DataTableColumnPrefs,
  DataTableDataSource,
  DataTableExportValue,
  DataTablePage,
  DataTableQuery,
  DataTableSort,
  DataTableSortValue,
  DataTableVirtualColumn,
} from './data-table.types';

// 這個檔案只放純函式（不碰 Angular）：分頁、排序、欄位偏好與前端資料來源。
// 元件和日後的伺服器端分頁都用同一套規則，測試也直接測這裡。

export function isVirtualColumn<T>(col: DataTableColumn<T>): col is DataTableVirtualColumn<T> {
  return col.virtual === true;
}

/** 儲存格沒有 dtCell template 時顯示的值：一般欄取 row[key]，虛擬欄取 value(row)。 */
export function cellValue<T>(col: DataTableColumn<T>, row: T): DataTableCellValue {
  if (isVirtualColumn(col)) return col.value?.(row);
  return (row as Record<string, unknown>)[col.key] as DataTableCellValue;
}

/** 匯出的原始值（null／undefined 由呼叫端轉成空字串）。 */
export function exportCellValue<T>(col: DataTableColumn<T>, row: T): DataTableExportValue | null | undefined {
  if (col.exportValue) return col.exportValue(row);
  if (isVirtualColumn(col)) return col.value?.(row);
  return (row as Record<string, unknown>)[col.key] as DataTableExportValue | null | undefined;
}

export function isSortableColumn<T>(col: DataTableColumn<T>): boolean {
  if (col.sortable === false) return false;
  if (isVirtualColumn(col)) return typeof col.sortValue === 'function';
  return true;
}

export function sortValueOf<T>(col: DataTableColumn<T>, row: T): DataTableSortValue {
  if (col.sortValue) return col.sortValue(row);
  if (isVirtualColumn(col)) return undefined;
  return (row as Record<string, unknown>)[col.key] as DataTableSortValue;
}

const collator = new Intl.Collator('zh-Hant', { numeric: true, sensitivity: 'base' });

function isEmptySortValue(v: DataTableSortValue): boolean {
  return v === null || v === undefined || v === '' || (v instanceof Date && Number.isNaN(v.getTime()));
}

/** 遞增比較兩個非空值：數字比大小、日期比時間、布林 false < true，其餘以中文（含數字）自然排序。 */
export function compareSortValues(a: DataTableSortValue, b: DataTableSortValue): number {
  const norm = (v: DataTableSortValue) => (v instanceof Date ? v.getTime() : typeof v === 'boolean' ? Number(v) : v);
  const x = norm(a);
  const y = norm(b);
  if (typeof x === 'number' && typeof y === 'number') return x - y;
  return collator.compare(String(x), String(y));
}

/**
 * 依單一欄位排序（穩定排序：值相同時維持原本順序）。sort 為 null 或找不到欄位時原樣回傳。
 * 空值（null／undefined／''）不論遞增遞減一律排在最後。
 */
export function sortRows<T>(
  rows: readonly T[],
  columns: readonly DataTableColumn<T>[],
  sort: DataTableSort | null,
): readonly T[] {
  if (!sort) return rows;
  const col = columns.find((c) => c.key === sort.key);
  if (!col || !isSortableColumn(col)) return rows;
  const dir = sort.direction === 'desc' ? -1 : 1;
  const keyed = rows.map((row, index) => ({ row, index, value: sortValueOf(col, row) }));
  keyed.sort((p, q) => {
    const pe = isEmptySortValue(p.value);
    const qe = isEmptySortValue(q.value);
    if (pe || qe) return pe === qe ? p.index - q.index : pe ? 1 : -1;
    return compareSortValues(p.value, q.value) * dir || p.index - q.index;
  });
  return keyed.map((k) => k.row);
}

/** 點欄位標題：遞增 → 遞減 → 不排序；點別的欄位從遞增開始。 */
export function nextSort(current: DataTableSort | null, key: string): DataTableSort | null {
  if (!current || current.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return null;
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
}

/** 把頁碼夾在 [0, 最後一頁]：資料變少（篩選、刪除）時不會停在空白頁。 */
export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(0, Math.floor(page)), pageCount(total, pageSize) - 1);
}

/** 這一頁是第幾筆到第幾筆（從 1 起算）。沒有資料時是 0–0。 */
export function pageRange(page: number, pageSize: number, total: number): { from: number; to: number } {
  if (total <= 0) return { from: 0, to: 0 };
  const p = clampPage(page, total, pageSize);
  return { from: p * pageSize + 1, to: Math.min(total, (p + 1) * pageSize) };
}

export function pageSlice<T>(rows: readonly T[], page: number, pageSize: number): readonly T[] {
  const p = clampPage(page, rows.length, pageSize);
  return rows.slice(p * pageSize, (p + 1) * pageSize);
}

/** 排在最前面的 frozen 欄的 key（沒有就是 null）。 */
export function frozenColumnKey<T>(columns: readonly DataTableColumn<T>[]): string | null {
  return columns.find((c) => c.frozen)?.key ?? null;
}

export interface OrderedColumn<T> {
  column: DataTableColumn<T>;
  hidden: boolean;
  /** frozen 欄：不能隱藏、不能移動。 */
  frozen: boolean;
  /** 能不能在面板裡取消勾選。 */
  hideable: boolean;
}

/**
 * 依使用者偏好排出所有欄位（含隱藏的，給欄位選擇面板用）：frozen 欄永遠第一；
 * prefs.order 裡的欄位照它的順序，不在裡面的（新加的欄位）依原始順序接在後面；已不存在的 key 忽略。
 */
export function orderColumns<T>(
  columns: readonly DataTableColumn<T>[],
  prefs: DataTableColumnPrefs | null,
): OrderedColumn<T>[] {
  const frozenKey = frozenColumnKey(columns);
  const byKey = new Map(columns.map((c) => [c.key, c] as const));
  const ordered: DataTableColumn<T>[] = [];
  const seen = new Set<string>();
  const push = (c: DataTableColumn<T> | undefined) => {
    if (c && !seen.has(c.key)) {
      seen.add(c.key);
      ordered.push(c);
    }
  };
  if (frozenKey) push(byKey.get(frozenKey));
  for (const key of prefs?.order ?? []) push(byKey.get(key));
  for (const c of columns) push(c);
  const hidden = new Set(prefs?.hidden ?? []);
  return ordered.map((column) => {
    const frozen = column.key === frozenKey;
    const hideable = !frozen && column.hideable !== false;
    return { column, frozen, hideable, hidden: hideable && hidden.has(column.key) };
  });
}

/** 畫面上實際顯示的欄位（順序已套用偏好）。 */
export function visibleColumns<T>(
  columns: readonly DataTableColumn<T>[],
  prefs: DataTableColumnPrefs | null,
): DataTableColumn<T>[] {
  return orderColumns(columns, prefs)
    .filter((c) => !c.hidden)
    .map((c) => c.column);
}

/** 偏好等於預設（原始順序、全部顯示）時回傳 null，讓「已修改」判斷不會因為使用者手動排回原樣而誤報。 */
export function normalizeColumnPrefs<T>(
  columns: readonly DataTableColumn<T>[],
  prefs: DataTableColumnPrefs | null,
): DataTableColumnPrefs | null {
  if (!prefs) return null;
  const ordered = orderColumns(columns, prefs);
  const order = ordered.map((c) => c.column.key);
  const hidden = ordered.filter((c) => c.hidden).map((c) => c.column.key);
  const defaultOrder = orderColumns(columns, null).map((c) => c.column.key);
  if (hidden.length === 0 && order.every((key, i) => key === defaultOrder[i])) return null;
  return { order, hidden };
}

/** 文字樣板代換：`format('第 {from}–{to} 筆', { from: 1, to: 25 })`。 */
export function formatLabel(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in values ? String(values[name]) : m));
}

/**
 * 前端版本的查詢：篩選 → 排序 → 分頁。`filter` 由使用端提供（例如 advanced-filter 的 applyFilters）。
 * 回傳 all（篩選＋排序後的完整資料，匯出用）與這一頁。
 */
export function applyClientQuery<T, F>(
  rows: readonly T[],
  columns: readonly DataTableColumn<T>[],
  query: DataTableQuery<F>,
  filter: (rows: readonly T[], filters: F) => readonly T[] = (r) => r,
): DataTablePage<T> & { all: readonly T[] } {
  const all = sortRows(filter(rows, query.filters), columns, query.sort);
  return { all, rows: pageSlice(all, query.page, query.pageSize), total: all.length };
}

/** 包成 DataTableDataSource：現在用前端資料，日後換成呼叫 API 的實作即可。 */
export function createClientDataSource<T, F>(
  getRows: () => readonly T[],
  columns: readonly DataTableColumn<T>[],
  filter?: (rows: readonly T[], filters: F) => readonly T[],
): DataTableDataSource<T, F> {
  return {
    query: (query) => {
      const { rows, total } = applyClientQuery(getRows(), columns, query, filter);
      return Promise.resolve({ rows, total });
    },
    queryAll: (query) =>
      Promise.resolve(applyClientQuery(getRows(), columns, { ...query, page: 0, pageSize: Number.MAX_SAFE_INTEGER }, filter).all),
  };
}
