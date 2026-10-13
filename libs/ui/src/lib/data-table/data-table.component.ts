import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  TemplateRef,
  afterRenderEffect,
  computed,
  contentChild,
  contentChildren,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DataTableCellContext, DataTableCellDirective } from './data-table-cell.directive';
import { DataTableColumnChooserComponent } from './data-table-column-chooser.component';
import { DataTablePagerComponent } from './data-table-pager.component';
import { exportRows, exportTableElement } from './data-table-export';
import {
  cellValue,
  clampPage,
  frozenColumnKey,
  isSortableColumn,
  nextSort,
  normalizeColumnPrefs,
  orderColumns,
  pageSlice,
  sortRows,
} from './data-table-query';
import {
  DataTableBatchActionsDirective,
  DataTableBodyDirective,
  DataTableHeadDirective,
} from './data-table-slot.directives';
import {
  DataTableColumn,
  DataTableColumnChooserLabels,
  DataTableColumnPrefs,
  DataTableLabels,
  DataTableMobileMode,
  DataTablePagingLabels,
  DataTableSort,
} from './data-table.types';

type ResolvedColumn<T> = DataTableColumn<T> & { primary: boolean };

/** 與 scss 的手機斷點一致：卡片版改用「載入更多」，不顯示分頁鈕。 */
const COMPACT_QUERY = '(max-width: 640px)';

@Component({
  selector: 'lib-data-table',
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatTooltipModule,
    DataTableColumnChooserComponent,
    DataTablePagerComponent,
  ],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent<T> {
  readonly columns = input<readonly DataTableColumn<T>[]>([]);
  readonly rows = input<readonly T[]>([]);
  // 下方拋出的字串是刻意保留的 developer diagnostics（開發期設定錯誤，不是使用者可見文案）：
  // 呼叫端忘記傳 [rowId] 或 dtHead/dtBody 沒有成對提供，此時應直接在開發環境炸出明確訊息，
  // 而不是靜默降級。這與「libs/ui 不得內建使用者可見字串」的約束不衝突，請勿把它們也搬進 labels。
  readonly rowId = input<(row: T) => unknown>((row) => {
    const id = (row as { id?: unknown }).id;
    if (id === undefined) {
      throw new Error('DataTable：資料列沒有 id 欄位，請傳入 [rowId] 指定識別欄位');
    }
    return id;
  });
  readonly mobile = input<DataTableMobileMode | null>(null);
  readonly exportName = input('export');
  readonly showExport = input(true);
  readonly emptyText = input('');
  readonly labels = input.required<DataTableLabels>();
  readonly selectable = input(false);
  /** 有些清單可批次選取／匯出，但不應提供通用的破壞性刪除操作。 */
  readonly showBatchDelete = input(true);
  readonly selection = input<readonly T[]>([]);
  readonly rowClickable = input(false);
  readonly rowClass = input<(row: T) => string>(() => '');

  // ---- 進階功能（全部預設關閉：沒開的清單畫面與行為與以前完全相同）----

  /** 分頁：桌機底部分頁列；手機卡片版改成「載入更多」。 */
  readonly pageable = input(false);
  readonly pageSizeOptions = input<readonly number[]>([25, 50, 100]);
  readonly pageSize = model(25);
  /** 目前頁碼（從 0 起算）。資料變少時元件會自動夾在最後一頁。 */
  readonly page = model(0);
  /** 點欄位標題排序：遞增 → 遞減 → 不排序，單欄。 */
  readonly sortable = input(false);
  readonly sort = model<DataTableSort | null>(null);
  /** 欄位選擇面板：顯示／隱藏、拖曳或上下移調整順序、恢復預設。 */
  readonly columnChooser = input(false);
  /** null＝預設欄位。使用者排回預設時也會回到 null。 */
  readonly columnPrefs = model<DataTableColumnPrefs | null>(null);

  readonly selectionChange = output<readonly T[]>();
  readonly batchDelete = output<readonly T[]>();
  readonly rowClick = output<T>();

  private readonly cellDirectives = contentChildren(DataTableCellDirective<T>);
  protected readonly headDirective = contentChild(DataTableHeadDirective);
  protected readonly bodyDirective = contentChild(DataTableBodyDirective);
  protected readonly batchActionsDirective = contentChild(DataTableBatchActionsDirective<T>);

  private readonly selectedIds = signal<ReadonlySet<unknown>>(new Set());

  protected readonly selectedRows = computed<readonly T[]>(() => {
    const ids = this.selectedIds();
    return this.processedRows().filter((row) => ids.has(this.rowId()(row)));
  });

  protected readonly selectedCount = computed(() => this.selectedRows().length);

  protected readonly allSelected = computed(() => {
    const rows = this.rows();
    return rows.length > 0 && this.selectedCount() === rows.length;
  });

  protected readonly partiallySelected = computed(() => {
    const count = this.selectedCount();
    return count > 0 && count < this.rows().length;
  });

  /** 手機斷點（matchMedia）；測試環境沒有 matchMedia 時視為桌機。 */
  protected readonly isCompact = signal(false);

  constructor() {
    effect(() => {
      const externalSelection = this.selection();
      const rows = untracked(() => this.rows());
      const rowIds = new Set(rows.map((row) => this.rowId()(row)));
      const nextIds = new Set(
        externalSelection
          .map((row) => this.rowId()(row))
          .filter((id) => rowIds.has(id)),
      );

      this.selectedIds.set(nextIds);
      const cleanedSelection = rows.filter((row) => nextIds.has(this.rowId()(row)));
      if (cleanedSelection.length !== externalSelection.length) {
        this.selectionChange.emit(cleanedSelection);
      }
    });

    effect(() => {
      const rows = this.rows();
      const previousIds = untracked(() => this.selectedIds());
      const rowIds = new Set(rows.map((row) => this.rowId()(row)));
      const nextIds = new Set([...previousIds].filter((id) => rowIds.has(id)));

      if (nextIds.size !== previousIds.size) {
        this.selectedIds.set(nextIds);
        this.selectionChange.emit(rows.filter((row) => nextIds.has(this.rowId()(row))));
      }
    });

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mql = window.matchMedia(COMPACT_QUERY);
      this.isCompact.set(mql.matches);
      const onChange = (e: MediaQueryListEvent) => this.isCompact.set(e.matches);
      mql.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => mql.removeEventListener('change', onChange));
    }

    // 固定欄前面若有勾選欄，固定欄的 left 要等於勾選欄的實際寬度（勾選欄寬度由內容撐出，量了才準）。
    afterRenderEffect({
      earlyRead: () => {
        if (!this.frozenActive() || !this.selectable()) return 0;
        this.displayRows();
        const th = this.tableEl()?.nativeElement.querySelector('thead .dt-selection-head');
        return th ? th.getBoundingClientRect().width : 0;
      },
      write: (width) => {
        this.tableEl()?.nativeElement.style.setProperty('--dt-frozen-offset', `${width()}px`);
      },
    });
  }

  /** dtHead 存在即進入逃生門模式：不讀 columns、不注入 data-label、不生卡片。 */
  protected readonly isCustom = computed(() => {
    const hasHead = this.headDirective() != null;
    const hasBody = this.bodyDirective() != null;
    if (hasHead !== hasBody) {
      throw new Error('DataTable：逃生門模式需同時提供 dtHead 與 dtBody');
    }
    return hasHead;
  });

  protected readonly mobileMode = computed<DataTableMobileMode>(
    () => this.mobile() ?? (this.isCustom() ? 'scroll' : 'cards'),
  );

  protected readonly cellTemplates = computed(() => {
    const map = new Map<string, TemplateRef<DataTableCellContext<T>>>();
    for (const directive of this.cellDirectives()) {
      map.set(directive.dtCell(), directive.template);
    }
    return map;
  });

  /** 所有欄位依偏好排好（含隱藏的），欄位選擇面板用。 */
  protected readonly orderedColumns = computed(() =>
    orderColumns(this.columns(), this.columnChooser() ? this.columnPrefs() : null),
  );

  /** 沒有任何欄位標 primary 時，第一個顯示的欄位自動視為 primary，避免手機卡片整張空白。 */
  protected readonly resolvedColumns = computed<ResolvedColumn<T>[]>(() => {
    const visible = this.orderedColumns()
      .filter((c) => !c.hidden)
      .map((c) => c.column);
    const hasPrimary = visible.some((c) => c.primary);
    return visible.map((col, i) => ({ ...col, primary: hasPrimary ? !!col.primary : i === 0 }));
  });

  protected readonly frozenKey = computed(() => frozenColumnKey(this.columns()));

  /** 固定欄存在且正在顯示。 */
  protected readonly frozenActive = computed(() => {
    const key = this.frozenKey();
    return key !== null && this.resolvedColumns().some((c) => c.key === key);
  });

  /** 篩選後（由使用端給的 rows）再排序的完整資料：匯出與分頁都從這裡取，匯出永遠是全部，不是這一頁。 */
  protected readonly processedRows = computed<readonly T[]>(() =>
    this.sortable() ? sortRows(this.rows(), this.columns(), this.sort()) : this.rows(),
  );

  protected readonly total = computed(() => this.processedRows().length);

  protected readonly currentPage = computed(() => clampPage(this.page(), this.total(), this.pageSize()));

  /** 卡片版用「載入更多」：已載入幾頁。排序、每頁筆數或資料換了就回到第一頁。 */
  private readonly loadedPages = linkedSignal({
    source: () => [this.sort(), this.pageSize(), this.rows()] as const,
    computation: () => 1,
  });

  protected readonly loadMoreMode = computed(
    () => this.pageable() && this.isCompact() && this.mobileMode() === 'cards',
  );

  /** 實際渲染的資料列。 */
  protected readonly displayRows = computed<readonly T[]>(() => {
    const rows = this.processedRows();
    if (!this.pageable()) return rows;
    const size = this.pageSize();
    if (this.loadMoreMode()) return rows.slice(0, this.loadedPages() * size);
    return pageSlice(rows, this.currentPage(), size);
  });

  protected readonly pagingLabels = computed<DataTablePagingLabels>(() => {
    const paging = this.labels().paging;
    if (this.pageable() && !paging) {
      throw new Error('DataTable：開啟 [pageable] 時 labels.paging 為必填');
    }
    return paging as DataTablePagingLabels;
  });

  protected readonly chooserLabels = computed(() => {
    const chooser = this.labels().columnChooser;
    if (this.columnChooser() && !chooser) {
      throw new Error('DataTable：開啟 [columnChooser] 時 labels.columnChooser 為必填');
    }
    return chooser as DataTableColumnChooserLabels;
  });

  protected readonly isEmpty = computed(() => !this.isCustom() && this.rows().length === 0);

  protected cellContext(row: T): DataTableCellContext<T> {
    return { $implicit: row };
  }

  protected readonly hasSecondary = computed(() =>
    this.resolvedColumns().some((col) => !col.primary),
  );

  private readonly expandedIds = signal<ReadonlySet<unknown>>(new Set());

  /** 表格橫向捲過時才畫固定欄的底色與分界（沒捲時跟其他欄一樣透明，畫面與以前一致）。 */
  protected readonly scrolledX = signal(false);

  protected onWrapScroll(event: Event): void {
    const scrolled = (event.target as HTMLElement).scrollLeft > 0;
    if (scrolled !== this.scrolledX()) this.scrolledX.set(scrolled);
  }

  protected isExpanded(row: T): boolean {
    return this.expandedIds().has(this.rowId()(row));
  }

  protected isSelected(row: T): boolean {
    return this.selectedIds().has(this.rowId()(row));
  }

  protected rowSelectionLabel(row: T): string {
    const firstColumn = this.resolvedColumns()[0];
    const visibleValue = firstColumn ? this.valueOf(row, firstColumn) : '';
    const rowIdentifier = String(this.rowId()(row));
    const parts = [this.labels().selectRow];
    if (visibleValue) parts.push(visibleValue);
    parts.push(rowIdentifier);
    return parts.join(' - ');
  }

  protected toggle(row: T): void {
    const id = this.rowId()(row);
    const next = new Set(this.expandedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expandedIds.set(next);
  }

  protected toggleRowSelection(row: T): void {
    const id = this.rowId()(row);
    const next = new Set(this.selectedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedIds.set(next);
    this.selectionChange.emit(this.rows().filter((current) => next.has(this.rowId()(current))));
  }

  protected onRowClick(row: T): void {
    if (!this.rowClickable()) return;
    this.rowClick.emit(row);
  }

  /**
   * 只處理「焦點在整列本身」時的 Enter／Space。列內的按鈕、選取 checkbox 也會把 keydown 冒泡上來——
   * 若一併當成整列點擊，既會多開一次詳情，preventDefault 還會吃掉按鈕自己的鍵盤觸發（Enter 按不動列內按鈕）。
   */
  protected onRowKeydown(row: T, event: Event): void {
    if (!this.rowClickable() || event.target !== event.currentTarget) return;
    event.preventDefault();
    this.rowClick.emit(row);
  }

  protected toggleAllSelection(): void {
    const rows = this.rows();
    const next = this.allSelected()
      ? new Set<unknown>()
      : new Set(rows.map((row) => this.rowId()(row)));
    this.selectedIds.set(next);
    this.selectionChange.emit(rows.filter((row) => next.has(this.rowId()(row))));
  }

  protected deleteSelected(): void {
    this.batchDelete.emit(this.selectedRows());
  }

  protected valueOf(row: T, col: DataTableColumn<T>): string {
    const value = cellValue(col, row);
    return value === null || value === undefined ? '' : String(value);
  }

  // ---- 排序 ----

  protected isColumnSortable(col: DataTableColumn<T>): boolean {
    return this.sortable() && isSortableColumn(col);
  }

  protected ariaSort(col: DataTableColumn<T>): 'ascending' | 'descending' | 'none' | null {
    if (!this.isColumnSortable(col)) return null;
    const sort = this.sort();
    if (!sort || sort.key !== col.key) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  protected toggleSort(col: DataTableColumn<T>): void {
    if (!this.isColumnSortable(col)) return;
    this.sort.set(nextSort(this.sort(), col.key));
    this.page.set(0);
  }

  // ---- 分頁 ----

  protected goToPage(page: number): void {
    this.page.set(clampPage(page, this.total(), this.pageSize()));
  }

  protected onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.page.set(0);
  }

  protected loadMore(): void {
    this.loadedPages.update((n) => n + 1);
  }

  // ---- 欄位 ----

  protected onColumnPrefsChange(prefs: DataTableColumnPrefs | null): void {
    this.columnPrefs.set(normalizeColumnPrefs(this.columns(), prefs));
  }

  /** 匯出失敗（多半是 xlsx 動態載入失敗）時通知使用端顯示 snackbar。 */
  readonly exportFailed = output<Error>();

  private readonly tableEl = viewChild<ElementRef<HTMLTableElement>>('tableEl');

  protected readonly canExport = computed(() => this.showExport() && !this.isEmpty());

  /** 匯出目前顯示的欄位（順序同畫面）與篩選＋排序後的「全部」資料列——不是只有這一頁。 */
  protected async runExport(): Promise<void> {
    try {
      if (this.isCustom()) {
        const el = this.tableEl()?.nativeElement;
        if (!el) {
          throw new Error('DataTable：找不到 table 節點，無法匯出');
        }
        await exportTableElement(el, this.exportName());
      } else {
        await exportRows(this.resolvedColumns(), this.processedRows(), this.exportName());
      }
    } catch (e) {
      this.exportFailed.emit(e as Error);
    }
  }

  protected async runSelectedExport(): Promise<void> {
    try {
      await exportRows(this.resolvedColumns(), this.selectedRows(), `${this.exportName()}-selected`);
    } catch (e) {
      this.exportFailed.emit(e as Error);
    }
  }
}
