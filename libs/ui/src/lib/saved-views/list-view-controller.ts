import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { DataTableColumnPrefs, DataTableSort } from '../data-table/data-table.types';
import { FilterCondition } from '../filter/filter.types';
import { ListViewState, SavedView, SavedViewRepository } from './saved-view.types';

/** 用來比較的穩定字串：篩選條件不論先後順序、物件鍵不論先後順序。 */
function canonical(state: ListViewState): string {
  const sortKeys = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.keys(v as object)
          .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
          .sort()
          .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
      );
    }
    return v;
  };
  const filters = [...state.filters].sort((a, b) => a.field.localeCompare(b.field));
  return JSON.stringify(sortKeys({ ...state, filters }));
}

/** 兩份檢視狀態是否相同（「已修改」用）。 */
export function sameListViewState(a: ListViewState, b: ListViewState): boolean {
  return canonical(a) === canonical(b);
}

function cloneState(state: ListViewState): ListViewState {
  return JSON.parse(JSON.stringify(state)) as ListViewState;
}

export interface ListViewControllerOptions {
  /** 這份清單的識別，例如 'orders'。 */
  listId: string;
  /** 預設檢視（沒有選任何已儲存檢視時）的狀態。 */
  defaults: ListViewState;
  repository: SavedViewRepository;
  /** 測試用。 */
  now?: () => Date;
  /** 測試用。 */
  newId?: () => string;
}

function randomId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  return c?.randomUUID ? c.randomUUID() : `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 一份清單的檢視狀態與已儲存檢視（不是元件，頁面 new 一個用）：
 *
 * ```ts
 * readonly view = new ListViewController({ listId: 'orders', defaults, repository: inject(SAVED_VIEW_REPOSITORY) });
 * constructor() { void this.view.load(); }
 * ```
 * 表格綁 `[(sort)]="view.sort"`、`[(pageSize)]="view.pageSize"`、`[(page)]="view.page"`、`[(columnPrefs)]="view.columns"`；
 * 篩選綁 `[conditions]="view.filters()" (conditionsChange)="view.setFilters($event)"`（換條件時回到第一頁）。
 */
export class ListViewController {
  readonly listId: string;
  private readonly defaults: ListViewState;
  private readonly repository: SavedViewRepository;
  private readonly now: () => Date;
  private readonly newId: () => string;

  readonly sort: WritableSignal<DataTableSort | null>;
  readonly filters: WritableSignal<readonly FilterCondition[]>;
  readonly columns: WritableSignal<DataTableColumnPrefs | null>;
  readonly pageSize: WritableSignal<number>;
  /** 目前頁碼不屬於檢視。 */
  readonly page = signal(0);

  private readonly viewsState = signal<readonly SavedView[]>([]);
  readonly views: Signal<readonly SavedView[]> = this.viewsState.asReadonly();
  /** null＝預設檢視。 */
  private readonly selectedIdState = signal<string | null>(null);
  readonly selectedId: Signal<string | null> = this.selectedIdState.asReadonly();
  /** 最近一次寫入沒能存到裝置上（只在記憶體裡）。 */
  readonly persistFailed = signal(false);

  readonly selectedView = computed(() => this.views().find((v) => v.id === this.selectedId()) ?? null);

  readonly state = computed<ListViewState>(() => ({
    sort: this.sort(),
    filters: [...this.filters()],
    columns: this.columns(),
    pageSize: this.pageSize(),
  }));

  /** 目前狀態與「選中的檢視（或預設）」不同。 */
  readonly modified = computed(() => !sameListViewState(this.state(), this.selectedView()?.state ?? this.defaults));

  constructor(options: ListViewControllerOptions) {
    this.listId = options.listId;
    this.defaults = cloneState(options.defaults);
    this.repository = options.repository;
    this.now = options.now ?? (() => new Date());
    this.newId = options.newId ?? randomId;
    this.sort = signal(this.defaults.sort);
    this.filters = signal(this.defaults.filters);
    this.columns = signal(this.defaults.columns);
    this.pageSize = signal(this.defaults.pageSize);
  }

  /** 從存放處讀回已儲存的檢視。讀取失敗時當作沒有檢視（不丟錯）。 */
  async load(): Promise<void> {
    try {
      this.viewsState.set(await this.repository.list(this.listId));
    } catch {
      this.viewsState.set([]);
    }
    if (this.selectedId() && !this.selectedView()) this.selectedIdState.set(null);
  }

  setFilters(filters: readonly FilterCondition[]): void {
    this.filters.set(filters);
    this.page.set(0);
  }

  private applyState(state: ListViewState): void {
    const s = cloneState(state);
    this.sort.set(s.sort);
    this.filters.set(s.filters);
    this.columns.set(s.columns);
    this.pageSize.set(s.pageSize);
    this.page.set(0);
  }

  /** 切到某個已儲存檢視（null＝預設檢視），套用它的設定。 */
  select(id: string | null): void {
    const view = id === null ? null : (this.views().find((v) => v.id === id) ?? null);
    this.selectedIdState.set(view?.id ?? null);
    this.applyState(view?.state ?? this.defaults);
  }

  /** 放棄修改，回到目前檢視原本的設定。 */
  discardChanges(): void {
    this.applyState(this.selectedView()?.state ?? this.defaults);
  }

  isNameTaken(name: string, exceptId?: string): boolean {
    const n = name.trim();
    return this.views().some((v) => v.id !== exceptId && v.name === n);
  }

  /** 以目前狀態另存一個新檢視並切過去。 */
  async saveAs(name: string): Promise<SavedView> {
    const at = this.now().toISOString();
    const view: SavedView = {
      id: this.newId(),
      listId: this.listId,
      name: name.trim(),
      state: cloneState(this.state()),
      createdAt: at,
      updatedAt: at,
      visibility: 'private',
      sharedWith: [],
    };
    this.viewsState.update((views) => [...views, view]);
    this.selectedIdState.set(view.id);
    await this.persist(() => this.repository.save(view));
    return view;
  }

  /** 把目前狀態寫回選中的檢視（預設檢視不能覆寫）。 */
  async saveCurrent(): Promise<void> {
    const current = this.selectedView();
    if (!current) return;
    const view: SavedView = { ...current, state: cloneState(this.state()), updatedAt: this.now().toISOString() };
    this.replace(view);
    await this.persist(() => this.repository.save(view));
  }

  async rename(id: string, name: string): Promise<void> {
    const current = this.views().find((v) => v.id === id);
    if (!current) return;
    const view: SavedView = { ...current, name: name.trim(), updatedAt: this.now().toISOString() };
    this.replace(view);
    await this.persist(() => this.repository.save(view));
  }

  /** 刪除檢視；刪的是目前選中的就回到預設檢視（套用預設設定）。 */
  async remove(id: string): Promise<void> {
    const wasSelected = this.selectedId() === id;
    this.viewsState.update((views) => views.filter((v) => v.id !== id));
    if (wasSelected) this.select(null);
    await this.persist(() => this.repository.remove(this.listId, id));
  }

  private replace(view: SavedView): void {
    this.viewsState.update((views) => views.map((v) => (v.id === view.id ? view : v)));
  }

  private async persist(write: () => Promise<{ persisted: boolean }>): Promise<void> {
    try {
      this.persistFailed.set(!(await write()).persisted);
    } catch {
      this.persistFailed.set(true);
    }
  }
}
