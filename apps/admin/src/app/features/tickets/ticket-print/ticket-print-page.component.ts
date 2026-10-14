import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ActivityEntry,
  EmptyStateComponent,
  ErrorStateComponent,
  PrintDocumentComponent,
  PrintTableColumn,
  PrintTableComponent,
  SkeletonComponent,
} from '@admin-template/ui';
import { fmtDate } from '../../../core/date-utils';
import { provideHeaderTitle } from '../../../layout/header/header-title';
import { HeaderToolbarDirective } from '../../../layout/header/header-toolbar-slot';
import { FEEDBACK_STATE_LABEL_PROVIDERS } from '../../../shared/ui/component-label-providers';
import { PRINT_DOCUMENT_LABEL_PROVIDERS } from '../../../shared/ui/print-document-labels';
import { TemplateInfo, TemplateInfoComponent } from '../../../shared/ui/template-info.component';
import { formatDueDate } from '../data/ticket-format';
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  Ticket,
} from '../data/ticket.model';
import { TicketRepository } from '../data/ticket.repository';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

const INFO: TemplateInfo = {
  summary: '列印樣板：用 lib-print-document 把一張工單排成「工單服務單」，可以直接列印或另存為 PDF 交給申請人簽收。',
  components: [
    'lib-print-document（頁首、資訊區、備註、簽名欄、頁尾；列印時只印服務單）',
    'lib-print-table（服務紀錄，表頭每頁重印）',
    'lib-skeleton、lib-empty-state、lib-error-state',
  ],
  replace: [
    'ticket.repository.ts：get()、activity() 換成呼叫後端',
    '資訊區的欄位與服務紀錄的欄位（infoItems、RECORD_COLUMNS）',
    '頁首的單位名稱與頁尾說明',
  ],
  files: ['apps/admin/src/app/features/tickets/ticket-print/', 'apps/admin/src/app/features/tickets/data/'],
};

const pad = (n: number) => String(n).padStart(2, '0');

/** 列印用的完整日期時間「YYYY/MM/DD HH:mm」（紙本要看得出年份，不省略同年）。 */
function fullDateTime(at: Date | string): string {
  const d = new Date(at);
  return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const RECORD_COLUMNS: readonly PrintTableColumn<ActivityEntry>[] = [
  { key: 'no', label: '#', align: 'center', width: '9mm', value: (_row, i) => i + 1 },
  { key: 'at', label: '時間', width: '33mm', value: (row) => fullDateTime(row.at) },
  { key: 'actor', label: '處理人', width: '22mm', value: (row) => row.actor?.name ?? '系統' },
  { key: 'summary', label: '內容' },
];

/**
 * 工單服務單（頁面樣板，/templates/tickets/:id/print）：從詳情頁的「列印」按鈕進來。
 * 資料來自同一個工單 repository；服務紀錄依時間由舊到新排列。
 */
@Component({
  selector: 'app-ticket-print-page',
  imports: [
    RouterLink,
    PrintDocumentComponent,
    PrintTableComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    HeaderToolbarDirective,
    TemplateInfoComponent,
  ],
  providers: [...PRINT_DOCUMENT_LABEL_PROVIDERS, ...FEEDBACK_STATE_LABEL_PROVIDERS],
  templateUrl: './ticket-print-page.component.html',
  styleUrl: './ticket-print-page.component.scss',
})
export class TicketPrintPageComponent {
  private readonly repo = inject(TicketRepository);
  private readonly router = inject(Router);

  protected readonly info = INFO;
  protected readonly columns = RECORD_COLUMNS;
  protected readonly ticketId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  protected readonly state = signal<LoadState>('loading');
  protected readonly ticket = signal<Ticket | null>(null);
  /** 服務紀錄：由舊到新。 */
  protected readonly records = signal<readonly ActivityEntry[]>([]);
  /** 列印日期與時間（開啟這一頁的時間）。 */
  protected readonly printedAt = new Date();
  protected readonly printDate = fmtDate(this.printedAt);
  protected readonly printedAtText = fullDateTime(this.printedAt);

  protected readonly infoItems = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    const requester = this.repo.person(t.requesterId);
    return [
      { label: '狀態', value: TICKET_STATUS_LABELS[t.status] },
      { label: '優先順序', value: TICKET_PRIORITY_LABELS[t.priority] },
      { label: '分類', value: TICKET_CATEGORY_LABELS[t.category] },
      { label: '附件', value: t.attachmentCount ? `${t.attachmentCount} 個` : '無' },
      { label: '申請人', value: requester ? `${requester.name}（${requester.team}）` : t.requesterId },
      { label: '負責人', value: this.repo.personName(t.assigneeId) || '尚未指派' },
      { label: '建立時間', value: fullDateTime(t.createdAt), numeric: true },
      { label: '期限', value: formatDueDate(t.dueDate) || '無', numeric: true },
    ];
  });

  constructor() {
    provideHeaderTitle(() => ({
      title: `列印工單 ${this.ticketId}`,
      breadcrumbs: [
        { label: '頁面樣板' },
        { label: '工單', route: '/templates/tickets' },
        { label: this.ticketId, route: `/templates/tickets/${this.ticketId}` },
      ],
    }));
    void this.load();
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    try {
      const [ticket, activity] = await Promise.all([this.repo.get(this.ticketId), this.repo.activity(this.ticketId)]);
      this.ticket.set(ticket);
      this.records.set([...activity].reverse());
      this.state.set(ticket ? 'ready' : 'not-found');
    } catch {
      this.state.set('error');
    }
  }

  protected backToList(): void {
    void this.router.navigate(['/templates/tickets']);
  }
}
