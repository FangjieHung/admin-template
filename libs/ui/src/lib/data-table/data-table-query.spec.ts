import { describe, it, expect } from 'vitest';
import {
  applyClientQuery,
  cellValue,
  clampPage,
  compareSortValues,
  createClientDataSource,
  formatLabel,
  isSortableColumn,
  nextSort,
  normalizeColumnPrefs,
  orderColumns,
  pageCount,
  pageRange,
  pageSlice,
  sortRows,
  visibleColumns,
} from './data-table-query';
import { rowsToAoa } from './data-table-export';
import { DataTableColumn } from './data-table.types';

interface Row {
  id: string;
  name: string;
  amount: number | null;
  ownerId: string;
  at: string;
}

const owners: Record<string, string> = { u1: '王小明', u2: '陳大同', u3: '林美惠' };

const rows: Row[] = [
  { id: 'r1', name: '項目 10', amount: 300, ownerId: 'u2', at: '2026-10-03T09:00:00' },
  { id: 'r2', name: '項目 2', amount: null, ownerId: 'u1', at: '2026-10-01T09:00:00' },
  { id: 'r3', name: '項目 1', amount: 100, ownerId: 'u3', at: '2026-10-02T09:00:00' },
  { id: 'r4', name: '項目 3', amount: 300, ownerId: 'u1', at: '' },
];

const columns: DataTableColumn<Row>[] = [
  { key: 'name', label: '名稱', frozen: true },
  { key: 'amount', label: '金額', align: 'end' },
  // 顯示的是名稱，排序也要照名稱，不是照 id。
  { key: 'ownerId', label: '負責人', exportValue: (r) => owners[r.ownerId], sortValue: (r) => owners[r.ownerId] },
  { key: 'at', label: '時間' },
  { key: 'double', label: '兩倍', virtual: true, value: (r) => (r.amount === null ? null : r.amount * 2) },
  { key: 'actions', label: '操作', virtual: true, exportSkip: true },
];

describe('欄位型別（編譯期）', () => {
  it('一般欄位的 key 必須是資料列的屬性；虛擬欄要寫 virtual 並提供取值', () => {
    // @ts-expect-error key 打錯字（不是 Row 的屬性）要編譯失敗
    const typo: DataTableColumn<Row> = { key: 'nmae', label: '名稱' };
    // @ts-expect-error 虛擬欄沒有 value／exportValue／exportSkip 要編譯失敗
    const noValue: DataTableColumn<Row> = { key: 'x', label: 'X', virtual: true };
    // @ts-expect-error 虛擬欄要排序就一定要給 sortValue
    const noSortValue: DataTableColumn<Row> = { key: 'x', label: 'X', virtual: true, value: () => 1, sortable: true };
    const ok: DataTableColumn<Row> = { key: 'x', label: 'X', virtual: true, value: () => 1, sortValue: () => 1 };
    expect([typo, noValue, noSortValue, ok]).toHaveLength(4);
  });
});

describe('cellValue / rowsToAoa', () => {
  it('一般欄取 row[key]；虛擬欄取 value(row)', () => {
    expect(cellValue(columns[0], rows[0])).toBe('項目 10');
    expect(cellValue(columns[4], rows[0])).toBe(600);
    expect(cellValue(columns[4], rows[1])).toBeNull();
  });

  it('匯出：exportValue 優先、虛擬欄退回 value、exportSkip 不匯出、null 變空字串', () => {
    expect(rowsToAoa(columns, rows.slice(0, 2))).toEqual([
      ['名稱', '金額', '負責人', '時間', '兩倍'],
      ['項目 10', 300, '陳大同', '2026-10-03T09:00:00', 600],
      ['項目 2', '', '王小明', '2026-10-01T09:00:00', ''],
    ]);
  });
});

describe('排序', () => {
  it('點標題的循環：遞增 → 遞減 → 不排序；換欄位從遞增開始', () => {
    let sort = nextSort(null, 'name');
    expect(sort).toEqual({ key: 'name', direction: 'asc' });
    sort = nextSort(sort, 'name');
    expect(sort).toEqual({ key: 'name', direction: 'desc' });
    expect(nextSort(sort, 'name')).toBeNull();
    expect(nextSort(sort, 'amount')).toEqual({ key: 'amount', direction: 'asc' });
  });

  it('文字以自然順序排（項目 2 在項目 10 前面）', () => {
    const sorted = sortRows(rows, columns, { key: 'name', direction: 'asc' });
    expect(sorted.map((r) => r.name)).toEqual(['項目 1', '項目 2', '項目 3', '項目 10']);
  });

  it('數字比大小、相同值維持原順序（穩定），空值不論方向都排最後', () => {
    expect(sortRows(rows, columns, { key: 'amount', direction: 'asc' }).map((r) => r.id)).toEqual(['r3', 'r1', 'r4', 'r2']);
    expect(sortRows(rows, columns, { key: 'amount', direction: 'desc' }).map((r) => r.id)).toEqual(['r1', 'r4', 'r3', 'r2']);
    expect(sortRows(rows, columns, { key: 'at', direction: 'desc' }).map((r) => r.id)).toEqual(['r1', 'r3', 'r2', 'r4']);
  });

  it('有 sortValue 時照 sortValue 排（顯示名稱而不是 id）', () => {
    const sorted = sortRows(rows, columns, { key: 'ownerId', direction: 'asc' });
    expect(sorted.map((r) => owners[r.ownerId])).toEqual(
      [...rows.map((r) => owners[r.ownerId])].sort(new Intl.Collator('zh-Hant').compare),
    );
    // 照 id 排會是 u1,u1,u2,u3；照名稱的結果不同，證明真的用了 sortValue。
    expect(sorted.map((r) => r.ownerId)).not.toEqual(['u1', 'u1', 'u2', 'u3']);
  });

  it('不能排序的欄位（沒有 sortValue 的虛擬欄、sortable:false）原樣回傳', () => {
    expect(isSortableColumn(columns[4])).toBe(false);
    expect(isSortableColumn(columns[5])).toBe(false);
    expect(isSortableColumn({ key: 'name', label: 'n', sortable: false } as DataTableColumn<Row>)).toBe(false);
    expect(sortRows(rows, columns, { key: 'double', direction: 'asc' })).toBe(rows);
    expect(sortRows(rows, columns, null)).toBe(rows);
  });

  it('compareSortValues：日期比時間、布林 false 在前', () => {
    expect(compareSortValues(new Date(2026, 0, 2), new Date(2026, 0, 1))).toBeGreaterThan(0);
    expect(compareSortValues(false, true)).toBeLessThan(0);
  });
});

describe('分頁', () => {
  it('總頁數至少 1；頁碼夾在範圍內', () => {
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(312, 25)).toBe(13);
    expect(pageCount(300, 25)).toBe(12);
    expect(clampPage(20, 312, 25)).toBe(12);
    expect(clampPage(-3, 312, 25)).toBe(0);
  });

  it('「第 from–to 筆」：最後一頁不足一頁、沒有資料是 0–0', () => {
    expect(pageRange(0, 25, 312)).toEqual({ from: 1, to: 25 });
    expect(pageRange(12, 25, 312)).toEqual({ from: 301, to: 312 });
    expect(pageRange(0, 25, 0)).toEqual({ from: 0, to: 0 });
    expect(formatLabel('第 {from}–{to} 筆，共 {total} 筆', { ...pageRange(1, 50, 312), total: 312 })).toBe(
      '第 51–100 筆，共 312 筆',
    );
  });

  it('pageSlice 取出該頁；頁碼超過時取最後一頁', () => {
    const many = Array.from({ length: 60 }, (_, i) => i);
    expect(pageSlice(many, 1, 25)).toEqual(many.slice(25, 50));
    expect(pageSlice(many, 9, 25)).toEqual(many.slice(50, 60));
  });
});

describe('欄位偏好', () => {
  it('frozen 欄永遠第一、不能隱藏；prefs 的順序優先，新欄位接在後面，不存在的 key 忽略', () => {
    const ordered = orderColumns(columns, { order: ['at', 'gone', 'name', 'amount'], hidden: ['name', 'amount'] });
    expect(ordered.map((c) => c.column.key)).toEqual(['name', 'at', 'amount', 'ownerId', 'double', 'actions']);
    expect(ordered[0]).toMatchObject({ frozen: true, hideable: false, hidden: false });
    expect(ordered.find((c) => c.column.key === 'amount')?.hidden).toBe(true);
    expect(visibleColumns(columns, { order: [], hidden: ['amount'] }).map((c) => c.key)).not.toContain('amount');
  });

  it('hideable:false 的欄位不會被隱藏', () => {
    const cols: DataTableColumn<Row>[] = [{ key: 'name', label: 'n', hideable: false }, { key: 'at', label: 't' }];
    expect(visibleColumns(cols, { order: [], hidden: ['name'] }).map((c) => c.key)).toEqual(['name', 'at']);
  });

  it('排回預設時正規化成 null（「已修改」不會誤報）', () => {
    const defaultOrder = columns.map((c) => c.key);
    expect(normalizeColumnPrefs(columns, { order: defaultOrder, hidden: [] })).toBeNull();
    expect(normalizeColumnPrefs(columns, null)).toBeNull();
    // 只把 amount 排到最前（緊接在固定欄後）＝原本的位置，也是預設。
    expect(normalizeColumnPrefs(columns, { order: ['amount'], hidden: [] })).toBeNull();
    expect(normalizeColumnPrefs(columns, { order: ['at'], hidden: ['double'] })).toEqual({
      order: ['name', 'at', 'amount', 'ownerId', 'double', 'actions'],
      hidden: ['double'],
    });
  });
});

describe('前端資料來源（日後換成伺服器端分頁的契約）', () => {
  const filter = (rs: readonly Row[], min: number | null) => (min === null ? rs : rs.filter((r) => (r.amount ?? 0) >= min));

  it('applyClientQuery：篩選 → 排序 → 分頁；all 是篩選＋排序後的全部', () => {
    const result = applyClientQuery(rows, columns, { page: 0, pageSize: 2, sort: { key: 'amount', direction: 'asc' }, filters: 200 }, filter);
    expect(result.total).toBe(2);
    expect(result.all.map((r) => r.id)).toEqual(['r1', 'r4']);
    expect(result.rows.map((r) => r.id)).toEqual(['r1', 'r4']);
  });

  it('createClientDataSource：query 回一頁與總數，queryAll 回全部（匯出用）', async () => {
    const source = createClientDataSource(() => rows, columns, filter);
    const page = await source.query({ page: 1, pageSize: 1, sort: { key: 'name', direction: 'asc' }, filters: null });
    expect(page).toEqual({ rows: [rows[1]], total: 4 });
    const all = await source.queryAll({ sort: { key: 'name', direction: 'asc' }, filters: 100 });
    expect(all.map((r) => r.name)).toEqual(['項目 1', '項目 3', '項目 10']);
  });
});
