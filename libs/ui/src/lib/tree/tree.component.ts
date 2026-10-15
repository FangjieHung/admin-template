import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  contentChild,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TREE_LABELS, assertTreeLabels, formatTreeLabel } from './tree-labels';
import { TreeController, TreeViewNode, defaultTreeChildren, findTypeahead, settleFirst } from './tree-model';
import { TreeKeySink } from './tree-key-sink';
import { TreeCheckAccess, checkedKeysInOrder, computeCheckStates, toggleCheckedKeys } from './tree-check';
import { TreeNodeContext, TreeNodeDirective } from './tree-node.directive';
import { TreeHighlightComponent } from './tree-highlight.component';
import type {
  TreeCheckState,
  TreeExpandAllOptions,
  TreeExpandAllResult,
  TreeFilter,
  TreeKey,
  TreeLoadChildren,
  TreeSearchMatch,
  TreeSelectionMode,
  TreeServerSearch,
} from './tree.types';

/** 搜尋字停手多久才呼叫伺服器端搜尋。 */
const SERVER_SEARCH_DELAY_MS = 250;
const NO_KEYS: ReadonlySet<TreeKey> = new Set();
let nextTreeId = 0;

/**
 * 樹狀選單（WAI-ARIA Tree View）：分類、組織架構這類有上下層的清單。
 *
 * - 資料：`[nodes]` 是第一層；子節點由 `[nodeChildren]` 取得（預設讀 `children` 屬性）。節點內容由
 *   `<ng-template libTreeNode let-node>` 提供，不給就顯示 `[nodeLabel]` 的文字。
 * - 展開：`[(expandedKeys)]` 雙向綁定（受控）；不綁定時元件自己記（非受控）。`expandAll()`／`collapseAll()` 一次展開或收合。
 *   延遲載入的樹按 `expandAll()` 會一層一層載入還沒載入的節點：同時最多 3 個請求、總共最多載入 50 個（`expandAll({ maxLoads, concurrency })` 可改），
 *   載入中的節點顯示轉圈，失敗的節點展開並顯示錯誤與重試；`expandAllProgress()` 是進度，`cancelExpandAll()` 停止。
 * - 延遲載入：`[loadChildren]` 回 Promise 或 Observable。第一次展開時載入、顯示轉圈；失敗時節點下方顯示錯誤與「重試」
 *  （也可以按 →）。收合再展開不會重新載入成功過的節點；失敗的節點收合後再展開會重新載入。
 *   沒有 `children` 的節點，`[hasChildren]` 可以先說「有沒有子節點」（不給就假設可能有）。
 * - 選取：`selection` 為 `single` 時是「目前項目」（`[(currentKey)]`，並送出 `(activate)`）；`multiple` 時是三態勾選
 *  （`[(checkedKeys)]`），規則見 `toggleCheckedKeys`：勾父節點連帶勾所有已知子孫；子孫全勾時父節點自動全勾；
 *   還沒載入的延遲節點算一個獨立的葉節點，勾了它，之後載入的子節點也全部算勾。`checkedKeys` 一律列出所有全勾的已知節點（含父節點）。
 * - 搜尋：`filterText`（比對 `nodeLabel`，不分大小寫）或 `[filter]` 謂詞。符合的節點與它們的祖先保留，祖先自動展開
 *  （搜尋中不能收合），比對到的字用 `<mark>` 標出。沒有結果時顯示 `noResults`。
 *   本機的比對只看得到已知的節點；延遲載入的樹可以給 `[serverSearch]`（使用端實作，回傳符合的鍵與祖先路徑），
 *   元件照路徑一層一層載入，讓伺服器找到的節點也出現（並保留）。沒給時，搜尋結果下方顯示 `searchLoadedOnly`（有提供這句時）。
 * - 鍵盤：↑↓ 移動、→ 展開或進入第一個子節點、← 收合或回到父節點、Home／End、打字跳到開頭相符的節點、
 *   Space 勾選（single 時選為目前項目）、Enter 送出 activate、`*` 展開同一層。
 *   打字跳轉也支援注音、倉頡等輸入法：鍵盤焦點實際在一個看不見的輸入框上（整棵樹唯一的 tab stop），
 *   用 `aria-activedescendant` 指向目前的節點；組字時輸入框在目前節點那一列的右側顯示成小框，確定後用確定的字比對（例：打「財」跳到「財務部」）。
 */
@Component({
  selector: 'lib-tree',
  imports: [NgTemplateOutlet, TreeHighlightComponent],
  templateUrl: './tree.component.html',
  styleUrl: './tree.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lib-tree', '[class.tr--focus-visible]': 'sink.focusVisible()' },
})
export class TreeComponent<T> {
  /** 第一層節點。 */
  readonly nodes = input.required<readonly T[]>();
  /** 節點的唯一鍵。 */
  readonly nodeKey = input.required<(node: T) => TreeKey>();
  /** 節點名稱：預設內容、搜尋比對、預輸入都用它。 */
  readonly nodeLabel = input.required<(node: T) => string>();
  /** 子節點（預設讀 `children` 屬性）。回 null／undefined 表示還不知道（交給 loadChildren），回空陣列表示沒有。 */
  readonly nodeChildren = input<(node: T) => readonly T[] | null | undefined>(defaultTreeChildren);
  /** 子節點還不知道時，這個節點有沒有子節點（決定要不要畫展開鈕）。不給就假設有（有 loadChildren 時）。 */
  readonly hasChildren = input<((node: T) => boolean) | null>(null);
  /** 延遲載入子節點。 */
  readonly loadChildren = input<TreeLoadChildren<T> | null>(null);
  readonly selection = input<TreeSelectionMode>('none');
  /** 搜尋文字（比對 nodeLabel，並標出比對到的字）。 */
  readonly filterText = input('');
  /** 自訂搜尋條件；給了就取代 filterText 的比對（filterText 仍用來標字）。 */
  readonly filter = input<TreeFilter<T> | null>(null);
  /** 整棵樹的無障礙名稱，例：「組織架構」。 */
  readonly label = input('');
  /**
   * 伺服器端搜尋（延遲載入的樹用）：filterText 有字時（停手 250ms 後）呼叫，回傳符合的節點鍵與祖先路徑；
   * 元件照路徑載入祖先，找到的節點即使名稱不含搜尋字也保留。
   */
  readonly serverSearch = input<TreeServerSearch | null>(null);

  /** 展開中的節點鍵（雙向綁定＝受控；不綁定＝元件自己記）。 */
  readonly expandedKeys = model<readonly TreeKey[]>([]);
  /** `single`：目前項目。 */
  readonly currentKey = model<TreeKey | null>(null);
  /** `multiple`：全勾的節點鍵（含父節點，依樹的順序）。 */
  readonly checkedKeys = model<readonly TreeKey[]>([]);

  /** 點擊、Enter（single 時另有 Space）啟用了一個節點。 */
  readonly activate = output<T>();

  protected readonly labels = assertTreeLabels(inject(TREE_LABELS, { optional: true }), 'Tree');
  private readonly nodeDef = contentChild(TreeNodeDirective);
  protected readonly nodeTemplate = computed(() => this.nodeDef()?.template ?? null);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly query = computed(() => this.filterText().trim());
  /** 伺服器端搜尋找到的節點鍵（它們不管名稱比不比對得到都保留）。 */
  private readonly serverMatches = signal<ReadonlySet<TreeKey>>(NO_KEYS);
  /** 伺服器端搜尋的狀態。 */
  protected readonly serverState = signal<'idle' | 'searching' | 'failed'>('idle');
  private readonly baseFilter = computed<TreeFilter<T> | null>(() => {
    const custom = this.filter();
    if (custom) return custom;
    const q = this.query().toLocaleLowerCase();
    if (!q) return null;
    const labelOf = this.nodeLabel();
    return (node) => labelOf(node).toLocaleLowerCase().includes(q);
  });
  private readonly activeFilter = computed<TreeFilter<T> | null>(() => {
    const base = this.baseFilter();
    const found = this.serverMatches();
    if (!base || found.size === 0) return base;
    const keyOf = this.nodeKey();
    return (node) => base(node) || found.has(keyOf(node));
  });
  protected readonly filtering = computed(() => this.activeFilter() !== null);

  private readonly ctrl = new TreeController<T>(
    {
      roots: () => this.nodes(),
      key: () => this.nodeKey(),
      children: () => this.nodeChildren(),
      hasChildren: () => this.hasChildren(),
      loadChildren: () => this.loadChildren(),
      expandedKeys: () => this.expandedKeys(),
      setExpandedKeys: (keys) => this.expandedKeys.set(keys),
      filter: () => this.activeFilter(),
      loaded: () => this.normalizeChecked(),
    },
    inject(DestroyRef),
  );
  protected readonly view = this.ctrl.view;

  private readonly checkAccess: TreeCheckAccess<T> = {
    key: (node) => this.nodeKey()(node),
    children: (node, key) => this.ctrl.childrenOf(node, key),
  };
  protected readonly checkStates = computed(() =>
    this.selection() === 'multiple'
      ? computeCheckStates(this.nodes(), this.checkAccess, new Set(this.checkedKeys()))
      : new Map<TreeKey, TreeCheckState>(),
  );

  /** 鍵盤焦點所在的節點（roving tabindex）；不在畫面上時退回目前項目或第一個節點。 */
  private readonly focusedKey = signal<TreeKey | null>(null);
  protected readonly tabKey = computed<TreeKey | null>(() => {
    const view = this.view();
    const focused = this.focusedKey();
    if (focused !== null && view.byKey.has(focused)) return focused;
    const current = this.selection() === 'single' ? this.currentKey() : null;
    if (current !== null && view.byKey.has(current)) return current;
    return view.flat[0]?.key ?? null;
  });
  protected readonly noResultsText = computed(() => formatTreeLabel(this.labels.noResults, { query: this.query() }));
  /** 目前節點的 DOM id：鍵盤接收器的 aria-activedescendant。 */
  protected readonly activeDomId = computed(() => {
    const key = this.tabKey();
    return key === null ? null : (this.view().byKey.get(key)?.domId ?? null);
  });
  protected readonly treeId = `lib-tree-${nextTreeId++}`;
  /** 搜尋結果下方的說明：伺服器端搜尋中／失敗，或「只搜尋已載入的項目」。 */
  protected readonly searchNote = computed<{ text: string; busy: boolean } | null>(() => {
    if (!this.filtering() || !this.query()) return null;
    const state = this.serverState();
    if (state === 'searching') return { text: this.labels.searching ?? '', busy: true };
    if (state === 'failed') return this.labels.searchFailed ? { text: this.labels.searchFailed, busy: false } : null;
    if (!this.serverSearch() && this.loadChildren() && this.labels.searchLoadedOnly) {
      return { text: this.labels.searchLoadedOnly, busy: false };
    }
    return null;
  });

  /** 全部展開進行中的進度（延遲載入的樹；沒在跑時是 null）。 */
  readonly expandAllProgress = this.ctrl.expandAllProgress;

  protected readonly sink = new TreeKeySink((query) => this.onTypeahead(query), inject(DestroyRef));
  private readonly sinkRef = viewChild<ElementRef<HTMLInputElement>>('sinkInput');
  private pendingFocus: TreeKey | null = null;

  constructor() {
    // 鍵盤移動到剛展開才畫出來的節點時，等畫面更新再聚焦；接收器跟著目前節點換位置（輸入法的選字窗出現在那一列旁邊）。
    afterRenderEffect(() => {
      this.view();
      this.activeDomId();
      untracked(() => {
        this.flushFocus();
        this.placeSink();
      });
    });
    // 伺服器端搜尋：搜尋字停手後呼叫，照回傳的路徑載入祖先。搜尋字換了就丟掉上一次的結果。
    effect((onCleanup) => {
      const query = this.query();
      const search = this.serverSearch();
      untracked(() => {
        this.serverMatches.set(NO_KEYS);
        this.serverState.set(query && search ? 'searching' : 'idle');
      });
      if (!query || !search) return;
      let live = true;
      let cancel: (() => void) | null = null;
      const timer = setTimeout(() => {
        let result: ReturnType<TreeServerSearch>;
        try {
          result = search(query);
        } catch {
          this.serverState.set('failed');
          return;
        }
        cancel = settleFirst(
          result,
          (matches) => void this.applyServerMatches(matches ?? [], () => live),
          () => live && this.serverState.set('failed'),
        );
      }, SERVER_SEARCH_DELAY_MS);
      onCleanup(() => {
        live = false;
        clearTimeout(timer);
        cancel?.();
      });
    });
  }

  /**
   * 全部展開。靜態的與已經載入過的節點立刻展開；延遲載入的樹另外一層一層載入還沒載入的節點
   * （預設同時 3 個請求、最多 50 個，見 `TreeExpandAllOptions`），完成時回傳載入了幾個、是否到了上限。
   */
  expandAll(options?: TreeExpandAllOptions): Promise<TreeExpandAllResult> {
    return this.ctrl.expandAll(options);
  }

  /** 停止進行中的全部展開（已送出的請求照樣完成並留著，但不再展開、不再送新的）。 */
  cancelExpandAll(): void {
    this.ctrl.cancelExpandAll();
  }

  collapseAll(): void {
    this.ctrl.cancelExpandAll();
    this.ctrl.collapseAll();
  }

  /** 讓某個節點拿到鍵盤焦點（例如搜尋後按 ↓ 從搜尋框跳進樹）。不在畫面上時聚焦第一個節點。 */
  focus(key: TreeKey | null = null): void {
    const target = key !== null && this.view().byKey.has(key) ? key : this.tabKey();
    if (target !== null) this.focusNode(target);
  }

  private async applyServerMatches(matches: readonly TreeSearchMatch[], live: () => boolean): Promise<void> {
    if (!live()) return;
    this.serverMatches.set(new Set(matches.map((m) => m.key)));
    await this.ctrl.revealPaths(
      matches.map((m) => [...m.ancestors, m.key]),
      live,
    );
    if (live()) this.serverState.set('idle');
  }

  protected context(vn: TreeViewNode<T>): TreeNodeContext<T> {
    return { $implicit: vn.node, level: vn.level, expanded: vn.expanded, query: this.query() };
  }

  protected labelOf(vn: TreeViewNode<T>): string {
    return this.nodeLabel()(vn.node);
  }

  protected checkState(vn: TreeViewNode<T>): TreeCheckState {
    return this.checkStates().get(vn.key) ?? 'unchecked';
  }

  protected ariaChecked(vn: TreeViewNode<T>): string | null {
    if (this.selection() !== 'multiple') return null;
    const state = this.checkState(vn);
    return state === 'mixed' ? 'mixed' : String(state === 'checked');
  }

  protected loadFailedText(vn: TreeViewNode<T>): string {
    return formatTreeLabel(this.labels.loadFailed, { name: this.labelOf(vn) });
  }

  // ---- 滑鼠 ----

  protected onRowClick(vn: TreeViewNode<T>): void {
    this.focusNode(vn.key);
    if (this.selection() === 'multiple') this.toggleCheck(vn);
    else this.activateNode(vn);
  }

  protected onToggleClick(event: MouseEvent, vn: TreeViewNode<T>): void {
    event.stopPropagation();
    this.focusNode(vn.key);
    if (!vn.expandable || vn.forced) return;
    this.ctrl.setExpanded(vn.key, !vn.expanded);
  }

  protected onCheckClick(event: MouseEvent, vn: TreeViewNode<T>): void {
    // 原生勾選框不自己切換：狀態一律由 checkedKeys 算出來（含半勾）。
    event.preventDefault();
    event.stopPropagation();
    this.focusNode(vn.key);
    this.toggleCheck(vn);
  }

  protected onRetry(event: MouseEvent, vn: TreeViewNode<T>): void {
    event.stopPropagation();
    this.focusNode(vn.key);
    this.ctrl.retry(vn.key);
  }

  /** 節點本身拿到焦點（報讀器的「移到這個項目」、點擊）：焦點交回鍵盤接收器，這個節點成為目前節點。 */
  protected onFocusIn(event: FocusEvent): void {
    const vn = this.nodeFromEvent(event);
    if (vn && event.target === this.host.nativeElement.ownerDocument.getElementById(vn.domId)) this.focusNode(vn.key);
  }

  // ---- 鍵盤（都在鍵盤接收器上）----

  protected onKeydown(event: KeyboardEvent): void {
    // 輸入法正在組字或選字：方向鍵、Enter 是給輸入法的。
    if (TreeKeySink.isImeKey(event)) return;
    const vn = this.activeNode();
    if (!vn || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key !== 'Tab' && event.key !== 'Shift') this.sink.keyboard();
    const target = this.ctrl.navigate(vn, event.key);
    if (target !== undefined) {
      event.preventDefault();
      if (target) this.focusNode(target.key);
      return;
    }
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        this.activateNode(vn);
        return;
      case ' ':
        event.preventDefault();
        if (this.selection() === 'multiple') this.toggleCheck(vn);
        else if (this.selection() === 'single') this.activateNode(vn);
        return;
    }
    if (TreeKeySink.isPrintable(event)) {
      event.preventDefault();
      this.sink.type(event.key);
    }
  }

  /** 預輸入（英數或輸入法確定的字）：跳到名稱開頭相符的節點。 */
  private onTypeahead(query: string): void {
    const hit = findTypeahead(this.view().flat, this.activeNode(), query, this.nodeLabel());
    if (hit) this.focusNode(hit.key);
  }

  private activeNode(): TreeViewNode<T> | null {
    const key = this.tabKey();
    return key === null ? null : (this.view().byKey.get(key) ?? null);
  }

  // ---- 共用 ----

  private activateNode(vn: TreeViewNode<T>): void {
    if (this.selection() === 'single') this.currentKey.set(vn.key);
    this.activate.emit(vn.node);
  }

  private toggleCheck(vn: TreeViewNode<T>): void {
    if (this.selection() !== 'multiple') return;
    this.checkedKeys.set(toggleCheckedKeys(this.nodes(), this.checkAccess, new Set(this.checkedKeys()), vn.key));
  }

  /** 延遲載入完成：已勾的節點載入了子節點，把它們也列進 checkedKeys（正規化）。 */
  private normalizeChecked(): void {
    if (this.selection() !== 'multiple' || this.checkedKeys().length === 0) return;
    const next = checkedKeysInOrder(this.nodes(), this.checkAccess, this.checkStates());
    const current = this.checkedKeys();
    if (next.length !== current.length || next.some((k, i) => k !== current[i])) this.checkedKeys.set(next);
  }

  private nodeFromEvent(event: Event): TreeViewNode<T> | null {
    const item = (event.target as HTMLElement | null)?.closest<HTMLElement>('[role="treeitem"]');
    if (!item || !this.host.nativeElement.contains(item)) return null;
    return this.view().flat.find((vn) => vn.domId === item.id) ?? null;
  }

  private focusNode(key: TreeKey): void {
    this.focusedKey.set(key);
    this.pendingFocus = key;
    this.flushFocus();
  }

  /** 焦點放到鍵盤接收器（aria-activedescendant 指向目前節點），並把目前節點捲進畫面。 */
  private flushFocus(): void {
    const key = this.pendingFocus;
    if (key === null) return;
    const vn = this.view().byKey.get(key);
    const sink = this.sinkRef()?.nativeElement;
    if (!vn || !sink) return;
    const el = this.host.nativeElement.ownerDocument.getElementById(vn.domId);
    // aria-activedescendant 要等畫面更新才換成這個節點：還沒換就下一輪再來。
    if (!el || sink.getAttribute('aria-activedescendant') !== vn.domId) return;
    this.pendingFocus = null;
    if (sink.ownerDocument.activeElement !== sink) sink.focus({ preventScroll: true });
    el.querySelector<HTMLElement>(':scope > .tr-row')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  /** 接收器放在目前節點那一列的高度：組字時的小框與輸入法的選字窗出現在那一列旁邊。 */
  private placeSink(): void {
    const sink = this.sinkRef()?.nativeElement;
    const id = this.activeDomId();
    const row = id ? this.host.nativeElement.ownerDocument.getElementById(id)?.querySelector<HTMLElement>(':scope > .tr-row') : null;
    if (!sink || !row) return;
    const top = row.getBoundingClientRect().top - this.host.nativeElement.getBoundingClientRect().top;
    sink.style.top = `${Math.round(top)}px`;
    sink.style.height = `${row.offsetHeight}px`;
  }
}
