import { Injectable } from '@angular/core';
import { ParamMap, Params } from '@angular/router';
import type { DataTableSort, FilterCondition } from '@admin-template/ui';

/**
 * 列表的篩選、排序、頁碼與網址 query params 互轉（純函式，方便測試）。
 * 重新整理、分享網址、從詳情頁按返回時，列表都回到同一個樣子。
 *
 * - `q`：搜尋文字。
 * - `view`：已儲存檢視的 id；其餘參數是「跟那個檢視（沒有就是預設）不同的部分」。
 * - `f`：篩選條件（JSON）；`sort`：`<欄位>.asc|desc`，`none` 表示不排序；`size`：每頁筆數。
 * - `page`：頁碼，從 1 起算，第 1 頁不寫。
 * - `demo`：示範開關（`error`、`empty`），不屬於列表狀態，原樣保留。
 */

export interface TicketListUrlState {
  q: string;
  view: string | null;
  filters: readonly FilterCondition[];
  sort: DataTableSort | null;
  pageSize: number;
  /** 從 0 起算。 */
  page: number;
}

/** 比較的基準：選中的檢視（沒有就是預設檢視）的設定。 */
export interface TicketListBase {
  filters: readonly FilterCondition[];
  sort: DataTableSort | null;
  pageSize: number;
}

/** 從網址讀出來的部分：沒寫的鍵是 undefined（沿用基準）。 */
export interface TicketListUrlOverrides {
  q: string;
  view: string | null;
  filters?: FilterCondition[];
  sort?: DataTableSort | null;
  pageSize?: number;
  page: number;
}

export const LIST_QUERY_KEYS = ['q', 'view', 'f', 'sort', 'size', 'page'] as const;

export function readListUrl(params: ParamMap, options: { sortKeys: readonly string[]; pageSizes: readonly number[] }): TicketListUrlOverrides {
  const page = Number(params.get('page'));
  const result: TicketListUrlOverrides = {
    q: params.get('q') ?? '',
    view: params.get('view') || null,
    page: Number.isInteger(page) && page > 1 ? page - 1 : 0,
  };
  const filters = parseFilters(params.get('f'));
  if (filters) result.filters = filters;
  const sort = params.get('sort');
  if (sort === 'none') result.sort = null;
  else if (sort) {
    const [key, direction] = sort.split('.');
    if (options.sortKeys.includes(key) && (direction === 'asc' || direction === 'desc')) result.sort = { key, direction };
  }
  const size = Number(params.get('size'));
  if (options.pageSizes.includes(size)) result.pageSize = size;
  return result;
}

/** 目前狀態 → query params（跟基準相同的部分不寫，網址保持短）。值是 null 的鍵會被 Router 拿掉。 */
export function toListQueryParams(state: TicketListUrlState, base: TicketListBase): Params {
  return {
    q: state.q.trim() || null,
    view: state.view,
    f: sameJson(state.filters, base.filters) ? null : JSON.stringify(state.filters),
    sort: sameJson(state.sort, base.sort) ? null : state.sort ? `${state.sort.key}.${state.sort.direction}` : 'none',
    size: state.pageSize === base.pageSize ? null : String(state.pageSize),
    page: state.page > 0 ? String(state.page + 1) : null,
  };
}

/** 兩組 query params 的列表部分是否相同（null／undefined 都當作沒寫）。 */
export function sameListParams(a: Params, b: Params): boolean {
  return LIST_QUERY_KEYS.every((key) => (a[key] ?? null) === (b[key] ?? null));
}

function parseFilters(raw: string | null): FilterCondition[] | undefined {
  if (raw === null) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return undefined;
    return value.filter(
      (c): c is FilterCondition =>
        !!c && typeof c === 'object' && typeof (c as FilterCondition).field === 'string' && typeof (c as FilterCondition).type === 'string',
    );
  } catch {
    return undefined;
  }
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 記住最後一次的列表網址參數：詳情頁的「返回工單列表」帶著它回去，篩選與頁碼都還在。
 * 從看板打開的工單，詳情頁改成「返回工單看板」（`origin`），帶著看板的篩選與分組（`boardParams`）回去。
 * 只在這次開啟期間有效（重新整理詳情頁後就回到預設列表）。
 */
@Injectable({ providedIn: 'root' })
export class TicketListMemory {
  queryParams: Params = {};
  /** 最後一次是從列表還是看板進到詳情。 */
  origin: 'list' | 'board' = 'list';
  boardParams: Params = {};
}
