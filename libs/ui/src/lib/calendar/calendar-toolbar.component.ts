import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { CalendarResource, CalendarResourceScale, CalendarView } from './calendar.types';
import { CalendarStore } from './calendar-store';

let nextId = 0;

/**
 * 日曆上方的工具列（lib-calendar 內部用）：今天、往前／往後、期間標題（按下選月份）、檢視切換、資源排程的刻度、資源篩選。
 * 檢視與刻度切換是 `.ui-nav-pill`（按下時 aria-pressed），今天與前後是 Material 按鈕，造型都交給質地。
 */
@Component({
  selector: 'lib-cal-toolbar',
  imports: [MatButtonModule],
  templateUrl: './calendar-toolbar.component.html',
  styleUrl: './calendar-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cal-toolbar' },
})
export class CalendarToolbarComponent {
  readonly title = input.required<string>();
  readonly anchor = input.required<Date>();
  readonly view = input.required<CalendarView>();
  readonly views = input.required<readonly CalendarView[]>();
  readonly scale = input<CalendarResourceScale>('week');
  readonly resources = input<readonly CalendarResource[]>([]);
  readonly showFilter = input(false);
  readonly filter = input('');

  readonly today = output<void>();
  readonly step = output<1 | -1>();
  readonly viewChange = output<CalendarView>();
  readonly scaleChange = output<CalendarResourceScale>();
  readonly pick = output<Date>();
  readonly filterChange = output<string>();

  protected readonly store = inject(CalendarStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly pickerId = `lib-cal-picker-${nextId++}`;

  protected readonly pickerOpen = signal(false);
  protected readonly pickerYear = signal(new Date().getFullYear());

  protected readonly viewOptions = computed(() => {
    const l = this.store.labels();
    const names: Record<CalendarView, string> = {
      month: l.viewMonth,
      week: l.viewWeek,
      day: l.viewDay,
      agenda: l.viewAgenda,
      resource: l.viewResource,
    };
    return this.views().map((id) => ({ id, label: names[id] }));
  });

  protected readonly scaleOptions = computed(() => {
    const l = this.store.labels();
    return [
      { id: 'day' as const, label: l.scaleDay },
      { id: 'week' as const, label: l.scaleWeek },
      { id: 'month' as const, label: l.scaleMonth },
    ];
  });

  protected readonly months = computed(() =>
    Array.from({ length: 12 }, (_, m) => ({
      m,
      label: this.store.format(this.store.labels().monthName, { month: m + 1 }),
      current: this.pickerYear() === this.anchor().getFullYear() && m === this.anchor().getMonth(),
    })),
  );

  protected readonly groups = computed(() => {
    const seen = new Set<string>();
    for (const r of this.resources()) if (r.group) seen.add(r.group);
    return [...seen];
  });

  constructor() {
    const onDocDown = (e: PointerEvent) => {
      if (!this.pickerOpen()) return;
      const root = this.host.nativeElement.querySelector('.cal-tb__period');
      if (root && !root.contains(e.target as Node)) this.pickerOpen.set(false);
    };
    document.addEventListener('pointerdown', onDocDown, true);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('pointerdown', onDocDown, true));
  }

  protected togglePicker(): void {
    if (this.pickerOpen()) {
      this.pickerOpen.set(false);
      return;
    }
    this.pickerYear.set(this.anchor().getFullYear());
    this.pickerOpen.set(true);
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('.cal-tb__month[aria-current="true"], .cal-tb__month')?.focus(), {
      injector: this.injector,
    });
  }

  protected choose(month: number): void {
    const anchor = this.anchor();
    const last = new Date(this.pickerYear(), month + 1, 0).getDate();
    this.pickerOpen.set(false);
    this.pick.emit(new Date(this.pickerYear(), month, Math.min(anchor.getDate(), last)));
    this.host.nativeElement.querySelector<HTMLElement>('.cal-tb__title')?.focus();
  }

  protected onPickerKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    this.pickerOpen.set(false);
    this.host.nativeElement.querySelector<HTMLElement>('.cal-tb__title')?.focus();
  }

  protected onFilter(e: Event): void {
    this.filterChange.emit((e.target as HTMLSelectElement).value);
  }
}
