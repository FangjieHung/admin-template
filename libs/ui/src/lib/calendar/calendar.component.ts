import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { ErrorStateComponent } from '../feedback-state/error-state.component';
import { MinuteClock } from '../activity-timeline/minute-clock';
import { ToastService } from '../toast/toast.service';
import { isAbortError } from '../relation-select/relation-source';
import { CALENDAR_LABELS, assertCalendarLabels, formatCalendarLabel } from './calendar-labels';
import {
  CalendarCategory,
  CalendarChangeFn,
  CalendarChangeKind,
  CalendarEvent,
  CalendarEventChange,
  CalendarRange,
  CalendarResource,
  CalendarResourceScale,
  CalendarSlotSelection,
  CalendarSource,
  CalendarView,
  CalendarWeekday,
} from './calendar.types';
import { CalendarStore } from './calendar-store';
import { CalendarFormatter } from './calendar-format';
import { daysFrom, diffCalendarDays, shiftAnchor, startOfDay, visibleRange } from './calendar-date';
import { sameSchedule } from './calendar-drag';
import { CalendarToolbarComponent } from './calendar-toolbar.component';
import { CalendarMonthComponent } from './calendar-month.component';
import { CalendarTimeGridComponent } from './calendar-time-grid.component';
import { CalendarAgendaComponent } from './calendar-agenda.component';
import { CalendarResourceComponent } from './calendar-resource.component';

/** 容器寬度不超過這個值時，預設改用 `mobileView`（議程）。 */
export const CALENDAR_PHONE_WIDTH = 600;
/** 容器寬度不超過這個值時，週檢視只顯示 3 天。 */
export const CALENDAR_TABLET_WIDTH = 900;

interface PendingChange {
  controller: AbortController;
  /** 最後一次確定存好的樣子（失敗時還原成它）。 */
  committed: CalendarEvent;
}

/**
 * 共用日曆與排程：月、週、日、議程、資源排程五種檢視，手寫、不依賴第三方日曆套件。
 *
 * - 資料：給 `[events]`（整份陣列），或給 `[source]`（依看得到的範圍分段載入，換頁時 abort 上一次）。
 * - 互動：點活動 → `(eventClick)`；點空白處或拖出一段 → `(slotSelect)`；拖曳移動、拉邊緣調整長度（對齊時段），
 *   鍵盤是聚焦活動後 Alt＋方向鍵移動、Alt＋Shift＋方向鍵調整長度，Esc 取消拖曳。變更交給 `[onEventChange]`：
 *   畫面先改，失敗時還原並提示原因，成功時提示可以「復原」（頁面 providers 有 ToastService 時）。
 * - 衝突：`allowOverlap=false` 時同一個資源時間重疊的活動加上警告圖示與「時間衝突」文字。
 * - 寬度：容器 ≤ 600px 預設議程（`mobileView`），≤ 900px 週檢視只顯示 3 天；資源排程在自己的容器裡橫向捲動。
 *
 * 畫面文字由 CALENDAR_LABELS 提供（少了會丟錯）。造型讀 `--lib-cal-*`（CONTRACT.md「共用日曆」）。
 */
@Component({
  selector: 'lib-calendar',
  imports: [
    CalendarToolbarComponent,
    CalendarMonthComponent,
    CalendarTimeGridComponent,
    CalendarAgendaComponent,
    CalendarResourceComponent,
    ErrorStateComponent,
  ],
  providers: [CalendarStore],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lib-calendar',
    '[attr.data-view]': 'activeView()',
    '[attr.aria-busy]': "status() === 'loading'",
  },
})
export class CalendarComponent {
  /** 目前的檢視，可以 `[(view)]`。 */
  readonly view = model<CalendarView>('month');
  /** 工具列提供哪些檢視（只有一種時不顯示切換鈕）。 */
  readonly views = input<readonly CalendarView[]>(['month', 'week', 'day', 'agenda']);
  /** 目前看的日期（決定月份、週、日），可以 `[(date)]`。 */
  readonly date = model<Date>(startOfDay(new Date()));
  /** 活動（整份）；給了 `source` 時不用。 */
  readonly events = input<readonly CalendarEvent[] | null>(null);
  /** 依範圍載入的資料來源。 */
  readonly source = input<CalendarSource | null>(null);
  readonly resources = input<readonly CalendarResource[]>([]);
  readonly categories = input<readonly CalendarCategory[]>([]);
  /** 資源排程的刻度，可以 `[(resourceScale)]`。 */
  readonly resourceScale = model<CalendarResourceScale>('week');
  /** 一週從星期幾開始（預設星期一）。 */
  readonly weekStartsOn = input<CalendarWeekday>(1);
  /** 時段長度（分鐘）：拖曳、鍵盤一次移動的量，也是時間格的淡線間距。 */
  readonly slotMinutes = input(30);
  /** 時間格與日刻度從幾點畫到幾點。 */
  readonly dayStart = input(0);
  readonly dayEnd = input(24);
  /** 週／日檢視打開時捲到幾點。 */
  readonly scrollToHour = input(8);
  /** 月檢視每天最多幾筆（其餘收成「+N 筆」）。 */
  readonly maxEventsPerDay = input(3);
  /** 議程一次顯示幾天。 */
  readonly agendaDays = input(14);
  /** 12 小時制（上午／下午）。 */
  readonly hour12 = input(false);
  readonly showWeekNumbers = input(false);
  /** false：同一個資源時間重疊的活動標成衝突。 */
  readonly allowOverlap = input(true);
  /** 唯讀：不能拖曳、不能選取空白時段（仍可以點開活動）。 */
  readonly readonly = input(false);
  /** 迷你月曆：月檢視每天只畫圓點，按下有活動的日子打開清單。 */
  readonly compact = input(false);
  /** 工具列顯示資源篩選（依分組或單一資源）。 */
  readonly resourceFilter = input(false);
  /** 下方顯示類別圖例（有 categories 時）。 */
  readonly showLegend = input(true);
  /** 手機寬度預設改用的檢視（null＝不換）；不在 `views` 裡時不換。 */
  readonly mobileView = input<CalendarView | null>('agenda');
  /** 議程日期標題的層級。 */
  readonly headingLevel = input(3);
  /** 儲存變更；不給時只改畫面並送出 `(eventChange)`。 */
  readonly onEventChange = input<CalendarChangeFn | null>(null);

  readonly eventClick = output<CalendarEvent>();
  readonly slotSelect = output<CalendarSlotSelection>();
  /** 看得到的範圍變了（換頁、換檢視）。 */
  readonly rangeChange = output<CalendarRange>();
  /** 一筆變更存好了。 */
  readonly eventChange = output<CalendarEventChange>();

  protected readonly labels = assertCalendarLabels(inject(CALENDAR_LABELS, { optional: true }));
  private readonly store = inject(CalendarStore);
  private readonly toast = inject(ToastService, { optional: true });
  private readonly clock = inject(MinuteClock);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** 容器寬度（ResizeObserver）；量到之前當成桌機寬度。 */
  protected readonly width = signal(Infinity);
  protected readonly status = signal<'ready' | 'loading' | 'error'>('ready');
  private readonly loaded = signal<readonly CalendarEvent[]>([]);
  private readonly overrides = signal<ReadonlyMap<string, CalendarEvent>>(new Map());
  private readonly pending = new Map<string, PendingChange>();
  private fetchController: AbortController | null = null;
  protected readonly filterValue = signal('');
  private readonly userPickedView = signal(false);
  protected readonly announcement = signal('');

  protected readonly activeView = computed<CalendarView>(() => {
    const mobile = this.mobileView();
    if (!this.userPickedView() && mobile && this.width() <= CALENDAR_PHONE_WIDTH && this.views().includes(mobile)) return mobile;
    return this.view();
  });

  protected readonly weekDays = computed(() => (this.width() <= CALENDAR_TABLET_WIDTH ? 3 : 7));

  private readonly rangeOptions = computed(() => ({
    weekStartsOn: this.weekStartsOn(),
    weekDays: this.weekDays(),
    agendaDays: this.agendaDays(),
    resourceScale: this.resourceScale(),
  }));

  /** 看得到的範圍（同一段時間不會重新觸發載入）。 */
  readonly range = computed<CalendarRange>(() => visibleRange(this.activeView(), this.date(), this.rangeOptions()), {
    equal: (a, b) => a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime(),
  });

  protected readonly days = computed(() => {
    const r = this.range();
    return daysFrom(r.start, diffCalendarDays(r.start, r.end));
  });

  private readonly fmt = computed(() => new CalendarFormatter(this.labels, this.hour12()));

  protected readonly title = computed(() => this.fmt().periodTitle(this.activeView(), this.date(), this.range(), this.resourceScale()));

  private readonly baseEvents = computed(() => (this.source() ? this.loaded() : (this.events() ?? [])));

  protected readonly visibleResources = computed(() => {
    const filter = this.filterValue();
    const all = this.resources();
    if (filter.startsWith('g:')) return all.filter((r) => r.group === filter.slice(2));
    if (filter.startsWith('r:')) return all.filter((r) => r.id === filter.slice(2));
    return all;
  });

  /** 畫面上的活動：套用樂觀更新，再依資源篩選。 */
  readonly displayEvents = computed(() => {
    const overrides = this.overrides();
    let list = this.baseEvents().map((e) => overrides.get(e.id) ?? e);
    if (this.filterValue()) {
      const ids = new Set(this.visibleResources().map((r) => r.id));
      list = list.filter((e) => e.resourceId && ids.has(e.resourceId));
    }
    return list;
  });

  protected readonly legend = computed(() =>
    this.showLegend() ? this.categories().map((c) => ({ ...c, css: typeof c.color === 'number' ? `var(--app-chart-${c.color})` : c.color })) : [],
  );

  constructor() {
    this.store.attach({
      labels: this.labels,
      hour12: this.hour12,
      readonly: this.readonly,
      slotMinutes: this.slotMinutes,
      dayStart: this.dayStart,
      dayEnd: this.dayEnd,
      weekStartsOn: this.weekStartsOn,
      allowOverlap: this.allowOverlap,
      categories: this.categories,
      resources: this.resources,
      events: this.displayEvents,
      now: this.clock.now,
      open: (event) => this.eventClick.emit(event),
      select: (slot) => this.slotSelect.emit(slot),
      commit: (kind, previous, next, via) => void this.commit(kind, previous, next, via),
    });

    const release = this.clock.acquire();
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      release();
      this.fetchController?.abort();
      for (const p of this.pending.values()) p.controller.abort();
    });

    // 依範圍載入；範圍或來源一變就 abort 上一次。
    effect(() => {
      const range = this.range();
      const source = this.source();
      untracked(() => {
        this.rangeChange.emit(range);
        if (source) void this.fetch(source, range);
      });
    });

    // 使用端換了整份 events：沒有在儲存中的樂觀更新就丟掉（以新的資料為準）。
    effect(() => {
      this.baseEvents();
      untracked(() => {
        const current = this.overrides();
        if (!current.size) return;
        const next = new Map([...current].filter(([id]) => this.pending.has(id)));
        if (next.size !== current.size) this.overrides.set(next);
      });
    });

    // 換檢視或期間時念給報讀器（第一次不念）。
    let first = true;
    effect(() => {
      const title = this.title();
      const view = this.activeView();
      untracked(() => {
        if (first) {
          first = false;
          return;
        }
        this.announcement.set(formatCalendarLabel(this.labels.viewChanged, { view: this.viewName(view), title }));
      });
    });

    afterNextRender(() => {
      const el = this.host.nativeElement;
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect.width;
        if (w) this.width.set(w);
      });
      observer.observe(el);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  // ---- 導覽 ----

  goToday(): void {
    this.date.set(startOfDay(new Date(this.clock.now())));
  }

  step(direction: 1 | -1): void {
    this.date.set(shiftAnchor(this.activeView(), this.date(), direction, this.rangeOptions()));
  }

  setView(view: CalendarView): void {
    this.userPickedView.set(true);
    this.view.set(view);
  }

  protected openDay(date: Date): void {
    if (!this.views().includes('day')) return;
    this.date.set(startOfDay(date));
    this.setView('day');
  }

  protected viewName(view: CalendarView): string {
    const l = this.labels;
    return { month: l.viewMonth, week: l.viewWeek, day: l.viewDay, agenda: l.viewAgenda, resource: l.viewResource }[view];
  }

  // ---- 載入 ----

  /** 重新載入目前範圍（給了 source 時）。 */
  reload(): void {
    const source = this.source();
    if (source) void this.fetch(source, this.range());
  }

  private async fetch(source: CalendarSource, range: CalendarRange): Promise<void> {
    this.fetchController?.abort();
    const controller = new AbortController();
    this.fetchController = controller;
    this.status.set('loading');
    try {
      const events = await source.list(range, controller.signal);
      if (controller.signal.aborted) return;
      this.loaded.set(events);
      this.status.set('ready');
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      this.status.set('error');
    }
  }

  // ---- 變更（樂觀更新、失敗還原、復原） ----

  private async commit(
    kind: CalendarChangeKind,
    previous: CalendarEvent,
    next: CalendarEvent,
    via: CalendarEventChange['via'],
  ): Promise<void> {
    const id = previous.id;
    const prior = this.pending.get(id);
    const committed = prior?.committed ?? previous;
    prior?.controller.abort();
    const controller = new AbortController();
    this.pending.set(id, { controller, committed });
    this.setOverride(id, next);

    const change: CalendarEventChange = { kind, event: next, previous, via };
    const save = this.onEventChange();
    try {
      if (save) await save(change, controller.signal);
      if (controller.signal.aborted) return;
      this.pending.delete(id);
      this.eventChange.emit(change);
      const message = formatCalendarLabel(kind === 'move' ? this.labels.moved : this.labels.extended, {
        title: next.title,
        when: this.fmt().when(next),
      });
      this.announcement.set(message);
      if (via !== 'undo' && this.toast) {
        const ref = this.toast.success(message, { action: this.labels.undo, duration: 5000 });
        void ref.actionClicked.then((undo) => {
          if (undo) void this.commit(kind, next, { ...next, start: previous.start, end: previous.end, resourceId: previous.resourceId }, 'undo');
        });
      }
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      this.pending.delete(id);
      this.setOverride(id, committed);
      const reason = typeof error === 'string' ? error : '';
      const message = formatCalendarLabel(reason ? this.labels.saveFailedReason : this.labels.saveFailed, {
        title: previous.title,
        reason,
      });
      this.announcement.set(message);
      this.toast?.error(message);
    }
  }

  private setOverride(id: string, event: CalendarEvent): void {
    const base = this.baseEvents().find((e) => e.id === id);
    const next = new Map(this.overrides());
    if (base && sameSchedule(base, event)) next.delete(id);
    else next.set(id, event);
    this.overrides.set(next);
  }
}
