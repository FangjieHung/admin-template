import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { formatLabel } from '../data-table/data-table-query';
import {
  DualMonthRangePickerComponent,
  SelectedDateRange,
} from '../dual-month-range-picker/dual-month-range-picker.component';
import { parseLocalDate, toLocalDateString, upsertCondition } from './filter-predicates';
import { FilterCondition, FilterDatePreset, FilterField, FilterLabels } from './filter.types';

let nextId = 0;

/** 一個欄位的空白條件（剛選欄位時的起點）。 */
export function emptyCondition<T>(field: FilterField<T>): FilterCondition {
  switch (field.type) {
    case 'text':
      return { field: field.id, type: 'text', text: '' };
    case 'select':
      return { field: field.id, type: 'select', value: '' };
    case 'multiSelect':
      return { field: field.id, type: 'multiSelect', values: [] };
    case 'dateRange':
      return { field: field.id, type: 'dateRange' };
    case 'numberRange':
      return { field: field.id, type: 'numberRange' };
  }
}

/**
 * 進階篩選：按鈕開出面板，選一個欄位、填條件、按「套用」。條件之間是 AND，同一欄位只保留一個條件
 * （再選一次同一欄位＝修改它）。已套用的條件交給 lib-filter-chips 顯示與移除。
 *
 * 日期區間的「自訂區間」用 lib-dual-month-range-picker：使用端要提供 DUAL_MONTH_RANGE_PICKER_LABELS
 * （同直接使用選擇器時）；月曆需要的 DateAdapter 由本元件自己提供。
 */
@Component({
  selector: 'lib-advanced-filter',
  imports: [OverlayModule, MatButtonModule, DualMonthRangePickerComponent],
  templateUrl: './advanced-filter.component.html',
  styleUrl: './advanced-filter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideNativeDateAdapter()],
})
export class AdvancedFilterComponent<T = unknown> {
  readonly fields = input.required<readonly FilterField<T>[]>();
  readonly conditions = model<readonly FilterCondition[]>([]);
  readonly labels = input.required<FilterLabels>();

  protected readonly uid = `lib-advanced-filter-${nextId++}`;
  protected readonly open = signal(false);
  /** 面板裡正在編輯的條件（還沒套用）。 */
  protected readonly draft = signal<FilterCondition | null>(null);

  private readonly injector = inject(Injector);
  private readonly trigger = viewChild('trigger', { read: ElementRef<HTMLButtonElement> });
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];

  protected readonly triggerText = computed(() => {
    const count = this.conditions().length;
    return count > 0 ? formatLabel(this.labels().triggerWithCount, { count }) : this.labels().trigger;
  });

  protected readonly draftField = computed(() => {
    const draft = this.draft();
    return draft ? (this.fields().find((f) => f.id === draft.field) ?? null) : null;
  });

  /** 日期條件目前選的是哪個選項；沒有 preset 但有起訖日＝自訂。 */
  protected readonly datePresetChoice = signal<FilterDatePreset | 'custom' | null>(null);

  protected toggle(): void {
    if (this.open()) this.close();
    else this.openPanel();
  }

  protected openPanel(): void {
    this.draft.set(null);
    this.datePresetChoice.set(null);
    this.open.set(true);
  }

  protected close(returnFocus = true): void {
    if (!this.open()) return;
    this.open.set(false);
    if (returnFocus) this.trigger()?.nativeElement.focus();
  }

  protected onAttach(): void {
    afterNextRender(() => this.panel()?.nativeElement.querySelector<HTMLElement>('select')?.focus(), {
      injector: this.injector,
    });
  }

  protected onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  protected chooseField(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    const field = this.fields().find((f) => f.id === id);
    if (!field) {
      this.draft.set(null);
      return;
    }
    // 已有這個欄位的條件：載入它來修改。
    const existing = this.conditions().find((c) => c.field === id);
    const draft = existing && existing.type === field.type ? existing : emptyCondition(field);
    this.draft.set(draft);
    this.datePresetChoice.set(
      draft.type === 'dateRange' ? (draft.preset ?? (draft.from || draft.to ? 'custom' : null)) : null,
    );
  }

  protected setText(event: Event): void {
    const draft = this.draft();
    if (draft?.type === 'text') this.draft.set({ ...draft, text: (event.target as HTMLInputElement).value });
  }

  protected setSelect(event: Event): void {
    const draft = this.draft();
    if (draft?.type === 'select') this.draft.set({ ...draft, value: (event.target as HTMLSelectElement).value });
  }

  protected isChecked(value: string): boolean {
    const draft = this.draft();
    return draft?.type === 'multiSelect' && draft.values.includes(value);
  }

  protected toggleValue(value: string, event: Event): void {
    const draft = this.draft();
    if (draft?.type !== 'multiSelect') return;
    const checked = (event.target as HTMLInputElement).checked;
    const field = this.draftField();
    const set = new Set(draft.values);
    if (checked) set.add(value);
    else set.delete(value);
    // 依選項原本的順序存，chip 文字才穩定。
    const order = field && field.type === 'multiSelect' ? field.options.map((o) => o.value) : [...set];
    this.draft.set({ ...draft, values: order.filter((v) => set.has(v)) });
  }

  protected setDatePreset(choice: FilterDatePreset | 'custom'): void {
    const draft = this.draft();
    if (draft?.type !== 'dateRange') return;
    this.datePresetChoice.set(choice);
    this.draft.set(
      choice === 'custom'
        ? { field: draft.field, type: 'dateRange', from: draft.from, to: draft.to }
        : { field: draft.field, type: 'dateRange', preset: choice },
    );
  }

  protected dateStart(): Date | null {
    const draft = this.draft();
    return draft?.type === 'dateRange' && draft.from ? parseLocalDate(draft.from) : null;
  }

  protected dateEnd(): Date | null {
    const draft = this.draft();
    return draft?.type === 'dateRange' && draft.to ? parseLocalDate(draft.to) : null;
  }

  protected setDateRange(range: SelectedDateRange): void {
    const draft = this.draft();
    if (draft?.type !== 'dateRange') return;
    this.draft.set({
      field: draft.field,
      type: 'dateRange',
      from: toLocalDateString(range.start),
      to: toLocalDateString(range.end),
    });
  }

  protected presetsOf(field: FilterField<T>): readonly FilterDatePreset[] {
    return field.type === 'dateRange' ? (field.presets ?? ['today', 'week']) : [];
  }

  protected presetLabel(preset: FilterDatePreset): string {
    return preset === 'today' ? this.labels().presetToday : this.labels().presetWeek;
  }

  protected numberOf(which: 'min' | 'max'): string {
    const draft = this.draft();
    if (draft?.type !== 'numberRange') return '';
    const v = draft[which];
    return Number.isFinite(v) ? String(v) : '';
  }

  protected setNumber(which: 'min' | 'max', event: Event): void {
    const draft = this.draft();
    if (draft?.type !== 'numberRange') return;
    const raw = (event.target as HTMLInputElement).value.trim();
    const n = raw === '' ? undefined : Number(raw);
    this.draft.set({ ...draft, [which]: Number.isFinite(n) ? n : undefined });
  }

  protected apply(): void {
    const draft = this.draft();
    if (!draft) return;
    this.conditions.set(upsertCondition(this.conditions(), normalizeDraft(draft)));
    this.close();
  }

  /** 文字與數字欄位按 Enter 直接套用。 */
  protected onFieldEnter(event: Event): void {
    event.preventDefault();
    this.apply();
  }
}

/** 最小值大於最大值時對調；文字去頭尾空白。 */
function normalizeDraft(cond: FilterCondition): FilterCondition {
  if (cond.type === 'text') return { ...cond, text: cond.text.trim() };
  if (cond.type === 'numberRange' && Number.isFinite(cond.min) && Number.isFinite(cond.max)) {
    const min = cond.min as number;
    const max = cond.max as number;
    if (min > max) return { ...cond, min: max, max: min };
  }
  return cond;
}
