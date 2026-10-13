/**
 * 關聯選擇欄位（lib-relation-select）的資料來源。
 *
 * 元件只認得這三個方法，不管資料在前端陣列還是伺服器：
 * - `search`：依輸入的字搜尋，回傳一頁結果與「後面還有沒有」。元件每次發新的搜尋前會 abort 上一次的 `signal`，
 *   接伺服器時把 `signal` 傳給 `fetch`／`HttpClient`（`takeUntil`）即可取消舊請求。
 * - `getById`：表單一開始只有 id 時，用它查出要顯示的那一筆（找不到回 `null`）。
 * - `idOf`：表單存的值是 id，不是整個物件。
 */
export interface RelationPage<T> {
  items: readonly T[];
  /** 後面還有符合的資料（清單底部提示「請輸入更多字縮小範圍」）。 */
  hasMore: boolean;
}

export interface RelationSource<T> {
  search(query: string, signal: AbortSignal): Promise<RelationPage<T>>;
  getById(id: string, signal?: AbortSignal): Promise<T | null>;
  idOf(item: T): string;
}

export interface ArraySourceOptions<T> {
  idOf: (item: T) => string;
  /** 主文字（比對用）。 */
  textOf: (item: T) => string;
  /** 第二行文字（也拿來比對，例如 email、部門）。 */
  secondaryOf?: (item: T) => string;
  /** 一次最多回傳幾筆，預設 20。 */
  limit?: number;
}

/**
 * 前端陣列做成的資料來源：給假資料或幾百筆以內的小清單用。不分大小寫，比對主文字與第二行文字；
 * 空字串回傳前 `limit` 筆。`items` 可以給函式，清單之後會變（例如「建立」新增了一筆）時每次搜尋讀最新的。
 */
export function createArraySource<T>(
  items: readonly T[] | (() => readonly T[]),
  options: ArraySourceOptions<T>,
): RelationSource<T> {
  const list = typeof items === 'function' ? items : () => items;
  const limit = Math.max(1, options.limit ?? 20);
  return {
    idOf: options.idOf,
    async search(query, signal) {
      throwIfAborted(signal);
      const q = normalize(query);
      const matched = q
        ? list().filter(
            (item) =>
              normalize(options.textOf(item)).includes(q) ||
              (!!options.secondaryOf && normalize(options.secondaryOf(item)).includes(q)),
          )
        : list();
      return { items: matched.slice(0, limit), hasMore: matched.length > limit };
    },
    async getById(id, signal) {
      throwIfAborted(signal);
      return list().find((item) => options.idOf(item) === id) ?? null;
    },
  };
}

/** 一段文字切成「有沒有比對到」的片段，給選項把比對到的字加粗（不拼 innerHTML）。 */
export interface HighlightSegment {
  text: string;
  match: boolean;
}

/** 不分大小寫找出所有 `query` 出現的位置；`query` 是空白時整段不加粗。 */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const q = normalize(query);
  if (!q || !text) return text ? [{ text, match: false }] : [];
  const lower = text.toLocaleLowerCase();
  const segments: HighlightSegment[] = [];
  let from = 0;
  for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, at + q.length)) {
    if (at > from) segments.push({ text: text.slice(from, at), match: false });
    segments.push({ text: text.slice(at, at + q.length), match: true });
    from = at + q.length;
  }
  if (from < text.length) segments.push({ text: text.slice(from), match: false });
  return segments;
}

/** 搜尋被取消（`AbortSignal`）時丟的錯誤；元件看到它就安靜略過，不顯示「搜尋失敗」。 */
export function isAbortError(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === 'AbortError';
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

function normalize(text: string): string {
  return text.trim().toLocaleLowerCase();
}
