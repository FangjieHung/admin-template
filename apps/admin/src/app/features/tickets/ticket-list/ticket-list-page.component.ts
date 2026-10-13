import { Component, Injector, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { AccessService, CanDirective } from '@admin-template/access';
import type { StatusKey } from '@admin-template/theme-pack';
import {
  AdvancedFilterComponent,
  DataTableBatchActionsDirective,
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  DataTableEmptyDirective,
  EmptyStateComponent,
  ErrorStateComponent,
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
  ToastService,
  applyFilters,
  openConfirmDialog,
} from '@admin-template/ui';
import { provideHeaderTitle } from '../../../layout/header/header-title';
import { HeaderToolbarDirective } from '../../../layout/header/header-toolbar-slot';
import {
  CONFIRM_DIALOG_LABEL_PROVIDERS,
  FEEDBACK_STATE_LABEL_PROVIDERS,
  TOAST_PROVIDERS,
  rangePickerLabelProviders,
} from '../../../shared/ui/component-label-providers';
import { ADMIN_DATA_TABLE_LABELS } from '../../../shared/ui/data-table-labels';
import { LIST_TOOLBAR_LABEL_PROVIDERS } from '../../../shared/ui/list-toolbar-labels';
import { ADMIN_FILTER_LABELS, ADMIN_SAVED_VIEWS_LABELS } from '../../../shared/ui/list-view-labels';
import { TemplateInfo, TemplateInfoComponent } from '../../../shared/ui/template-info.component';
import { TICKET_ASSIGNEES } from '../data/ticket-demo-data';
import { formatCreatedAt, formatDueDate, isOverdue, parseDueDate } from '../data/ticket-format';
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONES,
  Ticket,
  TicketStatus,
} from '../data/ticket.model';
import { TicketRepository, TicketSnapshot } from '../data/ticket.repository';
import { TicketListMemory, readListUrl, sameListParams, toListQueryParams } from './ticket-list-url';

type LoadState = 'loading' | 'ready' | 'error';

const PAGE_SIZES = [25, 50, 100] as const;
const UNASSIGNED = 'unassigned';
/** 活動紀錄的操作者：目前的使用者，摘要寫成「你 把狀態從…」。 */
const ACTOR = { name: '你' };

function options<T extends string>(labels: Readonly<Record<T, string>>): FilterOption<T>[] {
  return (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));
}

const INFO: TemplateInfo = {
  summary: '列表頁樣板：搜尋、篩選、排序、分頁都寫在網址上，重新整理或從詳情頁返回時還原；多選後可批次改狀態或刪除（可復原）。',
  components: [
    'lib-page-toolbar、lib-filter-select（頁首的搜尋與狀態）',
    'lib-advanced-filter、lib-filter-chips、lib-saved-views（ListViewController）',
    'lib-data-table（分頁、排序、欄位選擇、凍結編號欄、多選、批次操作、骨架、空狀態）',
    'lib-error-state、lib-empty-state、lib-status-chip、lib-toast、確認對話框',
    'libs/access 的 *libCan（檢視者看不到新增、批次改狀態、刪除）',
  ],
  replace: [
    'ticket.repository.ts：list() 換成呼叫後端（資料量大時改成伺服器分頁）',
    'ticket.model.ts：工單的欄位、狀態與標籤',
    '本頁的 columns、fields（欄位與篩選條件）',
    '網址的 ?demo=error、?demo=empty（示範載入失敗與沒有資料）',
  ],
  files: [
    'apps/admin/src/app/features/tickets/ticket-list/',
    'apps/admin/src/app/features/tickets/data/',
    'apps/admin/src/app/features/tickets/tickets.routes.ts',
  ],
};

/**
 * 工單列表（頁面樣板，/templates/tickets）：點一列進詳情，「新增工單」進空白表單。
 * 篩選、排序、頁碼同步到網址（ticket-list-url.ts）。
 */
@Component({
  selector: 'app-ticket-list-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    CanDirective,
    DataTableComponent,
    DataTableCellDirective,
    DataTableEmptyDirective,
    DataTableBatchActionsDirective,
    PageToolbarComponent,
    FilterSelectComponent,
    AdvancedFilterComponent,
    FilterChipsComponent,
    SavedViewsComponent,
    StatusChipComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    HeaderToolbarDirective,
    TemplateInfoComponent,
  ],
  providers: [
    ...LIST_TOOLBAR_LABEL_PROVIDERS,
    ...rangePickerLabelProviders('期限', '選擇日期'),
    ...FEEDBACK_STATE_LABEL_PROVIDERS,
    ...CONFIRM_DIALOG_LABEL_PROVIDERS,
    ...TOAST_PROVIDERS,
    // 已儲存檢視存在瀏覽器、每個示範身分分開；接後端時換成 API 版本的 SavedViewRepository。
    {
      provide: SAVED_VIEW_REPOSITORY,
      useFactory: () => {
        const access = inject(AccessService);
        return new LocalStorageSavedViewRepository({ userId: () => access.currentUser()?.id ?? 'local' });
      },
    },
  ],
  templateUrl: './ticket-list-page.component.html',
  styleUrl: './ticket-list-page.component.scss',
})
export class TicketListPageComponent {
  private readonly repo = inject(TicketRepository);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly toast = inject(ToastService);
  private readonly access = inject(AccessService);
  private readonly memory = inject(TicketListMemory);

  protected readonly info = INFO;
  protected readonly tableLabels = ADMIN_DATA_TABLE_LABELS;
  protected readonly filterLabels = ADMIN_FILTER_LABELS;
  protected readonly savedViewsLabels = ADMIN_SAVED_VIEWS_LABELS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly statuses = TICKET_STATUSES;
  protected readonly statusLabels = TICKET_STATUS_LABELS;
  protected readonly formatCreatedAt = formatCreatedAt;
  protected readonly formatDueDate = formatDueDate;
  protected readonly isOverdue = isOverdue;

  protected readonly loadState = signal<LoadState>('loading');
  protected readonly tickets = signal<readonly Ticket[]>([]);
  protected readonly selection = signal<readonly Ticket[]>([]);
  protected readonly busy = signal(false);
  /** 頁首的搜尋（不屬於檢視）。 */
  protected readonly query = signal('');

  protected readonly canDelete = computed(() => this.access.can('ticket:delete'));
  protected readonly canEdit = computed(() => this.access.can('ticket:edit'));
  protected readonly canCreate = computed(() => this.access.can('ticket:create'));

  readonly view = new ListViewController({
    listId: 'template-tickets',
    defaults: { sort: null, filters: [], columns: null, pageSize: 25 },
    repository: inject(SAVED_VIEW_REPOSITORY),
  });

  protected readonly columns: DataTableColumn<Ticket>[] = [
    { key: 'id', label: '編號', primary: true, frozen: true },
    { key: 'title', label: '標題', primary: true },
    {
      key: 'status',
      label: '狀態',
      primary: true,
      sortValue: (r) => TICKET_STATUSES.indexOf(r.status),
      exportValue: (r) => TICKET_STATUS_LABELS[r.status],
    },
    {
      key: 'priority',
      label: '優先順序',
      sortValue: (r) => TICKET_PRIORITIES.indexOf(r.priority),
      exportValue: (r) => TICKET_PRIORITY_LABELS[r.priority],
    },
    {
      key: 'category',
      label: '分類',
      sortValue: (r) => TICKET_CATEGORY_LABELS[r.category],
      exportValue: (r) => TICKET_CATEGORY_LABELS[r.category],
    },
    {
      key: 'assignee',
      virtual: true,
      label: '負責人',
      value: (r) => this.repo.personName(r.assigneeId) || '未指派',
      sortValue: (r) => this.repo.personName(r.assigneeId),
    },
    {
      key: 'requester',
      virtual: true,
      label: '申請人',
      value: (r) => this.repo.personName(r.requesterId),
      sortValue: (r) => this.repo.personName(r.requesterId),
    },
    { key: 'createdAt', label: '建立時間', exportValue: (r) => formatCreatedAt(r.createdAt) },
    { key: 'dueDate', label: '期限', exportValue: (r) => formatDueDate(r.dueDate) },
  ];

  protected readonly fields: FilterField<Ticket>[] = [
    { id: 'keyword', label: '關鍵字', type: 'text', value: (r) => [r.id, r.title, this.repo.personName(r.requesterId)] },
    { id: 'status', label: '狀態', type: 'multiSelect', options: options(TICKET_STATUS_LABELS), value: (r) => r.status },
    { id: 'priority', label: '優先順序', type: 'multiSelect', options: options(TICKET_PRIORITY_LABELS), value: (r) => r.priority },
    { id: 'category', label: '分類', type: 'select', options: options(TICKET_CATEGORY_LABELS), value: (r) => r.category },
    {
      id: 'assignee',
      label: '負責人',
      type: 'multiSelect',
      options: [{ value: UNASSIGNED, label: '未指派' }, ...TICKET_ASSIGNEES.map((p) => ({ value: p.id, label: p.name }))],
      value: (r) => r.assigneeId ?? UNASSIGNED,
    },
    { id: 'dueDate', label: '期限', type: 'dateRange', value: (r) => (r.dueDate ? parseDueDate(r.dueDate) : null) },
    { id: 'createdAt', label: '建立時間', type: 'dateRange', value: (r) => r.createdAt },
  ];

  protected readonly statusOptions = options(TICKET_STATUS_LABELS);

  /** 頁首的「狀態」快速篩選＝進階篩選裡只選一個狀態的那個條件。 */
  protected readonly quickStatus = computed<TicketStatus | null>(() => {
    const cond = this.view.filters().find((c) => c.field === 'status');
    return cond?.type === 'multiSelect' && cond.values.length === 1 ? (cond.values[0] as TicketStatus) : null;
  });

  protected readonly rows = computed(() => {
    const q = this.query().trim();
    const conditions: FilterCondition[] = [...this.view.filters()];
    if (q) conditions.push({ field: 'keyword', type: 'text', text: q });
    return applyFilters(this.tickets(), this.fields, conditions);
  });

  /** 有搜尋或篩選條件（決定空狀態是「沒有資料」還是「沒有符合的結果」）。 */
  protected readonly filtered = computed(() => this.query().trim() !== '' || this.view.filters().length > 0);

  protected readonly countText = computed(() => {
    if (this.loadState() !== 'ready') return '';
    const total = this.tickets().length;
    return this.filtered() ? `符合 ${this.rows().length}／${total} 筆` : `共 ${total} 筆`;
  });

  /** 網址還原完成之後，狀態一變就寫回網址。 */
  private readonly restored = signal(false);

  constructor() {
    provideHeaderTitle(() => ({ title: '工單', breadcrumbs: [{ label: '頁面樣板' }] }));
    void this.restoreFromUrl();
    void this.load();

    effect(() => {
      if (!this.restored()) return;
      const params = toListQueryParams(
        {
          q: this.query(),
          view: this.view.selectedId(),
          filters: this.view.filters(),
          sort: this.view.sort(),
          pageSize: this.view.pageSize(),
          page: this.view.page(),
        },
        this.view.selectedView()?.state ?? { filters: [], sort: null, pageSize: 25 },
      );
      untracked(() => this.writeUrl(params));
    });
  }

  // ---- 載入 ----

  private demo(): string | null {
    return this.route.snapshot.queryParamMap.get('demo');
  }

  /** silent：重新整理資料時不換成骨架（批次操作、復原之後）。 */
  protected async load(silent = false): Promise<void> {
    if (!silent) this.loadState.set('loading');
    try {
      const demo = this.demo();
      this.tickets.set(await this.repo.list({ simulateError: demo === 'error', simulateEmpty: demo === 'empty' }));
      this.loadState.set('ready');
    } catch {
      this.loadState.set('error');
    }
  }

  /** 重試：拿掉示範用的 ?demo=error 再載入一次（真正的頁面直接再呼叫一次 load）。 */
  protected async retry(): Promise<void> {
    if (this.demo() === 'error') {
      await this.router.navigate([], { relativeTo: this.route, queryParams: { demo: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
    await this.load();
  }

  private async restoreFromUrl(): Promise<void> {
    const url = readListUrl(this.route.snapshot.queryParamMap, {
      sortKeys: this.columns.map((c) => c.key),
      pageSizes: PAGE_SIZES,
    });
    await this.view.load();
    if (url.view && this.view.views().some((v) => v.id === url.view)) this.view.select(url.view);
    if (url.filters) this.view.setFilters(url.filters);
    if (url.sort !== undefined) this.view.sort.set(url.sort);
    if (url.pageSize) this.view.pageSize.set(url.pageSize);
    this.view.page.set(url.page);
    this.query.set(url.q);
    this.restored.set(true);
  }

  private writeUrl(params: Record<string, string | null>): void {
    this.memory.queryParams = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null));
    if (sameListParams(params, this.route.snapshot.queryParams)) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: 'merge', replaceUrl: true });
  }

  // ---- 篩選 ----

  protected setFilters(filters: readonly FilterCondition[]): void {
    this.view.setFilters(filters);
  }

  protected setQuickStatus(status: string | null): void {
    const rest = this.view.filters().filter((c) => c.field !== 'status');
    this.view.setFilters(status ? [...rest, { field: 'status', type: 'multiSelect', values: [status] }] : rest);
  }

  protected setQuery(text: string): void {
    this.query.set(text);
    this.view.page.set(0);
  }

  protected clearFilters(): void {
    this.query.set('');
    this.view.setFilters([]);
  }

  // ---- 列與批次操作 ----

  protected create(): void {
    void this.router.navigate(['new'], { relativeTo: this.route });
  }

  protected open(ticket: Ticket): void {
    void this.router.navigate([ticket.id], { relativeTo: this.route });
  }

  protected async setStatus(status: TicketStatus): Promise<void> {
    const rows = this.selection();
    if (!rows.length || this.busy()) return;
    const snapshot = await this.mutate(() => this.repo.setStatus(rows.map((r) => r.id), status, ACTOR));
    await this.offerUndo(snapshot, `已把 ${rows.length} 張工單改成「${TICKET_STATUS_LABELS[status]}」`, '已復原狀態');
  }

  protected async removeSelected(rows: readonly Ticket[]): Promise<void> {
    if (!rows.length || this.busy()) return;
    const ok = await openConfirmDialog(this.injector, {
      title: `刪除 ${rows.length} 張工單？`,
      message:
        rows.length === 1
          ? `確定刪除「${rows[0].id} ${rows[0].title}」？`
          : `確定刪除選取的 ${rows.length} 張工單（${rows.slice(0, 3).map((r) => r.id).join('、')}${rows.length > 3 ? '…' : ''}）？`,
      confirmLabel: '刪除',
      cancelLabel: '取消',
    });
    if (!ok) return;
    const snapshot = await this.mutate(() => this.repo.remove(rows.map((r) => r.id)));
    await this.offerUndo(snapshot, `已刪除 ${rows.length} 張工單`, `已復原 ${rows.length} 張工單`);
  }

  /** 寫入資料、清掉選取、重新讀一次清單（不換成骨架）。 */
  private async mutate(write: () => Promise<TicketSnapshot>): Promise<TicketSnapshot> {
    this.busy.set(true);
    try {
      const snapshot = await write();
      this.selection.set([]);
      await this.load(true);
      return snapshot;
    } finally {
      this.busy.set(false);
    }
  }

  /** 做完提示「復原」：按下就把資料放回快照的樣子。 */
  private async offerUndo(snapshot: TicketSnapshot, done: string, undone: string): Promise<void> {
    const ref = this.toast.success(done, { action: '復原' });
    if (!(await ref.actionClicked)) return;
    await this.repo.restore(snapshot);
    await this.load(true);
    this.toast.info(undone);
  }

  // dtCell 的 let-r 是 any，經過有型別的方法取標籤。
  protected statusTone(ticket: Ticket): StatusKey {
    return TICKET_STATUS_TONES[ticket.status];
  }

  protected statusLabel(ticket: Ticket): string {
    return TICKET_STATUS_LABELS[ticket.status];
  }

  protected priorityLabel(ticket: Ticket): string {
    return TICKET_PRIORITY_LABELS[ticket.priority];
  }

  protected categoryLabel(ticket: Ticket): string {
    return TICKET_CATEGORY_LABELS[ticket.category];
  }

  protected assigneeName(ticket: Ticket): string {
    return this.repo.personName(ticket.assigneeId);
  }
}
