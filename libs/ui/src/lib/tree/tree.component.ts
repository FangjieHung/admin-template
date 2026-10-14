import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  contentChild,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TREE_LABELS, assertTreeLabels, formatTreeLabel } from './tree-labels';
import { TreeController, TreeViewNode, defaultTreeChildren, findTypeahead } from './tree-model';
import { TreeCheckAccess, checkedKeysInOrder, computeCheckStates, toggleCheckedKeys } from './tree-check';
import { TreeNodeContext, TreeNodeDirective } from './tree-node.directive';
import { TreeHighlightComponent } from './tree-highlight.component';
import type { TreeCheckState, TreeFilter, TreeKey, TreeLoadChildren, TreeSelectionMode } from './tree.types';

/** 預輸入的字串在停手多久之後清空。 */
const TYPEAHEAD_RESET_MS = 500;

/**
 * 樹狀選單（WAI-ARIA Tree View）：分類、組織架構這類有上下層的清單。
 *
 * - 資料：`[nodes]` 是第一層；子節點由 `[nodeChildren]` 取得（預設讀 `children` 屬性）。節點內容由
 *   `<ng-template libTreeNode let-node>` 提供，不給就顯示 `[nodeLabel]` 的文字。
 * - 展開：`[(expandedKeys)]` 雙向綁定（受控）；不綁定時元件自己記（非受控）。`expandAll()`／`collapseAll()` 一次展開或收合。
 * - 延遲載入：`[loadChildren]` 回 Promise 或 Observable。第一次展開時載入、顯示轉圈；失敗時節點下方顯示錯誤與「重試」
 *  （也可以按 →）。收合再展開不會重新載入成功過的節點；失敗的節點收合後再展開會重新載入。
 *   沒有 `children` 的節點，`[hasChildren]` 可以先說「有沒有子節點」（不給就假設可能有）。
 * - 選取：`selection` 為 `single` 時是「目前項目」（`[(currentKey)]`，並送出 `(activate)`）；`multiple` 時是三態勾選
 *  （`[(checkedKeys)]`），規則見 `toggleCheckedKeys`：勾父節點連帶勾所有已知子孫；子孫全勾時父節點自動全勾；
 *   還沒載入的延遲節點算一個獨立的葉節點，勾了它，之後載入的子節點也全部算勾。`checkedKeys` 一律列出所有全勾的已知節點（含父節點）。
 * - 搜尋：`filterText`（比對 `nodeLabel`，不分大小寫）或 `[filter]` 謂詞。符合的節點與它們的祖先保留，祖先自動展開
 *  （搜尋中不能收合），比對到的字用 `<mark>` 標出；只搜尋已知的節點（還沒載入的延遲節點不會為了搜尋而載入）。沒有結果時顯示 `noResults`。
 * - 鍵盤：↑↓ 移動、→ 展開或進入第一個子節點、← 收合或回到父節點、Home／End、打字跳到開頭相符的節點（單一按鍵字元；
 *   輸入法組字時 keydown 是 `Process`，中文名稱沒辦法這樣跳）、
 *   Space 勾選（single 時選為目前項目）、Enter 送出 activate、`*` 展開同一層。整棵樹只有一個 tab stop（roving tabindex）。
 */
@Component({
  selector: 'lib-tree',
  imports: [NgTemplateOutlet, TreeHighlightComponent],
  templateUrl: './tree.component.html',
  styleUrl: './tree.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lib-tree' },
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
  private readonly activeFilter = computed<TreeFilter<T> | null>(() => {
    const custom = this.filter();
    if (custom) return custom;
    const q = this.query().toLocaleLowerCase();
    if (!q) return null;
    const labelOf = this.nodeLabel();
    return (node) => labelOf(node).toLocaleLowerCase().includes(q);
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

  private pendingFocus: TreeKey | null = null;
  private typeahead = '';
  private typeaheadTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // 鍵盤移動到剛展開才畫出來的節點時，等畫面更新再聚焦。
    afterRenderEffect(() => {
      this.view();
      untracked(() => this.flushFocus());
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.typeaheadTimer) clearTimeout(this.typeaheadTimer);
    });
  }

  /** 展開所有子節點已知的節點（還沒載入的延遲節點不會因此去載入）。 */
  expandAll(): void {
    this.ctrl.expandAll();
  }

  collapseAll(): void {
    this.ctrl.collapseAll();
  }

  /** 讓某個節點拿到鍵盤焦點（例如搜尋後按 ↓ 從搜尋框跳進樹）。不在畫面上時聚焦第一個節點。 */
  focus(key: TreeKey | null = null): void {
    const target = key !== null && this.view().byKey.has(key) ? key : this.tabKey();
    if (target !== null) this.focusNode(target);
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

  protected onFocusIn(event: FocusEvent): void {
    const vn = this.nodeFromEvent(event);
    if (vn) this.focusedKey.set(vn.key);
  }

  // ---- 鍵盤 ----

  protected onKeydown(event: KeyboardEvent): void {
    const vn = this.nodeFromEvent(event);
    if (!vn || event.ctrlKey || event.metaKey || event.altKey) return;
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
    if (event.key.length === 1 && event.key.trim()) {
      event.preventDefault();
      this.onTypeahead(vn, event.key);
    }
  }

  private onTypeahead(from: TreeViewNode<T>, char: string): void {
    this.typeahead += char;
    if (this.typeaheadTimer) clearTimeout(this.typeaheadTimer);
    this.typeaheadTimer = setTimeout(() => {
      this.typeahead = '';
      this.typeaheadTimer = null;
    }, TYPEAHEAD_RESET_MS);
    const hit = findTypeahead(this.view().flat, from, this.typeahead, this.nodeLabel());
    if (hit) this.focusNode(hit.key);
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

  private flushFocus(): void {
    const key = this.pendingFocus;
    if (key === null) return;
    const vn = this.view().byKey.get(key);
    if (!vn) return;
    const el = this.host.nativeElement.ownerDocument.getElementById(vn.domId);
    if (!el) return;
    this.pendingFocus = null;
    if (el.ownerDocument.activeElement !== el) el.focus();
  }
}
