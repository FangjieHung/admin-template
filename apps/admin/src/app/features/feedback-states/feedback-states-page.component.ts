import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import {
  AsyncStateComponent,
  AsyncStatus,
  DataTableColumn,
  DataTableComponent,
  DataTableEmptyDirective,
  EmptyStateComponent,
  EmptyStateKind,
  ErrorStateComponent,
  SkeletonComponent,
} from '@admin-template/ui';
import { FEEDBACK_STATE_LABEL_PROVIDERS } from '../../shared/ui/component-label-providers';
import { ADMIN_DATA_TABLE_LABELS } from '../../shared/ui/data-table-labels';
import { DEMO_CONTACTS, DEMO_PROJECTS, DemoContact, DemoProject } from '../../showcase/demo-data';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

const ENTRY = detailOf('feedback-states');

type ListMode = 'loading' | 'ready' | 'empty' | 'no-results' | 'error';
type TableMode = 'loading' | 'ready' | 'empty' | 'no-results';

interface ModeOption<T extends string> {
  id: T;
  label: string;
}

/** 重試時模擬重新載入的時間。 */
const RELOAD_MS = 1200;

/**
 * 載入、空白、錯誤展示頁（/components/feedback-states）：lib-async-state 即時切換、資料表的載入與空狀態，
 * 以及骨架 5 種形狀、空狀態 2 種、錯誤狀態的個別示範。
 */
@Component({
  selector: 'app-feedback-states-page',
  imports: [
    AsyncStateComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    DataTableComponent,
    DataTableEmptyDirective,
    ShowcasePageComponent,
    DemoBlockComponent,
  ],
  providers: [...FEEDBACK_STATE_LABEL_PROVIDERS],
  templateUrl: './feedback-states-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './feedback-states-page.component.scss'],
})
export class FeedbackStatesPageComponent {
  protected readonly entry = ENTRY;
  protected readonly tableLabels = ADMIN_DATA_TABLE_LABELS;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearReload());
  }

  // ---- lib-async-state 即時切換 ----
  protected readonly listModes: ModeOption<ListMode>[] = [
    { id: 'loading', label: '載入中' },
    { id: 'ready', label: '有資料' },
    { id: 'empty', label: '尚無資料' },
    { id: 'no-results', label: '篩選後沒有結果' },
    { id: 'error', label: '錯誤' },
  ];
  protected readonly listMode = signal<ListMode>('loading');
  protected readonly listStatus = computed<AsyncStatus>(() => {
    const mode = this.listMode();
    return mode === 'no-results' ? 'empty' : mode;
  });
  protected readonly listEmptyKind = computed<EmptyStateKind>(() => (this.listMode() === 'no-results' ? 'no-results' : 'no-data'));
  protected readonly contacts: readonly DemoContact[] = DEMO_CONTACTS;
  protected readonly lastAction = signal('（尚未操作）');

  protected setListMode(mode: ListMode): void {
    this.clearReload();
    this.listMode.set(mode);
  }

  protected onListEmptyAction(): void {
    if (this.listMode() === 'no-results') {
      this.lastAction.set('清除篩選 → 顯示全部聯絡人');
      this.listMode.set('ready');
    } else {
      this.lastAction.set('按下「新增聯絡人」（示範，不會真的新增）');
    }
  }

  protected onListRetry(): void {
    this.lastAction.set('重試 → 重新載入中');
    this.listMode.set('loading');
    this.clearReload();
    this.reloadTimer = setTimeout(() => {
      this.listMode.set('ready');
      this.lastAction.set('重試成功，已載入聯絡人');
    }, RELOAD_MS);
  }

  private clearReload(): void {
    if (this.reloadTimer !== null) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }
  }

  // ---- 資料表 ----
  protected readonly tableModes: ModeOption<TableMode>[] = [
    { id: 'loading', label: '載入中' },
    { id: 'ready', label: '有資料' },
    { id: 'empty', label: '尚無資料' },
    { id: 'no-results', label: '篩選後沒有結果' },
  ];
  protected readonly tableMode = signal<TableMode>('loading');
  protected readonly tableRows = computed<readonly DemoProject[]>(() => {
    const mode = this.tableMode();
    return mode === 'ready' || mode === 'loading' ? DEMO_PROJECTS : [];
  });
  protected readonly projectColumns: DataTableColumn<DemoProject>[] = [
    { key: 'name', label: '專案', primary: true },
    { key: 'owner', label: '負責人', primary: true },
    { key: 'progress', label: '進度（%）', align: 'end' },
    { key: 'budget', label: '預算', align: 'end' },
    { key: 'dueDate', label: '到期日' },
  ];

  // ---- 骨架 ----
  protected readonly skeletonAnimated = signal(true);

  protected readonly whenToUse = [
    '頁面或區塊的資料要等一下才會到：先畫出內容形狀的骨架，比轉圈更不容易覺得在等。',
    '清單、表格沒有資料：說明為什麼是空的，並給一個下一步（新增、清除篩選）。',
    '載入失敗：說明什麼失敗了，給「重試」；技術細節收在「顯示詳細資訊」裡。',
  ];
  protected readonly avoid = [
    '按鈕送出後的短暫等待：在按鈕上顯示處理中，不要把整塊換成骨架。',
    '操作完成或失敗的一次性通知：用提示訊息（toast）。',
    '整頁找不到或沒有權限：用錯誤頁樣板（規劃中）。',
  ];

  protected readonly usage = `// 頁面 providers（一次）：骨架的報讀器文字、重試鈕等。
providers: [{ provide: FEEDBACK_STATE_LABELS, useValue: { loading: '載入中', retry: '重試', showDetails: '顯示詳細資訊', hideDetails: '隱藏詳細資訊' } }]

<lib-async-state
  [status]="status()"            <!-- 'loading' | 'empty' | 'error' | 'ready' -->
  skeleton="list"
  emptyMessage="還沒有聯絡人"
  emptyActionLabel="新增聯絡人"
  errorMessage="聯絡人載入失敗"
  (emptyAction)="create()"
  (retry)="reload()"
>
  <ul>@for (c of contacts(); track c.id) { <li>{{ c.name }}</li> }</ul>
</lib-async-state>

<!-- 資料表：載入中顯示骨架列；沒有資料時 emptyText 變成空狀態 -->
<lib-data-table [columns]="columns" [rows]="rows()" [labels]="labels" [loading]="loading()"
  emptyText="沒有符合條件的專案" emptyKind="no-results">
  <ng-template dtEmpty>
    <lib-empty-state kind="no-results" message="沒有符合條件的專案" actionLabel="清除篩選" (action)="clearFilters()" />
  </ng-template>
</lib-data-table>`;

  protected readonly api: ApiSection[] = [
    {
      title: 'lib-async-state',
      rows: [
        { name: '[status]', type: "'loading' | 'empty' | 'error' | 'ready'", default: '必填', description: '目前狀態；ready 顯示投影進來的內容。' },
        { name: 'skeleton', type: 'SkeletonVariant', default: "'text'", description: '預設骨架的形狀；另有 skeletonCount、skeletonColumns。' },
        { name: 'emptyMessage／emptyDetail', type: 'string', default: "''", description: '空狀態的說明與補充文字。' },
        { name: '[emptyKind]', type: "'no-data' | 'no-results'", default: "'no-data'", description: '尚無資料或篩選後沒有結果。' },
        { name: 'emptyIcon／emptyActionLabel', type: 'string', default: "''", description: '空狀態的圖示與動作鈕文字。' },
        { name: 'errorMessage／errorHint／errorDetail', type: 'string', default: "''", description: '錯誤的說明、給使用者的建議、可展開的技術細節。' },
        { name: '[retryable]', type: 'boolean', default: 'true', description: 'false 時錯誤不顯示重試鈕。' },
        { name: '[compact]', type: 'boolean', default: 'false', description: '放在小卡片或表格裡時縮小留白。' },
        { name: '(retry)／(emptyAction)', type: 'void', description: '按下重試／空狀態的動作鈕。' },
        { name: 'libAsyncLoading／libAsyncEmpty／libAsyncError', type: 'ng-template', description: '換掉預設的骨架、空狀態或錯誤畫面。' },
      ],
    },
    {
      title: 'lib-skeleton',
      rows: [
        { name: 'variant', type: "'text' | 'table' | 'card' | 'list' | 'kpi'", default: "'text'", description: '照載入後的內容形狀挑；card、kpi 會畫 ui-card 外框。' },
        { name: '[count]', type: 'number | null', default: '3／5／3／3／4', description: '行數、列數、張數或項目數。' },
        { name: '[columns]', type: 'number', default: '4', description: 'table 的欄數。' },
        { name: '[animated]', type: 'boolean', default: 'true', description: 'false 不閃光；使用者要求減少動態時一律靜止（加上 lib-skeleton--static）。' },
        { name: 'label', type: 'string', default: 'labels.loading', description: '報讀器念的文字；外框 aria-busy，色塊 aria-hidden。' },
      ],
    },
    {
      title: 'lib-empty-state',
      rows: [
        { name: 'message', type: 'string', default: '必填', description: '一行說明。' },
        { name: 'detail', type: 'string', default: "''", description: '補充文字。' },
        { name: '[kind]', type: "'no-data' | 'no-results'", default: "'no-data'", description: '圖示 inbox／search_off；動作鈕實心／外框。' },
        { name: 'icon', type: 'string', default: '依 kind', description: 'Material Symbols 圖示名稱。' },
        { name: 'actionLabel', type: 'string', default: "''", description: '唯一一個動作鈕；空字串不顯示。' },
        { name: '(action)', type: 'void', description: '按下動作鈕。' },
      ],
    },
    {
      title: 'lib-error-state',
      rows: [
        { name: 'message', type: 'string', default: '必填', description: '什麼失敗了；放在 role="alert" 裡，切到錯誤時報讀器立刻念出。' },
        { name: 'hint', type: 'string', default: "''", description: '給使用者的建議。' },
        { name: 'detail', type: 'string', default: "''", description: '技術細節，有值時出現「顯示詳細資訊」切換鈕（aria-expanded）。' },
        { name: '[retryable]／retryLabel', type: 'boolean／string', default: "true／labels.retry", description: '重試鈕與它的文字。' },
        { name: '(retry)', type: 'void', description: '按下重試。' },
      ],
    },
    {
      title: '注入',
      rows: [
        { name: 'FEEDBACK_STATE_LABELS', type: 'FeedbackStateLabels', default: '選填', description: 'loading、retry、showDetails、hideDetails；缺少又沒用 input 給時會報錯。' },
      ],
    },
    {
      title: '質地',
      rows: [
        { name: '--app-skeleton-bg／-shine／-radius／-duration', type: 'CSS 變數', description: '骨架的底色、閃光、圓角（跟著 corner-small）與循環時長。' },
        { name: '--app-empty-bg／-frame／-shadow', type: 'CSS 變數', description: '空狀態與錯誤的外框：Linen 色塊、Grid 虛線框、Soft UI 淺內凹，其餘不加。' },
      ],
    },
  ];
}
