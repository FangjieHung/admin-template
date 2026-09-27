import { LocalStorageRepository } from './local-storage-repository';

/** 本機儲存某個集合的狀態：正常、沒有資料、內容無法解析（不是 JSON 陣列）。 */
export type StoredCollectionState = 'ok' | 'missing' | 'corrupt';

/** {@link LazySeedLocalStorageRepository.ensureReady} 的結果：原本就正常、首次灌入示範資料、內容損壞而重設。 */
export type EnsureReadyResult = 'ok' | 'seeded' | 'reset';

export interface StorageResetEvent {
  readonly key: string;
  /** true：原本的內容損壞（該提示使用者）；false：原本沒有資料，只是補灌示範資料。 */
  readonly corrupt: boolean;
}

/**
 * 示範資料需要時才載入的 LocalStorageRepository：`loadSeed` 通常包著動態 `import()`，
 * 讓示範資料留在獨立的 lazy chunk，資料正常的日常開站不必下載。
 *
 * - 啟動時先呼叫 {@link ensureReady}：缺資料或損壞的才載入示範資料寫回，之後的同步讀取照常運作。
 * - 使用途中才發現缺資料／損壞：讀取先回傳空清單，並只觸發一次非同步重設；
 *   重設期間的寫入排隊，等示範資料寫回後依序套用，最後呼叫 `onReset` 通知。
 *
 * 各前台 app（booking、affiliate）仍用同步種子的 {@link LocalStorageRepository}，不受影響。
 */
export class LazySeedLocalStorageRepository<
  T extends { id: string },
> extends LocalStorageRepository<T> {
  private pendingReset: Promise<void> | null = null;
  private queuedWrites: ((items: T[]) => T[])[] = [];

  constructor(
    key: string,
    private readonly loadSeed: () => Promise<T[]>,
    private readonly onDeferredReset?: (event: StorageResetEvent) => void,
    normalize?: (item: unknown) => T,
  ) {
    super(key, () => [], undefined, normalize);
  }

  /** 只檢查本機內容能不能用，不載入示範資料、不寫入。 */
  inspect(): StoredCollectionState {
    const raw = localStorage.getItem(this.key);
    if (raw === null) return 'missing';
    try {
      return Array.isArray(JSON.parse(raw)) ? 'ok' : 'corrupt';
    } catch {
      return 'corrupt';
    }
  }

  /**
   * 啟動時呼叫：內容正常就什麼都不做（不載入示範資料）；沒有資料或損壞時載入示範資料並寫回。
   * 不呼叫 onDeferredReset——由呼叫端彙整成一則提示。
   */
  async ensureReady(): Promise<EnsureReadyResult> {
    const state = this.inspect();
    if (state === 'ok') return 'ok';
    const items = await this.loadSeed();
    // 等待期間若已經有正常資料寫進來（例如使用途中的重設先完成），就不要蓋掉。
    if (this.inspect() === 'ok') return 'ok';
    super.replaceAll(items);
    return state === 'missing' ? 'seeded' : 'reset';
  }

  /** 非同步重設是否進行中。 */
  get resetting(): boolean {
    return this.pendingReset !== null;
  }

  /** 等待進行中的非同步重設完成（沒有就立即完成）。 */
  whenSettled(): Promise<void> {
    return this.pendingReset ?? Promise.resolve();
  }

  override getAll(): T[] {
    return this.pendingReset ? [] : super.getAll();
  }

  override create(item: T): T {
    if (this.deferIfResetting((items) => [...items, item])) return item;
    return super.create(item);
  }

  override update(id: string, patch: Partial<T>): T {
    // 重設完成後套用到示範資料上；該筆若不在示範資料裡就略過。
    const deferred = this.deferIfResetting((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
    if (deferred) return { ...patch, id } as T;
    return super.update(id, patch);
  }

  override remove(id: string): void {
    if (this.deferIfResetting((items) => items.filter((item) => item.id !== id))) return;
    super.remove(id);
  }

  override replaceAll(items: T[]): void {
    if (this.pendingReset) {
      this.queuedWrites.push(() => items);
      return;
    }
    super.replaceAll(items);
  }

  /** 讀一次以偵測缺資料／損壞；若因此（或原本就）在重設中，把寫入排隊並回傳 true。 */
  private deferIfResetting(change: (items: T[]) => T[]): boolean {
    this.getAll();
    if (!this.pendingReset) return false;
    this.queuedWrites.push(change);
    return true;
  }

  protected override reset(corrupt: boolean): T[] {
    if (!this.pendingReset) {
      this.pendingReset = this.loadSeed().then(
        (seedItems) => {
          const queued = this.queuedWrites;
          this.queuedWrites = [];
          this.pendingReset = null;
          super.replaceAll(queued.reduce((items, change) => change(items), seedItems));
          this.onDeferredReset?.({ key: this.key, corrupt });
        },
        () => {
          // 載入失敗（例如離線）：放棄這次重設與期間的寫入，下次讀取時再試。
          this.queuedWrites = [];
          this.pendingReset = null;
        },
      );
    }
    return [];
  }
}
