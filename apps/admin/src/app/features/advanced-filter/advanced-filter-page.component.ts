import { Component, computed, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import {
  AdvancedFilterComponent,
  FilterChipsComponent,
  FilterCondition,
  FilterField,
  FilterOption,
  applyFilters,
} from '@car-rental/ui';
import { fmtDateTime } from '../../core/date-utils';
import { ADMIN_FILTER_LABELS } from '../../shared/ui/list-view-labels';
import { rangePickerLabelProviders } from '../../shared/ui/component-label-providers';
import {
  DEMO_CATEGORY_LABELS,
  DEMO_OWNERS,
  DEMO_STATUS_LABELS,
  DemoItem,
  makeDemoItems,
} from '../../showcase/demo-data';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

function options<T extends string>(labels: Record<T, string>): FilterOption<T>[] {
  return (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));
}

const ENTRY = detailOf('advanced-filter');

@Component({
  selector: 'app-advanced-filter-page',
  imports: [JsonPipe, AdvancedFilterComponent, FilterChipsComponent, ShowcasePageComponent, DemoBlockComponent],
  providers: [...rangePickerLabelProviders('到期日', '選擇日期')],
  templateUrl: './advanced-filter-page.component.html',
  styleUrl: '../../showcase/demo-shared.scss',
})
export class AdvancedFilterPageComponent {
  protected readonly entry = ENTRY;
  protected readonly labels = ADMIN_FILTER_LABELS;
  protected readonly fmt = fmtDateTime;
  protected readonly statusLabels = DEMO_STATUS_LABELS;

  private readonly items = makeDemoItems(120);

  protected readonly fields: FilterField<DemoItem>[] = [
    { id: 'keyword', label: '關鍵字', type: 'text', value: (r) => [r.code, r.title, r.note] },
    { id: 'status', label: '狀態', type: 'multiSelect', options: options(DEMO_STATUS_LABELS), value: (r) => r.status },
    { id: 'category', label: '類別', type: 'select', options: options(DEMO_CATEGORY_LABELS), value: (r) => r.category },
    { id: 'owner', label: '負責人', type: 'multiSelect', options: DEMO_OWNERS.map((o) => ({ value: o, label: o })), value: (r) => r.owner },
    { id: 'dueAt', label: '到期日', type: 'dateRange', value: (r) => r.dueAt },
    { id: 'amount', label: '金額', type: 'numberRange', unit: '元', value: (r) => r.amount },
  ];

  /** 預先放兩個條件，一進頁就看得到條件標籤。 */
  protected readonly conditions = signal<readonly FilterCondition[]>([
    { field: 'status', type: 'multiSelect', values: ['todo', 'doing'] },
    { field: 'amount', type: 'numberRange', min: 5000 },
  ]);

  protected readonly results = computed(() => applyFilters(this.items, this.fields, [...this.conditions()]));

  protected readonly whenToUse = [
    '組合查詢：「這週到期、金額 5,000 以上、狀態是待處理或進行中」。',
    '條件要能存進檢視（條件是可 JSON 化的資料，見已儲存檢視）。',
  ];
  protected readonly avoid = ['只有一兩個單選條件：用頁首的快速篩選就好。'];

  protected readonly usage = `readonly fields: FilterField<WorkOrder>[] = [
  { id: 'keyword', label: '關鍵字', type: 'text', value: (r) => [r.code, r.title] },
  { id: 'status', label: '狀態', type: 'multiSelect', options: STATUS_OPTIONS, value: (r) => r.status },
  { id: 'dueAt', label: '到期日', type: 'dateRange', value: (r) => r.dueAt },
  { id: 'amount', label: '金額', type: 'numberRange', unit: '元', value: (r) => r.amount },
];
readonly conditions = signal<readonly FilterCondition[]>([]);
readonly results = computed(() => applyFilters(this.rows, this.fields, [...this.conditions()]));

<lib-advanced-filter [fields]="fields" [labels]="labels" [(conditions)]="conditions" />
<lib-filter-chips [fields]="fields" [labels]="labels" [(conditions)]="conditions" />

// 頁面 providers：月曆文字（日期區間條件會用到）
providers: [...rangePickerLabelProviders('到期日')]`;

  protected readonly api: ApiSection[] = [
    {
      title: 'lib-advanced-filter／lib-filter-chips',
      rows: [
        { name: '[fields]', type: 'FilterField<T>[]', default: '必填', description: '可篩選的欄位：text、select、multiSelect、dateRange（含今天、本週）、numberRange（可帶單位）。' },
        { name: '[(conditions)]', type: 'FilterCondition[]', default: '[]', description: '已套用的條件；多個條件之間是 AND，同一欄最多一個條件。' },
        { name: '[labels]', type: 'FilterLabels', default: '必填', description: '面板、條件標籤的所有文字（{field}、{value} 等會代換）。' },
      ],
    },
    {
      title: '函式（filter-predicates.ts）',
      rows: [
        { name: 'applyFilters(rows, fields, conditions)', type: 'T[]', description: '在前端套用條件；接伺服器時改把 conditions 送到 API。' },
        { name: 'upsertCondition(list, condition)', type: 'FilterCondition[]', description: '新增或取代同一欄的條件（頁首快速篩選用）。' },
        { name: 'removeCondition(list, fieldId)', type: 'FilterCondition[]', description: '移除某一欄的條件。' },
      ],
    },
  ];
}
