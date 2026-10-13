import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccessService } from '@admin-template/access';
import {
  BarChartComponent,
  DonutChartComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  LineChartComponent,
  SkeletonComponent,
  StatCardComponent,
  StatusChipComponent,
} from '@admin-template/ui';
import { provideHeaderTitle } from '../../layout/header/header-title';
import { HeaderToolbarDirective } from '../../layout/header/header-toolbar-slot';
import { CHART_LABEL_PROVIDERS } from '../../shared/ui/chart-labels';
import { FEEDBACK_STATE_LABEL_PROVIDERS } from '../../shared/ui/component-label-providers';
import { TemplateInfo, TemplateInfoComponent } from '../../shared/ui/template-info.component';
import { TICKET_ASSIGNEES } from '../tickets/data/ticket-demo-data';
import { formatDueDate, isOverdue } from '../tickets/data/ticket-format';
import { TICKET_STATUS_LABELS, TICKET_STATUS_TONES, Ticket } from '../tickets/data/ticket.model';
import { TICKET_DEMO_TODAY, TicketRepository } from '../tickets/data/ticket.repository';
import {
  DASHBOARD_PERIODS,
  DEFAULT_PERIOD,
  DashboardPeriod,
  OPEN_STATUSES,
  computeDashboard,
  myTodo,
  myTodoListParams,
  parsePeriod,
} from './dashboard-stats';

/** 待辦清單顯示幾筆。 */
export const TODO_LIMIT = 5;

const INFO: TemplateInfo = {
  summary: '儀表板樣板：期間切換（寫在網址上）、4 張數字小卡、新增與結案趨勢、依狀態與分類的分布，以及指派給目前使用者的待辦。',
  components: [
    'lib-stat-card（變化、迷你趨勢、整張卡連到列表）',
    'lib-line-chart、lib-donut-chart、lib-bar-chart（橫式堆疊）',
    'lib-status-chip、lib-empty-state、lib-error-state',
  ],
  replace: [
    'dashboard-stats.ts：統計改成呼叫後端的統計 API（資料量大時不要在前端算）',
    'ticket.repository.ts 的 list()、resolvedTimes()',
    '「指派給我」的判斷（示範是用目前身分的姓名對負責人）',
    '網址的 ?demo=error（示範載入失敗）',
  ],
  files: ['apps/admin/src/app/features/dashboard/', 'apps/admin/src/app/features/tickets/data/'],
};

type LoadState = 'loading' | 'ready' | 'error';

/**
 * 儀表板（頁面樣板，/templates/dashboard）：資料由工單 repository 算出。期間（7 天／30 天／本季）同步到
 * `?period=`（預設 7 天不寫）；待辦點了進工單詳情，「查看全部」連到帶篩選的工單列表。檢視者也看得到。
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink,
    StatCardComponent,
    LineChartComponent,
    DonutChartComponent,
    BarChartComponent,
    StatusChipComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    HeaderToolbarDirective,
    TemplateInfoComponent,
  ],
  providers: [...CHART_LABEL_PROVIDERS, ...FEEDBACK_STATE_LABEL_PROVIDERS],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
})
export class DashboardPageComponent {
  private readonly repo = inject(TicketRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly access = inject(AccessService);
  private readonly today = inject(TICKET_DEMO_TODAY)();

  protected readonly info = INFO;
  protected readonly periods = DASHBOARD_PERIODS;
  protected readonly integer: Intl.NumberFormatOptions = { maximumFractionDigits: 0 };
  protected readonly statusLabels = TICKET_STATUS_LABELS;
  protected readonly statusTones = TICKET_STATUS_TONES;
  protected readonly formatDueDate = formatDueDate;

  protected readonly loadState = signal<LoadState>('loading');
  private readonly tickets = signal<readonly Ticket[]>([]);
  private readonly resolved = signal<ReadonlyMap<string, string>>(new Map());

  protected readonly period = signal<DashboardPeriod>(parsePeriod(this.route.snapshot.queryParamMap.get('period')));
  protected readonly periodOption = computed(() => this.periods.find((p) => p.id === this.period()) ?? this.periods[0]);

  protected readonly stats = computed(() => computeDashboard(this.tickets(), this.resolved(), this.period(), this.today));
  protected readonly loading = computed(() => this.loadState() === 'loading');

  /** 目前身分對到的負責人（示範：用姓名對；對不到就沒有待辦）。 */
  private readonly me = computed(() => {
    const name = this.access.currentUser()?.name;
    return TICKET_ASSIGNEES.find((p) => p.name === name)?.id ?? null;
  });
  private readonly todoAll = computed(() => myTodo(this.tickets(), this.me(), this.today));
  protected readonly todo = computed(() => this.todoAll().slice(0, TODO_LIMIT));
  protected readonly todoCount = computed(() => this.todoAll().length);
  protected readonly todoParams = computed(() => {
    const me = this.me();
    return me ? myTodoListParams(me) : null;
  });
  /** 「未結案」小卡連到只看未結案的工單列表。 */
  protected readonly openListParams = {
    f: JSON.stringify([{ field: 'status', type: 'multiSelect', values: [...OPEN_STATUSES] }]),
  };

  constructor() {
    provideHeaderTitle(() => ({ title: '儀表板', breadcrumbs: [{ label: '頁面樣板' }] }));
    // 瀏覽器的上一頁／下一頁改了網址時，期間跟著變。
    const sub = this.route.queryParamMap.subscribe((params) => this.period.set(parsePeriod(params.get('period'))));
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loadState.set('loading');
    try {
      const demoError = this.route.snapshot.queryParamMap.get('demo') === 'error';
      const [tickets, resolved] = await Promise.all([this.repo.list({ simulateError: demoError }), this.repo.resolvedTimes()]);
      this.tickets.set(tickets);
      this.resolved.set(resolved);
      this.loadState.set('ready');
    } catch {
      this.loadState.set('error');
    }
  }

  protected async retry(): Promise<void> {
    if (this.route.snapshot.queryParamMap.get('demo') === 'error') {
      await this.router.navigate([], { relativeTo: this.route, queryParams: { demo: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
    await this.load();
  }

  protected setPeriod(period: DashboardPeriod): void {
    if (period === this.period()) return;
    this.period.set(period);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { period: period === DEFAULT_PERIOD ? null : period },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected overdue(ticket: Ticket): boolean {
    return isOverdue(ticket.dueDate, ticket.status, this.today);
  }

  protected assigneeLabel(): string {
    return this.access.currentUser()?.name ?? '';
  }
}
