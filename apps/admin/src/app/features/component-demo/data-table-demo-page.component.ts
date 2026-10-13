import { Component, computed, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  AdvancedFilterComponent,
  DUAL_MONTH_RANGE_PICKER_LABELS,
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
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
  applyFilters,
  removeCondition,
  upsertCondition,
} from '@car-rental/ui';
import { StatusKey } from '@car-rental/theme-pack';
import { ZH_TW } from '../../core/i18n/zh-tw';
import { fmtDateTime } from '../../core/date-utils';
import { HeaderToolbarDirective } from '../../layout/header/header-toolbar-slot';
import { provideHeaderTitle } from '../../layout/header/header-title';
import { StatusChipComponent } from '../../shared/chips/status-chip.component';
import { ADMIN_DATA_TABLE_LABELS } from '../../shared/ui/data-table-labels';
import { ADMIN_FILTER_LABELS, ADMIN_SAVED_VIEWS_LABELS } from '../../shared/ui/list-view-labels';
import {
  DEMO_CATEGORY_LABELS,
  DEMO_OWNERS,
  DEMO_STATUS_LABELS,
  DemoItem,
  DemoStatus,
  makeDemoItems,
} from './demo-items';
import { LIST_TOOLBAR_LABEL_PROVIDERS } from '../../shared/ui/list-toolbar-labels';

const STATUS_TONE: Record<DemoStatus, StatusKey> = {
  todo: 'pending',
  doing: 'warning',
  done: 'completed',
  hold: 'inactive',
};

function options<T extends string>(labels: Record<T, string>): FilterOption<T>[] {
  return (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));
}

/**
 * 清單元件示範頁（/dev/data-table）：用中性假資料展示 libs/ui 的分頁、排序、欄位選擇、固定欄、
 * 進階篩選與已儲存檢視。不屬於任何業務頁，之後若改由元件展示 app 承接，整個資料夾與路由直接刪除。
 */
@Component({
  selector: 'app-data-table-demo-page',
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
  ],
  templateUrl: './data-table-demo-page.component.html',
  styleUrls: ['../../app.scss', './data-table-demo-page.component.scss'],
  providers: [
    ...LIST_TOOLBAR_LABEL_PROVIDERS,
    {
      provide: DUAL_MONTH_RANGE_PICKER_LABELS,
      useValue: {
        field: '到期日',
        placeholder: '選擇日期',
        prevMonth: ZH_TW.rentalSearch.prevMonth,
        nextMonth: ZH_TW.rentalSearch.nextMonth,
        monthTitle: ZH_TW.rentalSearch.monthTitle,
      },
    },
    // 目前沒有登入身分，先用固定的本機使用者；有帳號後換成目前員工的 id。
    { provide: SAVED_VIEW_REPOSITORY, useFactory: () => new LocalStorageSavedViewRepository({ userId: () => 'local' }) },
  ],
})
export class DataTableDemoPageComponent {
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

  constructor() {
    provideHeaderTitle(() => ({ title: '清單元件示範', breadcrumbs: [] }));
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
