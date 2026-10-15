import {
  Component,
  DestroyRef,
  Directive,
  DoCheck,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AbstractControl, ControlValueAccessor, FormGroupDirective, NgControl, NgForm, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldAppearance, MatFormFieldModule, SubscriptSizing } from '@angular/material/form-field';
import { MatInput, MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RELATION_SELECT_LABELS, assertRelationSelectLabels, formatRelationLabel } from './relation-select-labels';
import { HighlightSegment, RelationSource, highlightSegments, isAbortError } from './relation-source';

/** 清單裡不是資料的兩個選項（建立、重試）的值。 */
const CREATE = { relationSelectAction: 'create' } as const;
const RETRY = { relationSelectAction: 'retry' } as const;
type ActionValue = typeof CREATE | typeof RETRY;

/** 清單目前顯示什麼。`idle`：還沒有任何結果（面板不打開）。 */
type Phase = 'idle' | 'results' | 'error';

/** 輸入停多久才搜尋（毫秒）。 */
export const RELATION_SELECT_DEBOUNCE = 250;
/** 搜尋超過多久才顯示「載入中」那一行（毫秒）；比這快的回應不閃一下載入中。 */
export const RELATION_SELECT_LOADING_DELAY = 150;

/**
 * matInput 只在「自己身上」有 NgControl 時才逐輪重算錯誤狀態；這裡的表單控制項掛在外層元件上，所以由這個指令每輪
 * 請它重算（碰過、表單送出這類沒有事件可訂閱的條件也要跟著變紅）。放在 input 上，第一次變更偵測就算得到。
 */
@Directive({ selector: 'input[libRelationSelectErrorState]' })
class RelationSelectErrorStateDirective implements DoCheck {
  private readonly matInput = inject(MatInput, { self: true });

  ngDoCheck(): void {
    this.matInput.updateErrorState();
  }
}

/**
 * 關聯選擇欄位：從大量資料裡挑一筆（負責人、專案、聯絡人），輸入就搜尋。
 *
 * - 值是 id（`string | null`），不是整個物件；可以用 `formControlName`／`[formControl]`，也可以用 `[(value)]`。
 *   一開始只有 id 時用 `source.getById` 查出顯示文字（查詢中顯示骨架，查不到顯示 id 本身＋提示）。
 * - 聚焦就先搜一次空字串（不打字也能挑前幾筆）；輸入後停 250ms 才搜，新搜尋會 abort 舊的，晚到的舊回應不會蓋掉新結果。
 * - 打了字沒選就離開欄位時，輸入框還原成目前已選項的文字，不留半截字讓人以為已選。
 * - 外框是 `mat-form-field` ＋ `matInput` ＋ `mat-autocomplete`，造型交給質地的欄位與浮層 recipe。
 */
@Component({
  selector: 'lib-relation-select',
  imports: [
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    RelationSelectErrorStateDirective,
  ],
  templateUrl: './relation-select.component.html',
  styleUrl: './relation-select.component.scss',
  host: {
    class: 'lib-relation-select',
  },
})
export class RelationSelectComponent<T> implements ControlValueAccessor, DoCheck {
  readonly label = input('');
  readonly placeholder = input('');
  readonly hint = input('');
  /** 驗證錯誤時欄位下方的文字，例：「請選擇負責人」。 */
  readonly errorMessage = input('');
  readonly required = input(false);
  readonly disabled = input(false);
  readonly readonly = input(false);
  /** 預設 outline（一般表單）；篩選列、`ui-field-group` 用 fill。 */
  readonly appearance = input<MatFormFieldAppearance>('outline');
  /** 沒有看得到的 label 時的無障礙名稱（例：資料表儲存格裡的編輯器）。 */
  readonly ariaLabel = input<string | null>(null);
  /** dynamic：欄位下方不預留提示與錯誤的高度（放在表格儲存格裡時用）。 */
  readonly subscriptSizing = input<SubscriptSizing>('fixed');
  readonly source = input.required<RelationSource<T>>();
  /** 選項與輸入框顯示的主文字。 */
  readonly displayWith = input.required<(item: T) => string>();
  /** 選項第二行的灰字（email、部門、代碼）。 */
  readonly secondaryWith = input<((item: T) => string) | null>(null);
  /** 選項前面的縮寫圓章文字（例：姓名的後兩個字）。 */
  readonly avatarWith = input<((item: T) => string) | null>(null);
  /** 找不到時多一個「建立「xxx」」選項，按下時送出 `createRequested`。 */
  readonly allowCreate = input(false);
  /** 清單最多顯示幾筆，預設 20；超過時底部提示請輸入更多字。 */
  readonly maxResults = input(20);

  /** 目前選的 id。 */
  readonly value = model<string | null>(null);
  /** 使用者按了「建立」，帶目前輸入的字（已去頭尾空白）。建立完成後把新 id 設回 value 即可。 */
  readonly createRequested = output<string>();
  /** 使用者選了一筆（或按清除時是 null）。用程式改 value 不會送出。 */
  readonly selectionChange = output<T | null>();

  protected readonly labels = assertRelationSelectLabels(inject(RELATION_SELECT_LABELS, { optional: true }));
  protected readonly CREATE = CREATE;
  protected readonly RETRY = RETRY;

  private readonly ngControl = inject(NgControl, { self: true, optional: true });
  private readonly parentForm = inject(NgForm, { optional: true }) ?? inject(FormGroupDirective, { optional: true });
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('input');
  private readonly trigger = viewChild.required(MatAutocompleteTrigger);

  /** 輸入框裡的字（跟 DOM 同步）。 */
  protected readonly text = signal('');
  protected readonly selected = signal<T | null>(null);
  private readonly formDisabled = signal(false);
  private readonly touched = signal(false);

  // ---- 搜尋狀態 ----
  protected readonly phase = signal<Phase>('idle');
  protected readonly items = signal<readonly T[]>([]);
  protected readonly hasMore = signal(false);
  /** 目前清單是用哪個字搜出來的（加粗、找不到、建立都用它）。 */
  protected readonly resultQuery = signal('');
  private readonly pending = signal(false);
  /** 搜尋超過 150ms 才為 true。 */
  protected readonly loadingVisible = signal(false);

  // ---- 初始值解析 ----
  protected readonly resolving = signal(false);
  protected readonly resolveFailedId = signal<string | null>(null);
  /** 輸入框是 startSearch 帶進來的字：初始值查完只記下已選項，不把輸入框改回它的文字。 */
  private readonly typedOver = signal(false);
  /** 解析初始值中、而且輸入框還沒有打進來的字：顯示骨架、唯讀。 */
  protected readonly busy = computed(() => this.resolving() && !this.typedOver());

  private searchSeq = 0;
  private searchAbort: AbortController | null = null;
  private resolveAbort: AbortController | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private loadingTimer: ReturnType<typeof setTimeout> | null = null;
  /** 表單控制項的事件（碰過、驗證狀態、表單送出）每來一次就 +1，讓範本重算錯誤外觀。 */
  private readonly controlVersion = signal(0);
  private watchedControl: AbstractControl | null = null;
  private controlEvents: Subscription | null = null;
  private onChange: (id: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());
  protected readonly isRequired = computed(
    () => this.required() || !!this.ngControl?.control?.hasValidator(Validators.required),
  );
  protected readonly showClear = computed(
    () => this.value() !== null && !this.isDisabled() && !this.readonly() && !this.busy(),
  );
  protected readonly canCreate = computed(
    () => this.allowCreate() && this.phase() === 'results' && this.resultQuery().length > 0 && !this.exactMatch(),
  );
  protected readonly resolveFailedText = computed(() => {
    const id = this.resolveFailedId();
    return id === null ? '' : formatRelationLabel(this.labels.resolveFailed, { id });
  });
  /** 給報讀器的狀態（aria-live）：載入中、找不到、搜尋失敗、初始值查不到。 */
  protected readonly liveMessage = computed(() => {
    if (this.busy() || this.loadingVisible()) return this.labels.loading;
    if (this.resolveFailedId() !== null) return this.resolveFailedText();
    if (this.phase() === 'error') return this.labels.searchFailed;
    if (this.phase() === 'results' && this.items().length === 0) return this.noResultsText();
    return '';
  });

  /**
   * 範本讀這個 signal：表單在別處被標成碰過（例如送出鈕呼叫 markAllAsTouched）時，本元件的畫面也會重畫，
   * 輸入框上的指令才有機會請 matInput 重算錯誤狀態（zoneless 下沒被標記的元件不會跟著重畫）。
   */
  protected readonly invalidShown = computed(() => {
    this.controlVersion();
    this.touched();
    this.value();
    return this.isErrorState();
  });

  /** 給 matInput 的錯誤判斷：表單控制項無效且碰過（或表單已送出）；沒接表單時看 required。 */
  protected readonly errorMatcher: ErrorStateMatcher = { isErrorState: () => this.isErrorState() };
  /** mat-autocomplete 寫回輸入框的文字：資料顯示主文字，建立／重試保留目前的字。 */
  protected readonly displayOption = (option: T | ActionValue | null): string =>
    option === null || isAction(option) ? this.text() : this.displayWith()(option);

  constructor() {
    if (this.ngControl) this.ngControl.valueAccessor = this;

    // value 改變（[(value)]、writeValue）→ 同步顯示文字；自己選的那一筆已經同步過，不會再查一次。
    effect(() => {
      const id = this.value();
      untracked(() => this.syncFromValue(id));
    });
    // 換了資料來源：舊的結果作廢。
    effect(() => {
      this.source();
      untracked(() => this.resetResults());
    });

    const submitted = this.parentForm?.ngSubmit.subscribe(() => this.controlVersion.update((n) => n + 1));
    inject(DestroyRef).onDestroy(() => {
      this.cancelSearch();
      this.resolveAbort?.abort();
      this.controlEvents?.unsubscribe();
      submitted?.unsubscribe();
    });
  }

  /** formControlName 在本元件之後才把控制項接上，所以在這裡（每輪都會跑、很便宜）看到新控制項時才訂閱它的事件。 */
  ngDoCheck(): void {
    const control = this.ngControl?.control ?? null;
    if (control === this.watchedControl) return;
    this.watchedControl = control;
    this.controlEvents?.unsubscribe();
    this.controlEvents = control?.events.subscribe(() => this.controlVersion.update((n) => n + 1)) ?? null;
  }

  // ---- ControlValueAccessor ----
  writeValue(id: string | null | undefined): void {
    this.value.set(id ?? null);
  }

  registerOnChange(fn: (id: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.formDisabled.set(disabled);
  }

  /**
   * 用一段字開始搜尋：輸入框換成這段字、立刻以它搜尋並打開清單（例：資料表的關聯欄用打字開始編輯）。
   * 初始值還在查時，查完只記下已選項、不把輸入框改回它的文字；沒選就離開時照樣還原成已選項的文字。
   */
  startSearch(text: string): void {
    if (this.isDisabled() || this.readonly()) return;
    this.typedOver.set(true);
    this.setText(text);
    this.search(text.trim());
    this.trigger().openPanel();
  }

  // ---- 範本事件 ----
  protected onFocus(): void {
    if (this.isDisabled() || this.readonly() || this.busy()) return;
    const query = this.queryFromText();
    // 同一個字已經有結果就不重搜（例如選完之後焦點回到輸入框）。
    if (!this.pending() && this.phase() === 'results' && this.resultQuery() === query) return;
    this.search(query);
  }

  protected onInput(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
    this.clearDebounce();
    this.debounceTimer = setTimeout(() => this.search(this.queryFromText()), RELATION_SELECT_DEBOUNCE);
  }

  protected onBlur(): void {
    this.touched.set(true);
    this.onTouched();
    // 面板還開著（例如正在點選項）時，交給 closed／optionSelected 處理。
    if (!this.trigger().panelOpen) this.restoreText();
  }

  protected onClosed(): void {
    if (!this.hasFocus()) this.restoreText();
  }

  protected onSelected(event: MatAutocompleteSelectedEvent): void {
    const option = event.option.value as T | ActionValue;
    event.option.deselect(false);
    if (option === RETRY) {
      this.setText(this.text());
      this.search(this.queryFromText());
      // 選項選完之後 trigger 會關掉面板；下一輪再打開，讓重試的結果出現在原地。
      setTimeout(() => this.trigger().openPanel());
      return;
    }
    if (option === CREATE) {
      const query = this.resultQuery();
      this.restoreText();
      this.createRequested.emit(query);
      return;
    }
    this.select(option as T);
  }

  protected clear(): void {
    this.cancelSearch();
    this.typedOver.set(false);
    this.selected.set(null);
    this.resolveFailedId.set(null);
    this.setText('');
    this.commit(null);
    this.selectionChange.emit(null);
    this.resetResults();
    this.inputRef()?.nativeElement.focus();
  }

  // ---- 範本用的小工具 ----
  protected idOf(item: T): string {
    return this.source().idOf(item);
  }

  protected segments(text: string): HighlightSegment[] {
    return highlightSegments(text, this.resultQuery());
  }

  protected noResultsText(): string {
    const query = this.resultQuery();
    return query ? formatRelationLabel(this.labels.noResults, { query }) : this.labels.empty;
  }

  protected createText(): string {
    return formatRelationLabel(this.labels.create, { query: this.resultQuery() });
  }

  // ---- 內部 ----
  private select(item: T): void {
    this.cancelSearch();
    this.typedOver.set(false);
    this.selected.set(item);
    this.resolveFailedId.set(null);
    this.setText(this.displayWith()(item));
    this.commit(this.source().idOf(item));
    this.selectionChange.emit(item);
    // 下次聚焦搜空字串（輸入框是已選項的文字，不是查詢字）。
    this.resetResults();
  }

  private commit(id: string | null): void {
    this.value.set(id);
    this.onChange(id);
  }

  private search(query: string): void {
    this.cancelSearch();
    const seq = ++this.searchSeq;
    const abort = new AbortController();
    this.searchAbort = abort;
    this.pending.set(true);
    this.loadingTimer = setTimeout(() => {
      if (seq === this.searchSeq) this.loadingVisible.set(true);
    }, RELATION_SELECT_LOADING_DELAY);

    let request: Promise<{ items: readonly T[]; hasMore: boolean }>;
    try {
      request = this.source().search(query, abort.signal);
    } catch (error) {
      request = Promise.reject(error);
    }
    request.then(
      (page) => {
        if (seq !== this.searchSeq) return; // 晚到的舊回應
        const max = Math.max(1, this.maxResults());
        this.items.set(page.items.slice(0, max));
        this.hasMore.set(page.hasMore || page.items.length > max);
        this.resultQuery.set(query);
        this.phase.set('results');
        this.finishSearch();
      },
      (error: unknown) => {
        if (seq !== this.searchSeq || isAbortError(error)) return;
        this.items.set([]);
        this.hasMore.set(false);
        this.resultQuery.set(query);
        this.phase.set('error');
        this.finishSearch();
      },
    );
  }

  private finishSearch(): void {
    this.pending.set(false);
    this.loadingVisible.set(false);
    if (this.loadingTimer) clearTimeout(this.loadingTimer);
    this.loadingTimer = null;
  }

  /** 取消進行中與排隊中的搜尋；之後回來的結果都會被丟掉。 */
  private cancelSearch(): void {
    this.clearDebounce();
    this.searchSeq++;
    this.searchAbort?.abort();
    this.searchAbort = null;
    this.finishSearch();
  }

  private clearDebounce(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }

  private resetResults(): void {
    this.phase.set('idle');
    this.items.set([]);
    this.hasMore.set(false);
    this.resultQuery.set('');
  }

  private syncFromValue(id: string | null): void {
    const current = this.selected();
    if (id !== null && current !== null && this.source().idOf(current) === id) return;
    if (id === null && current === null && this.resolveFailedId() === null && !this.resolving()) return;
    this.resolveAbort?.abort();
    this.resolveAbort = null;
    this.resolveFailedId.set(null);
    this.selected.set(null);
    if (id === null) {
      this.resolving.set(false);
      this.setText('');
      return;
    }
    this.resolve(id);
  }

  private resolve(id: string): void {
    const abort = new AbortController();
    this.resolveAbort = abort;
    this.resolving.set(true);
    if (!this.typedOver()) this.setText('');
    let request: Promise<T | null>;
    try {
      request = this.source().getById(id, abort.signal);
    } catch (error) {
      request = Promise.reject(error);
    }
    request.then(
      (item) => {
        if (abort.signal.aborted) return;
        this.resolving.set(false);
        if (item) {
          this.selected.set(item);
          if (!this.typedOver()) this.setText(this.displayWith()(item));
        } else {
          this.failResolve(id);
        }
      },
      (error: unknown) => {
        if (abort.signal.aborted || isAbortError(error)) return;
        this.resolving.set(false);
        this.failResolve(id);
      },
    );
  }

  /** 查不到：輸入框顯示 id 本身（不讓欄位空白），下方提示。 */
  private failResolve(id: string): void {
    this.resolveFailedId.set(id);
    if (!this.typedOver()) this.setText(id);
  }

  /** 還原成目前已選項的文字（沒選＝空白；初始值查不到＝id）。 */
  private restoreText(): void {
    this.clearDebounce();
    this.typedOver.set(false);
    const item = this.selected();
    const failed = this.resolveFailedId();
    const restored = item ? this.displayWith()(item) : (failed ?? '');
    if (this.text() !== restored) {
      this.setText(restored);
      // 下次聚焦重新搜（剛才的結果是半截字搜出來的）。
      this.cancelSearch();
      this.resetResults();
    }
  }

  private setText(text: string): void {
    this.text.set(text);
    // 範本也綁了 [value]；這裡直接寫 DOM，蓋過 mat-autocomplete 剛寫進去的字（signal 值沒變時綁定不會重寫）。
    const el = this.inputRef()?.nativeElement;
    if (el && el.value !== text) el.value = text;
  }

  /** 輸入框是已選項的文字時搜空字串（列出前幾筆），否則搜輸入的字。 */
  private queryFromText(): string {
    const item = this.selected();
    const text = this.text();
    if ((item && text === this.displayWith()(item)) || (this.resolveFailedId() !== null && text === this.resolveFailedId())) {
      return '';
    }
    return text.trim();
  }

  private exactMatch(): boolean {
    const query = this.resultQuery().toLocaleLowerCase();
    const display = this.displayWith();
    return this.items().some((item) => display(item).trim().toLocaleLowerCase() === query);
  }

  private hasFocus(): boolean {
    const el = this.inputRef()?.nativeElement;
    return !!el && el.ownerDocument.activeElement === el;
  }

  private isErrorState(): boolean {
    const control = this.ngControl?.control;
    if (control) return control.invalid && (control.touched || !!this.parentForm?.submitted);
    return this.required() && this.touched() && this.value() === null;
  }
}

function isAction(value: unknown): value is ActionValue {
  return value === CREATE || value === RETRY;
}
