import { Component, Injector, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { AccessService, CanDirective } from '@admin-template/access';
import {
  ActivityEntry,
  ActivityTimelineComponent,
  CommentDeleteEvent,
  CommentEditEvent,
  CommentItem,
  CommentSubmitEvent,
  CommentThreadComponent,
  DescriptionItem,
  DescriptionListComponent,
  DescriptionValueDirective,
  DetailActionDirective,
  DetailActionsDirective,
  DetailAsideDirective,
  DetailLayoutComponent,
  DetailTitleDirective,
  EmptyStateComponent,
  ErrorStateComponent,
  MentionSource,
  StatusChipComponent,
  ToastService,
  mentionIdsOf,
  openConfirmDialog,
} from '@admin-template/ui';
import { NotificationCenterService } from '../../../core/notifications/notification-center.service';
import { provideHeaderTitle } from '../../../layout/header/header-title';
import { HeaderToolbarDirective } from '../../../layout/header/header-toolbar-slot';
import {
  CONFIRM_DIALOG_LABEL_PROVIDERS,
  FEEDBACK_STATE_LABEL_PROVIDERS,
  TOAST_PROVIDERS,
} from '../../../shared/ui/component-label-providers';
import {
  ACTIVITY_TIMELINE_LABEL_PROVIDERS,
  DESCRIPTION_LIST_LABEL_PROVIDERS,
  DETAIL_LAYOUT_LABEL_PROVIDERS,
} from '../../../shared/ui/detail-labels';
import { RELATION_SELECT_LABEL_PROVIDERS } from '../../../shared/ui/relation-select-labels';
import { RICH_TEXT_LABEL_PROVIDERS } from '../../../shared/ui/rich-text-labels';
import { TemplateInfo, TemplateInfoComponent } from '../../../shared/ui/template-info.component';
import { TICKET_MENTION_PEOPLE } from '../data/ticket-comment-demo-data';
import { TICKET_ACTIVITY_KINDS } from '../data/ticket-demo-data';
import { formatCreatedAt, formatDueDate, isOverdue } from '../data/ticket-format';
import { UserPreferencesStore } from '../../../core/user-preferences';
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONES,
  Ticket,
} from '../data/ticket.model';
import { TicketRepository } from '../data/ticket.repository';
import { TicketListMemory } from '../ticket-list/ticket-list-url';
import {
  TicketAssignDialogComponent,
  TicketAssignDialogData,
  TicketAssignDialogResult,
} from './ticket-assign-dialog.component';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';
type DetailTab = 'overview' | 'activity';

const ACTOR = { name: '你' };

const INFO: TemplateInfo = {
  summary: '詳情頁樣板：一張工單的標題、狀態、動作、分頁與摘要。編輯、指派、關閉、刪除都會記進活動紀錄；找不到工單時顯示專屬畫面。',
  components: [
    'lib-detail-layout（返回、標題、資訊列、動作與「更多」、分頁、摘要側欄、捲動後的精簡頁首）',
    'lib-comment-thread（留言：@提及同事會送一則通知到頁首的鈴鐺；示範的通知中心不分使用者）',
    'lib-description-list（概覽與摘要）、lib-activity-timeline（活動紀錄）',
    'lib-relation-select（指派對話框）、確認對話框、lib-toast、lib-empty-state、lib-error-state',
    'libs/access 的 *libCan（檢視者看不到編輯、指派、關閉、刪除）',
    '「列印」連到工單服務單（/templates/tickets/:id/print，lib-print-document）',
  ],
  replace: [
    'ticket.repository.ts：get()、activity()、assign()、setStatus()、remove() 換成呼叫後端',
    '概覽與摘要的欄位（overviewItems、summaryItems）',
    '活動紀錄的種類對照（TICKET_ACTIVITY_KINDS）',
    'ticket.repository.ts 的 comments()、addComment()、editComment()、removeComment()，與提及名單（TICKET_MENTION_PEOPLE）；@提及的通知改由後端送出',
  ],
  files: [
    'apps/admin/src/app/features/tickets/ticket-detail/',
    'apps/admin/src/app/features/tickets/data/',
  ],
};

/**
 * 工單詳情（頁面樣板，/templates/tickets/:id）：返回列表會帶著列表的篩選與頁碼（TicketListMemory）；從看板打開時改成返回看板。
 * 表單存檔後導回這一頁，提示由表單頁顯示。
 */
@Component({
  selector: 'app-ticket-detail-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatTabsModule,
    CanDirective,
    DetailLayoutComponent,
    DetailTitleDirective,
    DetailActionsDirective,
    DetailActionDirective,
    DetailAsideDirective,
    DescriptionListComponent,
    DescriptionValueDirective,
    ActivityTimelineComponent,
    CommentThreadComponent,
    StatusChipComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    HeaderToolbarDirective,
    TemplateInfoComponent,
  ],
  providers: [
    ...DETAIL_LAYOUT_LABEL_PROVIDERS,
    ...DESCRIPTION_LIST_LABEL_PROVIDERS,
    ...ACTIVITY_TIMELINE_LABEL_PROVIDERS,
    ...FEEDBACK_STATE_LABEL_PROVIDERS,
    ...CONFIRM_DIALOG_LABEL_PROVIDERS,
    ...RELATION_SELECT_LABEL_PROVIDERS,
    ...RICH_TEXT_LABEL_PROVIDERS,
    ...TOAST_PROVIDERS,
  ],
  templateUrl: './ticket-detail-page.component.html',
  styleUrl: './ticket-detail-page.component.scss',
})
export class TicketDetailPageComponent {
  private readonly repo = inject(TicketRepository);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly access = inject(AccessService);
  private readonly notifications = inject(NotificationCenterService);
  private readonly memory = inject(TicketListMemory);
  /** 返回連結：從看板打開的回到看板（帶著看板的篩選與分組），其他回到列表（帶著列表的篩選與頁碼）。 */
  protected readonly back =
    this.memory.origin === 'board'
      ? { path: '/templates/tickets/board', params: this.memory.boardParams, label: '返回工單看板', action: '回到工單看板' }
      : { path: '/templates/tickets', params: this.memory.queryParams, label: '返回工單列表', action: '回到工單列表' };

  protected readonly info = INFO;
  protected readonly kinds = TICKET_ACTIVITY_KINDS;
  protected readonly statusLabels = TICKET_STATUS_LABELS;
  protected readonly statusTones = TICKET_STATUS_TONES;
  /** 日期跟著設定頁「偏好」的日期格式。 */
  private readonly prefs = inject(UserPreferencesStore);
  protected readonly formatCreatedAt = (iso: string) => formatCreatedAt(iso, new Date(), this.prefs.dateFormat());
  private readonly dueText = (value: string | null) => formatDueDate(value, this.prefs.dateFormat());

  protected readonly state = signal<LoadState>('loading');
  protected readonly ticket = signal<Ticket | null>(null);
  protected readonly activity = signal<readonly ActivityEntry[]>([]);
  protected readonly comments = signal<readonly CommentItem[]>([]);
  /** 留言的作者：目前登入的示範身分（libs/access）。 */
  protected readonly me = computed(() => {
    const user = this.access.currentUser();
    return user ? { id: user.id, name: user.name } : null;
  });
  /** 能編輯工單的人才能留言（檢視者只能看）。 */
  protected readonly canComment = computed(() => !!this.me() && this.access.can('ticket:edit'));
  protected readonly mentionSource: MentionSource = async (query) => {
    const q = query.trim().toLocaleLowerCase();
    return TICKET_MENTION_PEOPLE.filter((p) => !q || p.name.includes(q) || (p.description ?? '').toLocaleLowerCase().includes(q)).slice(0, 8);
  };
  protected readonly tab = signal<DetailTab>('overview');
  protected readonly busy = signal(false);
  /** 路由參數 :id。換一張工單時 Router 會重建這個元件，所以讀一次就好。 */
  protected readonly ticketId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly compactTitle = computed(() => {
    const t = this.ticket();
    return t ? `${t.id} ${t.title}` : '';
  });
  protected readonly requesterName = computed(() => this.repo.personName(this.ticket()?.requesterId ?? null));

  protected readonly summaryItems = computed<DescriptionItem[]>(() => {
    const t = this.ticket();
    if (!t) return [];
    const requester = this.repo.person(t.requesterId);
    return [
      { label: '編號', value: t.id, copyable: true },
      { label: '狀態', value: TICKET_STATUS_LABELS[t.status], key: 'status' },
      { label: '優先順序', value: TICKET_PRIORITY_LABELS[t.priority] },
      { label: '負責人', value: this.repo.personName(t.assigneeId) || null, hint: t.assigneeId ? undefined : '尚未指派' },
      { label: '申請人', value: requester?.name ?? t.requesterId, hint: requester?.team },
      {
        label: '期限',
        value: this.dueText(t.dueDate) || null,
        hint: isOverdue(t.dueDate, t.status) ? '已逾期' : undefined,
      },
    ];
  });

  protected readonly overviewItems = computed<DescriptionItem[]>(() => {
    const t = this.ticket();
    if (!t) return [];
    return [
      { label: '分類', value: TICKET_CATEGORY_LABELS[t.category] },
      { label: '優先順序', value: TICKET_PRIORITY_LABELS[t.priority] },
      { label: '負責人', value: this.repo.personName(t.assigneeId) || null },
      { label: '申請人', value: this.requesterName() },
      { label: '建立時間', value: this.formatCreatedAt(t.createdAt) },
      { label: '期限', value: this.dueText(t.dueDate) || null },
      { label: '附件', value: t.attachmentCount ? `${t.attachmentCount} 個` : null },
    ];
  });

  constructor() {
    provideHeaderTitle(() => ({
      title: this.ticket() ? `工單 ${this.ticket()?.id}` : '工單',
      breadcrumbs: [{ label: '頁面樣板' }, { label: '工單', route: '/templates/tickets' }],
    }));
    void this.load();
  }

  protected async load(): Promise<void> {
    const id = this.ticketId;
    this.state.set('loading');
    try {
      const [ticket, activity, comments] = await Promise.all([this.repo.get(id), this.repo.activity(id), this.repo.comments(id)]);
      this.ticket.set(ticket);
      this.activity.set(activity);
      this.comments.set(comments);
      this.state.set(ticket ? 'ready' : 'not-found');
    } catch {
      this.state.set('error');
    }
  }

  /** 做完動作後重新讀一次（不換成骨架）。 */
  private async refresh(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const [ticket, activity] = await Promise.all([this.repo.get(t.id), this.repo.activity(t.id)]);
    this.ticket.set(ticket);
    this.activity.set(activity);
    if (!ticket) this.state.set('not-found');
  }

  protected backToList(): void {
    void this.router.navigate([this.back.path], { queryParams: this.back.params });
  }

  protected async assign(): Promise<void> {
    const t = this.ticket();
    if (!t || this.busy()) return;
    const data: TicketAssignDialogData = { ticketId: t.id, title: t.title, assigneeId: t.assigneeId };
    const ref = this.dialog.open<TicketAssignDialogComponent, TicketAssignDialogData, TicketAssignDialogResult>(
      TicketAssignDialogComponent,
      { data, injector: this.injector, width: '28rem', maxWidth: 'calc(100vw - 2rem)', autoFocus: 'first-tabbable' },
    );
    const result = await new Promise<TicketAssignDialogResult | undefined>((resolve) => ref.afterClosed().subscribe(resolve));
    if (!result) return;
    await this.run(() => this.repo.assign(t.id, result.assigneeId, ACTOR));
    const name = this.repo.personName(result.assigneeId);
    this.toast.success(name ? `已指派給 ${name}` : '已取消指派');
  }

  protected async close(): Promise<void> {
    const t = this.ticket();
    if (!t || this.busy()) return;
    const ok = await openConfirmDialog(this.injector, {
      title: '關閉工單？',
      message: `關閉後「${t.id} ${t.title}」不會再出現在待處理的清單裡；之後仍然可以重新開啟。`,
      confirmLabel: '關閉工單',
      cancelLabel: '取消',
      tone: 'primary',
    });
    if (!ok) return;
    const snapshot = await this.run(() => this.repo.setStatus([t.id], 'closed', ACTOR));
    const ref = this.toast.success(`已關閉工單 ${t.id}`, { action: '復原' });
    if (await ref.actionClicked) {
      await this.repo.restore(snapshot);
      await this.refresh();
      this.toast.info('已復原狀態');
    }
  }

  protected async reopen(): Promise<void> {
    const t = this.ticket();
    if (!t || this.busy()) return;
    await this.run(() => this.repo.setStatus([t.id], 'open', ACTOR));
    this.toast.success(`已重新開啟工單 ${t.id}`);
  }

  protected async remove(): Promise<void> {
    const t = this.ticket();
    if (!t || this.busy()) return;
    const ok = await openConfirmDialog(this.injector, {
      title: '刪除工單？',
      message: `確定刪除「${t.id} ${t.title}」？活動紀錄會一起刪除。`,
      confirmLabel: '刪除',
      cancelLabel: '取消',
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      await this.repo.remove([t.id]);
      this.toast.success(`已刪除工單 ${t.id}`);
      this.backToList();
    } finally {
      this.busy.set(false);
    }
  }

  protected async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(location.href);
      this.toast.success('已複製這張工單的連結');
    } catch {
      this.toast.error('瀏覽器不允許複製，請直接複製網址列');
    }
  }

  protected onCopied(text: string): void {
    this.toast.success(`已複製「${text}」`);
  }

  // ---- 留言 ----

  protected onCommentSubmit(event: CommentSubmitEvent): void {
    const t = this.ticket();
    const me = this.me();
    if (!t || !me) return;
    event.respondWith(
      this.repo.addComment(t.id, me, event.html).then(async () => {
        this.comments.set(await this.repo.comments(t.id));
        this.notifyMentions(t.id, me.name, event.mentions, event.text);
      }),
    );
  }

  protected onCommentEdit(event: CommentEditEvent): void {
    const t = this.ticket();
    const me = this.me();
    if (!t || !me) return;
    const before = mentionIdsOf(this.comments().find((c) => c.id === event.id)?.html);
    event.respondWith(
      this.repo.editComment(t.id, event.id, event.html).then(async () => {
        this.comments.set(await this.repo.comments(t.id));
        // 編輯時只通知新加進來的人。
        this.notifyMentions(t.id, me.name, event.mentions.filter((id) => !before.includes(id)), event.text);
      }),
    );
  }

  protected onCommentDelete(event: CommentDeleteEvent): void {
    const t = this.ticket();
    if (!t) return;
    event.respondWith(
      this.repo.removeComment(t.id, event.id).then(async () => {
        this.comments.set(await this.repo.comments(t.id));
        this.toast.success('已刪除留言');
      }),
    );
  }

  /**
   * 被 @提及的人收到一則通知（示範：通知中心不分使用者，直接出現在頁首的鈴鐺）。
   * 接後端時由伺服器在留言存檔後送出，這裡就不需要了。
   */
  private notifyMentions(ticketId: string, author: string, mentions: readonly string[], text: string): void {
    const names = mentions.map((id) => TICKET_MENTION_PEOPLE.find((p) => p.id === id)?.name ?? id);
    if (names.length === 0) return;
    void this.notifications.load().then((runtime) =>
      runtime.notify({
        title: `${author}在 ${ticketId} 提到 ${names.join('、')}`,
        body: text.length > 80 ? `${text.slice(0, 80)}…` : text,
        category: 'mention',
        avatar: Array.from(author)[0] ?? '',
        link: `/templates/tickets/${ticketId}`,
      }),
    );
  }

  /** 寫入資料後重新讀一次；進行中時其他動作不會重複送出。 */
  private async run<T>(write: () => Promise<T>): Promise<T> {
    this.busy.set(true);
    try {
      const result = await write();
      await this.refresh();
      return result;
    } finally {
      this.busy.set(false);
    }
  }
}
