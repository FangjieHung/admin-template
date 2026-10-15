import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, signal } from '@angular/core';
import { CalendarEvent, CalendarRange, CalendarResource, CalendarResourceScale } from './calendar.types';
import { CalendarEventComponent } from './calendar-event.component';
import { CalendarStore } from './calendar-store';
import { MINUTES_PER_DAY, addDays, addMinutes, atMinutes, dayKey, daysFrom, diffCalendarDays, diffWallMinutes, isSameDay } from './calendar-date';
import { effectiveEnd, packLanes } from './calendar-layout';
import { CalendarDelta, CalendarEdge, clampToHours, snapTo, trackPointerDrag } from './calendar-drag';

/** 時間軸的範圍：從哪個時間開始、總共幾分鐘（鐘面分鐘）。 */
export interface TimelineWindow {
  start: Date;
  minutes: number;
}

/** 某個時間在時間軸上的位置（0–1，超出範圍會被夾住）。 */
export function timelineFraction(window: TimelineWindow, date: Date): number {
  return Math.max(0, Math.min(1, diffWallMinutes(window.start, date) / window.minutes));
}

export interface TimelineItem {
  event: CalendarEvent;
  lane: number;
  left: number;
  width: number;
  /** 被範圍左右邊界截斷了。 */
  cutStart: boolean;
  cutEnd: boolean;
}

export interface TimelineRow {
  resource: CalendarResource;
  items: TimelineItem[];
  lanes: number;
}

interface TimelineGroup {
  key: string;
  title: string | null;
  rows: TimelineRow[];
}

/** 一個資源的活動排進時間軸：依時間算左右位置（%），重疊的疊成好幾條。 */
export function layoutRow(resource: CalendarResource, events: readonly CalendarEvent[], window: TimelineWindow): TimelineRow {
  const mine = events
    .filter((e) => e.resourceId === resource.id)
    .map((event) => ({ event, from: timelineFraction(window, event.start), to: timelineFraction(window, effectiveEnd(event)) }))
    .filter((x) => x.to > x.from || (x.from > 0 && x.from < 1));
  const packed = packLanes(mine.map((x) => ({ id: x.event.id, start: x.event.start, end: effectiveEnd(x.event) })));
  return {
    resource,
    lanes: packed.count,
    items: mine.map((x) => ({
      event: x.event,
      lane: packed.lanes.get(x.event.id) ?? 0,
      left: x.from * 100,
      width: Math.max(0.5, (x.to - x.from) * 100),
      cutStart: diffWallMinutes(window.start, x.event.start) < 0,
      cutEnd: diffWallMinutes(window.start, effectiveEnd(x.event)) > window.minutes,
    })),
  };
}

/**
 * 資源排程（lib-calendar 內部用）：每一列是一個資源（可分組），橫軸是時間——日刻度以小時為欄，週／月刻度以天為欄。
 * 資源欄與時間標題在自己的捲動容器裡黏住（左、上）；拖曳活動左右換時間、上下換資源，拉左右緣調整長度；
 * 空白處點一下或拖出一段＝在那個資源選取一段時間。`allowOverlap=false` 時同一列重疊的活動標成衝突。
 */
@Component({
  selector: 'lib-cal-resource',
  imports: [CalendarEventComponent],
  templateUrl: './calendar-resource.component.html',
  styleUrl: './calendar-resource.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cal-rt' },
})
export class CalendarResourceComponent {
  readonly range = input.required<CalendarRange>();
  readonly scale = input<CalendarResourceScale>('week');
  readonly gridLabel = input('');
  /** 要顯示的資源（外層已套用資源篩選）。 */
  readonly resources = input.required<readonly CalendarResource[]>();

  protected readonly store = inject(CalendarStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly selection = signal<{ resourceId: string; left: number; width: number } | null>(null);

  protected readonly window = computed<TimelineWindow>(() => {
    const range = this.range();
    if (this.scale() === 'day') {
      const from = this.store.state().dayStart() * 60;
      return { start: atMinutes(range.start, from), minutes: this.store.state().dayEnd() * 60 - from };
    }
    return { start: range.start, minutes: diffCalendarDays(range.start, range.end) * MINUTES_PER_DAY };
  });

  /** 移動的最小單位（分鐘）：日刻度是時段，週／月刻度是一天。 */
  protected readonly unit = computed(() => (this.scale() === 'day' ? this.store.state().slotMinutes() : MINUTES_PER_DAY));

  protected readonly columns = computed(() => {
    const range = this.range();
    const today = this.store.today();
    const fmt = this.store.fmt();
    if (this.scale() === 'day') {
      const from = this.store.state().dayStart();
      return Array.from({ length: this.store.state().dayEnd() - from }, (_, i) => ({
        key: `h${from + i}`,
        top: fmt.hourLabel(from + i),
        bottom: '',
        label: fmt.hourLabel(from + i),
        today: false,
      }));
    }
    return daysFrom(range.start, diffCalendarDays(range.start, range.end)).map((d) => ({
      key: dayKey(d),
      top: fmt.weekdayShort(d),
      bottom: String(d.getDate()),
      label: [fmt.dateLong(d), isSameDay(d, today) ? this.store.labels().todayMark : ''].filter(Boolean).join('，'),
      today: isSameDay(d, today),
    }));
  });

  protected readonly groups = computed<TimelineGroup[]>(() => {
    const events = this.store.events();
    const window = this.window();
    const groups: TimelineGroup[] = [];
    for (const resource of this.resources()) {
      const key = resource.group ?? '';
      let group = groups.find((g) => g.key === key);
      if (!group) {
        group = { key, title: resource.group ?? null, rows: [] };
        groups.push(group);
      }
      group.rows.push(layoutRow(resource, events, window));
    }
    return groups;
  });

  protected readonly ghost = computed(() => {
    const preview = this.store.preview();
    if (!preview) return null;
    const window = this.window();
    const from = timelineFraction(window, preview.event.start);
    const to = timelineFraction(window, effectiveEnd(preview.event));
    if (to <= from) return null;
    return { preview, resourceId: preview.event.resourceId ?? null, left: from * 100, width: (to - from) * 100 };
  });

  protected readonly nowLeft = computed(() => {
    const window = this.window();
    const minutes = diffWallMinutes(window.start, this.store.today());
    if (minutes < 0 || minutes > window.minutes) return null;
    return minutes / window.minutes;
  });

  protected readonly todayBand = computed(() => {
    if (this.scale() === 'day') return null;
    const range = this.range();
    const i = diffCalendarDays(range.start, this.store.today());
    const n = diffCalendarDays(range.start, range.end);
    if (i < 0 || i >= n) return null;
    return { left: (i / n) * 100, width: 100 / n };
  });

  private clamp = (e: CalendarEvent) =>
    this.scale() === 'day' ? clampToHours(e, this.store.state().dayStart() * 60, this.store.state().dayEnd() * 60) : e;

  private rowRects(): { id: string; rect: DOMRect }[] {
    return [...this.host.nativeElement.querySelectorAll<HTMLElement>('[data-resource-row]')].map((el) => ({
      id: el.dataset['resourceRow'] ?? '',
      rect: el.getBoundingClientRect(),
    }));
  }

  private trackRect(): DOMRect | null {
    return this.host.nativeElement.querySelector<HTMLElement>('.rt__track')?.getBoundingClientRect() ?? null;
  }

  /** 指標 x → 從範圍開始算的分鐘（往下對齊單位）。 */
  private minuteAt(rect: DOMRect, x: number): number {
    const ratio = Math.max(0, Math.min(0.9999, (x - rect.left) / rect.width));
    const unit = this.unit();
    return Math.floor((ratio * this.window().minutes) / unit) * unit;
  }

  // ---- 拖曳活動 ----

  protected onEventPointerDown(e: PointerEvent, event: CalendarEvent): void {
    if (e.button !== 0 || !this.store.canEdit(event)) return;
    const edge = ((e.target as HTMLElement).closest<HTMLElement>('[data-edge]')?.dataset['edge'] as CalendarEdge | undefined) ?? null;
    const track = this.trackRect();
    if (!track) return;
    const rows = this.rowRects();
    const pxPerMinute = track.width / this.window().minutes;
    const unit = this.unit();
    trackPointerDrag(e, {
      move: (dx, _dy, ev) => {
        const minutes = snapTo(dx / pxPerMinute, unit);
        const delta: CalendarDelta = unit === MINUTES_PER_DAY ? { days: minutes / MINUTES_PER_DAY, minutes: 0 } : { days: 0, minutes };
        if (!edge) {
          const row = rows.find(({ rect }) => ev.clientY >= rect.top && ev.clientY < rect.bottom);
          if (row) delta.resourceId = row.id;
        }
        this.store.previewChange(event, delta, edge, this.clamp);
      },
      end: (committed) => this.store.endDrag(event, committed),
    });
  }

  protected onEventKey(e: KeyboardEvent, event: CalendarEvent): void {
    if (!e.altKey) return;
    const unit = this.unit();
    const step = unit === MINUTES_PER_DAY ? { days: 1, minutes: 0 } : { days: 0, minutes: unit };
    let delta: CalendarDelta | null = null;
    if (e.key === 'ArrowLeft') delta = { days: -step.days, minutes: -step.minutes };
    else if (e.key === 'ArrowRight') delta = { ...step };
    else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey) {
      const ids = this.resources().map((r) => r.id);
      const next = ids[ids.indexOf(event.resourceId ?? '') + (e.key === 'ArrowUp' ? -1 : 1)];
      if (next !== undefined) delta = { days: 0, minutes: 0, resourceId: next };
    }
    if (!delta) return;
    e.preventDefault();
    e.stopPropagation();
    this.store.keyboardChange(event, delta, e.shiftKey ? 'end' : null, this.clamp);
  }

  // ---- 空白處選取 ----

  protected onTrackPointerDown(e: PointerEvent, resourceId: string): void {
    if (e.button !== 0 || e.pointerType === 'touch' || this.store.state().readonly()) return;
    if ((e.target as HTMLElement).closest('button')) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const from = this.minuteAt(rect, e.clientX);
    const total = this.window().minutes;
    trackPointerDrag(e, {
      move: (_dx, _dy, ev) => {
        const at = this.minuteAt(rect, ev.clientX);
        const lo = Math.min(from, at);
        const hi = Math.max(from, at) + this.unit();
        this.selection.set({ resourceId, left: (lo / total) * 100, width: ((hi - lo) / total) * 100 });
      },
      end: (committed) => {
        const sel = this.selection();
        this.selection.set(null);
        if (!committed || !sel) return;
        const lo = Math.round((sel.left / 100) * total);
        const hi = Math.round(((sel.left + sel.width) / 100) * total);
        this.emitSelection(resourceId, lo, hi);
      },
    });
  }

  protected onTrackClick(e: MouseEvent, resourceId: string): void {
    if ((e.target as HTMLElement).closest('button') || this.store.state().readonly()) return;
    const from = this.minuteAt((e.currentTarget as HTMLElement).getBoundingClientRect(), e.clientX);
    this.emitSelection(resourceId, from, from + this.unit());
  }

  private emitSelection(resourceId: string, from: number, to: number): void {
    const window = this.window();
    const allDay = this.unit() === MINUTES_PER_DAY;
    const at = (minutes: number) =>
      allDay ? addDays(window.start, Math.round(minutes / MINUTES_PER_DAY)) : addMinutes(window.start, minutes);
    const start = at(from);
    const end = at(to);
    this.store.state().select({ start, end, allDay, resourceId });
  }

  protected open(event: CalendarEvent): void {
    this.store.state().open(event);
  }
}
