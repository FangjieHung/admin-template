import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AccessService } from '@admin-template/access';
import {
  ErrorStateComponent,
  FilterOption,
  FilterSelectComponent,
  KanbanAddCardEvent,
  KanbanBoardComponent,
  KanbanCanMove,
  KanbanCardDirective,
  KanbanColumn,
  KanbanGroup,
  KanbanMoveEvent,
  KanbanMoveRejectedEvent,
  PageToolbarComponent,
  SkeletonComponent,
  ToastService,
  moveKanbanItem,
} from '@admin-template/ui';
import { provideHeaderTitle } from '../../../layout/header/header-title';
import { HeaderToolbarDirective } from '../../../layout/header/header-toolbar-slot';
import { FEEDBACK_STATE_LABEL_PROVIDERS, TOAST_PROVIDERS } from '../../../shared/ui/component-label-providers';
import { KANBAN_LABEL_PROVIDERS } from '../../../shared/ui/kanban-labels';
import { LIST_TOOLBAR_LABEL_PROVIDERS } from '../../../shared/ui/list-toolbar-labels';
import { TemplateInfo, TemplateInfoComponent } from '../../../shared/ui/template-info.component';
import { UserPreferencesStore } from '../../../core/user-preferences';
import { TICKET_ASSIGNEES } from '../data/ticket-demo-data';
import { formatDueDate, isOverdue } from '../data/ticket-format';
import {
  TICKET_PRIORITY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  Ticket,
  TicketPriority,
  TicketStatus,
} from '../data/ticket.model';
import { TicketRepository } from '../data/ticket.repository';
import { TicketListMemory } from '../ticket-list/ticket-list-url';

type LoadState = 'loading' | 'ready' | 'error';
type GroupMode = 'none' | 'assignee';

/** 分組模式裡「未指派」那一道的 id（也是負責人篩選的「未指派」選項）。 */
export const UNASSIGNED = 'unassigned';
/** 活動紀錄的操作者：目前的使用者，摘要寫成「你 把狀態從…」。 */
const ACTOR = { name: '你' };

/** 結案（已完成、已關閉）一定要有負責人。 */
const NEEDS_ASSIGNEE: readonly string[] = ['resolved', 'closed'];

const INFO: TemplateInfo = {
  summary:
    '看板樣板：跟工單列表同一份資料，依狀態分欄。拖曳（或 Alt＋方向鍵、卡片的「移動」選單）換狀態，依負責人分組時換道就是改負責人，都寫回工單資料並記一筆活動紀錄，列表與詳情看到的一樣。篩選負責人、優先順序與關鍵字；點卡片標題打開工單詳情；「待處理」欄底直接新增工單。沒有「工單・編輯」只能看。',
  components: [
    'lib-kanban-board（分欄、分組／泳道、拖曳、鍵盤、移動選單、新增卡片、窄版一次一欄）',
    'lib-page-toolbar、lib-filter-select（頁首的關鍵字、負責人、優先順序）',
    'lib-toast（被擋下的原因、儲存失敗）、lib-skeleton、lib-error-state',
    'libs/access 的 AccessService（沒有「工單・編輯」時唯讀、沒有「工單・建立」時不能新增）',
  ],
  replace: [
    'ticket.repository.ts：setStatus()、assign()、quickCreate() 換成呼叫後端',
    '本頁的 canMove（示範規則：結案的工單要有負責人）與欄位（TICKET_STATUSES）',
    '欄內的順序只在這一頁有效（示範資料沒有排序欄位）；要保存就在後端加排序欄位，(moved) 時一起送出',
    '<app-template-info>（新專案用不到，連同 INFO 一起刪）',
  ],
  files: [
    'apps/admin/src/app/features/tickets/ticket-board/',
    'apps/admin/src/app/features/tickets/data/ticket.repository.ts',
    'apps/admin/src/app/features/tickets/tickets.routes.ts',
  ],
};

/**
 * 工單看板（頁面樣板，/templates/tickets/board）：工單列表的另一種檢視，資料與列表、詳情共用 TicketRepository。
 * 篩選與分組寫在網址上（?q=、?assignee=、?priority=、?group=assignee），從詳情頁返回時還原。
 */
@Component({
  selector: 'app-ticket-board-page',
  imports: [
    RouterLink,
    MatButtonModule,
    KanbanBoardComponent,
    KanbanCardDirective,
    PageToolbarComponent,
    FilterSelectComponent,
    SkeletonComponent,
    ErrorStateComponent,
    HeaderToolbarDirective,
    TemplateInfoComponent,
  ],
  providers: [...KANBAN_LABEL_PROVIDERS, ...LIST_TOOLBAR_LABEL_PROVIDERS, ...FEEDBACK_STATE_LABEL_PROVIDERS, ...TOAST_PROVIDERS],
  templateUrl: './ticket-board-page.component.html',
  styleUrl: './ticket-board-page.component.scss',
})
export class TicketBoardPageComponent {
  protected readonly info = INFO;
  private readonly repo = inject(TicketRepository);
  private readonly access = inject(AccessService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly memory = inject(TicketListMemory);
  private readonly prefs = inject(UserPreferencesStore);

  protected readonly canEdit = computed(() => this.access.can('ticket:edit'));
  protected readonly canCreate = computed(() => this.access.can('ticket:create'));
  protected readonly loadState = signal<LoadState>('loading');
  protected readonly tickets = signal<Ticket[]>([]);

  // ---- 篩選與分組（寫在網址上） ----
  protected readonly query = signal('');
  protected readonly assignee = signal<string | null>(null);
  protected readonly priority = signal<TicketPriority | null>(null);
  protected readonly groupMode = signal<GroupMode>('none');
  protected readonly collapsed = signal<readonly string[]>([]);

  protected readonly assigneeOptions: FilterOption<string>[] = [
    ...TICKET_ASSIGNEES.map((p) => ({ value: p.id, label: p.name })),
    { value: UNASSIGNED, label: '未指派' },
  ];
  protected readonly priorityOptions: FilterOption<TicketPriority>[] = (
    Object.entries(TICKET_PRIORITY_LABELS) as [TicketPriority, string][]
  ).map(([value, label]) => ({ value, label }));
  protected readonly groupOptions: readonly { id: GroupMode; label: string }[] = [
    { id: 'none', label: '不分組' },
    { id: 'assignee', label: '負責人' },
  ];
  protected readonly priorityLabels = TICKET_PRIORITY_LABELS;

  protected readonly columns = computed<KanbanColumn[]>(() =>
    TICKET_STATUSES.map((status) => ({
      id: status,
      title: TICKET_STATUS_LABELS[status],
      allowAdd: status === 'open' && this.canCreate(),
      ...(status === 'waiting' ? { hint: '等申請人回覆或補資料' } : {}),
    })),
  );

  protected readonly filterCount = computed(() => (this.assignee() ? 1 : 0) + (this.priority() ? 1 : 0));

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLocaleLowerCase();
    const assignee = this.assignee();
    const priority = this.priority();
    return this.tickets().filter(
      (t) =>
        (!q || t.id.toLocaleLowerCase().includes(q) || t.title.toLocaleLowerCase().includes(q)) &&
        (!assignee || (t.assigneeId ?? UNASSIGNED) === assignee) &&
        (!priority || t.priority === priority),
    );
  });

  /** 依負責人分組的道：篩選了負責人就只有那一道；否則全部負責人（沒有卡片也顯示，可以拖進去）＋未指派。 */
  protected readonly groups = computed<KanbanGroup[]>(() => {
    const all: KanbanGroup[] = [
      ...TICKET_ASSIGNEES.map((p) => ({ id: p.id, title: p.name })),
      { id: UNASSIGNED, title: '未指派' },
    ];
    const only = this.assignee();
    return only ? all.filter((g) => g.id === only) : all;
  });

  protected readonly countText = computed(() => {
    if (this.loadState() !== 'ready') return '';
    const shown = this.visible().length;
    const total = this.tickets().length;
    return shown === total ? `共 ${total} 張工單` : `符合條件 ${shown} 張（共 ${total} 張）`;
  });

  protected readonly key = (t: Ticket) => t.id;
  protected readonly column = (t: Ticket) => t.status;
  protected readonly title = (t: Ticket) => `${t.id} ${t.title}`;
  protected readonly owner = (t: Ticket) => t.assigneeId ?? UNASSIGNED;
  protected readonly formatDueDate = (value: string | null) => formatDueDate(value, this.prefs.dateFormat());
  protected readonly isOverdue = isOverdue;
  protected readonly repoName = (id: string) => this.repo.personName(id);

  /** 示範規則：已完成、已關閉的工單一定要有負責人（分組模式看換道之後的負責人）。 */
  protected readonly canMove: KanbanCanMove<Ticket> = (ticket, _from, to, groups) => {
    const owner = groups ? groups.toGroupId : (ticket.assigneeId ?? UNASSIGNED);
    if (NEEDS_ASSIGNEE.includes(to) && owner === UNASSIGNED) {
      return `「${ticket.id}」還沒有負責人，指派之後才能移到「${TICKET_STATUS_LABELS[to as TicketStatus]}」`;
    }
    return true;
  };

  constructor() {
    provideHeaderTitle(() => ({ title: '工單看板', breadcrumbs: [{ label: '頁面樣板' }, { label: '工單', route: '/templates/tickets' }] }));
    // 從看板打開的工單，詳情頁的返回連結回到看板。
    this.memory.origin = 'board';
    this.readUrl();
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loadState.set('loading');
    try {
      this.tickets.set(await this.repo.list());
      this.loadState.set('ready');
    } catch {
      this.loadState.set('error');
    }
  }

  // ---- 篩選 ----

  protected setQuery(q: string): void {
    this.query.set(q);
    this.writeUrl();
  }

  protected setAssignee(value: string | null): void {
    this.assignee.set(value);
    this.writeUrl();
  }

  protected setPriority(value: TicketPriority | null): void {
    this.priority.set(value);
    this.writeUrl();
  }

  protected setGroupMode(mode: GroupMode): void {
    this.groupMode.set(mode);
    this.writeUrl();
  }

  protected clearFilters(): void {
    this.query.set('');
    this.assignee.set(null);
    this.priority.set(null);
    this.writeUrl();
  }

  // ---- 移動與新增：先改畫面，寫回資料層；失敗時重新載入並提示 ----

  protected async onMoved(event: KanbanMoveEvent<Ticket>): Promise<void> {
    const id = event.item.id;
    const assigneeId = event.toGroupId === undefined || event.toGroupId === UNASSIGNED ? null : event.toGroupId;
    this.tickets.update((list) =>
      moveKanbanItem(list, event, {
        key: this.key,
        column: this.column,
        withColumn: (t, status) => ({ ...t, status: status as TicketStatus }),
        group: this.owner,
        withGroup: (t) => ({ ...t, assigneeId }),
      }),
    );
    try {
      if (event.fromColumnId !== event.toColumnId) await this.repo.setStatus([id], event.toColumnId as TicketStatus, ACTOR);
      if (event.toGroupId !== undefined && event.fromGroupId !== event.toGroupId) await this.repo.assign(id, assigneeId, ACTOR);
    } catch {
      this.toast.error(`「${id}」沒有存成功，已重新載入看板`);
      await this.load();
    }
  }

  protected onRejected(event: KanbanMoveRejectedEvent<Ticket>): void {
    this.toast.warning(event.reason);
  }

  protected async onAdd(event: KanbanAddCardEvent): Promise<void> {
    const assigneeId = !event.groupId || event.groupId === UNASSIGNED ? null : event.groupId;
    try {
      const created = await this.repo.quickCreate(event.title, { assigneeId }, ACTOR);
      this.tickets.update((list) => [created, ...list]);
      this.toast.success(`已新增工單 ${created.id}`);
    } catch {
      this.toast.error('新增工單失敗，請再試一次');
    }
  }

  // ---- 網址 ----

  private readUrl(): void {
    const params = this.route.snapshot.queryParamMap;
    this.query.set(params.get('q') ?? '');
    const assignee = params.get('assignee');
    this.assignee.set(assignee && this.assigneeOptions.some((o) => o.value === assignee) ? assignee : null);
    const priority = params.get('priority') as TicketPriority | null;
    this.priority.set(priority && priority in TICKET_PRIORITY_LABELS ? priority : null);
    this.groupMode.set(params.get('group') === 'assignee' ? 'assignee' : 'none');
    this.memory.boardParams = this.params();
  }

  private params(): Record<string, string> {
    const params: Record<string, string> = {};
    if (this.query().trim()) params['q'] = this.query().trim();
    if (this.assignee()) params['assignee'] = this.assignee()!;
    if (this.priority()) params['priority'] = this.priority()!;
    if (this.groupMode() === 'assignee') params['group'] = 'assignee';
    return params;
  }

  private writeUrl(): void {
    const params = this.params();
    this.memory.boardParams = params;
    void this.router.navigate([], { relativeTo: this.route, queryParams: params, replaceUrl: true });
  }
}
