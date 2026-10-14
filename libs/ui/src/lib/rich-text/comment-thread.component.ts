import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  ViewEncapsulation,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { formatRelativeTime } from '../activity-timeline/activity-timeline.types';
import { MinuteClock } from '../activity-timeline/minute-clock';
import { openConfirmDialog } from '../confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../feedback-state/empty-state.component';
import { I18nService } from '../i18n/i18n.service';
import { RICH_TEXT_LABELS, assertRichTextLabels, formatRichTextLabel } from './rich-text-labels';
import { RichTextEditorComponent } from './rich-text-editor.component';
import { RichTextViewComponent } from './rich-text-view.component';
import type {
  CommentDeleteEvent,
  CommentEditEvent,
  CommentEventBase,
  CommentItem,
  CommentSubmitEvent,
  MentionSource,
  RichTextContent,
} from './rich-text.types';

let nextId = 0;

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

interface CommentView {
  item: CommentItem;
  own: boolean;
  initial: string;
  iso: string;
  ago: string;
  full: string;
  editedTitle: string | null;
}

const EMPTY: RichTextContent = { html: '', text: '', mentions: [], length: 0 };

/**
 * 留言串：由舊到新排列，底部是輸入框（lib-rich-text-editor，可以 @提及），⌘↵／Ctrl+↵ 送出。
 *
 * 受控元件：不自己存留言。送出、編輯、刪除都用事件交給使用端（帶 HTML、純文字與 mentions），使用端在事件裡呼叫
 * `respondWith(promise)`：處理中元件停用輸入；成功時清空輸入框（或結束編輯），失敗時保留內容、顯示錯誤，可以重試。
 * 使用端成功後自己更新 `[comments]`。
 *
 * - 自己的留言（`currentUserId`）可以編輯（原地換成編輯器，Esc 取消、⌘↵ 儲存）與刪除（確認對話框）。
 * - 留言很多時只顯示最新的 `visibleCount` 則，上方「顯示較早的 M 則」展開全部（焦點移到第一則展開的留言）。
 * - 相對時間每分鐘更新（MinuteClock），滑過看完整時間；有 `editedAt` 的留言標「已編輯」。
 */
@Component({
  selector: 'lib-comment-thread',
  imports: [ReactiveFormsModule, MatButton, MatIconButton, MatTooltip, EmptyStateComponent, RichTextEditorComponent, RichTextViewComponent],
  templateUrl: './comment-thread.component.html',
  styleUrl: './comment-thread.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lib-comment-thread lib-rich-text' },
})
export class CommentThreadComponent {
  protected readonly labels = assertRichTextLabels(inject(RICH_TEXT_LABELS, { optional: true }), 'CommentThread');
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly i18n = inject(I18nService);
  private readonly clock = inject(MinuteClock);

  /** 留言（舊到新；元件不排序以外的處理）。 */
  readonly comments = input.required<readonly CommentItem[]>();
  /** 目前使用者：作者 id 相同的留言可以編輯、刪除。 */
  readonly currentUserId = input<string | null>(null);
  /** 提及的資料來源（輸入框與編輯器共用）。 */
  readonly mentionSource = input<MentionSource | null>(null);
  /** 一開始顯示最新的幾則；較早的摺疊。 */
  readonly visibleCount = input(5);
  /** 每則留言的字數上限（純文字長度）；null 不限。 */
  readonly maxLength = input<number | null>(null);
  /** false：沒有輸入框（只能看）。 */
  readonly canComment = input(true, { transform: booleanAttribute });
  /** 輸入框的 placeholder；不給時用 `RICH_TEXT_LABELS.composerPlaceholder`。 */
  readonly placeholder = input<string | null>(null);

  readonly commentSubmit = output<CommentSubmitEvent>();
  readonly commentEdit = output<CommentEditEvent>();
  readonly commentDelete = output<CommentDeleteEvent>();

  protected readonly uid = `lib-comments-${nextId++}`;
  protected readonly sendHint = formatRichTextLabel(this.labels.sendHint, { keys: MAC ? '⌘↵' : 'Ctrl+↵' });

  private readonly composerEditor = viewChild<RichTextEditorComponent>('composer');
  private readonly editEditor = viewChild<RichTextEditorComponent>('editor');

  // ---- 清單 ----
  protected readonly expanded = signal(false);
  private readonly rtf = computed(() => new Intl.RelativeTimeFormat(this.i18n.current().intl, { numeric: 'auto' }));
  private readonly fullFormat = computed(
    () => new Intl.DateTimeFormat(this.i18n.current().intl, { dateStyle: 'medium', timeStyle: 'short' }),
  );
  protected readonly views = computed<CommentView[]>(() => {
    const now = new Date(this.clock.now());
    const rtf = this.rtf();
    const full = this.fullFormat();
    const me = this.currentUserId();
    return this.comments().map((item) => {
      const at = toDate(item.createdAt);
      const edited = item.editedAt ? toDate(item.editedAt) : null;
      return {
        item,
        own: me !== null && item.author.id === me,
        initial: (Array.from(item.author.name.trim())[0] ?? '').toUpperCase(),
        iso: at.toISOString(),
        ago: formatRelativeTime(at, now, rtf),
        full: full.format(at),
        editedTitle: edited ? formatRichTextLabel(this.labels.editedAt, { time: full.format(edited) }) : null,
      };
    });
  });
  protected readonly hiddenCount = computed(() =>
    this.expanded() ? 0 : Math.max(0, this.views().length - Math.max(1, this.visibleCount())),
  );
  protected readonly visible = computed(() => this.views().slice(this.hiddenCount()));
  protected readonly showEarlierLabel = computed(() => formatRichTextLabel(this.labels.showEarlier, { count: this.hiddenCount() }));

  // ---- 新留言 ----
  protected readonly composerControl = new FormControl('', { nonNullable: true });
  private readonly composerContent = signal<RichTextContent>(EMPTY);
  protected readonly sending = signal(false);
  protected readonly sendFailed = signal(false);
  protected readonly canSend = computed(() => !this.sending() && this.composerContent().text.trim().length > 0 && !this.overLimit(this.composerContent()));

  // ---- 編輯、刪除 ----
  protected readonly editingId = signal<string | null>(null);
  protected readonly editControl = new FormControl('', { nonNullable: true });
  private readonly editContent = signal<RichTextContent>(EMPTY);
  private editOriginal = '';
  protected readonly saving = signal(false);
  protected readonly editFailed = signal(false);
  protected readonly deletingId = signal<string | null>(null);
  protected readonly deleteFailedId = signal<string | null>(null);

  constructor() {
    const release = this.clock.acquire();
    inject(DestroyRef).onDestroy(release);
  }

  protected showEarlier(): void {
    const firstHidden = this.views()[0]?.item.id;
    this.expanded.set(true);
    afterNextRender(() => this.itemElement(firstHidden)?.focus(), { injector: this.injector });
  }

  protected itemDomId(id: string): string {
    return `${this.uid}-${id}`;
  }

  private itemElement(id: string | undefined): HTMLElement | null {
    if (!id) return null;
    return this.host.nativeElement.ownerDocument.getElementById(this.itemDomId(id));
  }

  protected actionsLabel(view: CommentView): string {
    return formatRichTextLabel(this.labels.actions, { name: view.item.author.name });
  }

  // ---- 送出 ----

  protected onComposerChange(content: RichTextContent): void {
    this.composerContent.set(content);
    if (this.sendFailed()) this.sendFailed.set(false);
  }

  /** 送出（按鈕、⌘↵、重試）。 */
  async submit(): Promise<void> {
    const content = this.composerContent();
    if (!this.canSend()) return;
    this.sending.set(true);
    this.sendFailed.set(false);
    this.composerControl.disable();
    try {
      await this.dispatch<CommentSubmitEvent>((event) => this.commentSubmit.emit(event), {
        html: content.html,
        text: content.text,
        mentions: content.mentions,
      });
      this.composerControl.enable();
      this.composerControl.setValue('');
      this.composerContent.set(EMPTY);
      this.sending.set(false);
      this.composerEditor()?.focus();
    } catch {
      this.composerControl.enable();
      this.sending.set(false);
      this.sendFailed.set(true);
    }
  }

  // ---- 編輯 ----

  protected startEdit(view: CommentView): void {
    if (this.saving()) return;
    this.editOriginal = view.item.html;
    this.editControl.setValue(view.item.html);
    this.editControl.enable();
    this.editFailed.set(false);
    this.editingId.set(view.item.id);
    afterNextRender(
      () => {
        const editor = this.editEditor();
        void editor?.whenReady().then(() => editor.focus());
      },
      { injector: this.injector },
    );
  }

  protected onEditChange(content: RichTextContent): void {
    this.editContent.set(content);
    if (this.editFailed()) this.editFailed.set(false);
  }

  protected canSave(): boolean {
    const content = this.editContent();
    return !this.saving() && content.text.trim().length > 0 && !this.overLimit(content);
  }

  async saveEdit(): Promise<void> {
    const id = this.editingId();
    if (!id || !this.canSave()) return;
    const content = this.editContent();
    if (content.html === this.editOriginal) {
      this.cancelEdit();
      return;
    }
    this.saving.set(true);
    this.editFailed.set(false);
    this.editControl.disable();
    try {
      await this.dispatch<CommentEditEvent>((event) => this.commentEdit.emit(event), {
        id,
        html: content.html,
        text: content.text,
        mentions: content.mentions,
      });
      this.saving.set(false);
      this.editingId.set(null);
      afterNextRender(() => this.itemElement(id)?.focus(), { injector: this.injector });
    } catch {
      this.editControl.enable();
      this.saving.set(false);
      this.editFailed.set(true);
    }
  }

  protected cancelEdit(): void {
    const id = this.editingId();
    this.editingId.set(null);
    this.editFailed.set(false);
    afterNextRender(() => this.itemElement(id ?? undefined)?.focus(), { injector: this.injector });
  }

  /** 編輯中按 Esc 取消（提及清單開著時 Esc 只關清單，編輯器會先把事件標成已處理）。 */
  protected onEditKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !event.defaultPrevented && !this.saving()) {
      event.preventDefault();
      this.cancelEdit();
    }
  }

  // ---- 刪除 ----

  protected async remove(view: CommentView): Promise<void> {
    if (this.deletingId()) return;
    const ok = await openConfirmDialog(this.injector, {
      title: this.labels.deleteTitle,
      message: this.labels.deleteMessage,
      confirmLabel: this.labels.delete,
      cancelLabel: this.labels.cancel,
      tone: 'danger',
    });
    if (!ok) return;
    const id = view.item.id;
    this.deletingId.set(id);
    this.deleteFailedId.set(null);
    try {
      await this.dispatch<CommentDeleteEvent>((event) => this.commentDelete.emit(event), { id });
    } catch {
      this.deleteFailedId.set(id);
    } finally {
      this.deletingId.set(null);
    }
  }

  // ----

  private overLimit(content: RichTextContent): boolean {
    const max = this.maxLength();
    return max !== null && content.length > max;
  }

  /** 送出事件；使用端在處理函式裡同步呼叫 respondWith(promise) 時等它完成（reject＝失敗）。 */
  private dispatch<E extends CommentEventBase>(emit: (event: E) => void, data: Omit<E, 'respondWith'>): Promise<void> {
    let work: Promise<unknown> | null = null;
    const event = {
      ...data,
      respondWith: (promise: Promise<unknown>) => {
        work = promise;
      },
    } as E;
    emit(event);
    return Promise.resolve(work).then(() => undefined);
  }
}

function toDate(value: number | Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}
