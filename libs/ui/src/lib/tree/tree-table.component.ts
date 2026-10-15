import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  TemplateRef,
  afterRenderEffect,
  computed,
  contentChildren,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DataTableCellContext, DataTableCellDirective } from '../data-table/data-table-cell.directive';
import type { DataTableCellValue } from '../data-table/data-table.types';
import { TREE_LABELS, assertTreeLabels, formatTreeLabel } from './tree-labels';
import { TreeController, TreeViewNode, defaultTreeChildren, findTypeahead } from './tree-model';
import { TreeKeySink } from './tree-key-sink';
import type { TreeExpandAllOptions, TreeExpandAllResult, TreeKey, TreeLoadChildren, TreeTableColumn } from './tree.types';

let nextTreeTableId = 0;

/**
 * 樹狀表（WAI-ARIA Treegrid，列模式）：每一列是一個節點，第一欄帶縮排與展開鈕，其餘欄位像資料表一樣對齊。
 *
 * - 欄位：`[columns]` 寫法沿用 data-table（key 綁資料列的屬性；`<ng-template dtCell="key" let-row>` 自訂儲存格）。
 * - 展開、延遲載入、`[(expandedKeys)]`、`expandAll()`／`collapseAll()` 的規則與 lib-tree 相同；載入失敗時在那一列下面多一列錯誤與「重試」。
 * - 全部展開：延遲載入的列一層一層載入（同時最多 3 個請求、總共最多 50 個，`expandAll({ maxLoads, concurrency })` 可改），
 *   規則同 lib-tree 的 `expandAll()`；`expandAllProgress()` 是進度，`cancelExpandAll()` 停止。
 * - 鍵盤（列模式）：↑↓ 換列、→ 展開或到第一個子列、← 收合或回到父列、Home／End、Enter 送出 `(activate)`、`*` 展開同一層、
 *   打字跳到第一欄文字開頭相符的列（英數與輸入法都可以，同 lib-tree）。
 *   鍵盤焦點實際在一個看不見的輸入框上（整張表唯一的 tab stop），`aria-activedescendant` 指向目前的列；
 *   儲存格範本裡不要放按鈕等互動元件（它們會多出 tab stop）。
 * - 外觀：表格本身掛 data-table 的 `.dt-table`，各質地設的 `--dt-*` 變數（外框、列線、表頭底色、字級、列高）直接適用。
 *   窄螢幕橫向捲動，第一欄固定在左側。
 * - 不支援：排序、分頁、固定欄設定、欄位選擇、勾選、表格內編輯、手機卡片版（要這些用 lib-data-table）。
 */
@Component({
  selector: 'lib-tree-table',
  imports: [NgTemplateOutlet],
  templateUrl: './tree-table.component.html',
  styleUrl: './tree-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lib-tree-table', '[class.tt--focus-visible]': 'sink.focusVisible()' },
})
export class TreeTableComponent<T> {
  /** 第一層的資料列。 */
  readonly rows = input.required<readonly T[]>();
  readonly columns = input.required<readonly TreeTableColumn<T>[]>();
  /** 資料列的唯一鍵。 */
  readonly rowKey = input.required<(row: T) => TreeKey>();
  /** 子資料列（預設讀 `children` 屬性）；回 null／undefined 表示還不知道（交給 loadChildren）。 */
  readonly rowChildren = input<(row: T) => readonly T[] | null | undefined>(defaultTreeChildren);
  /** 子資料列還不知道時，這一列有沒有子列（決定要不要畫展開鈕）。 */
  readonly hasChildren = input<((row: T) => boolean) | null>(null);
  readonly loadChildren = input<TreeLoadChildren<T> | null>(null);
  /** 表格的無障礙名稱，例：「專案進度」。 */
  readonly label = input('');
  /** 第一欄最小寬度（窄螢幕時固定在左側的那一欄）。 */
  readonly firstColumnMinWidth = input('14rem');

  /** 展開中的列（雙向綁定＝受控；不綁定＝元件自己記）。 */
  readonly expandedKeys = model<readonly TreeKey[]>([]);
  /** 點擊或 Enter 啟用了一列。 */
  readonly activate = output<T>();

  protected readonly labels = assertTreeLabels(inject(TREE_LABELS, { optional: true }), 'TreeTable');
  private readonly cellDefs = contentChildren(DataTableCellDirective);
  protected readonly cellTemplates = computed(() => {
    const map = new Map<string, TemplateRef<DataTableCellContext<T>>>();
    for (const def of this.cellDefs()) map.set(def.dtCell(), def.template as TemplateRef<DataTableCellContext<T>>);
    return map;
  });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly ctrl = new TreeController<T>(
    {
      roots: () => this.rows(),
      key: () => this.rowKey(),
      children: () => this.rowChildren(),
      hasChildren: () => this.hasChildren(),
      loadChildren: () => this.loadChildren(),
      expandedKeys: () => this.expandedKeys(),
      setExpandedKeys: (keys) => this.expandedKeys.set(keys),
    },
    inject(DestroyRef),
  );
  protected readonly view = this.ctrl.view;

  private readonly focusedKey = signal<TreeKey | null>(null);
  protected readonly tabKey = computed<TreeKey | null>(() => {
    const view = this.view();
    const focused = this.focusedKey();
    if (focused !== null && view.byKey.has(focused)) return focused;
    return view.flat[0]?.key ?? null;
  });
  /** 橫向捲過：固定的第一欄才畫底色與右緣分界（同 data-table）。 */
  protected readonly scrolledX = signal(false);
  protected readonly activeDomId = computed(() => {
    const key = this.tabKey();
    return key === null ? null : (this.view().byKey.get(key)?.domId ?? null);
  });
  protected readonly tableId = `lib-tree-table-${nextTreeTableId++}`;
  /** 全部展開進行中的進度（延遲載入的列；沒在跑時是 null）。 */
  readonly expandAllProgress = this.ctrl.expandAllProgress;
  protected readonly sink = new TreeKeySink((query) => this.onTypeahead(query), inject(DestroyRef));
  private readonly sinkRef = viewChild<ElementRef<HTMLInputElement>>('sinkInput');
  private pendingFocus: TreeKey | null = null;

  constructor() {
    afterRenderEffect(() => {
      this.view();
      this.activeDomId();
      untracked(() => {
        this.flushFocus();
        this.placeSink();
      });
    });
  }

  /** 全部展開；延遲載入的列一層一層載入（見 `TreeExpandAllOptions`）。 */
  expandAll(options?: TreeExpandAllOptions): Promise<TreeExpandAllResult> {
    return this.ctrl.expandAll(options);
  }

  cancelExpandAll(): void {
    this.ctrl.cancelExpandAll();
  }

  collapseAll(): void {
    this.ctrl.cancelExpandAll();
    this.ctrl.collapseAll();
  }

  protected cellText(col: TreeTableColumn<T>, row: T): DataTableCellValue {
    if (col.value) return col.value(row);
    if (col.virtual) return '';
    return row[col.key] as DataTableCellValue;
  }

  protected loadFailedText(vn: TreeViewNode<T>): string {
    const first = this.columns()[0];
    const name = first ? String(this.cellText(first, vn.node) ?? '') : '';
    return formatTreeLabel(this.labels.loadFailed, { name });
  }

  protected onScroll(event: Event): void {
    this.scrolledX.set((event.target as HTMLElement).scrollLeft > 0);
  }

  protected onRowClick(vn: TreeViewNode<T>): void {
    this.focusRow(vn.key);
    this.activate.emit(vn.node);
  }

  protected onToggleClick(event: MouseEvent, vn: TreeViewNode<T>): void {
    event.stopPropagation();
    this.focusRow(vn.key);
    if (vn.expandable) this.ctrl.setExpanded(vn.key, !vn.expanded);
  }

  protected onRetry(event: MouseEvent, vn: TreeViewNode<T>): void {
    event.stopPropagation();
    this.focusRow(vn.key);
    this.ctrl.retry(vn.key);
  }

  /** 列本身拿到焦點（點擊、報讀器移到這一列）：焦點交回鍵盤接收器，這一列成為目前的列。 */
  protected onFocusIn(event: FocusEvent): void {
    const vn = this.rowFromEvent(event);
    if (vn && event.target === this.host.nativeElement.ownerDocument.getElementById(vn.domId)) this.focusRow(vn.key);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (TreeKeySink.isImeKey(event)) return; // 組字、選字的鍵留給輸入法
    const key = this.tabKey();
    const vn = key === null ? null : (this.view().byKey.get(key) ?? null);
    if (!vn || event.altKey || event.metaKey) return;
    if (event.key !== 'Tab' && event.key !== 'Shift') this.sink.keyboard();
    // Ctrl＋Home／End：第一列／最後一列（grid 的慣例），跟 Home／End 一樣。
    if (event.ctrlKey && event.key !== 'Home' && event.key !== 'End') return;
    const target = this.ctrl.navigate(vn, event.key);
    if (target !== undefined) {
      event.preventDefault();
      if (target) this.focusRow(target.key);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      this.activate.emit(vn.node);
      return;
    }
    if (!event.ctrlKey && TreeKeySink.isPrintable(event)) {
      event.preventDefault();
      this.sink.type(event.key);
    }
  }

  /** 第一欄的文字（預輸入比對用）。 */
  private firstText(row: T): string {
    const first = this.columns()[0];
    return first ? String(this.cellText(first, row) ?? '') : '';
  }

  private onTypeahead(query: string): void {
    const key = this.tabKey();
    const from = key === null ? null : (this.view().byKey.get(key) ?? null);
    const hit = findTypeahead(this.view().flat, from, query, (row) => this.firstText(row));
    if (hit) this.focusRow(hit.key);
  }

  private rowFromEvent(event: Event): TreeViewNode<T> | null {
    const row = (event.target as HTMLElement | null)?.closest<HTMLElement>('tr[data-tree-row]');
    if (!row || !this.host.nativeElement.contains(row)) return null;
    return this.view().flat.find((vn) => vn.domId === row.id) ?? null;
  }

  private focusRow(key: TreeKey): void {
    this.focusedKey.set(key);
    this.pendingFocus = key;
    this.flushFocus();
  }

  /** 焦點放到鍵盤接收器（aria-activedescendant 指向目前的列），並把那一列捲進畫面。 */
  private flushFocus(): void {
    const key = this.pendingFocus;
    if (key === null) return;
    const vn = this.view().byKey.get(key);
    const sink = this.sinkRef()?.nativeElement;
    if (!vn || !sink) return;
    const el = this.host.nativeElement.ownerDocument.getElementById(vn.domId);
    if (!el || sink.getAttribute('aria-activedescendant') !== vn.domId) return;
    this.pendingFocus = null;
    if (sink.ownerDocument.activeElement !== sink) sink.focus({ preventScroll: true });
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  /** 接收器放在目前那一列的高度（組字的小框與輸入法的選字窗出現在那一列旁邊）。 */
  private placeSink(): void {
    const sink = this.sinkRef()?.nativeElement;
    const id = this.activeDomId();
    const row = id ? this.host.nativeElement.ownerDocument.getElementById(id) : null;
    if (!sink || !row) return;
    const top = row.getBoundingClientRect().top - this.host.nativeElement.getBoundingClientRect().top;
    sink.style.top = `${Math.round(top)}px`;
    sink.style.height = `${row.offsetHeight}px`;
  }
}
