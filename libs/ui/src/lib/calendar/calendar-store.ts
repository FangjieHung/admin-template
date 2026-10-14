import { Injectable, Signal, computed, signal } from '@angular/core';
import { CalendarLabels, formatCalendarLabel } from './calendar-labels';
import {
  CalendarCategory,
  CalendarChangeKind,
  CalendarEvent,
  CalendarResource,
  CalendarSlotSelection,
  CalendarWeekday,
} from './calendar.types';
import { CalendarFormatter } from './calendar-format';
import { CalendarSegment, conflictsWith, findConflicts } from './calendar-layout';
import { CalendarDelta, CalendarEdge, extendEvent, moveEvent, sameSchedule } from './calendar-drag';

/** lib-calendar 交給各個檢視讀的設定（全部是 signal，由外層元件提供）。 */
export interface CalendarHostState {
  labels: CalendarLabels;
  hour12: Signal<boolean>;
  readonly: Signal<boolean>;
  slotMinutes: Signal<number>;
  dayStart: Signal<number>;
  dayEnd: Signal<number>;
  weekStartsOn: Signal<CalendarWeekday>;
  allowOverlap: Signal<boolean>;
  categories: Signal<readonly CalendarCategory[]>;
  resources: Signal<readonly CalendarResource[]>;
  /** 畫面上的活動（已套用樂觀更新與資源篩選）。 */
  events: Signal<readonly CalendarEvent[]>;
  /** 現在（毫秒），每分鐘更新。 */
  now: Signal<number>;
  /** 點了活動。 */
  open(event: CalendarEvent): void;
  /** 在空白處選了一段時間。 */
  select(slot: CalendarSlotSelection): void;
  /** 送出一筆變更（拖曳放開、鍵盤移動）。 */
  commit(kind: CalendarChangeKind, previous: CalendarEvent, next: CalendarEvent, via: 'pointer' | 'keyboard'): void;
}

/** 拖曳中的預覽：被拖的那筆活動放到新位置的樣子。 */
export interface CalendarDragPreview {
  /** 新位置的活動（id 與原本相同）。 */
  event: CalendarEvent;
  kind: CalendarChangeKind;
  /** 放在這裡會跟同一個資源的其他活動衝突。 */
  conflict: boolean;
  /** 跟著指標的提示：新的時間（與資源）。 */
  tip: string;
}

/**
 * 各個檢視共用的狀態與運算：顏色、名稱、能不能拖、衝突、拖曳預覽。由 lib-calendar 提供（每個日曆一份）。
 */
@Injectable()
export class CalendarStore {
  private host!: CalendarHostState;

  /** 拖曳中的預覽；沒有在拖時是 null。 */
  readonly preview = signal<CalendarDragPreview | null>(null);

  readonly labels = computed(() => this.state().labels);
  readonly fmt = computed(() => new CalendarFormatter(this.state().labels, this.state().hour12()));
  readonly events = computed(() => this.state().events());
  readonly conflicts = computed(() => findConflicts(this.state().events(), this.state().allowOverlap()));
  readonly today = computed(() => new Date(this.state().now()));

  private readonly categoryMap = computed(() => new Map(this.state().categories().map((c) => [c.id, c])));
  private readonly resourceMap = computed(() => new Map(this.state().resources().map((r) => [r.id, r])));

  /** lib-calendar 在建構時呼叫一次。 */
  attach(host: CalendarHostState): void {
    this.host = host;
  }

  state(): CalendarHostState {
    return this.host;
  }

  /** 活動的顏色（CSS 值）：類別的圖表色或使用端給的 token；沒有類別用主色。 */
  colorOf(event: CalendarEvent): string {
    const category = event.category ? this.categoryMap().get(event.category) : undefined;
    if (!category) return 'var(--mat-sys-primary)';
    return typeof category.color === 'number' ? `var(--app-chart-${category.color})` : category.color;
  }

  categoryLabel(event: CalendarEvent): string | null {
    return (event.category && this.categoryMap().get(event.category)?.label) || null;
  }

  resourceTitle(id: string | null | undefined): string | null {
    return (id && this.resourceMap().get(id)?.title) || null;
  }

  canEdit(event: CalendarEvent): boolean {
    return !this.state().readonly() && event.editable !== false;
  }

  isConflict(event: CalendarEvent): boolean {
    return this.conflicts().has(event.id);
  }

  accessibleName(event: CalendarEvent, segment?: CalendarSegment | null): string {
    return this.fmt().accessibleName(event, {
      resource: this.resourceTitle(event.resourceId),
      category: this.categoryLabel(event),
      conflict: this.isConflict(event),
      segment,
    });
  }

  // ---- 拖曳 ----

  /** 依位移算出新的活動並更新預覽。 */
  previewChange(original: CalendarEvent, delta: CalendarDelta, edge: CalendarEdge | null, clamp?: (e: CalendarEvent) => CalendarEvent): void {
    let next = edge ? extendEvent(original, delta, edge, this.state().slotMinutes()) : moveEvent(original, delta);
    if (clamp) next = clamp(next);
    const conflict = !this.state().allowOverlap() && conflictsWith(next, this.state().events()).length > 0;
    const resource = delta.resourceId !== undefined ? this.resourceTitle(next.resourceId) : null;
    const when = this.fmt().when(next);
    this.preview.set({
      event: next,
      kind: edge ? 'extend' : 'move',
      conflict,
      tip: [when, resource, conflict ? this.state().labels.conflict : null].filter(Boolean).join('，'),
    });
  }

  /** 放開：位置有變就送出變更。 */
  endDrag(original: CalendarEvent, committed: boolean): void {
    const preview = this.preview();
    this.preview.set(null);
    if (!committed || !preview || sameSchedule(preview.event, original)) return;
    this.state().commit(preview.kind, original, preview.event, 'pointer');
  }

  /** 鍵盤移動一格或調整長度一格：直接送出（每按一次存一次，同一筆又改時上一次的請求會被 abort）。 */
  keyboardChange(original: CalendarEvent, delta: CalendarDelta, edge: CalendarEdge | null, clamp?: (e: CalendarEvent) => CalendarEvent): boolean {
    if (!this.canEdit(original)) return false;
    let next = edge ? extendEvent(original, delta, edge, this.state().slotMinutes()) : moveEvent(original, delta);
    if (clamp) next = clamp(next);
    if (sameSchedule(next, original)) return false;
    this.state().commit(edge ? 'extend' : 'move', original, next, 'keyboard');
    return true;
  }

  /** 「+{count} 筆」之類的樣板。 */
  format(template: string, values: Readonly<Record<string, string | number>>): string {
    return formatCalendarLabel(template, values);
  }
}
