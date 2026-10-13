import { Component, computed, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  AdvancedFilterComponent,
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  DataTableMobileMode,
  FilterChipsComponent,
  FilterCondition,
  FilterField,
  FilterOption,
  FilterSelectComponent,
  ListViewController,
  LocalStorageSavedViewRepository,
  PageToolbarComponent,
  SAVED_VIEW_REPOSITORY,
  SavedViewsComponent,
  StatusChipComponent,
  applyFilters,
  removeCondition,
  upsertCondition,
} from '@admin-template/ui';
import { StatusKey } from '@admin-template/theme-pack';
import { fmtDateTime } from '../../core/date-utils';
import { HeaderToolbarDirective } from '../../layout/header/header-toolbar-slot';
import { ADMIN_DATA_TABLE_LABELS } from '../../shared/ui/data-table-labels';
import { ADMIN_FILTER_LABELS, ADMIN_SAVED_VIEWS_LABELS } from '../../shared/ui/list-view-labels';
import { LIST_TOOLBAR_LABEL_PROVIDERS } from '../../shared/ui/list-toolbar-labels';
import { rangePickerLabelProviders } from '../../shared/ui/component-label-providers';
import {
  DEMO_CATEGORY_LABELS,
  DEMO_OWNERS,
  DEMO_STATUS_LABELS,
  DemoItem,
  DemoStatus,
  makeDemoItems,
} from '../../showcase/demo-data';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { detailOf } from '../../showcase/showcase-catalog';

const STATUS_TONE: Record<DemoStatus, StatusKey> = {
  todo: 'pending',
  doing: 'warning',
  done: 'completed',
  hold: 'inactive',
};

function options<T extends string>(labels: Record<T, string>): FilterOption<T>[] {
  return (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));
}

const ENTRY = detailOf('data-table');

/**
 * 資料表展示頁（/components/data-table）：用中性的工單假資料，把 libs/ui 清單元件全部打開——
 * 分頁、排序、欄位選擇、固定欄、多選、匯出，加上頁首工具列、進階篩選與已儲存檢視。
 */
@Component({
  selector: 'app-data-table-page',
  imports: [
    DataTableComponent,
    DataTableCellDirective,
    PageToolbarComponent,
    FilterSelectComponent,
    AdvancedFilterComponent,
    FilterChipsComponent,
    SavedViewsComponent,
    HeaderToolbarDirective,
    StatusChipComponent,
    ShowcasePageComponent,
    DemoBlockComponent,
  ],
  templateUrl: './data-table-page.component.html',
  styleUrl: './data-table-page.component.scss',
  providers: [
    ...LIST_TOOLBAR_LABEL_PROVIDERS,
    ...rangePickerLabelProviders('到期日', '選擇日期'),
    // 範本沒有真正的登入身分，先用固定的本機使用者；接上帳號後換成目前使用者的 id。
    { provide: SAVED_VIEW_REPOSITORY, useFactory: () => new LocalStorageSavedViewRepository({ userId: () => 'local' }) },
  ],
})
export class DataTablePageComponent {
  protected readonly entry = ENTRY;
  private readonly snackBar = inject(MatSnackBar);
  protected readonly tableLabels = ADMIN_DATA_TABLE_LABELS;
  protected readonly filterLabels = ADMIN_FILTER_LABELS;
  protected readonly savedViewsLabels = ADMIN_SAVED_VIEWS_LABELS;
  protected readonly fmt = fmtDateTime;

  readonly items = makeDemoItems();

  readonly view = new ListViewController({
    listId: 'demo-items',
    defaults: { sort: null, filters: [], columns: null, pageSize: 25 },
    repository: inject(SAVED_VIEW_REPOSITORY),
  });

  readonly columns: DataTableColumn<DemoItem>[] = [
    { key: 'code', label: '單號', primary: true, frozen: true },
    { key: 'title', label: '標題', primary: true },
    { key: 'category', label: '類別', exportValue: (r) => DEMO_CATEGORY_LABELS[r.category], sortValue: (r) => DEMO_CATEGORY_LABELS[r.category] },
    { key: 'status', label: '狀態', primary: true, exportValue: (r) => DEMO_STATUS_LABELS[r.status], sortValue: (r) => DEMO_STATUS_LABELS[r.status] },
    { key: 'owner', label: '負責人' },
    { key: 'createdAt', label: '建立時間', exportValue: (r) => this.fmt(r.createdAt) },
    { key: 'dueAt', label: '到期時間', exportValue: (r) => this.fmt(r.dueAt) },
    { key: 'amount', label: '金額', align: 'end' },
    { key: 'qty', label: '數量', align: 'end' },
    {
      key: 'total',
      virtual: true,
      label: '小計',
      align: 'end',
      value: (r) => r.amount * r.qty,
      sortValue: (r) => r.amount * r.qty,
    },
    { key: 'note', label: '備註', sortable: false },
  ];

  readonly fields: FilterField<DemoItem>[] = [
    { id: 'keyword', label: '關鍵字', type: 'text', value: (r) => [r.code, r.title, r.note] },
    { id: 'status', label: '狀態', type: 'multiSelect', options: options(DEMO_STATUS_LABELS), value: (r) => r.status },
    { id: 'category', label: '類別', type: 'select', options: options(DEMO_CATEGORY_LABELS), value: (r) => r.category },
    {
      id: 'owner',
      label: '負責人',
      type: 'multiSelect',
      options: DEMO_OWNERS.map((o) => ({ value: o, label: o })),
      value: (r) => r.owner,
    },
    { id: 'dueAt', label: '到期日', type: 'dateRange', value: (r) => r.dueAt },
    { id: 'amount', label: '金額', type: 'numberRange', unit: '元', value: (r) => r.amount },
  ];

  readonly statusOptions = options(DEMO_STATUS_LABELS);

  /** 頁首的搜尋（不屬於檢視）。 */
  readonly query = signal('');

  /** 頁首的「狀態」快速篩選＝進階篩選裡只選一個狀態的那個條件。 */
  readonly quickStatus = computed<DemoStatus | null>(() => {
    const cond = this.view.filters().find((c) => c.field === 'status');
    return cond?.type === 'multiSelect' && cond.values.length === 1 ? (cond.values[0] as DemoStatus) : null;
  });

  readonly filteredItems = computed(() => {
    const q = this.query().trim();
    const conditions: FilterCondition[] = q ? [...this.view.filters(), { field: 'keyword', type: 'text', text: q }] : [...this.view.filters()];
    return applyFilters(this.items, this.fields, conditions);
  });

  /** 第二塊示範：少量資料、不分頁、可展開列，切換手機版呈現方式。 */
  readonly smallRows = makeDemoItems(6);
  readonly smallColumns: DataTableColumn<DemoItem>[] = [
    { key: 'code', label: '單號', primary: true },
    { key: 'title', label: '標題', primary: true },
    { key: 'owner', label: '負責人' },
    { key: 'amount', label: '金額', align: 'end' },
  ];
  readonly mobileMode = signal<DataTableMobileMode>('cards');
  readonly lastClicked = signal<DemoItem | null>(null);

  protected readonly whenToUse = [
    '清單頁的主體：資料筆數多、需要排序、篩選、挑欄位或匯出。',
    '需要多選後批次處理（匯出、刪除、改狀態）。',
    '手機也要能看：預設改成卡片，只顯示 primary 欄，其餘欄位可展開。',
  ];
  protected readonly avoid = [
    '只有三五筆、不需要排序或篩選的資訊：用一般清單或卡片即可。',
    '要在格子裡直接編輯：行內編輯元件還在規劃中。',
  ];

  protected readonly usage = `// 頁面
readonly columns: DataTableColumn<WorkOrder>[] = [
  { key: 'code', label: '單號', primary: true, frozen: true },
  { key: 'title', label: '標題', primary: true },
  { key: 'amount', label: '金額', align: 'end' },
  { key: 'total', virtual: true, label: '小計', align: 'end', value: (r) => r.amount * r.qty },
];
readonly view = new ListViewController({ listId: 'work-orders', defaults, repository: inject(SAVED_VIEW_REPOSITORY) });

<!-- 模板 -->
<lib-data-table
  [columns]="columns" [rows]="rows()" [labels]="labels"
  [pageable]="true" [sortable]="true" [columnChooser]="true" [selectable]="true"
  [(sort)]="view.sort" [(pageSize)]="view.pageSize" [(page)]="view.page" [(columnPrefs)]="view.columns"
  exportName="work-orders" (exportFailed)="onExportFailed($event)">
  <ng-template dtCell="status" let-r>
    <lib-status-chip [label]="statusLabel(r)" [status]="statusTone(r)" />
  </ng-template>
</lib-data-table>`;

  protected readonly api: ApiSection[] = [
    {
      title: '輸入',
      rows: [
        { name: '[columns]', type: 'DataTableColumn<T>[]', default: '[]', description: '欄位定義：key 綁 keyof T；virtual 欄用 value 計算；frozen 固定最左識別欄；primary 是手機卡片收合時仍顯示的欄。' },
        { name: '[rows]', type: 'T[]', default: '[]', description: '要顯示的資料（已篩選）；分頁與排序由元件處理。' },
        { name: '[labels]', type: 'DataTableLabels', default: '必填', description: '所有畫面文字；開了分頁、欄位選擇時要帶 paging、columnChooser。' },
        { name: '[rowId]', type: '(row: T) => unknown', default: 'row.id', description: '辨識資料列，用於多選與展開狀態。' },
        { name: '[pageable]', type: 'boolean', default: 'false', description: '分頁（25／50／100），手機改為「載入更多」。' },
        { name: '[sortable]', type: 'boolean', default: 'false', description: '點欄名排序：升 → 降 → 取消；欄位可用 sortable: false 排除、sortValue 自訂排序值。' },
        { name: '[columnChooser]', type: 'boolean', default: 'false', description: '欄位選擇面板：顯示／隱藏、拖曳或按鈕調整順序。' },
        { name: '[selectable]', type: 'boolean', default: 'false', description: '列首勾選框與全選；選取後出現批次操作列（dtBatchActions 插槽）。' },
        { name: '[showBatchDelete]', type: 'boolean', default: 'true', description: '批次操作列是否顯示刪除鈕。' },
        { name: '[mobile]', type: "'cards' | 'scroll' | null", default: "null（= 'cards'）", description: '手機版呈現：卡片或橫向捲動。' },
        { name: '[rowClickable]', type: 'boolean', default: 'false', description: '整列可點，觸發 rowClick。' },
        { name: '[showExport]', type: 'boolean', default: 'true', description: '是否顯示匯出 Excel 鈕。' },
        { name: 'exportName', type: 'string', default: "'export'", description: '匯出檔名（不含副檔名）。' },
        { name: 'emptyText', type: 'string', default: "''", description: '沒有資料時的文字。' },
      ],
    },
    {
      title: '雙向綁定（model）',
      rows: [
        { name: '[(sort)]', type: 'DataTableSort | null', default: 'null', description: '目前排序；接 ListViewController 就會存進檢視。' },
        { name: '[(page)]', type: 'number', default: '0', description: '目前頁（從 0 起算）。' },
        { name: '[(pageSize)]', type: 'number', default: '25', description: '每頁筆數。' },
        { name: '[(columnPrefs)]', type: 'DataTableColumnPrefs | null', default: 'null', description: '顯示的欄與順序；null 為預設。' },
      ],
    },
    {
      title: '輸出',
      rows: [
        { name: '(selectionChange)', type: 'T[]', description: '勾選變動。' },
        { name: '(batchDelete)', type: 'T[]', description: '按下批次刪除。' },
        { name: '(rowClick)', type: 'T', description: '點整列（需 rowClickable）。' },
        { name: '(exportFailed)', type: 'Error', description: '匯出失敗（例如 xlsx 分塊下載失敗）；由頁面顯示 labels.exportFailedText。' },
      ],
    },
    {
      title: '插槽（ng-template）',
      rows: [
        { name: 'dtCell="<key>"', type: 'let-r', description: '自訂某一欄的儲存格內容。' },
        { name: 'dtBatchActions', type: 'let-selected', description: '批次操作列的額外按鈕。' },
        { name: 'dtHead／dtBody', type: '—', description: '逃生門：整個表頭或表身自己寫（合併儲存格等）。' },
      ],
    },
  ];

  constructor() {
    void this.view.load();
  }

  setQuickStatus(value: DemoStatus | null): void {
    const filters = this.view.filters();
    this.view.setFilters(
      value ? upsertCondition(filters, { field: 'status', type: 'multiSelect', values: [value] }) : removeCondition(filters, 'status'),
    );
  }

  setFilters(filters: readonly FilterCondition[]): void {
    this.view.setFilters(filters);
  }

  statusLabel(r: DemoItem): string {
    return DEMO_STATUS_LABELS[r.status];
  }

  categoryLabel(r: DemoItem): string {
    return DEMO_CATEGORY_LABELS[r.category];
  }

  statusTone(r: DemoItem): StatusKey {
    return STATUS_TONE[r.status];
  }

  onExportFailed(e: Error): void {
    console.error('DataTable 匯出失敗', e);
    this.snackBar.open(this.tableLabels.exportFailedText, undefined, { duration: 3000 });
  }
}
