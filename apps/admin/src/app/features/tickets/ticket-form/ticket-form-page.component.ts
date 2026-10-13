import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { HasUnsavedChanges } from '@admin-template/access';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  RelationSelectComponent,
  SkeletonComponent,
  ToastService,
  openConfirmDialog,
} from '@admin-template/ui';
import { provideHeaderTitle } from '../../../layout/header/header-title';
import { HeaderToolbarDirective } from '../../../layout/header/header-toolbar-slot';
import {
  CONFIRM_DIALOG_LABEL_PROVIDERS,
  FEEDBACK_STATE_LABEL_PROVIDERS,
  TOAST_PROVIDERS,
} from '../../../shared/ui/component-label-providers';
import { RELATION_SELECT_LABEL_PROVIDERS } from '../../../shared/ui/relation-select-labels';
import { TemplateInfo, TemplateInfoComponent } from '../../../shared/ui/template-info.component';
import { toDateString } from '../data/ticket-demo-data';
import { parseDueDate } from '../data/ticket-format';
import {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  TICKET_DESCRIPTION_MAX,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_TITLE_MAX,
  Ticket,
  TicketCategory,
  TicketDraft,
  TicketNotFoundError,
  TicketPerson,
  TicketPriority,
} from '../data/ticket.model';
import { TicketRepository } from '../data/ticket.repository';
import { TicketListMemory } from '../ticket-list/ticket-list-url';
import { FormFieldError, FormFieldSpec, collectFormErrors, fieldMessage, focusTarget, notBlank } from './form-errors';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

const ACTOR = { name: '你' };

/** 欄位依畫面順序；錯誤摘要與 mat-error 共用這份文字。 */
export const TICKET_FORM_FIELDS: readonly FormFieldSpec[] = [
  { key: 'title', label: '標題', messages: { required: '請輸入標題', blank: '請輸入標題', maxlength: `標題不能超過 ${TICKET_TITLE_MAX} 個字` } },
  { key: 'category', label: '分類', messages: { required: '請選擇分類' } },
  { key: 'priority', label: '優先順序', messages: { required: '請選擇優先順序' } },
  { key: 'requesterId', label: '申請人', messages: { required: '請選擇申請人' } },
  { key: 'assigneeId', label: '負責人', messages: {} },
  {
    key: 'dueDate',
    label: '期限',
    messages: { matDatepickerParse: '請輸入正確的日期（例：2026/10/31）', matDatepickerMin: '期限不能早於今天' },
  },
  { key: 'description', label: '描述', messages: { maxlength: `描述不能超過 ${TICKET_DESCRIPTION_MAX} 個字` } },
];

const SPEC = Object.fromEntries(TICKET_FORM_FIELDS.map((f) => [f.key, f])) as Record<string, FormFieldSpec>;

const INFO: TemplateInfo = {
  summary: '表單頁樣板：新增與編輯共用。分段的卡片、欄位驗證、送出時的錯誤摘要（點了跳到欄位）、底部固定的操作列，未存檔離開會先確認。',
  components: [
    'Material 欄位：mat-form-field、matInput、mat-select、mat-radio-group、mat-datepicker、mat-error',
    'lib-relation-select（負責人；申請人可以當場建立）',
    '確認對話框（離開前確認）、lib-toast（存檔成功）、lib-skeleton、lib-empty-state',
    'libs/access 的 unsavedChangesGuard（路由離開前呼叫 canLeave）',
  ],
  replace: [
    'ticket.repository.ts：get()、create()、update() 換成呼叫後端',
    'TICKET_FORM_FIELDS（欄位、順序與錯誤訊息）與表單的 Validators',
    '分類、優先順序的選項（ticket.model.ts）',
  ],
  files: [
    'apps/admin/src/app/features/tickets/ticket-form/',
    'apps/admin/src/app/features/tickets/data/',
    'apps/admin/src/app/features/tickets/tickets.routes.ts（canDeactivate）',
  ],
};

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * 工單表單（頁面樣板，/templates/tickets/new 與 /templates/tickets/:id/edit）。
 * 送出時有錯：頂端顯示錯誤摘要、捲到並聚焦第一個錯誤欄位；存檔成功：提示並導到詳情頁。
 */
@Component({
  selector: 'app-ticket-form-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatSelectModule,
    RelationSelectComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    HeaderToolbarDirective,
    TemplateInfoComponent,
  ],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'zh-TW' },
    ...RELATION_SELECT_LABEL_PROVIDERS,
    ...CONFIRM_DIALOG_LABEL_PROVIDERS,
    ...FEEDBACK_STATE_LABEL_PROVIDERS,
    ...TOAST_PROVIDERS,
  ],
  templateUrl: './ticket-form-page.component.html',
  styleUrl: './ticket-form-page.component.scss',
})
export class TicketFormPageComponent implements HasUnsavedChanges {
  protected readonly repo = inject(TicketRepository);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly toast = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly listParams = inject(TicketListMemory).queryParams;

  /** 編輯：網址的 :id；新增：null。 */
  protected readonly ticketId = inject(ActivatedRoute).snapshot.paramMap.get('id');
  protected readonly mode = this.ticketId ? 'edit' : 'create';

  protected readonly info = INFO;
  protected readonly titleMax = TICKET_TITLE_MAX;
  protected readonly descriptionMax = TICKET_DESCRIPTION_MAX;
  protected readonly categories = TICKET_CATEGORIES;
  protected readonly categoryLabels = TICKET_CATEGORY_LABELS;
  protected readonly priorities = TICKET_PRIORITIES;
  protected readonly priorityLabels = TICKET_PRIORITY_LABELS;

  protected readonly state = signal<LoadState>(this.ticketId ? 'loading' : 'ready');
  protected readonly saving = signal(false);
  /** 按過存檔：之後錯誤摘要跟著欄位即時更新。 */
  protected readonly submitted = signal(false);
  protected readonly errors = signal<FormFieldError[]>([]);
  /** 期限的下限：今天；編輯一張期限已過的工單時放寬到原本的期限（不逼使用者改它）。 */
  protected readonly minDue = signal(startOfToday());

  protected readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, notBlank, Validators.maxLength(TICKET_TITLE_MAX)]],
    category: [null as TicketCategory | null, Validators.required],
    priority: ['medium' as TicketPriority, Validators.required],
    requesterId: [null as string | null, Validators.required],
    assigneeId: [null as string | null],
    dueDate: [null as Date | null],
    description: ['', Validators.maxLength(TICKET_DESCRIPTION_MAX)],
  });

  /** 載入完成（或新增時一開始）的值；跟它不同就是有未存的變更。 */
  private initial = this.serialize();
  /** 存檔成功後不再提醒離開。 */
  private saved = false;
  protected readonly titleLength = signal(0);

  protected readonly pageTitle = computed(() => (this.mode === 'edit' ? `編輯工單 ${this.ticketId}` : '新增工單'));
  protected readonly cancelLink = computed(() =>
    this.mode === 'edit' ? ['/templates/tickets', this.ticketId ?? ''] : ['/templates/tickets'],
  );
  protected readonly cancelParams = this.mode === 'edit' ? {} : this.listParams;

  protected readonly personName = (p: TicketPerson) => p.name;
  protected readonly personTeam = (p: TicketPerson) => p.team;
  protected readonly personInitials = (p: TicketPerson) => Array.from(p.name).slice(-2).join('');

  constructor() {
    provideHeaderTitle(() => ({
      title: this.pageTitle(),
      breadcrumbs: [{ label: '頁面樣板' }, { label: '工單', route: '/templates/tickets' }],
    }));
    const sub = this.form.valueChanges.subscribe(() => {
      this.titleLength.set(this.form.controls.title.value.length);
      if (this.submitted()) this.errors.set(this.collectErrors());
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
    if (this.ticketId) void this.load(this.ticketId);
  }

  protected async load(id: string): Promise<void> {
    this.state.set('loading');
    try {
      const ticket = await this.repo.get(id);
      if (!ticket) {
        this.state.set('not-found');
        return;
      }
      this.fill(ticket);
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }

  private fill(ticket: Ticket): void {
    const due = ticket.dueDate ? parseDueDate(ticket.dueDate) : null;
    if (due && due < startOfToday()) this.minDue.set(due);
    this.form.reset({
      title: ticket.title,
      category: ticket.category,
      priority: ticket.priority,
      requesterId: ticket.requesterId,
      assigneeId: ticket.assigneeId,
      dueDate: due,
      description: ticket.description,
    });
    this.initial = this.serialize();
  }

  protected backToList(): void {
    void this.router.navigate(['/templates/tickets'], { queryParams: this.listParams });
  }

  // ---- 錯誤 ----

  protected messageOf(key: string): string | null {
    return fieldMessage(SPEC[key], this.form.get(key)?.errors ?? null);
  }

  private collectErrors(): FormFieldError[] {
    return collectFormErrors(this.form.controls, TICKET_FORM_FIELDS);
  }

  /** 捲到欄位並聚焦（錯誤摘要的連結、送出失敗時的第一個錯誤欄位）。 */
  focusField(key: string): void {
    const target = focusTarget(this.host.nativeElement, key);
    if (!target) return;
    target.scrollIntoView?.({ block: 'center', behavior: 'instant' });
    target.focus({ preventScroll: true });
  }

  // ---- 申請人可以當場建立 ----

  protected createRequester(name: string): void {
    const person = this.repo.addRequester(name);
    this.form.controls.requesterId.setValue(person.id);
    this.form.controls.requesterId.markAsDirty();
    this.toast.success(`已新增申請人「${person.name}」`);
  }

  // ---- 存檔與離開 ----

  async save(): Promise<void> {
    if (this.saving()) return;
    this.submitted.set(true);
    this.form.markAllAsTouched();
    const errors = this.collectErrors();
    this.errors.set(errors);
    if (errors.length) {
      // 等錯誤摘要畫出來（版面會往下推）再捲動與聚焦。
      afterNextRender(() => this.focusField(errors[0].key), { injector: this.injector });
      return;
    }
    this.saving.set(true);
    const draft = this.toDraft();
    let ticket: Ticket;
    try {
      ticket = this.ticketId ? await this.repo.update(this.ticketId, draft, ACTOR) : await this.repo.create(draft, ACTOR);
    } catch (error) {
      this.saving.set(false);
      if (error instanceof TicketNotFoundError) this.state.set('not-found');
      else this.toast.error('存檔失敗，請再試一次。');
      return;
    }
    this.saved = true;
    await this.router.navigate(['/templates/tickets', ticket.id]);
    this.toast.success(this.mode === 'edit' ? `已儲存工單 ${ticket.id}` : `已建立工單 ${ticket.id}`);
  }

  /** 有未存的變更（跟載入時的值不同）。 */
  isDirty(): boolean {
    return !this.saved && this.state() === 'ready' && this.serialize() !== this.initial;
  }

  /** 路由離開前（unsavedChangesGuard）：有未存的變更時先問。 */
  async canLeave(): Promise<boolean> {
    if (!this.isDirty()) return true;
    return openConfirmDialog(this.injector, {
      title: '有尚未儲存的變更',
      message: '離開這一頁的話，剛剛修改的內容不會存檔。',
      confirmLabel: '捨棄變更',
      cancelLabel: '繼續編輯',
    });
  }

  /** 重新整理或關閉分頁：瀏覽器只允許顯示它自己的提示。 */
  @HostListener('window:beforeunload', ['$event'])
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isDirty()) event.preventDefault();
  }

  private toDraft(): TicketDraft {
    const v = this.form.getRawValue();
    return {
      title: v.title.trim(),
      category: v.category ?? 'other',
      priority: v.priority,
      requesterId: v.requesterId ?? '',
      assigneeId: v.assigneeId,
      dueDate: v.dueDate ? toDateString(v.dueDate) : null,
      description: v.description.trim(),
    };
  }

  private serialize(): string {
    const v = this.form.getRawValue();
    return JSON.stringify({ ...v, dueDate: v.dueDate ? toDateString(v.dueDate) : null });
  }
}
