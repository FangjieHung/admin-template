import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivityEntry, ActivityTimelineComponent } from '@admin-template/ui';
import { ACTIVITY_TIMELINE_LABEL_PROVIDERS } from '../../shared/ui/detail-labels';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';
import { DEMO_ACTIVITY_FILTERS, DEMO_ACTIVITY_KINDS, filterDemoActivity, makeDemoActivity } from './activity-log-demo-data';

const ENTRY = detailOf('activity-log');
/** 每次載入幾筆。 */
export const ACTIVITY_PAGE_SIZE = 12;
/** 模擬的網路延遲（毫秒）。 */
export const ACTIVITY_DEMO_LATENCY = 800;

/** 活動紀錄展示頁（/components/activity-log）：40 筆示範紀錄、篩選、載入更多、第一次載入、空狀態。 */
@Component({
  selector: 'app-activity-log-page',
  imports: [ActivityTimelineComponent, ShowcasePageComponent, DemoBlockComponent],
  providers: [...ACTIVITY_TIMELINE_LABEL_PROVIDERS],
  templateUrl: './activity-log-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './activity-log-page.component.scss'],
})
export class ActivityLogPageComponent {
  protected readonly entry = ENTRY;
  protected readonly kinds = DEMO_ACTIVITY_KINDS;
  protected readonly filters = DEMO_ACTIVITY_FILTERS;

  /** 40 筆，時間相對於打開頁面的這一刻（今天、昨天兩組一定在）。 */
  private readonly all: readonly ActivityEntry[] = makeDemoActivity(new Date(), 40);
  protected readonly total = this.all.length;

  protected readonly filter = signal<string | null>('all');
  protected readonly pageCount = signal(ACTIVITY_PAGE_SIZE);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);

  private readonly filtered = computed(() => filterDemoActivity(this.all, this.filter()));
  protected readonly shown = computed(() => this.filtered().slice(0, this.pageCount()));
  protected readonly hasMore = computed(() => this.shown().length < this.filtered().length);
  protected readonly filteredCount = computed(() => this.filtered().length);
  protected readonly filterLabel = computed(() => this.filters.find((f) => f.id === this.filter())?.label ?? '全部');

  /** 空狀態示範：還沒有任何紀錄、篩選後沒有符合的。 */
  protected readonly noEntries: ActivityEntry[] = [];

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearTimer());
  }

  protected onFilterChange(id: string | null): void {
    // 換篩選＝重新查詢：先顯示骨架，延遲後回到第一頁。
    this.clearTimer();
    this.loading.set(true);
    this.loadingMore.set(false);
    this.timer = setTimeout(() => {
      this.filter.set(id);
      this.pageCount.set(ACTIVITY_PAGE_SIZE);
      this.loading.set(false);
    }, ACTIVITY_DEMO_LATENCY / 2);
  }

  protected onLoadMore(): void {
    if (this.loadingMore()) return;
    this.loadingMore.set(true);
    this.timer = setTimeout(() => {
      this.pageCount.update((n) => n + ACTIVITY_PAGE_SIZE);
      this.loadingMore.set(false);
    }, ACTIVITY_DEMO_LATENCY);
  }

  protected reload(): void {
    this.clearTimer();
    this.loading.set(true);
    this.timer = setTimeout(() => {
      this.pageCount.set(ACTIVITY_PAGE_SIZE);
      this.loading.set(false);
    }, ACTIVITY_DEMO_LATENCY * 2);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  protected readonly whenToUse = [
    '詳情頁的「活動紀錄」分頁：誰在何時改了什麼、留了什麼言。',
    '稽核、異動歷程：需要看到欄位的舊值與新值。',
    '系統自動產生的事件（提醒、升級、自動指派）和人的操作排在同一條時間軸。',
  ];
  protected readonly avoid = [
    '要排序、篩選很多欄位或匯出的大量紀錄：用資料表（lib-data-table）。',
    '即時聊天：時間軸不處理輸入框、已讀與即時推播。',
    '只有一兩筆最後更新時間：直接寫在描述清單裡。',
  ];

  protected readonly usage = `// 頁面的 providers：畫面文字（相對時間由 Intl.RelativeTimeFormat 依語言產生，不放這裡）
providers: [{ provide: ACTIVITY_TIMELINE_LABELS, useValue: {
  today: '今天', yesterday: '昨天', dayHeading: '{date}（{weekday}）', system: '系統',
  loadMore: '載入更多', expandChanges: '展開 {count} 筆變更', collapseChanges: '收合變更',
  emptyValue: '（空白）', changedTo: '改成', empty: '還沒有活動紀錄',
  emptyFiltered: '沒有符合篩選條件的紀錄', filters: '篩選活動紀錄', loading: '載入中',
} }]

// 種類對照表：元件不認得任何業務種類
readonly kinds: ActivityKindMap = {
  status: { icon: 'sync_alt', tone: 'info' },
  comment: { icon: 'chat', tone: 'neutral' },
  resolve: { icon: 'check_circle', tone: 'success' },
};

<lib-activity-timeline
  [entries]="entries()"
  [kinds]="kinds"
  [filters]="[{ id: 'all', label: '全部' }, { id: 'comments', label: '留言' }]"
  [(filter)]="filter"
  [hasMore]="hasMore()"
  [loadingMore]="loadingMore()"
  [loading]="loading()"
  (filterChange)="reload($event)"
  (loadMore)="fetchOlder()"
/>`;

  protected readonly api: ApiSection[] = [
    {
      title: '輸入',
      rows: [
        { name: '[entries]', type: 'ActivityEntry[]', default: '必填', description: '{ id, actor: { name, initials? } | null, at, kind, summary, changes?, body? }；actor 是 null 代表系統。依傳入順序（通常新到舊）分組，元件不排序。' },
        { name: '[kinds]', type: 'ActivityKindMap', default: '必填', description: 'kind → { icon, tone }；tone 是 neutral／info／success／warning／danger。找不到的 kind 用中性的 history 圖示。' },
        { name: '[filters]', type: 'ActivityFilter[]', default: '[]', description: '{ id, label }，顯示成一排 chip；第一個當作「全部」（空狀態文字依此區分）。' },
        { name: '[(filter)]', type: 'string | null', default: 'null', description: '目前的篩選 id；null 時是第一個。' },
        { name: '[hasMore]', type: 'boolean', default: 'false', description: '底部顯示「載入更多」。' },
        { name: '[loadingMore]', type: 'boolean', default: 'false', description: '「載入更多」轉圈、停用。' },
        { name: '[loading]', type: 'boolean', default: 'false', description: '第一次載入（或換篩選重新查詢）時顯示骨架。' },
        { name: '[collapseAfter]', type: 'number', default: '3', description: '變更超過幾筆時預設收合成「展開 N 筆變更」。' },
        { name: '[headingLevel]', type: 'number', default: '3', description: '日期分組標題的 aria-level，依頁面結構調整。' },
        { name: '[systemIcon]', type: 'string', default: "'settings'", description: '系統紀錄圓章的 Material Symbols 圖示。' },
      ],
    },
    {
      title: '輸出',
      rows: [
        { name: '(filterChange)', type: 'string', description: '使用者換了篩選（[(filter)] 的另一半）。資料由頁面自己篩或重新查詢。' },
        { name: '(loadMore)', type: 'void', description: '按下「載入更多」。' },
      ],
    },
    {
      title: '注入',
      rows: [
        { name: 'ACTIVITY_TIMELINE_LABELS', type: 'ActivityTimelineLabels', default: '必填', description: '13 句畫面文字；少一句會在建立元件時丟錯並列出缺的名稱。' },
        { name: 'MinuteClock', type: 'root 服務', description: '共用的分鐘時鐘：相對時間與今天／昨天分組每分鐘更新一次；最後一個時間軸銷毀時停止。' },
      ],
    },
  ];
}
