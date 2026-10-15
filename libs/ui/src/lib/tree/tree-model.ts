import { DestroyRef, Signal, computed, effect, signal, untracked } from '@angular/core';
import type {
  TreeExpandAllOptions,
  TreeExpandAllProgress,
  TreeExpandAllResult,
  TreeFilter,
  TreeKey,
  TreeLoadChildren,
} from './tree.types';

/** expandAll() 的預設上限：最多載入幾個延遲節點、同時幾個請求。 */
export const TREE_EXPAND_ALL_MAX_LOADS = 50;
export const TREE_EXPAND_ALL_CONCURRENCY = 3;

/** 畫面上的一個節點（lib-tree 與 lib-tree-table 共用）。只包含目前看得到的節點；收合的子孫不在裡面。 */
export interface TreeViewNode<T> {
  node: T;
  key: TreeKey;
  /** 層級，從 1 起算（`aria-level`）。 */
  level: number;
  parent: TreeViewNode<T> | null;
  /** 在同一層看得到的兄弟裡排第幾（從 1 起算）與共有幾個（`aria-posinset`／`aria-setsize`）。 */
  posinset: number;
  setsize: number;
  /** 有子節點（或還沒載入、可能有）。 */
  expandable: boolean;
  expanded: boolean;
  /** 搜尋中為了露出符合的子孫而自動展開：這時不能收合。 */
  forced: boolean;
  loading: boolean;
  /** 延遲載入失敗。 */
  error: boolean;
  /** 看得到的子節點（收合時是空陣列）。 */
  children: TreeViewNode<T>[];
  /** DOM id（鍵可能含任意字元，另外配一個安全的 id）。 */
  domId: string;
}

export interface TreeView<T> {
  roots: TreeViewNode<T>[];
  /** 依畫面順序（前序）排好的可見節點：鍵盤上下移動就在這裡面走。 */
  flat: TreeViewNode<T>[];
  byKey: Map<TreeKey, TreeViewNode<T>>;
  /** 已展開、但子節點還不知道（也沒在載入、沒失敗）的節點：控制器會去載入它們。 */
  needsLoad: T[];
}

/** 控制器要讀的設定；全部是函式（讀 signal input），讓 computed 自動追蹤。 */
export interface TreeSource<T> {
  roots: () => readonly T[];
  key: () => (node: T) => TreeKey;
  children: () => (node: T) => readonly T[] | null | undefined;
  hasChildren: () => ((node: T) => boolean) | null;
  loadChildren: () => TreeLoadChildren<T> | null;
  expandedKeys: () => readonly TreeKey[];
  setExpandedKeys: (keys: readonly TreeKey[]) => void;
  /** 搜尋謂詞（null＝沒在搜尋）。只有 lib-tree 用。 */
  filter?: () => TreeFilter<T> | null;
  /** 延遲載入成功後（子節點已經放進樹裡）呼叫。 */
  loaded?: (node: T) => void;
}

/** 預設的子節點取法：讀節點的 `children` 屬性。 */
export function defaultTreeChildren<T>(node: T): readonly T[] | null | undefined {
  return (node as { children?: readonly T[] | null } | null)?.children;
}

let nextControllerId = 0;

/**
 * 展開收合、延遲載入、搜尋時的可見節點計算，以及鍵盤導覽的目標——lib-tree 與 lib-tree-table 共用同一套規則。
 * 在元件的 injection context 建立（用到 effect）。
 */
export class TreeController<T> {
  private readonly loadedChildren = signal<ReadonlyMap<TreeKey, readonly T[]>>(new Map());
  private readonly loadingKeys = signal<ReadonlySet<TreeKey>>(new Set());
  private readonly failedKeys = signal<ReadonlySet<TreeKey>>(new Set());
  private readonly pending = new Map<TreeKey, () => void>();
  /** 載入中的節點：完成時 resolve（true＝成功）。expandAll 與搜尋路徑共用，同一個節點不會重複請求。 */
  private readonly settles = new Map<TreeKey, Promise<boolean>>();
  private expandRun: { cancelled: boolean } | null = null;
  private readonly domIds = new Map<TreeKey, string>();
  private readonly idPrefix = `lib-tree-n${nextControllerId++}`;
  private destroyed = false;

  readonly view: Signal<TreeView<T>>;
  /** expandAll() 進行中的進度（沒在跑時是 null）。 */
  readonly expandAllProgress = signal<TreeExpandAllProgress | null>(null);

  constructor(
    private readonly src: TreeSource<T>,
    destroyRef: DestroyRef,
  ) {
    this.view = computed(() => this.build());
    effect(() => {
      const needs = this.view().needsLoad;
      // 收合（不論是使用者還是使用端改 expandedKeys）就清掉失敗狀態：下次展開會重新載入。
      const open = new Set(this.src.expandedKeys());
      const stale = [...this.failedKeys()].filter((key) => !open.has(key));
      untracked(() => {
        if (stale.length > 0) this.failedKeys.update((set) => new Set([...set].filter((k) => !stale.includes(k))));
        needs.forEach((node) => this.load(node));
      });
    });
    destroyRef.onDestroy(() => {
      this.destroyed = true;
      if (this.expandRun) this.expandRun.cancelled = true;
      this.pending.forEach((cancel) => cancel());
      this.pending.clear();
    });
  }

  /** 已知的子節點：靜態的 children，或延遲載入過的；還不知道回 null。 */
  childrenOf(node: T, key: TreeKey = this.src.key()(node)): readonly T[] | null {
    const own = this.src.children()(node);
    if (own) return own;
    return this.loadedChildren().get(key) ?? null;
  }

  isExpandable(node: T, key: TreeKey = this.src.key()(node)): boolean {
    const known = this.childrenOf(node, key);
    if (known) return known.length > 0;
    const has = this.src.hasChildren();
    if (has) return has(node);
    return this.src.loadChildren() !== null;
  }

  // ---- 展開、收合 ----

  setExpanded(key: TreeKey, open: boolean): void {
    const current = this.src.expandedKeys();
    const has = current.includes(key);
    if (open === has) return;
    this.src.setExpandedKeys(open ? [...current, key] : current.filter((k) => k !== key));
  }

  /**
   * 全部展開。靜態的與已經載入過的節點立刻展開；還沒載入的延遲節點「一層一層」載入（同時最多 `concurrency` 個請求），
   * 載入成功才展開、再往下一層，總共最多載入 `maxLoads` 個（超過就停，結果的 `limitReached` 是 true）。
   * 載入失敗的節點展開並顯示錯誤與「重試」，不中斷其他節點。`cancelExpandAll()` 停止排新的請求（已送出的照樣完成、留著，但不再展開）。
   * 沒有 loadChildren 時跟以前一樣，同步展開所有已知的節點。
   */
  expandAll(options: TreeExpandAllOptions = {}): Promise<TreeExpandAllResult> {
    this.cancelExpandAll();
    const known = this.expandKnown();
    if (this.src.loadChildren() === null) {
      return Promise.resolve({ loaded: 0, failed: 0, limitReached: false, cancelled: false });
    }
    const maxLoads = Math.max(0, Math.floor(options.maxLoads ?? TREE_EXPAND_ALL_MAX_LOADS));
    const concurrency = Math.max(1, Math.floor(options.concurrency ?? TREE_EXPAND_ALL_CONCURRENCY));
    const run = { cancelled: false };
    this.expandRun = run;
    const progress: TreeExpandAllProgress = { loaded: 0, failed: 0, pending: 0, limitReached: false };
    const publish = () => run === this.expandRun && this.expandAllProgress.set({ ...progress });
    publish();
    return (async () => {
      // 一層一層：先找出這一層「展開了但子節點未知」的節點，載完再看下一層。
      let frontier = known;
      while (frontier.length > 0 && !run.cancelled && !this.destroyed) {
        const next: T[] = [];
        for (let i = 0; i < frontier.length && !run.cancelled; i += concurrency) {
          const room = maxLoads - progress.loaded - progress.failed;
          if (room <= 0) {
            progress.limitReached = true;
            break;
          }
          const batch = frontier.slice(i, i + Math.min(concurrency, room));
          progress.pending = batch.length;
          publish();
          const results = await Promise.all(batch.map((node) => this.loadAsync(node)));
          progress.pending = 0;
          if (run.cancelled || this.destroyed) break;
          const keyOf = this.src.key();
          const open: TreeKey[] = [];
          batch.forEach((node, j) => {
            open.push(keyOf(node));
            if (results[j]) {
              progress.loaded++;
              next.push(...this.expandKnown(this.childrenOf(node) ?? [], false));
            } else {
              progress.failed++;
            }
          });
          // 成功的展開（失敗的也展開：節點下方顯示錯誤與重試）。
          this.addExpanded(open);
          publish();
        }
        if (progress.limitReached) break;
        frontier = next;
      }
      const result: TreeExpandAllResult = {
        loaded: progress.loaded,
        failed: progress.failed,
        limitReached: progress.limitReached,
        cancelled: run.cancelled,
      };
      if (run === this.expandRun) {
        this.expandRun = null;
        this.expandAllProgress.set(null);
      }
      return result;
    })();
  }

  /** 停止 expandAll()：不再送出新的載入請求。 */
  cancelExpandAll(): void {
    if (!this.expandRun) return;
    this.expandRun.cancelled = true;
    this.expandRun = null;
    this.expandAllProgress.set(null);
  }

  /**
   * 展開 nodes（預設是第一層）底下所有子節點已知的節點，回傳「可以展開、但子節點還沒載入」的延遲節點（依畫面順序）。
   * write＝false 時只收集鍵、不寫回（呼叫端一起寫）。
   */
  private expandKnown(nodes: readonly T[] = this.src.roots(), write = true): T[] {
    const keyOf = this.src.key();
    const keys: TreeKey[] = [];
    const unknown: T[] = [];
    const visit = (node: T) => {
      const key = keyOf(node);
      const kids = this.childrenOf(node, key);
      if (kids) {
        if (kids.length > 0) {
          keys.push(key);
          kids.forEach(visit);
        }
      } else if (this.isExpandable(node, key) && !this.failedKeys().has(key)) {
        unknown.push(node);
      }
    };
    nodes.forEach(visit);
    if (write) this.addExpanded(keys);
    else this.deferredKeys.push(...keys);
    return unknown;
  }

  /** expandKnown(write＝false) 收集的鍵：下一次 addExpanded 一起寫回。 */
  private deferredKeys: TreeKey[] = [];

  private addExpanded(keys: readonly TreeKey[]): void {
    const all = [...this.deferredKeys, ...keys];
    this.deferredKeys = [];
    const current = this.src.expandedKeys();
    const have = new Set(current);
    // 保留原本已展開的鍵，只補上新的。
    const add = all.filter((k) => !have.has(k) && have.add(k));
    if (add.length > 0) this.src.setExpandedKeys([...current, ...add]);
  }

  /**
   * 載入一串路徑（每條是從第一層到某個節點的鍵）上的延遲節點，讓路徑末端的節點出現在已知的樹裡。
   * 伺服器端搜尋用：一層一層載入，同一層共用的祖先只載一次，同時最多 `concurrency` 個請求、總共最多 `maxLoads` 個。
   * isCurrent 回 false（例如搜尋字已經換了）時中途停止。回傳成功走完的路徑數。
   */
  async revealPaths(
    paths: readonly (readonly TreeKey[])[],
    isCurrent: () => boolean = () => true,
    { maxLoads = TREE_EXPAND_ALL_MAX_LOADS, concurrency = TREE_EXPAND_ALL_CONCURRENCY }: TreeExpandAllOptions = {},
  ): Promise<number> {
    const keyOf = this.src.key();
    let loads = 0;
    // 每條路徑目前走到哪一層的節點清單。
    let walkers = paths.filter((p) => p.length > 0).map((path) => ({ path, depth: 0, level: this.src.roots() as readonly T[] }));
    let reached = 0;
    while (walkers.length > 0 && isCurrent() && !this.destroyed) {
      const need = new Map<TreeKey, T>();
      const alive: typeof walkers = [];
      for (const w of walkers) {
        const node = w.level.find((n) => keyOf(n) === w.path[w.depth]);
        if (!node) continue;
        if (w.depth === w.path.length - 1) {
          reached++;
          continue;
        }
        alive.push(w);
        const key = keyOf(node);
        if (!this.childrenOf(node, key)) need.set(key, node);
      }
      const queue = [...need.values()];
      for (let i = 0; i < queue.length && isCurrent(); i += concurrency) {
        const batch = queue.slice(i, i + Math.min(concurrency, Math.max(0, maxLoads - loads)));
        if (batch.length === 0) break;
        loads += batch.length;
        await Promise.all(batch.map((node) => this.loadAsync(node)));
      }
      walkers = alive.map((w) => {
        const node = w.level.find((n) => keyOf(n) === w.path[w.depth])!;
        return { path: w.path, depth: w.depth + 1, level: this.childrenOf(node) ?? [] };
      });
    }
    return reached;
  }

  collapseAll(): void {
    if (this.src.expandedKeys().length > 0) this.src.setExpandedKeys([]);
  }

  /** 展開同一層所有可以展開的節點（WAI-ARIA 的 `*`）。 */
  expandSiblings(vn: TreeViewNode<T>): void {
    const siblings = vn.parent ? vn.parent.children : this.view().roots;
    const current = this.src.expandedKeys();
    const add = siblings.filter((s) => s.expandable && !s.forced && !current.includes(s.key)).map((s) => s.key);
    if (add.length > 0) this.src.setExpandedKeys([...current, ...add]);
  }

  /** 清掉失敗狀態：節點仍是展開的，所以會重新載入。 */
  retry(key: TreeKey): void {
    if (!this.failedKeys().has(key)) return;
    this.failedKeys.update((set) => without(set, key));
    this.setExpanded(key, true);
  }

  /**
   * 方向鍵等導覽鍵：回傳要聚焦的節點；只改展開狀態（或沒事可做）時回 null；不是導覽鍵回 undefined。
   * →：載入失敗時重試；收合中就展開；已展開就到第一個子節點。←：展開中就收合；否則回到父節點。
   */
  navigate(vn: TreeViewNode<T>, key: string): TreeViewNode<T> | null | undefined {
    const flat = this.view().flat;
    const index = flat.indexOf(vn);
    switch (key) {
      case 'ArrowDown':
        return flat[index + 1] ?? null;
      case 'ArrowUp':
        return index > 0 ? flat[index - 1] : null;
      case 'Home':
        return flat[0] ?? null;
      case 'End':
        return flat[flat.length - 1] ?? null;
      case 'ArrowRight':
        if (vn.error) {
          this.retry(vn.key);
          return null;
        }
        if (vn.expandable && !vn.expanded) {
          this.setExpanded(vn.key, true);
          return null;
        }
        return vn.expanded && vn.children.length > 0 ? vn.children[0] : null;
      case 'ArrowLeft':
        if (vn.expandable && vn.expanded && !vn.forced) {
          this.setExpanded(vn.key, false);
          return null;
        }
        return vn.parent;
      case '*':
        this.expandSiblings(vn);
        return null;
      default:
        return undefined;
    }
  }

  // ---- 延遲載入 ----

  /** 載入一個節點的子節點（已經載入過就直接回 true；正在載入就等那一次）。 */
  loadAsync(node: T): Promise<boolean> {
    const key = this.src.key()(node);
    if (this.childrenOf(node, key)) return Promise.resolve(true);
    this.load(node);
    return this.settles.get(key) ?? Promise.resolve(!!this.childrenOf(node, key));
  }

  private load(node: T): void {
    const fn = this.src.loadChildren();
    const key = this.src.key()(node);
    if (!fn || this.pending.has(key) || this.destroyed) return;
    this.loadingKeys.update((set) => with_(set, key));
    this.failedKeys.update((set) => without(set, key));
    let settled = false;
    let done!: (ok: boolean) => void;
    this.settles.set(key, new Promise<boolean>((resolve) => (done = resolve)));
    const finish = (children: readonly T[] | null) => {
      if (settled) return;
      settled = true;
      this.settles.delete(key);
      if (this.destroyed) {
        done(false);
        return;
      }
      this.pending.get(key)?.();
      this.pending.delete(key);
      this.loadingKeys.update((set) => without(set, key));
      if (children) {
        this.loadedChildren.update((map) => new Map(map).set(key, children));
        this.src.loaded?.(node);
      } else {
        this.failedKeys.update((set) => with_(set, key));
      }
      done(!!children);
    };
    let result: ReturnType<TreeLoadChildren<T>>;
    try {
      result = fn(node);
    } catch {
      finish(null);
      return;
    }
    if (isSubscribable<readonly T[]>(result)) {
      let unsubscribe: (() => void) | null = null;
      // 先占位：同步發值的 Observable（of(...)）會在 subscribe 回傳前就 finish。
      this.pending.set(key, () => unsubscribe?.());
      const sub = result.subscribe({
        next: (value) => finish(value ?? []),
        error: () => finish(null),
        complete: () => finish([]),
      });
      unsubscribe = () => sub.unsubscribe();
      if (settled) sub.unsubscribe();
    } else {
      let cancelled = false;
      this.pending.set(key, () => (cancelled = true));
      Promise.resolve(result).then(
        (value) => !cancelled && finish(value ?? []),
        () => !cancelled && finish(null),
      );
    }
  }

  // ---- 可見節點 ----

  private domId(key: TreeKey): string {
    let id = this.domIds.get(key);
    if (!id) {
      id = `${this.idPrefix}-${this.domIds.size}`;
      this.domIds.set(key, id);
    }
    return id;
  }

  private build(): TreeView<T> {
    const keyOf = this.src.key();
    const expanded = new Set(this.src.expandedKeys());
    const loading = this.loadingKeys();
    const failed = this.failedKeys();
    this.loadedChildren();
    const filter = this.src.filter?.() ?? null;
    const canLoad = this.src.loadChildren() !== null;
    const flat: TreeViewNode<T>[] = [];
    const byKey = new Map<TreeKey, TreeViewNode<T>>();
    const needsLoad: T[] = [];

    // 搜尋：先找出符合的節點與「有符合的子孫」的節點（只搜已知的節點）。
    const keep = filter ? new Map<TreeKey, { self: boolean; descendant: boolean }>() : null;
    if (filter && keep) {
      const mark = (node: T): boolean => {
        const key = keyOf(node);
        let descendant = false;
        for (const kid of this.childrenOf(node, key) ?? []) {
          if (mark(kid)) descendant = true;
        }
        const self = filter(node);
        if (self || descendant) keep.set(key, { self, descendant });
        return self || descendant;
      };
      this.src.roots().forEach(mark);
    }

    const branch = (nodes: readonly T[], level: number, parent: TreeViewNode<T> | null): TreeViewNode<T>[] => {
      const list = keep ? nodes.filter((n) => keep.has(keyOf(n))) : nodes;
      return list.map((node, i) => {
        const key = keyOf(node);
        const vn: TreeViewNode<T> = {
          node,
          key,
          level,
          parent,
          posinset: i + 1,
          setsize: list.length,
          expandable: false,
          expanded: false,
          forced: false,
          loading: false,
          error: false,
          children: [],
          domId: this.domId(key),
        };
        flat.push(vn);
        byKey.set(key, vn);
        if (keep) {
          const info = keep.get(key)!;
          vn.expandable = vn.expanded = vn.forced = info.descendant;
          if (info.descendant) vn.children = branch(this.childrenOf(node, key) ?? [], level + 1, vn);
        } else {
          vn.expandable = this.isExpandable(node, key);
          vn.expanded = vn.expandable && expanded.has(key);
          vn.loading = loading.has(key);
          vn.error = vn.expanded && failed.has(key);
          if (vn.expanded) {
            const kids = this.childrenOf(node, key);
            if (kids) vn.children = branch(kids, level + 1, vn);
            else if (!vn.loading && !vn.error && canLoad) needsLoad.push(node);
          }
        }
        return vn;
      });
    };
    const roots = branch(this.src.roots(), 1, null);
    return { roots, flat, byKey, needsLoad };
  }
}

/**
 * 等 Promise 或 Observable 的第一個值（Observable 拿到第一個值就取消訂閱；complete 而沒有值時當成 undefined）。
 * 回傳取消函式：之後不會再呼叫 next／error。lib-tree 的伺服器端搜尋用。
 */
export function settleFirst<V>(
  result: PromiseLike<V> | { subscribe(observer: { next: (v: V) => void; error: (e: unknown) => void; complete: () => void }): { unsubscribe(): void } },
  next: (value: V | undefined) => void,
  error: (reason: unknown) => void,
): () => void {
  let live = true;
  const once = <A>(fn: (a: A) => void) => (a: A) => {
    if (!live) return;
    live = false;
    fn(a);
  };
  const onNext = once(next);
  const onError = once(error);
  if (isSubscribable<V>(result)) {
    let sub: { unsubscribe(): void } | null = null;
    sub = result.subscribe({ next: (v) => (onNext(v), sub?.unsubscribe()), error: onError, complete: () => onNext(undefined) });
    if (!live) sub.unsubscribe();
    return () => {
      live = false;
      sub?.unsubscribe();
    };
  }
  Promise.resolve(result).then(onNext, onError);
  return () => (live = false);
}

/** 型別上的鴨子判斷：有 subscribe 就當 Observable（不必為了 isObservable 引入 rxjs）。 */
function isSubscribable<V>(value: unknown): value is {
  subscribe(observer: { next: (v: V) => void; error: (e: unknown) => void; complete: () => void }): { unsubscribe(): void };
} {
  return !!value && typeof (value as { subscribe?: unknown }).subscribe === 'function';
}

function with_<K>(set: ReadonlySet<K>, key: K): ReadonlySet<K> {
  return set.has(key) ? set : new Set(set).add(key);
}

function without<K>(set: ReadonlySet<K>, key: K): ReadonlySet<K> {
  if (!set.has(key)) return set;
  const next = new Set(set);
  next.delete(key);
  return next;
}

/**
 * 預輸入（type-ahead）：從目前節點的下一個開始找名稱開頭相符的可見節點，找到尾端再從頭找。
 * 同一個字連按（「aa」）時改成在開頭是那個字的節點之間輪流跳。
 */
export function findTypeahead<T>(
  flat: readonly TreeViewNode<T>[],
  from: TreeViewNode<T> | null,
  buffer: string,
  labelOf: (node: T) => string,
): TreeViewNode<T> | null {
  const chars = [...buffer.trim()];
  if (chars.length === 0 || flat.length === 0) return null;
  // 以字元（code point）比較：中日韓的罕用字、表情符號是兩個 UTF-16 單位。
  const query = chars.every((ch) => ch === chars[0]) ? chars[0] : chars.join('');
  const lower = query.toLocaleLowerCase();
  const start = from ? flat.indexOf(from) : -1;
  // 多字的查詢先比目前節點本身（打字途中不要跳走），單字則從下一個開始。
  const offset = [...query].length > 1 ? 0 : 1;
  for (let i = 0; i < flat.length; i++) {
    const vn = flat[(start + offset + i + flat.length) % flat.length];
    if (labelOf(vn.node).trim().toLocaleLowerCase().startsWith(lower)) return vn;
  }
  return null;
}
