import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
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
import { EmptyStateComponent, EmptyStateKind } from '../feedback-state/empty-state.component';
import { exportRows, exportTableElement } from './data-table-export';
import { DataTableEditorHostDirective } from './data-table-editor-host.directive';
import { editorOf, hasEditableColumns, isCellEditable } from './data-table-editor-access';
import type { DataTableEditController, DataTableEditHost } from './data-table-edit.controller';
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
  DataTableEmptyDirective,
  DataTableHeadDirective,
} from './data-table-slot.directives';
import {
  DataTableBatchSaveFn,
  DataTableCellSaveFn,
  DataTableColumn,
  DataTableColumnChooserLabels,
  DataTableColumnPrefs,
  DataTableEditMode,
  DataTableEditingLabels,
  DataTableLabels,
  DataTableMobileMode,
  DataTablePagingLabels,
  DataTableSort,
} from './data-table.types';

type ResolvedColumn<T> = DataTableColumn<T> & { primary: boolean };

/** 與 scss 的手機斷點一致：卡片版改用「載入更多」，不顯示分頁鈕。 */
const COMPACT_QUERY = '(max-width: 640px)';
const SKELETON_WIDTHS = [72, 54, 86, 46, 64, 78, 58];

@Component({
  selector: 'lib-data-table',
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatTooltipModule,
    DataTableColumnChooserComponent,
    DataTablePagerComponent,
    DataTableEditorHostDirective,
    EmptyStateComponent,
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
  /** 沒有資料時的說明（一行）。顯示成 `lib-empty-state`；要放動作鈕時改用 `<ng-template dtEmpty>`。 */
  readonly emptyText = input('');
  /** 空狀態的補充文字。 */
  readonly emptyDetail = input('');
  /** `no-data`：還沒有資料；`no-results`：篩選後沒有結果（圖示不同）。 */
  readonly emptyKind = input<EmptyStateKind>('no-data');
  /** 載入中：保留表頭，內容換成骨架列（不顯示空狀態、匯出與分頁）。 */
  readonly loading = input(false);
  /** 載入中顯示幾列骨架。 */
  readonly loadingRows = input(5);
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

  // ---- 表格內直接編輯（columns 裡有 editor 的欄位才會開啟；控制器與編輯器是 lazy chunk）----

  /** instant：改一格存一格（onCellSave）；batch：先標成已修改，按「儲存全部」才送出（onBatchSave）。 */
  readonly editMode = input<DataTableEditMode>('instant');
  /** 即時儲存一格（editMode 是 instant 時必填）。 */
  readonly onCellSave = input<DataTableCellSaveFn<T> | null>(null);
  /** 批次儲存（editMode 是 batch 時必填）。 */
  readonly onBatchSave = input<DataTableBatchSaveFn<T> | null>(null);
  /** 批次修改有沒有未儲存的格子（頁面的 canDeactivate 用；也可以直接讀 `dirty()`）。 */
  readonly dirtyChange = output<boolean>();

  readonly selectionChange = output<readonly T[]>();
  readonly batchDelete = output<readonly T[]>();
  readonly rowClick = output<T>();

  private readonly cellDirectives = contentChildren(DataTableCellDirective<T>);
  protected readonly headDirective = contentChild(DataTableHeadDirective);
  protected readonly bodyDirective = contentChild(DataTableBodyDirective);
  protected readonly batchActionsDirective = contentChild(DataTableBatchActionsDirective<T>);
  protected readonly emptyDirective = contentChild(DataTableEmptyDirective);

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

  private readonly destroyRef = inject(DestroyRef);
  private readonly hostEl = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

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

    // 有可編輯的欄位才載入編輯控制器（動態 import）；欄位不再可編輯（例如關掉「快速編輯」）時拆掉。
    effect(() => {
      const enabled = this.editingEnabled();
      // 少了 labels.editing 時在這裡就丟出錯誤（開發期設定錯誤），不要等控制器載入完才發現。
      if (enabled) this.editingLabels();
      untracked(() => {
        if (enabled) void this.loadEditing();
        else this.unloadEditing();
      });
    });
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.unloadEditing();
    });

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mql = window.matchMedia(COMPACT_QUERY);
      this.isCompact.set(mql.matches);
      const onChange = (e: MediaQueryListEvent) => this.isCompact.set(e.matches);
      mql.addEventListener('change', onChange);
      this.destroyRef.onDestroy(() => mql.removeEventListener('change', onChange));
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

  protected readonly isLoading = computed(() => this.loading() && !this.isCustom());
  protected readonly isEmpty = computed(() => !this.isCustom() && !this.loading() && this.rows().length === 0);
  protected readonly skeletonRows = computed(() =>
    Array.from({ length: Math.max(1, Math.floor(this.loadingRows())) }, (_, i) => i),
  );
  /** 骨架列每格的寬度固定輪替（不用亂數，每次一樣）。 */
  protected skeletonWidth(row: number, col: number): string {
    return `${SKELETON_WIDTHS[(row * 3 + col) % SKELETON_WIDTHS.length]}%`;
  }

  /** 編輯中（批次草稿、儲存中）的列，dtCell 範本拿到的是改過的樣子。 */
  protected cellContext(row: T): DataTableCellContext<T> {
    const ed = this.edit();
    return { $implicit: ed ? ed.view(row) : row };
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
    if (!this.rowClickable() || this.edit()?.editing()) return;
    this.rowClick.emit(row);
  }

  // ---- 表格內直接編輯 ----

  /** 編輯控制器（lazy 載入完成後才有）。範本用 `ed` 取它。 */
  protected readonly edit = signal<DataTableEditController<T> | null>(null);
  private editLoading: Promise<void> | null = null;
  private destroyed = false;

  /** 有欄位設了 editor（逃生門模式不支援編輯）。 */
  protected readonly editingEnabled = computed(() => !this.isCustom() && hasEditableColumns(this.columns()));

  protected readonly editingLabels = computed<DataTableEditingLabels>(() => {
    const editing = this.labels().editing;
    if (this.editingEnabled() && !editing) {
      throw new Error('DataTable：有欄位設了 editor 時 labels.editing 為必填');
    }
    return editing as DataTableEditingLabels;
  });

  /** 手機卡片版：不做儲存格層級的編輯，改成每張卡片一顆「編輯」打開整列表單。 */
  protected readonly editFormMode = computed(() => this.isCompact() && this.mobileMode() === 'cards');

  /** 批次修改有未儲存的格子。 */
  readonly dirty = computed(() => this.edit()?.dirty() ?? false);

  /** 儲存全部批次修改（頁面離開前的「儲存」用）。有錯或失敗時回傳 false。 */
  saveChanges(): Promise<boolean> {
    return this.edit()?.saveAll() ?? Promise.resolve(true);
  }

  /** 捨棄全部批次修改。 */
  discardChanges(): void {
    this.edit()?.discard();
  }

  private async loadEditing(): Promise<void> {
    if (this.edit() || this.editLoading) return this.editLoading ?? undefined;
    const hasRelation = this.columns().some((c) => editorOf(c)?.type === 'relation');
    this.editLoading = (async () => {
      const m = await import('./data-table-edit.controller');
      if (hasRelation) await m.preloadRelationEditor();
      // 載入期間表格已經被移除（換頁）或欄位不再可編輯：不建立控制器。
      if (this.destroyed || !this.editingEnabled() || this.edit()) return;
      this.edit.set(new m.DataTableEditController<T>(this.editHost()));
    })().finally(() => (this.editLoading = null));
    return this.editLoading;
  }

  private unloadEditing(): void {
    const ed = untracked(() => this.edit());
    if (!ed) return;
    ed.destroy();
    this.edit.set(null);
  }

  private editHost(): DataTableEditHost<T> {
    return {
      element: this.hostEl.nativeElement,
      injector: this.injector,
      columns: this.resolvedColumns,
      rows: this.rows,
      processedRows: this.processedRows,
      displayRows: this.displayRows,
      rowId: this.rowId,
      labels: this.editingLabels,
      mode: this.editMode,
      cellSave: this.onCellSave,
      batchSave: this.onBatchSave,
      selectable: this.selectable,
      formMode: this.editFormMode,
      pageable: this.pageable,
      pageSize: this.pageSize,
      goToPage: (page) => this.goToPage(page),
      rowLabel: (row) => this.rowLabel(row),
      dirtyChange: (dirty) => this.dirtyChange.emit(dirty),
    };
  }

  /** 這一列的識別文字：固定欄（或第一欄）的文字，沒有時用 rowId。 */
  protected rowLabel(row: T): string {
    const columns = this.resolvedColumns();
    const col = columns.find((c) => c.key === this.frozenKey()) ?? columns[0];
    const text = col ? this.valueOf(row, col) : '';
    return text || String(this.rowId()(row));
  }

  /** 勾選欄在方向鍵導覽裡的 key。 */
  protected readonly selectKey = '\u0000select';

  /** 這一列至少有一欄可以改（手機卡片才顯示「編輯」）。 */
  protected rowEditable(row: T): boolean {
    return this.resolvedColumns().some((c) => isCellEditable(c, row));
  }

  protected editRowLabel(row: T): string {
    return this.editingLabels().editRowLabel.replace('{row}', this.rowLabel(row));
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
    const ed = this.edit();
    const view = ed ? ed.view(row) : row;
    const value = cellValue(col, view);
    if (value === null || value === undefined) return '';
    // 下拉欄沒有 dtCell 時顯示選項文字，不是存的值。
    const editor = editorOf(col);
    if (editor?.type === 'select') return editor.options.find((o) => o.value === value)?.label ?? String(value);
    return String(value);
  }

  /** 開關欄（editor.type 'toggle'）沒有 dtCell 時畫成開關＋文字。 */
  protected isToggle(col: DataTableColumn<T>): boolean {
    return editorOf(col)?.type === 'toggle';
  }

  protected toggleOn(row: T, col: DataTableColumn<T>): boolean {
    const ed = this.edit();
    return !!cellValue(col, ed ? ed.view(row) : row);
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

  protected readonly canExport = computed(() => this.showExport() && !this.isEmpty() && !this.isLoading());

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
