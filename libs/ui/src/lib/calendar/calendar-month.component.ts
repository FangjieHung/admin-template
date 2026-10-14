import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  Injector,
  input,
  output,
  signal,
} from '@angular/core';
import { CalendarEvent, CalendarWeekday } from './calendar.types';
import { CalendarEventComponent } from './calendar-event.component';
import { CalendarStore } from './calendar-store';
import { addDays, dayKey, diffCalendarDays, isSameDay, isoWeek, monthGrid, parseDayKey, startOfDay } from './calendar-date';
import { CalendarSegment, MonthDayBucket, bucketMonth, segmentOn } from './calendar-layout';
import { trackPointerDrag } from './calendar-drag';

interface MonthCell extends MonthDayBucket {
  key: string;
  outside: boolean;
  today: boolean;
  label: string;
  ghost: CalendarSegment | null;
  dots: string[];
}

interface MonthWeek {
  key: string;
  number: number;
  cells: MonthCell[];
}

/** 鍵盤在月曆格移動：左右一天、上下一週、Home／End 到週首週末；PageUp／PageDown 換月由外層處理。 */
export function monthKeyDelta(key: string, date: Date, weekStartsOn: CalendarWeekday): number | null {
  switch (key) {
    case 'ArrowLeft':
      return -1;
    case 'ArrowRight':
      return 1;
    case 'ArrowUp':
      return -7;
    case 'ArrowDown':
      return 7;
    case 'Home':
      return -((date.getDay() - weekStartsOn + 7) % 7);
    case 'End':
      return 6 - ((date.getDay() - weekStartsOn + 7) % 7);
    default:
      return null;
  }
}

/**
 * 月檢視（lib-calendar 內部用）：`role="grid"`，方向鍵在日子之間移動（只有目前那一格在 Tab 順序裡，
 * Tab 再進到那一格的活動）；每天最多 `maxEvents` 筆，其餘收成「+N 筆」，按下打開當天的完整清單。
 * 空白處點一下或拖過幾天＝選了那幾天（整天）；拖曳活動換日子（保留時間），Alt＋方向鍵也可以。
 */
@Component({
  selector: 'lib-cal-month',
  imports: [CalendarEventComponent],
  templateUrl: './calendar-month.component.html',
  styleUrl: './calendar-month.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cal-month', '[class.is-compact]': 'compact()' },
})
export class CalendarMonthComponent {
  readonly anchor = input.required<Date>();
  readonly maxEvents = input(3);
  readonly showWeekNumbers = input(false);
  /** 迷你月曆：每天只畫圓點，按下有活動的日子打開清單。 */
  readonly compact = input(false);
  /** 格子的無障礙名稱（月曆標題）。 */
  readonly gridLabel = input('');

  /** 鍵盤移到這個月以外的日子，或 PageUp／PageDown：請外層換月。 */
  readonly anchorChange = output<Date>();

  protected readonly store = inject(CalendarStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  private readonly focusDate = signal<Date | null>(null);
  /** 拖過幾天的選取（整天）。 */
  protected readonly selection = signal<{ from: Date; to: Date } | null>(null);
  protected readonly popover = signal<{ key: string; top: number; left: number } | null>(null);
  private popoverTrigger: HTMLElement | null = null;

  protected readonly weekdayHeads = computed(() => {
    const start = this.store.state().weekStartsOn();
    const fmt = this.store.fmt();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2026, 0, 4 + ((start + i) % 7)); // 2026/1/4 是星期日
      return { key: i, short: fmt.weekdayShort(d), long: fmt.weekday(d) };
    });
  });

  protected readonly focusKey = computed(() => {
    const anchor = this.anchor();
    const focus = this.focusDate();
    if (focus && focus.getMonth() === anchor.getMonth() && focus.getFullYear() === anchor.getFullYear()) return dayKey(focus);
    const today = this.store.today();
    if (today.getMonth() === anchor.getMonth() && today.getFullYear() === anchor.getFullYear()) return dayKey(today);
    return dayKey(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  });

  protected readonly weeks = computed<MonthWeek[]>(() => {
    const anchor = this.anchor();
    const grid = monthGrid(anchor, this.store.state().weekStartsOn());
    const days = grid.flat();
    const max = this.compact() ? 0 : this.maxEvents();
    const buckets = bucketMonth(days, this.store.events(), max);
    const today = this.store.today();
    const fmt = this.store.fmt();
    const labels = this.store.labels();
    const preview = this.store.preview();
    const cells = buckets.map<MonthCell>((b) => {
      const isToday = isSameDay(b.date, today);
      const label = [
        this.store.format(labels.dayCell, { date: fmt.dateLong(b.date), count: b.all.length }),
        isToday ? labels.todayMark : '',
      ]
        .filter(Boolean)
        .join('，');
      return {
        ...b,
        key: dayKey(b.date),
        outside: b.date.getMonth() !== anchor.getMonth(),
        today: isToday,
        label,
        ghost: preview ? segmentOn(preview.event, b.date) : null,
        dots: b.all.slice(0, 3).map((s) => this.store.colorOf(s.event)),
      };
    });
    return grid.map((week, w) => ({ key: dayKey(week[0]), number: isoWeek(week[0]), cells: cells.slice(w * 7, w * 7 + 7) }));
  });

  protected readonly popoverCell = computed(() => {
    const pop = this.popover();
    if (!pop) return null;
    return this.weeks().flatMap((w) => w.cells).find((c) => c.key === pop.key) ?? null;
  });

  constructor() {
    const onDocDown = (e: PointerEvent) => {
      const panel = this.host.nativeElement.querySelector('.cal-pop');
      if (this.popover() && panel && !panel.contains(e.target as Node) && e.target !== this.popoverTrigger) this.closePopover(false);
    };
    document.addEventListener('pointerdown', onDocDown, true);
    this.destroyRef.onDestroy(() => document.removeEventListener('pointerdown', onDocDown, true));
  }

  protected isSelected(cell: MonthCell): boolean {
    const sel = this.selection();
    return !!sel && cell.date.getTime() >= sel.from.getTime() && cell.date.getTime() <= sel.to.getTime();
  }

  // ---- 鍵盤：日子之間 ----

  protected onGridKey(e: KeyboardEvent): void {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-date]');
    if (!cell || e.target !== cell) return;
    const date = parseDayKey(cell.dataset['date'] ?? '');
    if (!date) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.activateDay(date, cell);
      return;
    }
    let next: Date | null = null;
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      const d = new Date(date.getFullYear(), date.getMonth() + (e.key === 'PageUp' ? -1 : 1), 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      next = new Date(d.getFullYear(), d.getMonth(), Math.min(date.getDate(), last));
    } else {
      const delta = monthKeyDelta(e.key, date, this.store.state().weekStartsOn());
      if (delta === null) return;
      next = addDays(date, delta);
    }
    e.preventDefault();
    this.focusDay(next);
  }

  private focusDay(date: Date): void {
    this.focusDate.set(date);
    const anchor = this.anchor();
    if (date.getMonth() !== anchor.getMonth() || date.getFullYear() !== anchor.getFullYear()) this.anchorChange.emit(date);
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(`[data-date="${dayKey(date)}"]`)?.focus(), {
      injector: this.injector,
    });
  }

  /** Enter／點一下空白處：迷你月曆打開當天清單，一般月曆選取這一天。 */
  private activateDay(date: Date, cell: HTMLElement): void {
    const bucket = this.weeks().flatMap((w) => w.cells).find((c) => c.key === dayKey(date));
    if (this.compact()) {
      if (bucket?.all.length) this.openPopover(bucket.key, cell);
      return;
    }
    if (this.store.state().readonly()) return;
    this.store.state().select({ start: startOfDay(date), end: addDays(startOfDay(date), 1), allDay: true, resourceId: null });
  }

  protected onCellClick(e: MouseEvent, cell: MonthCell): void {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    this.focusDate.set(cell.date);
    this.activateDay(cell.date, e.currentTarget as HTMLElement);
  }

  // ---- 拖過幾天選取 ----

  protected onCellPointerDown(e: PointerEvent, cell: MonthCell): void {
    if (e.button !== 0 || this.compact() || this.store.state().readonly() || (e.target as HTMLElement).closest('button')) return;
    if (e.pointerType === 'touch') return;
    const rects = this.cellRects();
    const from = cell.date;
    trackPointerDrag(e, {
      move: (_dx, _dy, ev) => {
        const to = this.dayAt(rects, ev.clientX, ev.clientY) ?? from;
        this.selection.set(to < from ? { from: to, to: from } : { from, to });
      },
      end: (committed) => {
        const sel = this.selection();
        this.selection.set(null);
        if (!committed || !sel) return;
        this.store.state().select({ start: sel.from, end: addDays(sel.to, 1), allDay: true, resourceId: null });
      },
    });
  }

  // ---- 活動：拖曳換日子、鍵盤 ----

  protected onEventPointerDown(e: PointerEvent, segment: CalendarSegment, cell: MonthCell): void {
    const event = segment.event;
    if (e.button !== 0 || e.pointerType === 'touch' || !this.store.canEdit(event)) return;
    const rects = this.cellRects();
    const origin = cell.date;
    trackPointerDrag(e, {
      move: (_dx, _dy, ev) => {
        const target = this.dayAt(rects, ev.clientX, ev.clientY) ?? origin;
        this.store.previewChange(event, { days: diffCalendarDays(origin, target), minutes: 0 }, null);
      },
      end: (committed) => this.store.endDrag(event, committed),
    });
  }

  protected onEventKey(e: KeyboardEvent, event: CalendarEvent): void {
    if (!e.altKey) return;
    const days = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' ? -7 : e.key === 'ArrowDown' ? 7 : 0;
    if (!days) return;
    e.preventDefault();
    e.stopPropagation();
    this.store.keyboardChange(event, { days, minutes: 0 }, e.shiftKey ? 'end' : null);
  }

  private cellRects(): { date: Date; rect: DOMRect }[] {
    return [...this.host.nativeElement.querySelectorAll<HTMLElement>('.cal-day[data-date]')].map((el) => ({
      date: parseDayKey(el.dataset['date'] ?? '') ?? new Date(),
      rect: el.getBoundingClientRect(),
    }));
  }

  private dayAt(rects: { date: Date; rect: DOMRect }[], x: number, y: number): Date | null {
    const hit = rects.find(({ rect }) => x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom);
    return hit?.date ?? null;
  }

  // ---- 「+N 筆」浮動清單 ----

  protected openMore(e: MouseEvent, cell: MonthCell): void {
    e.stopPropagation();
    const cellEl = (e.currentTarget as HTMLElement).closest<HTMLElement>('.cal-day');
    if (cellEl) this.openPopover(cell.key, cellEl, e.currentTarget as HTMLElement);
  }

  private openPopover(key: string, cellEl: HTMLElement, trigger: HTMLElement = cellEl): void {
    const hostRect = this.host.nativeElement.getBoundingClientRect();
    const rect = cellEl.getBoundingClientRect();
    const width = Math.min(18 * 16, hostRect.width);
    const left = Math.max(0, Math.min(rect.left - hostRect.left - 8, hostRect.width - width));
    this.popoverTrigger = trigger;
    this.popover.set({ key, top: rect.top - hostRect.top, left });
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('.cal-pop .cal-ev')?.focus(), {
      injector: this.injector,
    });
  }

  protected closePopover(restoreFocus = true): void {
    this.popover.set(null);
    if (restoreFocus) this.popoverTrigger?.focus();
    this.popoverTrigger = null;
  }

  protected onPopoverKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.closePopover();
    }
  }

  protected openEvent(event: CalendarEvent): void {
    this.store.state().open(event);
  }
}
