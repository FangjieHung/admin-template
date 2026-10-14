import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CalendarEvent } from './calendar.types';
import { CalendarEventComponent } from './calendar-event.component';
import { CalendarStore } from './calendar-store';
import { atMinutes, dayKey, isSameDay, minutesOfDay, startOfDay } from './calendar-date';
import { CalendarSegment, compareEvents, packColumns, segmentOn } from './calendar-layout';
import { CalendarDelta, CalendarEdge, clampToHours, snapTo, trackPointerDrag } from './calendar-drag';

export interface PositionedSegment {
  segment: CalendarSegment;
  top: number;
  height: number;
  left: number;
  width: number;
}

interface GridDay {
  date: Date;
  key: string;
  today: boolean;
  label: string;
  allDay: CalendarSegment[];
  timed: PositionedSegment[];
}

/** 把一天裡有時間的片段排進 dayStart–dayEnd 的時間格（百分比位置，重疊的並排）。 */
export function layoutDay(
  segments: readonly CalendarSegment[],
  day: Date,
  dayStartMinutes: number,
  dayEndMinutes: number,
): PositionedSegment[] {
  const total = dayEndMinutes - dayStartMinutes;
  const clipped = segments
    .map((segment) => {
      const s = Math.max(dayStartMinutes, isSameDay(segment.start, day) ? minutesOfDay(segment.start) : 0);
      const endMin = isSameDay(segment.end, day) ? minutesOfDay(segment.end) : 24 * 60;
      const e = Math.min(dayEndMinutes, endMin);
      return { segment, s, e: Math.max(e, s + Math.min(15, total)) };
    })
    .filter((c) => c.s < dayEndMinutes && c.e > dayStartMinutes);
  const packed = packColumns(clipped.map((c) => ({ id: c.segment.event.id, start: atMinutes(day, c.s), end: atMinutes(day, c.e) })));
  return clipped.map(({ segment, s, e }) => {
    const p = packed.get(segment.event.id) ?? { column: 0, columns: 1, span: 1 };
    return {
      segment,
      top: ((s - dayStartMinutes) / total) * 100,
      height: ((Math.min(e, dayEndMinutes) - s) / total) * 100,
      left: (p.column / p.columns) * 100,
      width: (p.span / p.columns) * 100,
    };
  });
}

/**
 * 週／日檢視（lib-calendar 內部用）：上方是星期與「整天」列（捲動時黏在上面），下方是 dayStart–dayEnd 的時間格，
 * 打開時捲到上班時間。重疊的活動並排；拖曳移動（上下換時間、左右換日子）、拉上下緣調整長度，都對齊時段；
 * 空白處點一下或拖出一段＝選取那段時間。今天有「現在」的紅線。
 */
@Component({
  selector: 'lib-cal-time-grid',
  imports: [CalendarEventComponent],
  templateUrl: './calendar-time-grid.component.html',
  styleUrl: './calendar-time-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cal-tg' },
})
export class CalendarTimeGridComponent {
  readonly days = input.required<readonly Date[]>();
  /** 打開時捲到幾點。 */
  readonly scrollToHour = input(8);
  readonly gridLabel = input('');
  /** 按了某一天的標題（外層切到日檢視）。 */
  readonly dayClick = output<Date>();

  protected readonly store = inject(CalendarStore);
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly body = viewChild.required<ElementRef<HTMLElement>>('body');

  protected readonly selection = signal<{ key: string; from: number; to: number } | null>(null);
  protected readonly hover = signal<{ key: string; minute: number } | null>(null);

  protected readonly startMin = computed(() => this.store.state().dayStart() * 60);
  protected readonly endMin = computed(() => this.store.state().dayEnd() * 60);
  protected readonly total = computed(() => this.endMin() - this.startMin());
  protected readonly slot = computed(() => this.store.state().slotMinutes());
  protected readonly hours = computed(() => {
    const from = this.store.state().dayStart();
    return Array.from({ length: this.store.state().dayEnd() - from }, (_, i) => ({ hour: from + i, label: this.store.fmt().hourLabel(from + i) }));
  });

  protected readonly grid = computed<GridDay[]>(() => {
    const events = [...this.store.events()].sort(compareEvents);
    const today = this.store.today();
    const fmt = this.store.fmt();
    return this.days().map((date) => {
      const segments = events.map((e) => segmentOn(e, date)).filter((s): s is CalendarSegment => s !== null);
      const isToday = isSameDay(date, today);
      return {
        date,
        key: dayKey(date),
        today: isToday,
        label: [fmt.dateLong(date), isToday ? this.store.labels().todayMark : ''].filter(Boolean).join('，'),
        allDay: segments.filter((s) => s.event.allDay),
        timed: layoutDay(
          segments.filter((s) => !s.event.allDay),
          date,
          this.startMin(),
          this.endMin(),
        ),
      };
    });
  });

  /** 拖曳預覽在每一天的位置（整天或時間格）。 */
  protected readonly ghosts = computed(() => {
    const preview = this.store.preview();
    const result = new Map<string, { allDay: CalendarSegment | null; timed: PositionedSegment | null }>();
    if (!preview) return result;
    for (const date of this.days()) {
      const seg = segmentOn(preview.event, date);
      if (!seg) continue;
      if (preview.event.allDay) result.set(dayKey(date), { allDay: seg, timed: null });
      else {
        const [timed] = layoutDay([seg], date, this.startMin(), this.endMin());
        result.set(dayKey(date), { allDay: null, timed: timed ? { ...timed, left: 0, width: 100 } : null });
      }
    }
    return result;
  });

  protected readonly nowTop = computed(() => {
    const now = this.store.today();
    const m = minutesOfDay(now);
    if (m < this.startMin() || m > this.endMin()) return null;
    return ((m - this.startMin()) / this.total()) * 100;
  });

  constructor() {
    afterNextRender(() => this.scrollToWorkingHours());
  }

  /** 捲到上班時間（scrollToHour）。 */
  scrollToWorkingHours(): void {
    const scroller = this.scroller().nativeElement;
    const body = this.body().nativeElement;
    const ratio = (this.scrollToHour() * 60 - this.startMin()) / this.total();
    // 時間格緊接在黏住的標題列下面，所以捲動量＝時間格高度 × 比例，那個鐘點剛好露在標題列下緣；
    // 再往回留半個鐘點，讓那個鐘點的刻度字整個看得到。
    const hour = body.offsetHeight / (this.total() / 60);
    scroller.scrollTop = Math.max(0, body.offsetHeight * ratio - hour / 2);
  }

  protected selectionStyle(key: string): { top: number; height: number } | null {
    const sel = this.selection();
    if (!sel || sel.key !== key) return null;
    return { top: ((sel.from - this.startMin()) / this.total()) * 100, height: ((sel.to - sel.from) / this.total()) * 100 };
  }

  protected hoverTop(key: string): number | null {
    const h = this.hover();
    if (!h || h.key !== key || this.selection() || this.store.preview()) return null;
    return ((h.minute - this.startMin()) / this.total()) * 100;
  }

  private clamp = (e: CalendarEvent) => clampToHours(e, this.startMin(), this.endMin());

  /** 指標位置 → 當天第幾分鐘（對齊時段，往下取整）。 */
  private minuteAt(colRect: DOMRect, y: number): number {
    const ratio = Math.max(0, Math.min(1, (y - colRect.top) / colRect.height));
    const raw = this.startMin() + ratio * this.total();
    return Math.min(this.endMin() - this.slot(), Math.floor(raw / this.slot()) * this.slot());
  }

  private columns(): { key: string; rect: DOMRect }[] {
    return [...this.body().nativeElement.querySelectorAll<HTMLElement>('.tg__col[data-date]')].map((el) => ({
      key: el.dataset['date'] ?? '',
      rect: el.getBoundingClientRect(),
    }));
  }

  private columnIndexAt(cols: { rect: DOMRect }[], x: number, fallback: number): number {
    const i = cols.findIndex(({ rect }) => x >= rect.left && x < rect.right);
    if (i !== -1) return i;
    if (!cols.length) return fallback;
    return x < cols[0].rect.left ? 0 : cols.length - 1;
  }

  // ---- 空白處：滑過提示、點一下或拖出一段選取 ----

  protected onColPointerMove(e: PointerEvent, key: string): void {
    if (e.pointerType !== 'mouse' || this.store.state().readonly()) return;
    const col = e.currentTarget as HTMLElement;
    this.hover.set({ key, minute: this.minuteAt(col.getBoundingClientRect(), e.clientY) });
  }

  protected onColPointerDown(e: PointerEvent, day: GridDay): void {
    if (e.button !== 0 || e.pointerType === 'touch' || this.store.state().readonly()) return;
    if ((e.target as HTMLElement).closest('button')) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const from = this.minuteAt(rect, e.clientY);
    trackPointerDrag(e, {
      move: (_dx, _dy, ev) => {
        const at = this.minuteAt(rect, ev.clientY);
        const lo = Math.min(from, at);
        const hi = Math.max(from, at) + this.slot();
        this.selection.set({ key: day.key, from: lo, to: hi });
      },
      end: (committed) => {
        const sel = this.selection();
        this.selection.set(null);
        if (committed && sel) this.emitSelection(day.date, sel.from, sel.to);
      },
    });
  }

  protected onColClick(e: MouseEvent, day: GridDay): void {
    if ((e.target as HTMLElement).closest('button') || this.store.state().readonly()) return;
    const from = this.minuteAt((e.currentTarget as HTMLElement).getBoundingClientRect(), e.clientY);
    this.emitSelection(day.date, from, from + this.slot());
  }

  private emitSelection(day: Date, from: number, to: number): void {
    this.store.state().select({ start: atMinutes(day, from), end: atMinutes(day, to), allDay: false, resourceId: null });
  }

  protected onAllDayClick(e: MouseEvent, day: GridDay): void {
    if ((e.target as HTMLElement).closest('button') || this.store.state().readonly()) return;
    const start = startOfDay(day.date);
    this.store.state().select({ start, end: atMinutes(start, 24 * 60), allDay: true, resourceId: null });
  }

  // ---- 拖曳活動 ----

  protected onEventPointerDown(e: PointerEvent, segment: CalendarSegment, dayIndex: number): void {
    const event = segment.event;
    if (e.button !== 0 || e.pointerType === 'touch' || !this.store.canEdit(event)) return;
    const edgeEl = (e.target as HTMLElement).closest<HTMLElement>('[data-edge]');
    const edge = (edgeEl?.dataset['edge'] as CalendarEdge | undefined) ?? null;
    const cols = this.columns();
    const pxPerMinute = (cols[0]?.rect.height ?? 1) / this.total();
    const allDay = !!event.allDay;
    trackPointerDrag(e, {
      move: (_dx, dy, ev) => {
        const days = this.columnIndexAt(cols, ev.clientX, dayIndex) - dayIndex;
        const minutes = allDay ? 0 : snapTo(dy / pxPerMinute, this.slot());
        const delta: CalendarDelta = { days, minutes };
        // 拉上緣只改時間；拉下緣也可以拉到別天。
        if (edge === 'start' && !allDay) delta.days = 0;
        this.store.previewChange(event, delta, edge, allDay ? undefined : this.clamp);
      },
      end: (committed) => this.store.endDrag(event, committed),
    });
  }

  protected onEventKey(e: KeyboardEvent, event: CalendarEvent): void {
    if (!e.altKey) return;
    const slot = event.allDay ? 0 : this.slot();
    let delta: CalendarDelta | null = null;
    if (e.key === 'ArrowUp' && slot) delta = { days: 0, minutes: -slot };
    else if (e.key === 'ArrowDown' && slot) delta = { days: 0, minutes: slot };
    else if (e.key === 'ArrowLeft') delta = { days: -1, minutes: 0 };
    else if (e.key === 'ArrowRight') delta = { days: 1, minutes: 0 };
    if (!delta) return;
    e.preventDefault();
    e.stopPropagation();
    this.store.keyboardChange(event, delta, e.shiftKey ? 'end' : null, event.allDay ? undefined : this.clamp);
  }

  protected open(event: CalendarEvent): void {
    this.store.state().open(event);
  }

  protected onDayClick(date: Date): void {
    this.dayClick.emit(date);
  }
}
