import { Observable, Subject } from 'rxjs';

/**
 * 通知中心（lib-notification-list）的資料來源。
 *
 * 元件只認得下面這幾個方法，不管資料在前端陣列、REST 還是 WebSocket：
 * - `list`：一頁通知（新到舊）與下一頁的游標。元件換篩選或重新載入前會 abort 上一次的 `signal`，
 *   接伺服器時把 `signal` 傳給 `fetch`／`HttpClient`（`takeUntil`）即可取消舊請求。
 * - `unreadCount`：未讀數（頁首鈴鐺的數字）。
 * - `markRead`／`markAllRead`／`remove`：使用者的動作；reject 時元件把畫面還原並念出「沒有完成」。
 * - `changes`（選填）：伺服器推播。元件收到 `added` 時把新通知放到最上面並念出來；其他事件讓多個畫面
 *   （鈴鐺面板、全部通知頁）保持一致。
 */
export interface NotificationAction {
  id: string;
  /** 按鈕文字，例：「接受指派」。 */
  label: string;
}

/** 圖示底色的語意，對到 `--app-{tone}-bg/-fg`。 */
export type NotificationTone = 'neutral' | 'info' | 'positive' | 'warning' | 'danger';

export interface NotificationItem {
  id: string;
  title: string;
  /** 一兩句說明，畫面上最多兩行。 */
  body?: string;
  /** 建立時間（毫秒或 ISO 字串）。 */
  createdAt: number | string;
  read: boolean;
  /** 頁面自訂的類別 id（「指派給我」「提及」「系統」），對到 `[categories]` 的 id。 */
  category?: string;
  /** Material Symbols 圖示名稱；有 `avatar` 時不用。 */
  icon?: string;
  /** 人送來的通知：名字縮寫（一兩個字），畫成圓章。 */
  avatar?: string;
  tone?: NotificationTone;
  /** 點了要去哪裡（不透明的字串，元件只原樣送出 `(open)`，由頁面決定怎麼導覽）。 */
  link?: string;
  /** 最多一個直接在通知上完成的動作。 */
  action?: NotificationAction;
}

export type NotificationFilter = 'all' | 'unread';

export interface NotificationQuery {
  filter: NotificationFilter;
  /** null／undefined：不限類別。 */
  category?: string | null;
  /** 上一頁回傳的 `nextCursor`；第一頁不給。 */
  cursor?: string | null;
  /** 一頁幾筆。 */
  limit: number;
}

export interface NotificationPage {
  items: readonly NotificationItem[];
  /** 還有下一頁時給游標；沒有就不給（元件據此顯示「載入更多」）。 */
  nextCursor?: string | null;
}

export type NotificationEvent =
  | { type: 'added'; item: NotificationItem }
  | { type: 'read'; ids: readonly string[]; read: boolean }
  | { type: 'all-read' }
  | { type: 'removed'; id: string };

export interface NotificationSource {
  list(query: NotificationQuery, signal: AbortSignal): Promise<NotificationPage>;
  unreadCount(): Promise<number>;
  markRead(ids: readonly string[], read: boolean): Promise<void>;
  markAllRead(): Promise<void>;
  remove(id: string): Promise<void>;
  changes?: Observable<NotificationEvent>;
}

/** 通知的建立時間（毫秒）。 */
export function notificationTime(item: NotificationItem): number {
  return typeof item.createdAt === 'number' ? item.createdAt : new Date(item.createdAt).getTime();
}

/** 通知符不符合目前的篩選（`added` 事件決定要不要放進目前的清單）。 */
export function matchesNotificationQuery(
  item: NotificationItem,
  query: Pick<NotificationQuery, 'filter' | 'category'>,
): boolean {
  if (query.filter === 'unread' && item.read) return false;
  return !query.category || item.category === query.category;
}

export interface DemoNotificationSourceOptions {
  /** 每次呼叫的假延遲（毫秒），預設 400。 */
  latencyMs?: number;
  /** true：第一次 `list` 失敗（示範錯誤狀態與重試），之後正常。 */
  failOnce?: boolean;
  /** 新通知的 id 前綴，預設 `demo-`。 */
  idPrefix?: string;
  /** 現在時間（測試用），預設 `Date.now`。 */
  now?: () => number;
}

/** 推一則新通知時要給的內容；id、時間、未讀由來源補上。 */
export type NewNotification = Omit<NotificationItem, 'id' | 'createdAt' | 'read'> & Partial<Pick<NotificationItem, 'id'>>;

export interface DemoNotificationSource extends NotificationSource {
  changes: Observable<NotificationEvent>;
  /** 馬上送達一則新通知（回傳補齊後的通知）。 */
  push(item: NewNotification): NotificationItem;
  /** 每隔 `intervalMs` 送達一則 `next(第幾則)` 產生的通知；重複呼叫會換掉原本的計時器。 */
  startTimer(intervalMs: number, next: (seq: number) => NewNotification): void;
  /** 停掉計時器（之後可以再 `startTimer`）。 */
  stopTimer(): void;
  readonly timerRunning: boolean;
  /** 下一次 `list` 失敗一次（示範用）。 */
  failNext(): void;
  /** 目前所有通知（新到舊，測試與除錯用）。 */
  snapshot(): readonly NotificationItem[];
}

/**
 * 示範用的資料來源：前端陣列、假延遲、游標分頁；`push` 與 `startTimer` 模擬伺服器推播（`changes`）。
 * 計時器要記得 `stopTimer()`（頁面銷毀時），測試裡用假時鐘也可以。
 */
export function createDemoNotificationSource(
  seed: readonly NotificationItem[],
  options: DemoNotificationSourceOptions = {},
): DemoNotificationSource {
  const latency = Math.max(0, options.latencyMs ?? 400);
  const now = options.now ?? Date.now;
  const prefix = options.idPrefix ?? 'demo-';
  let items: NotificationItem[] = sortNewest(seed.map((item) => ({ ...item })));
  let failures = options.failOnce ? 1 : 0;
  let seq = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const changes = new Subject<NotificationEvent>();

  const wait = (signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      if (signal?.aborted) return reject(abortError());
      const id = setTimeout(resolve, latency);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(id);
          reject(abortError());
        },
        { once: true },
      );
    });

  const push = (input: NewNotification): NotificationItem => {
    seq += 1;
    const item: NotificationItem = { ...input, id: input.id ?? `${prefix}${now()}-${seq}`, createdAt: now(), read: false };
    items = [item, ...items];
    changes.next({ type: 'added', item: { ...item } });
    return item;
  };

  return {
    changes: changes.asObservable(),
    async list(query, signal) {
      await wait(signal);
      if (failures > 0) {
        failures -= 1;
        throw new Error('demo: list failed');
      }
      const matched = items.filter((item) => matchesNotificationQuery(item, query));
      const start = query.cursor ? afterCursor(matched, query.cursor) : 0;
      const limit = Math.max(1, query.limit);
      const page = matched.slice(start, start + limit);
      const last = page[page.length - 1];
      const hasMore = start + limit < matched.length;
      return { items: page.map((item) => ({ ...item })), nextCursor: hasMore && last ? cursorOf(last) : null };
    },
    async unreadCount() {
      return items.filter((item) => !item.read).length;
    },
    async markRead(ids, read) {
      await wait();
      const set = new Set(ids);
      items = items.map((item) => (set.has(item.id) ? { ...item, read } : item));
      changes.next({ type: 'read', ids: [...ids], read });
    },
    async markAllRead() {
      await wait();
      items = items.map((item) => (item.read ? item : { ...item, read: true }));
      changes.next({ type: 'all-read' });
    },
    async remove(id) {
      await wait();
      items = items.filter((item) => item.id !== id);
      changes.next({ type: 'removed', id });
    },
    push,
    startTimer(intervalMs, next) {
      if (timer) clearInterval(timer);
      let n = 0;
      timer = setInterval(() => push(next(++n)), Math.max(1000, intervalMs));
    },
    stopTimer() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    get timerRunning() {
      return timer !== null;
    },
    failNext() {
      failures = 1;
    },
    snapshot() {
      return items.map((item) => ({ ...item }));
    },
  };
}

function sortNewest(list: NotificationItem[]): NotificationItem[] {
  return list.sort((a, b) => notificationTime(b) - notificationTime(a) || (a.id < b.id ? 1 : -1));
}

// 游標是「時間:id」：新通知插在最前面、或前面的通知被移除時，下一頁仍然從同一則之後接下去，不重複也不漏。
function cursorOf(item: NotificationItem): string {
  return `${notificationTime(item)}:${item.id}`;
}

function afterCursor(list: readonly NotificationItem[], cursor: string): number {
  const at = cursor.indexOf(':');
  const time = Number(cursor.slice(0, at));
  const id = cursor.slice(at + 1);
  const index = list.findIndex((item) => {
    const t = notificationTime(item);
    return t < time || (t === time && item.id < id);
  });
  return index === -1 ? list.length : index;
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}
