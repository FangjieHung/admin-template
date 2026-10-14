import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AccessService } from '@admin-template/access';
import {
  CalendarCategory,
  CalendarChangeFn,
  CalendarComponent,
  CalendarEvent,
  CalendarResource,
  CalendarSource,
  DescriptionItem,
  DescriptionListComponent,
  DescriptionValueDirective,
  ResponsivePanelComponent,
  StatusChipComponent,
  addDays,
  overlaps,
} from '@admin-template/ui';
import { provideHeaderTitle } from '../../layout/header/header-title';
import { HeaderToolbarDirective } from '../../layout/header/header-toolbar-slot';
import { TemplateInfo, TemplateInfoComponent } from '../../shared/ui/template-info.component';
import { CALENDAR_LABEL_PROVIDERS } from '../../shared/ui/calendar-labels';
import { DESCRIPTION_LIST_LABEL_PROVIDERS } from '../../shared/ui/detail-labels';
import { TOAST_PROVIDERS } from '../../shared/ui/component-label-providers';
import { TICKET_ASSIGNEES, toDateString } from '../tickets/data/ticket-demo-data';
import { formatDueDate, parseDueDate } from '../tickets/data/ticket-format';
import {
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONES,
  Ticket,
  TicketPriority,
} from '../tickets/data/ticket.model';
import { TicketRepository } from '../tickets/data/ticket.repository';

const ACTOR = { name: '你' };

/** 還沒指派的工單放在這一列（拖到這裡＝取消指派）。 */
export const UNASSIGNED_ROW = 'unassigned';

const INFO: TemplateInfo = {
  summary:
    '排程樣板：資源排程一列一位工程師（依組別分組），有期限的工單排在到期日。拖曳左右改期限、上下改負責人，存進工單資料層並寫一筆活動紀錄；失敗會還原。點工單在側邊看詳情。檢視者只能看。',
  components: [
    'lib-calendar（資源排程、月、議程；拖曳與鍵盤 Alt＋方向鍵）',
    'lib-responsive-panel＋lib-description-list（工單詳情）',
    'libs/access 的 AccessService（沒有「工單・編輯」時唯讀）',
  ],
  replace: [
    'features/tickets/data 的工單資料層（reschedule() 換成呼叫後端）',
    '負責人清單 TICKET_ASSIGNEES（換成真正的人員或設備）',
    '<app-template-info>（新專案用不到，連同 INFO 一起刪）',
  ],
  files: ['apps/admin/src/app/features/schedule/schedule-page.component.ts', 'apps/admin/src/app/features/tickets/data/ticket.repository.ts'],
};

/** 優先順序 → 圖表色（配色決定實際顏色）。 */
const PRIORITY_COLORS: Readonly<Record<TicketPriority, number>> = { low: 4, medium: 1, high: 5, urgent: 6 };

export const SCHEDULE_CATEGORIES: readonly CalendarCategory[] = (Object.keys(TICKET_PRIORITY_LABELS) as TicketPriority[]).map((p) => ({
  id: p,
  label: `${TICKET_PRIORITY_LABELS[p]}優先`,
  color: PRIORITY_COLORS[p],
}));

/** 工單 → 日曆活動：期限那天的整天活動，列在負責人那一列。已完成、已關閉的不能拖。 */
export function ticketToEvent(ticket: Ticket, canEdit: boolean): CalendarEvent<Ticket> | null {
  if (!ticket.dueDate) return null;
  const start = parseDueDate(ticket.dueDate);
  return {
    id: ticket.id,
    title: `${ticket.id} ${ticket.title}`,
    start,
    end: addDays(start, 1),
    allDay: true,
    resourceId: ticket.assigneeId ?? UNASSIGNED_ROW,
    category: ticket.priority,
    status: TICKET_STATUS_LABELS[ticket.status],
    editable: canEdit && ticket.status !== 'resolved' && ticket.status !== 'closed',
    meta: ticket,
  };
}

/** 排程（頁面樣板，/templates/schedule）。 */
@Component({
  selector: 'app-schedule-page',
  imports: [
    RouterLink,
    MatButtonModule,
    CalendarComponent,
    ResponsivePanelComponent,
    DescriptionListComponent,
    DescriptionValueDirective,
    StatusChipComponent,
    HeaderToolbarDirective,
    TemplateInfoComponent,
  ],
  providers: [...CALENDAR_LABEL_PROVIDERS, ...DESCRIPTION_LIST_LABEL_PROVIDERS, ...TOAST_PROVIDERS],
  templateUrl: './schedule-page.component.html',
  styleUrl: './schedule-page.component.scss',
})
export class SchedulePageComponent {
  protected readonly info = INFO;
  protected readonly categories = SCHEDULE_CATEGORIES;
  protected readonly statusTones = TICKET_STATUS_TONES;
  private readonly repo = inject(TicketRepository);
  private readonly access = inject(AccessService);

  protected readonly canEdit = computed(() => this.access.can('ticket:edit'));
  /** 最近一次載入或儲存後的工單（側邊面板讀這份）。 */
  private readonly tickets = signal<ReadonlyMap<string, Ticket>>(new Map());
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selected = computed(() => {
    const id = this.selectedId();
    return id ? (this.tickets().get(id) ?? null) : null;
  });

  /** 依組別排（組別照第一次出現的順序），最後一列是未指派。 */
  protected readonly resources: readonly CalendarResource[] = [
    ...[...new Set(TICKET_ASSIGNEES.map((p) => p.team))].flatMap((team) =>
      TICKET_ASSIGNEES.filter((p) => p.team === team).map((p) => ({ id: p.id, title: p.name, group: team })),
    ),
    { id: UNASSIGNED_ROW, title: '未指派', group: '待指派' },
  ];

  /** 依範圍載入：工單資料層一次給全部，這裡只留期限落在範圍內的。換成後端時改成帶範圍的查詢。 */
  protected readonly source = computed<CalendarSource>(() => {
    const canEdit = this.canEdit();
    return {
      list: async (range) => {
        const list = await this.repo.list();
        this.tickets.set(new Map(list.map((t) => [t.id, t])));
        return list
          .map((t) => ticketToEvent(t, canEdit))
          .filter((e): e is CalendarEvent<Ticket> => !!e && overlaps(e.start, e.end, range.start, range.end));
      },
    };
  });

  /** 拖曳：改負責人（換列）與期限（換日子），寫進資料層；失敗時日曆自己還原並提示。 */
  protected readonly save: CalendarChangeFn = async (change, signal) => {
    const assigneeId = change.event.resourceId === UNASSIGNED_ROW ? null : (change.event.resourceId ?? null);
    const saved = await this.repo.reschedule(change.event.id, { assigneeId, dueDate: toDateString(change.event.start) }, ACTOR, signal);
    this.tickets.update((map) => new Map(map).set(saved.id, saved));
  };

  protected readonly summary = computed<DescriptionItem[]>(() => {
    const t = this.selected();
    if (!t) return [];
    return [
      { label: '編號', value: t.id, copyable: true },
      { label: '狀態', value: TICKET_STATUS_LABELS[t.status], key: 'status' },
      { label: '優先順序', value: TICKET_PRIORITY_LABELS[t.priority] },
      { label: '負責人', value: this.repo.personName(t.assigneeId) || null },
      { label: '期限', value: formatDueDate(t.dueDate) || null },
      { label: '申請人', value: this.repo.personName(t.requesterId) },
    ];
  });

  constructor() {
    provideHeaderTitle(() => ({ title: '排程', breadcrumbs: [{ label: '頁面樣板' }] }));
  }

  protected open(event: CalendarEvent): void {
    this.selectedId.set(event.id);
  }
}
