import { Component, computed, inject } from '@angular/core';
import { JsonPipe } from '@angular/common';
import {
  AdvancedFilterComponent,
  DataTableColumn,
  DataTableComponent,
  FilterChipsComponent,
  FilterField,
  FilterOption,
  ListViewController,
  LocalStorageSavedViewRepository,
  SAVED_VIEW_REPOSITORY,
  SavedViewsComponent,
  applyFilters,
} from '@admin-template/ui';
import { ADMIN_DATA_TABLE_LABELS } from '../../shared/ui/data-table-labels';
import { ADMIN_FILTER_LABELS, ADMIN_SAVED_VIEWS_LABELS } from '../../shared/ui/list-view-labels';
import { rangePickerLabelProviders } from '../../shared/ui/component-label-providers';
import { DEMO_OWNERS, DEMO_STATUS_LABELS, DemoItem, makeDemoItems } from '../../showcase/demo-data';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

const ENTRY = detailOf('saved-views');

@Component({
  selector: 'app-saved-views-page',
  imports: [
    JsonPipe,
    SavedViewsComponent,
    AdvancedFilterComponent,
    FilterChipsComponent,
    DataTableComponent,
    ShowcasePageComponent,
    DemoBlockComponent,
  ],
  providers: [
    ...rangePickerLabelProviders('到期日', '選擇日期'),
    // 範本沒有真正的登入身分，先用固定的本機使用者；接上帳號後換成目前使用者的 id。
    { provide: SAVED_VIEW_REPOSITORY, useFactory: () => new LocalStorageSavedViewRepository({ userId: () => 'local' }) },
  ],
  templateUrl: './saved-views-page.component.html',
  styleUrl: '../../showcase/demo-shared.scss',
})
export class SavedViewsPageComponent {
  protected readonly entry = ENTRY;
  protected readonly tableLabels = ADMIN_DATA_TABLE_LABELS;
  protected readonly filterLabels = ADMIN_FILTER_LABELS;
  protected readonly savedViewsLabels = ADMIN_SAVED_VIEWS_LABELS;

  private readonly items = makeDemoItems(80);

  protected readonly view = new ListViewController({
    listId: 'showcase-saved-views',
    defaults: { sort: null, filters: [], columns: null, pageSize: 25 },
    repository: inject(SAVED_VIEW_REPOSITORY),
  });

  protected readonly columns: DataTableColumn<DemoItem>[] = [
    { key: 'code', label: '單號', primary: true },
    { key: 'title', label: '標題', primary: true },
    { key: 'statusLabel', virtual: true, label: '狀態', value: (r) => DEMO_STATUS_LABELS[r.status], sortValue: (r) => DEMO_STATUS_LABELS[r.status] },
    { key: 'owner', label: '負責人' },
    { key: 'amount', label: '金額', align: 'end' },
  ];

  protected readonly fields: FilterField<DemoItem>[] = [
    {
      id: 'status',
      label: '狀態',
      type: 'multiSelect',
      options: (Object.entries(DEMO_STATUS_LABELS) as [string, string][]).map(([value, label]): FilterOption => ({ value, label })),
      value: (r) => r.status,
    },
    { id: 'owner', label: '負責人', type: 'multiSelect', options: DEMO_OWNERS.map((o) => ({ value: o, label: o })), value: (r) => r.owner },
    { id: 'amount', label: '金額', type: 'numberRange', unit: '元', value: (r) => r.amount },
  ];

  protected readonly rows = computed(() => applyFilters(this.items, this.fields, [...this.view.filters()]));

  constructor() {
    void this.view.load();
  }

  protected readonly whenToUse = [
    '同一份清單有幾種常用的看法（「我的待處理」「本月大額」），使用者想一鍵切換。',
    '排序、篩選、欄位設定要在重新整理或下次登入後還在。',
  ];
  protected readonly avoid = ['要分享給同事的檢視：介面預留了 visibility: shared，但目前只存在自己的瀏覽器。'];

  protected readonly usage = `// 頁面
providers: [{ provide: SAVED_VIEW_REPOSITORY, useFactory: () => new LocalStorageSavedViewRepository({ userId: () => currentUserId() }) }]

readonly view = new ListViewController({
  listId: 'work-orders',
  defaults: { sort: null, filters: [], columns: null, pageSize: 25 },
  repository: inject(SAVED_VIEW_REPOSITORY),
});
constructor() { void this.view.load(); }

<!-- 模板：表格與篩選都綁在 view 上 -->
<lib-saved-views [controller]="view" [labels]="savedViewsLabels" />
<lib-data-table … [(sort)]="view.sort" [(pageSize)]="view.pageSize" [(page)]="view.page" [(columnPrefs)]="view.columns" />
<lib-advanced-filter … [conditions]="view.filters()" (conditionsChange)="view.setFilters($event)" />`;

  protected readonly api: ApiSection[] = [
    {
      title: 'lib-saved-views',
      rows: [
        { name: '[controller]', type: 'ListViewController', default: '必填', description: '這份清單的檢視狀態。' },
        { name: '[labels]', type: 'SavedViewsLabels', default: '必填', description: '選單、儲存、改名、刪除的文字。' },
      ],
    },
    {
      title: 'ListViewController',
      rows: [
        { name: 'sort／filters／columns／pageSize', type: 'WritableSignal', description: '屬於檢視的狀態；表格與篩選直接綁。' },
        { name: 'page', type: 'WritableSignal<number>', description: '目前頁碼（不屬於檢視）。' },
        { name: 'views／selectedView', type: 'Signal', description: '已儲存的檢視與目前選中的那一個（null 為預設檢視）。' },
        { name: 'modified', type: 'Signal<boolean>', description: '目前狀態與選中的檢視不同（顯示「已修改」）。' },
        { name: 'setFilters(list)', type: 'void', description: '換條件並回到第一頁。' },
        { name: 'load()', type: 'Promise<void>', description: '從存放處讀回檢視；失敗時當作沒有。' },
      ],
    },
    {
      title: '注入',
      rows: [
        { name: 'SAVED_VIEW_REPOSITORY', type: 'SavedViewRepository', default: '必填', description: '檢視存在哪裡；內建 LocalStorageSavedViewRepository（每位使用者分開存），接後端時換掉。' },
      ],
    },
  ];
}
