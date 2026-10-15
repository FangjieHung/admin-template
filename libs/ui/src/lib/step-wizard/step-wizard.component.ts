import { NgTemplateOutlet } from '@angular/common';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  DestroyRef,
  Directive,
  ElementRef,
  Injector,
  QueryList,
  ViewChildren,
  afterNextRender,
  computed,
  forwardRef,
  inject,
  input,
  numberAttribute,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CdkStepHeader, CdkStepper } from '@angular/cdk/stepper';
import { MatButtonModule } from '@angular/material/button';
import { STEP_WIZARD_LABELS, assertStepWizardLabels, formatStepWizardLabel } from './step-wizard-labels';
import { StepWizardFieldError, collectFieldErrors, findFieldFocusTarget } from './step-wizard-fields';
import { WizardStepComponent } from './wizard-step.component';
import {
  StepWizardCompactComponent,
  StepWizardMarkerComponent,
  StepWizardSummaryComponent,
  WizardStepState,
} from './step-wizard-parts';

export type { WizardStepState } from './step-wizard-parts';

/** 容器寬度小於這個值（px）時，步驟清單收成一列「步驟 2／4 · 成員」＋進度條。 */
export const STEP_WIZARD_COMPACT_BELOW = 600;

/**
 * 步驟清單上的按鈕。CdkStepper 的鍵盤導覽（FocusKeyManager）需要每個按鈕的 `_elementRef` 與 `focus()`；
 * 不用 CDK 的 `cdkStepHeader`，因為它會把按鈕標成 `role="tab"`（步驟清單是有序清單，不是分頁）。
 */
@Directive({ selector: 'button[libStepWizardHeader]' })
export class StepWizardHeaderDirective {
  readonly _elementRef = inject<ElementRef<HTMLButtonElement>>(ElementRef);

  get disabled(): boolean {
    return this._elementRef.nativeElement.disabled;
  }

  focus(): void {
    this._elementRef.nativeElement.focus();
  }
}

interface StepView {
  step: WizardStepComponent;
  index: number;
  state: WizardStepState;
  current: boolean;
  /** 已經走過、而且不能再回去改（`editable` 是 false）：按鈕停用，外觀仍是「完成」。 */
  frozen: boolean;
}

interface ErrorSummary {
  title: string;
  detail: string;
  fields: StepWizardFieldError[];
}

/**
 * 步驟精靈：把一份長表單拆成幾步，一步一步填（新增專案、匯入、開通帳號）。建立在 CDK 的 CdkStepper 上，
 * 外觀全部用語意 token 與質地 recipe，不依賴 Material Icons 字型。
 *
 * - 預設線性：「下一步」先驗證目前這一步的 `stepControl`（全部標記為碰過）；無效就留在原地、這一步標成錯誤、
 *   上方出現錯誤摘要、焦點移到第一個無效欄位。已完成的步驟隨時可以點回去（`editable` 是 false 的步驟走過之後就不能回去：按鈕停用、外觀維持完成）；
 *   後面還沒開放的步驟鎖住。
 *   `[linear]="false"`：每一步都能直接點，帶著錯誤離開時那一步標成錯誤，按「完成」時才一次檢查全部。
 * - 步驟狀態：未開始、目前、完成、錯誤、鎖住；選填步驟名稱下方多一行「選填」。狀態另有只給報讀器的文字，不只靠顏色。
 * - 寬度小於 `compactBelow`（看元件自己的寬度，不是視窗）時，步驟清單收成一列精簡列＋細進度條，
 *   按鈕展開完整清單。`orientation="vertical"`：步驟清單在左側（窄時同樣收成精簡列）。
 * - 底部內建「上一步／下一步／完成」與選填的「取消」：「完成」送出 `finish`，忙碌狀態用 `[submitting]`，
 *   或給 `[submitAction]`（回傳 Promise，等它結束）。取消只送出 `cancel`，要不要先確認由頁面決定。
 * - 換步驟後焦點移到該步的標題，並念出「步驟 2，共 4 步：成員」；減少動態時不做滑入動畫。
 * - 不依賴 Router：要把目前步驟寫進網址，用 `[(selectedIndex)]` 在頁面同步。
 */
@Component({
  selector: 'lib-step-wizard',
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    StepWizardHeaderDirective,
    StepWizardMarkerComponent,
    StepWizardSummaryComponent,
    StepWizardCompactComponent,
  ],
  templateUrl: './step-wizard.component.html',
  styleUrl: './step-wizard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: CdkStepper, useExisting: forwardRef(() => StepWizardComponent) }],
  host: {
    class: 'lib-step-wizard',
    '[class.lib-step-wizard--vertical]': "orientation === 'vertical'",
    '[class.lib-step-wizard--compact]': 'compact()',
    // 直式與窄版展開的清單共用的「一步一列」排法。
    '[class.lib-step-wizard--column]': "compact() || orientation === 'vertical'",
    '[attr.aria-busy]': "busy() ? 'true' : null",
  },
})
export class StepWizardComponent extends CdkStepper implements AfterContentInit {
  // CdkStepper 的兩個查詢換成這個元件自己的步驟與按鈕（同 MatStepper 的作法；需要初始值才能通過型別檢查）。
  @ContentChildren(WizardStepComponent, { descendants: true }) override _steps: QueryList<WizardStepComponent> =
    undefined!;
  @ViewChildren(StepWizardHeaderDirective) override _stepHeader: QueryList<CdkStepHeader> = undefined!;
  override readonly steps: QueryList<WizardStepComponent> = new QueryList<WizardStepComponent>();

  /** 送出中（使用 `(finish)` 自己送出時由頁面控制）：「完成」顯示送出中、其他按鈕與步驟清單停用。 */
  readonly submitting = input(false);
  /** 選填：按下「完成」且全部驗證通過後呼叫；回傳 Promise 時等它結束（期間是忙碌狀態）。失敗時 reject，精靈留在原地。 */
  readonly submitAction = input<(() => unknown) | null>(null);
  /** 「完成」鈕的文字，不給時用 labels 的 `finish`。最好是具體的動詞，例：「建立專案」。 */
  readonly finishLabel = input('');
  /** 顯示「取消」鈕（按下送出 `cancel`）。 */
  readonly showCancel = input(false);
  /** 元件寬度小於這個值（px）時收成精簡列。 */
  readonly compactBelow = input(STEP_WIZARD_COMPACT_BELOW, { transform: numberAttribute });
  /** 步驟標題的層級（`aria-level`），配合頁面的標題結構。 */
  readonly headingLevel = input(2, { transform: numberAttribute });
  /** 隱藏底部的「上一步／下一步／完成」（例如匯入結束後，內容自己提供「完成」與「再來一次」）。 */
  readonly hideActions = input(false);

  /** 全部驗證通過、按下「完成」。 */
  readonly finish = output<void>();
  /** 按下「取消」。 */
  readonly cancel = output<void>();

  protected readonly labels = assertStepWizardLabels(inject(STEP_WIZARD_LABELS, { optional: true }));
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  // 錯誤摘要是元件：要它的 DOM 元素（聚焦用）就得指定 read: ElementRef。
  private readonly summaryRef = viewChild('summaryBox', { read: ElementRef<HTMLElement> });

  private readonly stepList = signal<readonly WizardStepComponent[]>([]);
  private readonly width = signal(0);
  private readonly pending = signal(false);
  /** 最近一次換步驟的方向（決定滑入方向）；null：還沒換過（第一次顯示不做動畫）。 */
  protected readonly direction = signal<'forward' | 'back' | null>(null);
  protected readonly announcement = signal('');
  protected readonly listOpen = signal(false);
  protected readonly uid = `lib-step-wizard-${nextId++}`;

  readonly busy = computed(() => this.submitting() || this.pending());
  readonly compact = computed(() => this.width() > 0 && this.width() < this.compactBelow());

  /** 每一步的狀態（stepControl 改變時由各步的 revision 觸發重算）。 */
  protected readonly views = computed<StepView[]>(() => {
    const steps = this.stepList();
    for (const step of steps) step.revision();
    const selected = this.selectedIndex;
    const linear = this.linear;
    return steps.map((step, index) => ({
      step,
      index,
      current: index === selected,
      state: this.stateOf(step, index, selected, linear, steps),
      frozen: index < selected && !step.editable,
    }));
  });

  protected readonly currentView = computed(() => this.views()[this.selectedIndex] ?? null);
  /** 目前這一步包成陣列：`@for` 換步驟時重建區塊，滑入動畫才會重播。 */
  protected readonly currentSteps = computed(() => {
    const view = this.currentView();
    return view ? [view.step] : [];
  });
  protected readonly isLast = computed(() => this.selectedIndex >= this.stepList().length - 1);
  protected readonly progress = computed(() => {
    const total = this.stepList().length;
    return total ? ((this.selectedIndex + 1) / total) * 100 : 0;
  });

  /** 目前這一步被擋下過、而且還有錯時的摘要。 */
  protected readonly summary = computed<ErrorSummary | null>(() => {
    const view = this.currentView();
    if (!view || view.state !== 'error') return null;
    const step = view.step;
    const fields = collectFieldErrors(step.stepControl, step.fieldLabels());
    const title = fields.length
      ? formatStepWizardLabel(this.labels.errorSummary, { count: fields.length })
      : this.labels.stepInvalid;
    return { title, detail: step.errorMessage || '', fields: fields.filter((f) => f.label) };
  });

  constructor() {
    super();
    // 預設線性（CdkStepper 預設非線性）；`[linear]` 綁定會在之後覆寫。
    this.linear = true;
    this.selectionChange.subscribe((event) => {
      this.direction.set(event.selectedIndex >= event.previouslySelectedIndex ? 'forward' : 'back');
      this.listOpen.set(false);
    });
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(([entry]) => this.width.set(entry.contentRect.width));
      observer.observe(this.host.nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  override ngAfterContentInit(): void {
    super.ngAfterContentInit();
    this.stepList.set(this.steps.toArray());
    this.steps.changes.subscribe(() => this.stepList.set(this.steps.toArray()));
  }

  protected compactText(view: StepView | null): string {
    if (!view) return '';
    return formatStepWizardLabel(this.labels.compactStatus, {
      current: view.index + 1,
      total: this.stepList().length,
      label: view.step.label ?? '',
    });
  }

  protected stateText(state: WizardStepState): string {
    switch (state) {
      case 'done':
        return this.labels.stateDone;
      case 'error':
        return this.labels.stateError;
      case 'locked':
        return this.labels.stateLocked;
      case 'upcoming':
        return this.labels.stateUpcoming;
      default:
        return '';
    }
  }

  /** 按下「下一步」。 */
  goNext(): void {
    if (this.busy()) return;
    const step = this.steps.get(this.selectedIndex);
    if (!step) return;
    if (!this.validateCurrent(step) && this.linear) return;
    this.moveTo(this.selectedIndex + 1);
  }

  /** 按下「上一步」。 */
  goPrevious(): void {
    if (this.busy() || this.selectedIndex === 0) return;
    this.moveTo(this.selectedIndex - 1);
  }

  /** 點步驟清單上的某一步。 */
  protected selectStep(index: number): void {
    if (this.busy() || this.views()[index]?.frozen) return;
    if (index === this.selectedIndex) {
      this.listOpen.set(false);
      return;
    }
    if (index > this.selectedIndex) {
      const step = this.steps.get(this.selectedIndex);
      if (step && !this.validateCurrent(step) && this.linear) return;
    }
    this.moveTo(index);
  }

  /** 按下「完成」：檢查所有步驟，第一個無效的步驟會被打開並顯示錯誤；全部通過才送出。 */
  async submit(): Promise<void> {
    if (this.busy()) return;
    const steps = this.steps.toArray();
    const current = steps[this.selectedIndex];
    current?.stepControl?.markAllAsTouched();
    current?._markAsInteracted();
    const firstInvalid = steps.findIndex((step) => step.isBlocking());
    if (firstInvalid >= 0) {
      const step = steps[firstInvalid];
      step.stepControl?.markAllAsTouched();
      step.attempted.set(true);
      step.bump();
      if (firstInvalid !== this.selectedIndex) {
        // 往回跳到有錯的那一步（往回永遠允許）。
        this.selectedIndex = firstInvalid;
      }
      this.focusFirstInvalid(step);
      return;
    }
    this.finish.emit();
    const action = this.submitAction();
    if (!action) return;
    this.pending.set(true);
    try {
      await action();
    } catch {
      // 失敗時留在原地；錯誤訊息由頁面自己顯示（例如提示訊息）。
    } finally {
      this.pending.set(false);
    }
  }

  protected toggleList(): void {
    this.listOpen.update((open) => !open);
  }

  /** 非線性時，步驟清單裡用方向鍵、Home、End 移動焦點（CdkStepper 的 FocusKeyManager）。 */
  protected onHeaderKeydown(event: KeyboardEvent): void {
    if (this.linear) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      this._onKeydown(event);
    }
  }

  /** 錯誤摘要裡點欄位名稱：聚焦那個欄位。 */
  protected focusField(path: string): void {
    const root = this.panel()?.nativeElement;
    findFieldFocusTarget(root ?? this.host.nativeElement, path)?.focus();
  }

  protected tabIndexOf(index: number): number | null {
    if (this.linear) return null;
    return this._getFocusIndex() === index ? 0 : -1;
  }

  /** 驗證目前這一步：無效時標成錯誤、聚焦第一個無效欄位，回傳是否有效。 */
  private validateCurrent(step: WizardStepComponent): boolean {
    step.stepControl?.markAllAsTouched();
    step._markAsInteracted();
    step.bump();
    if (!step.isBlocking()) return true;
    step.attempted.set(true);
    if (this.linear) this.focusFirstInvalid(step);
    return false;
  }

  private moveTo(index: number): void {
    const before = this.selectedIndex;
    this.selectedIndex = index;
    if (this.selectedIndex === before) return;
    const view = this.views()[this.selectedIndex];
    this.announcement.set(
      formatStepWizardLabel(this.labels.announce, {
        current: this.selectedIndex + 1,
        total: this.stepList().length,
        label: view?.step.label ?? '',
      }),
    );
    afterNextRender({ write: () => this.heading()?.nativeElement.focus() }, { injector: this.injector });
  }

  private focusFirstInvalid(step: WizardStepComponent): void {
    afterNextRender(
      {
        write: () => {
          const root = this.panel()?.nativeElement;
          const first = collectFieldErrors(step.stepControl, step.fieldLabels())[0];
          const target = root && first ? findFieldFocusTarget(root, first.path) : null;
          (target ?? this.summaryRef()?.nativeElement)?.focus();
        },
      },
      { injector: this.injector },
    );
  }

  private stateOf(
    step: WizardStepComponent,
    index: number,
    selected: number,
    linear: boolean,
    steps: readonly WizardStepComponent[],
  ): WizardStepState {
    if (step.attempted() && step.isInvalid()) return 'error';
    if (index === selected) return 'current';
    if (step.completed && !step.isInvalid()) return 'done';
    if (linear && !this.reachable(index, selected, steps)) return 'locked';
    return 'upcoming';
  }

  /** 線性模式下能不能直接點過去：前面每一步都完成（或選填），規則同 CdkStepper。 */
  private reachable(index: number, selected: number, steps: readonly WizardStepComponent[]): boolean {
    if (index <= selected) return true;
    for (let i = 0; i < index; i++) {
      const step = steps[i];
      if (step.optional || step._completedOverride()) continue;
      if (i === selected) {
        if (step.stepControl ? step.isBlocking() : false) return false;
        continue;
      }
      const done = step.stepControl ? !step.isBlocking() && step.interacted : step.completed;
      if (!done) return false;
    }
    return true;
  }
}

let nextId = 0;
