import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  TemplateRef,
  ViewContainerRef,
  ViewEncapsulation,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALIDATORS, NG_VALUE_ACCESSOR, ReactiveFormsModule, ValidationErrors, Validator } from '@angular/forms';
import {
  OverlayRef,
  createFlexibleConnectedPositionStrategy,
  createOverlayRef,
  createRepositionScrollStrategy,
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatTooltip } from '@angular/material/tooltip';
import { Subscription, isObservable } from 'rxjs';
import { RICH_TEXT_LABELS, RichTextLabels, assertRichTextLabels, formatRichTextLabel } from './rich-text-labels';
import type { MentionTrigger, RichTextEngine, RichTextToolbarState } from './rich-text-engine.types';
import { normalizeLinkHref } from './rich-text-html';
import { RichTextContentStylesComponent } from './rich-text-content-styles.component';
import type { MentionCandidate, MentionSource, RichTextCommand, RichTextContent } from './rich-text.types';

let nextId = 0;

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

type ToolId = RichTextCommand | 'link';

interface ToolDef {
  id: ToolId;
  icon: string;
  label: keyof RichTextLabels;
  /** 快捷鍵（畫面上顯示）：[Mac, 其他]。 */
  keys?: readonly [string, string];
  /** aria-keyshortcuts：[Mac, 其他]。 */
  aria?: readonly [string, string];
  /** 有開／關狀態（aria-pressed）。 */
  toggle: boolean;
  /** 前面畫一條分隔線。 */
  group?: boolean;
}

/**
 * 工具列。連結沒有快捷鍵：⌘K／Ctrl+K 是全站搜尋（頁首的處理不分大小寫，⌘⇧K 也會打開它），
 * Firefox 在 Windows／Linux 又把 Ctrl+Shift+K 留給開發者工具；鍵盤使用者用 Shift+Tab 到工具列（單一 Tab 停點）再按連結。
 */
const TOOLS: readonly ToolDef[] = [
  { id: 'bold', icon: 'format_bold', label: 'bold', keys: ['⌘B', 'Ctrl+B'], aria: ['Meta+B', 'Control+B'], toggle: true },
  { id: 'emphasis', icon: 'format_italic', label: 'emphasis', keys: ['⌘I', 'Ctrl+I'], aria: ['Meta+I', 'Control+I'], toggle: true },
  {
    id: 'bulletList',
    icon: 'format_list_bulleted',
    label: 'bulletList',
    keys: ['⌘⇧8', 'Ctrl+Shift+8'],
    aria: ['Meta+Shift+8', 'Control+Shift+8'],
    toggle: true,
    group: true,
  },
  {
    id: 'orderedList',
    icon: 'format_list_numbered',
    label: 'orderedList',
    keys: ['⌘⇧7', 'Ctrl+Shift+7'],
    aria: ['Meta+Shift+7', 'Control+Shift+7'],
    toggle: true,
  },
  { id: 'blockquote', icon: 'format_quote', label: 'blockquote', keys: ['⌘⇧B', 'Ctrl+Shift+B'], aria: ['Meta+Shift+B', 'Control+Shift+B'], toggle: true },
  { id: 'link', icon: 'link', label: 'link', toggle: true, group: true },
  { id: 'clearFormat', icon: 'format_clear', label: 'clearFormat', keys: ['⌘\\', 'Ctrl+\\'], aria: ['Meta+\\', 'Control+\\'], toggle: false },
];

const EMPTY_TOOLBAR: RichTextToolbarState = {
  bold: false,
  emphasis: false,
  bulletList: false,
  orderedList: false,
  blockquote: false,
  link: false,
};

const EMPTY_CONTENT: RichTextContent = { html: '', text: '', mentions: [], length: 0 };

/**
 * 富文字編輯器：粗體、斜體、清單、引用、連結、清除格式，輸入 `@` 提及同事。值是 HTML 字串（ControlValueAccessor，
 * 可以掛 `formControl`／`ngModel`），另外送出被提及的人的 id（`(mentions)`）。
 *
 * - 引擎是 ProseMirror，在第一次建立編輯器時才動態載入（`rich-text-engine.ts`，獨立的 lazy chunk），不會進 Initial bundle；
 *   載入前編輯區是空的、`aria-busy`，載入後補上目前的值。
 * - 中文輸入法：組字中不搜尋、不改文件；組字確定後才依確定的字搜尋提及（見 rich-text-engine.ts）。
 * - 貼上只保留支援的格式（段落、粗體、斜體、清單、引用、http／https／mailto 連結），字型、顏色、大小、圖片全部拿掉。
 * - 字數上限（`maxLength`）：純文字長度；接近上限顯示「剩 N 字」，超過時進入錯誤狀態（表單驗證錯誤 `maxlength`）。
 *
 * 樣式不封裝（內容是 ProseMirror 動態建立的節點）；選擇器都從 `.lib-rich-text-editor` 開始。
 */
@Component({
  selector: 'lib-rich-text-editor',
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatTooltip,
    RichTextContentStylesComponent,
  ],
  templateUrl: './rich-text-editor.component.html',
  styleUrl: './rich-text-editor.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RichTextEditorComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => RichTextEditorComponent), multi: true },
  ],
  host: {
    class: 'lib-rich-text-editor lib-rich-text',
    '[class.is-focused]': 'focused()',
    '[class.is-disabled]': 'isDisabled()',
    '[class.is-readonly]': 'readonly()',
    '[class.is-invalid]': 'overLimit()',
    '[attr.aria-busy]': 'ready() ? null : "true"',
  },
})
export class RichTextEditorComponent implements ControlValueAccessor, Validator {
  protected readonly labels = assertRichTextLabels(inject(RICH_TEXT_LABELS, { optional: true }), 'RichTextEditor');
  private readonly injector = inject(Injector);
  private readonly vcr = inject(ViewContainerRef);
  private readonly destroyRef = inject(DestroyRef);

  /** 沒有內容時的提示。 */
  readonly placeholder = input('');
  /** 編輯區的無障礙名稱（沒給時用 `RICH_TEXT_LABELS.editor`）；畫面上已有標籤時改用 `ariaLabelledby`。 */
  readonly ariaLabel = input<string | null>(null);
  readonly ariaLabelledby = input<string | null>(null);
  /** 另外的說明文字（例如欄位下方的提示）的 id，會加進 aria-describedby。 */
  readonly ariaDescribedby = input<string | null>(null);
  /** 唯讀：可以選取、複製，不能編輯；不顯示工具列。 */
  readonly readonly = input(false, { transform: booleanAttribute });
  /** 停用（也可以用表單的 `disable()`）。 */
  readonly disabled = input(false, { transform: booleanAttribute });
  /** 顯示工具列。 */
  readonly toolbar = input(true, { transform: booleanAttribute });
  /** 編輯區的最小／最大高度（CSS 長度）；內容超過最大高度時在框內捲動。 */
  readonly minHeight = input('6rem');
  readonly maxHeight = input('20rem');
  /** 字數上限（純文字長度，提及算「@名字」）；null 表示不限。 */
  readonly maxLength = input<number | null>(null);
  /** 剩幾個字以內開始顯示「剩 N 字」；預設是上限的 10%（至少 10 字）。 */
  readonly warnAt = input<number | null>(null);
  /** 提及的資料來源；沒給時輸入 `@` 不會打開清單。 */
  readonly mentionSource = input<MentionSource | null>(null);

  /** 被提及的人的 id（依出現順序、不重複）；只在使用者編輯讓清單改變時送出。 */
  readonly mentions = output<readonly string[]>();
  /** 使用者編輯後的完整內容（HTML、純文字、提及、字數）。 */
  readonly contentChange = output<RichTextContent>();
  /** ⌘↵／Ctrl+↵（留言串用來送出）。 */
  readonly submitShortcut = output<void>();

  private readonly uid = nextId++;
  protected readonly editorId = `lib-rte-${this.uid}`;
  protected readonly counterId = `lib-rte-${this.uid}-counter`;
  protected readonly listboxId = `lib-rte-${this.uid}-mentions`;
  protected readonly linkTitleId = `lib-rte-${this.uid}-link-title`;
  protected readonly tools = TOOLS;

  private readonly mount = viewChild.required<ElementRef<HTMLElement>>('mount');
  private readonly scroll = viewChild.required<ElementRef<HTMLElement>>('scroll');
  private readonly anchor = viewChild.required<ElementRef<HTMLElement>>('anchor');
  private readonly toolButtons = viewChildren<ElementRef<HTMLButtonElement>>('toolButton');
  private readonly mentionTemplate = viewChild.required<TemplateRef<unknown>>('mentionPanel');
  private readonly linkTemplate = viewChild.required<TemplateRef<unknown>>('linkPanel');

  private engine: RichTextEngine | null = null;
  private readyResolve!: () => void;
  private readonly readyPromise = new Promise<void>((resolve) => (this.readyResolve = resolve));
  private destroyed = false;

  protected readonly ready = signal(false);
  protected readonly focused = signal(false);
  private readonly formDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());
  protected readonly showToolbar = computed(() => this.toolbar() && !this.readonly());
  protected readonly toolbarState = signal<RichTextToolbarState>(EMPTY_TOOLBAR);
  /** 工具列目前可以用 Tab 停的那一顆（roving tabindex）。 */
  protected readonly focusIndex = signal(0);

  private readonly _content = signal<RichTextContent>(EMPTY_CONTENT);
  /** 目前的內容（HTML、純文字、提及、字數）。 */
  readonly content = this._content.asReadonly();
  /** 寫進來但引擎還沒載入的值。 */
  private pendingValue = '';

  protected readonly overBy = computed(() => {
    const max = this.maxLength();
    return max === null ? 0 : Math.max(0, this._content().length - max);
  });
  protected readonly overLimit = computed(() => this.overBy() > 0);
  protected readonly remaining = computed(() => {
    const max = this.maxLength();
    if (max === null) return null;
    const left = max - this._content().length;
    const threshold = this.warnAt() ?? Math.max(10, Math.ceil(max * 0.1));
    return left >= 0 && left <= threshold ? left : null;
  });
  protected readonly counterText = computed(() => {
    if (this.overLimit()) return formatRichTextLabel(this.labels.overLimit, { count: this.overBy() });
    const left = this.remaining();
    return left === null ? '' : formatRichTextLabel(this.labels.remaining, { count: left });
  });

  // ---- 提及 ----
  private trigger: MentionTrigger | null = null;
  protected readonly mentionOpen = signal(false);
  protected readonly mentionItems = signal<readonly MentionCandidate[]>([]);
  protected readonly mentionStatus = signal<'loading' | 'ready' | 'error'>('ready');
  /** 目前清單結果對應的查詢字（`data-query`，驗收與除錯用）。 */
  protected readonly mentionResultQuery = signal<string | null>(null);
  protected readonly mentionQuery = signal('');
  protected readonly activeIndex = signal(0);
  protected readonly activeOptionId = computed(() =>
    this.mentionOpen() && this.mentionItems().length > 0 ? `${this.listboxId}-${this.activeIndex()}` : null,
  );
  private searchSeq = 0;
  private searchSub: Subscription | null = null;
  private mentionOverlay: OverlayRef | null = null;

  // ---- 連結 ----
  protected readonly linkOpen = signal(false);
  protected readonly linkEditing = signal(false);
  protected readonly linkControl = new FormControl('', { nonNullable: true });
  private linkOverlay: OverlayRef | null = null;

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;

  constructor() {
    afterNextRender(() => void this.load());

    // 停用、唯讀、placeholder、aria 屬性跟著輸入更新到編輯區。
    effect(() => {
      const editable = !this.isDisabled() && !this.readonly();
      const placeholder = this.placeholder();
      const attrs = this.ariaAttributes();
      if (!this.ready()) return;
      untracked(() => {
        this.engine?.setEditable(editable);
        this.engine?.setPlaceholder(placeholder);
        this.engine?.setAttributes(attrs);
        if (!editable) this.closeMention();
      });
    });
    effect(() => {
      this.maxLength();
      untracked(() => this.onValidatorChange());
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.searchSub?.unsubscribe();
      this.mentionOverlay?.dispose();
      this.linkOverlay?.dispose();
      this.engine?.destroy();
      this.engine = null;
    });
  }

  /** 編輯區上會變的屬性。 */
  private readonly ariaAttributes = computed<Record<string, string | null>>(() => {
    const describedBy = [this.ariaDescribedby(), this.counterText() ? this.counterId : null].filter(Boolean).join(' ');
    const labelledBy = this.ariaLabelledby();
    return {
      'aria-label': labelledBy ? null : (this.ariaLabel() ?? this.labels.editor),
      'aria-labelledby': labelledBy,
      'aria-describedby': describedBy || null,
      'aria-placeholder': this.placeholder() || null,
      'aria-readonly': this.readonly() ? 'true' : null,
      'aria-disabled': this.isDisabled() ? 'true' : null,
      'aria-invalid': this.overLimit() ? 'true' : null,
      'aria-expanded': this.mentionSource() ? String(this.mentionOpen()) : null,
      'aria-controls': this.mentionOpen() ? this.listboxId : null,
      'aria-activedescendant': this.activeOptionId(),
    };
  });

  /** 引擎載入完成（測試、或要在建立後馬上聚焦時用）。 */
  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  focus(): void {
    this.engine?.focus();
  }

  // ---- ControlValueAccessor ----

  writeValue(value: string | null | undefined): void {
    const html = value ?? '';
    this.pendingValue = html;
    if (!this.engine) return;
    this.engine.setContent(html);
    this._content.set(this.engine.content());
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.formDisabled.set(disabled);
  }

  validate(): ValidationErrors | null {
    const max = this.maxLength();
    if (max === null || !this.overLimit()) return null;
    return { maxlength: { requiredLength: max, actualLength: this._content().length } };
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  // ---- 引擎 ----

  private async load(): Promise<void> {
    const { createRichTextEngine } = await import('./rich-text-engine');
    if (this.destroyed) return;
    this.engine = createRichTextEngine({
      element: this.mount().nativeElement,
      content: this.pendingValue,
      editable: !this.isDisabled() && !this.readonly(),
      placeholder: this.placeholder(),
      attributes: { id: this.editorId, role: 'textbox', 'aria-multiline': 'true', 'aria-autocomplete': 'list', 'aria-haspopup': 'listbox' },
      callbacks: {
        onChange: (content) => this.handleChange(content),
        onToolbar: (state) => this.toolbarState.set(state),
        onFocus: (focused) => {
          this.focused.set(focused);
          if (!focused) this.onTouched();
        },
        onMention: (trigger) => this.handleMention(trigger),
        onMentionKey: (event) => this.handleMentionKey(event),
        onSubmitShortcut: () => {
          this.submitShortcut.emit();
          return true;
        },
      },
    });
    this.engine.setAttributes(this.ariaAttributes());
    this._content.set(this.engine.content());
    this.ready.set(true);
    this.readyResolve();
  }

  private handleChange(content: RichTextContent): void {
    const before = this._content().mentions;
    const wasOver = this.overLimit();
    this._content.set(content);
    this.onChange(content.html);
    this.contentChange.emit(content);
    if (!sameIds(before, content.mentions)) this.mentions.emit(content.mentions);
    if (wasOver !== this.overLimit()) this.onValidatorChange();
  }

  // ---- 工具列 ----

  protected isPressed(tool: ToolDef): boolean | null {
    if (!tool.toggle) return null;
    return this.toolbarState()[tool.id as keyof RichTextToolbarState] ?? false;
  }

  protected toolName(tool: ToolDef): string {
    return this.labels[tool.label];
  }

  protected tooltip(tool: ToolDef): string {
    if (!tool.keys) return this.toolName(tool);
    return formatRichTextLabel(this.labels.toolTip, { label: this.toolName(tool), keys: tool.keys[MAC ? 0 : 1] });
  }

  protected ariaShortcut(tool: ToolDef): string | null {
    return tool.aria ? tool.aria[MAC ? 0 : 1] : null;
  }

  protected activate(tool: ToolDef, index: number): void {
    if (!this.engine || this.isDisabled()) return;
    this.focusIndex.set(index);
    if (tool.id === 'link') {
      this.openLink();
      return;
    }
    this.engine.run(tool.id);
  }

  /** 工具列的 ← → Home End（roving tabindex，整個工具列只有一個 Tab 停點）。 */
  protected onToolbarKey(event: KeyboardEvent): void {
    const count = this.tools.length;
    const current = this.focusIndex();
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = (current + 1) % count;
        break;
      case 'ArrowLeft':
        next = (current - 1 + count) % count;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.focusIndex.set(next);
    this.toolButtons()[next]?.nativeElement.focus();
  }

  // ---- 連結 ----

  protected openLink(): void {
    if (!this.engine) return;
    const current = this.engine.currentLink();
    this.linkEditing.set(current !== null);
    this.linkControl.setValue(current ?? '');
    this.linkControl.setErrors(null);
    this.linkControl.markAsUntouched();
    const button = this.toolButtons()[this.tools.findIndex((t) => t.id === 'link')]?.nativeElement;
    if (!button) return;
    this.linkOverlay ??= this.createLinkOverlay(button);
    if (!this.linkOverlay.hasAttached()) this.linkOverlay.attach(new TemplatePortal(this.linkTemplate(), this.vcr));
    this.linkOpen.set(true);
    setTimeout(() => this.linkOverlay?.overlayElement.querySelector<HTMLInputElement>('input')?.select());
  }

  private createLinkOverlay(button: HTMLElement): OverlayRef {
    const ref = createOverlayRef(this.injector, {
      positionStrategy: createFlexibleConnectedPositionStrategy(this.injector, button)
        .withPositions([
          { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
          { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
        ])
        .withPush(true)
        .withViewportMargin(8),
      scrollStrategy: createRepositionScrollStrategy(this.injector),
      panelClass: 'lib-rich-text-link-pane',
    });
    ref.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeLink(true);
      }
    });
    ref.outsidePointerEvents().subscribe((event) => {
      if (button.contains(event.target as Node)) return;
      this.closeLink(false);
    });
    return ref;
  }

  protected applyLink(event?: Event): void {
    event?.preventDefault();
    const href = normalizeLinkHref(this.linkControl.value);
    if (!href) {
      this.linkControl.setErrors({ protocol: true });
      this.linkControl.markAsTouched();
      return;
    }
    this.closeLink(false);
    this.engine?.applyLink(href);
  }

  protected removeLink(): void {
    this.closeLink(false);
    this.engine?.removeLink();
  }

  protected closeLink(focusEditor: boolean): void {
    this.linkOverlay?.detach();
    this.linkOpen.set(false);
    if (focusEditor) this.engine?.focus();
  }

  // ---- 提及 ----

  private handleMention(trigger: MentionTrigger | null): void {
    const source = this.mentionSource();
    if (!trigger || !source || this.isDisabled() || this.readonly()) {
      this.closeMention();
      return;
    }
    const changed = !this.mentionOpen() || trigger.query !== this.mentionQuery() || trigger.from !== this.trigger?.from;
    this.trigger = trigger;
    this.mentionQuery.set(trigger.query);
    this.placeAnchor(trigger);
    this.openMentionOverlay();
    if (changed) this.search(source, trigger.query);
  }

  /** 把隱藏的錨點放到 `@` 的位置（在捲動區裡面，捲動時清單跟著走）。 */
  private placeAnchor(trigger: MentionTrigger): void {
    const scroll = this.scroll().nativeElement;
    const box = scroll.getBoundingClientRect();
    const anchor = this.anchor().nativeElement;
    anchor.style.left = `${trigger.rect.left - box.left + scroll.scrollLeft}px`;
    anchor.style.top = `${trigger.rect.top - box.top + scroll.scrollTop}px`;
    anchor.style.height = `${Math.max(1, trigger.rect.bottom - trigger.rect.top)}px`;
  }

  private openMentionOverlay(): void {
    if (!this.mentionOverlay) {
      this.mentionOverlay = createOverlayRef(this.injector, {
        positionStrategy: createFlexibleConnectedPositionStrategy(this.injector, this.anchor().nativeElement)
          .withPositions([
            { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
            { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
          ])
          .withPush(true)
          .withViewportMargin(8),
        scrollStrategy: createRepositionScrollStrategy(this.injector),
        panelClass: 'lib-rich-text-mention-pane',
      });
    }
    if (!this.mentionOverlay.hasAttached()) this.mentionOverlay.attach(new TemplatePortal(this.mentionTemplate(), this.vcr));
    else this.mentionOverlay.updatePosition();
    this.mentionOpen.set(true);
  }

  private search(source: MentionSource, query: string): void {
    const seq = ++this.searchSeq;
    this.searchSub?.unsubscribe();
    this.searchSub = null;
    this.mentionStatus.set('loading');
    const done = (items: readonly MentionCandidate[]) => {
      if (seq !== this.searchSeq) return;
      this.mentionItems.set(items);
      this.mentionResultQuery.set(query);
      this.activeIndex.set(0);
      this.mentionStatus.set('ready');
      this.mentionOverlay?.updatePosition();
    };
    const fail = () => {
      if (seq !== this.searchSeq) return;
      this.mentionItems.set([]);
      this.mentionResultQuery.set(query);
      this.mentionStatus.set('error');
    };
    try {
      const result = source(query);
      if (isObservable(result)) this.searchSub = result.subscribe({ next: done, error: fail });
      else result.then(done, fail);
    } catch {
      fail();
    }
  }

  private handleMentionKey(event: KeyboardEvent): boolean {
    if (!this.mentionOpen()) return false;
    const count = this.mentionItems().length;
    switch (event.key) {
      case 'ArrowDown':
        if (!count) return false;
        this.activeIndex.update((i) => (i + 1) % count);
        this.scrollActiveIntoView();
        return true;
      case 'ArrowUp':
        if (!count) return false;
        this.activeIndex.update((i) => (i - 1 + count) % count);
        this.scrollActiveIntoView();
        return true;
      case 'Enter':
      case 'Tab': {
        const item = this.mentionItems()[this.activeIndex()];
        if (!item || this.mentionStatus() === 'error') {
          this.engine?.dismissMention();
          return false;
        }
        this.selectMention(item);
        return true;
      }
      case 'Escape':
        this.engine?.dismissMention();
        return true;
      default:
        return false;
    }
  }

  private scrollActiveIntoView(): void {
    setTimeout(() => {
      const id = this.activeOptionId();
      const el = id ? this.mentionOverlay?.overlayElement.querySelector(`#${id}`) : null;
      el?.scrollIntoView?.({ block: 'nearest' });
    });
  }

  protected selectMention(item: MentionCandidate): void {
    const trigger = this.trigger;
    if (!trigger || !this.engine) return;
    this.closeMention();
    this.engine.insertMention(trigger, item.id, item.name);
  }

  private closeMention(): void {
    this.searchSeq++;
    this.searchSub?.unsubscribe();
    this.searchSub = null;
    this.trigger = null;
    this.mentionOverlay?.detach();
    this.mentionOpen.set(false);
    this.mentionItems.set([]);
    this.mentionResultQuery.set(null);
    this.mentionStatus.set('ready');
  }

  protected initial(item: MentionCandidate): string {
    return (Array.from(item.name.trim())[0] ?? '').toUpperCase();
  }

  protected emptyText(): string {
    return formatRichTextLabel(this.labels.mentionEmpty, { query: this.mentionQuery() });
  }
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
