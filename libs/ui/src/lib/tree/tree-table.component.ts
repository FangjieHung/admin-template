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
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DataTableCellContext, DataTableCellDirective } from '../data-table/data-table-cell.directive';
import type { DataTableCellValue } from '../data-table/data-table.types';
import { TREE_LABELS, assertTreeLabels, formatTreeLabel } from './tree-labels';
import { TreeController, TreeViewNode, defaultTreeChildren } from './tree-model';
import type { TreeKey, TreeLoadChildren, TreeTableColumn } from './tree.types';

/**
 * 樹狀表（WAI-ARIA Treegrid，列模式）：每一列是一個節點，第一欄帶縮排與展開鈕，其餘欄位像資料表一樣對齊。
 *
 * - 欄位：`[columns]` 寫法沿用 data-table（key 綁資料列的屬性；`<ng-template dtCell="key" let-row>` 自訂儲存格）。
 * - 展開、延遲載入、`[(expandedKeys)]`、`expandAll()`／`collapseAll()` 的規則與 lib-tree 相同；載入失敗時在那一列下面多一列錯誤與「重試」。
 * - 鍵盤（列模式）：↑↓ 換列、→ 展開或到第一個子列、← 收合或回到父列、Home／End、Enter 送出 `(activate)`、`*` 展開同一層。
 *   整張表只有一個 tab stop（roving tabindex）；儲存格範本裡不要放按鈕等互動元件（它們會多出 tab stop）。
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
  host: { class: 'lib-tree-table' },
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
  private pendingFocus: TreeKey | null = null;

  constructor() {
    afterRenderEffect(() => {
      this.view();
      untracked(() => this.flushFocus());
    });
  }

  expandAll(): void {
    this.ctrl.expandAll();
  }

  collapseAll(): void {
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

  protected onFocusIn(event: FocusEvent): void {
    const vn = this.rowFromEvent(event);
    if (vn) this.focusedKey.set(vn.key);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const vn = this.rowFromEvent(event);
    if (!vn || event.altKey || event.metaKey) return;
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
    }
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
