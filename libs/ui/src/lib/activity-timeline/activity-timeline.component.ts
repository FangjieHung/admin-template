import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EmptyStateComponent } from '../feedback-state/empty-state.component';
import { I18nService } from '../i18n/i18n.service';
import { ACTIVITY_TIMELINE_LABELS, assertActivityTimelineLabels } from './activity-timeline-labels';
import {
  ActivityDayGroup,
  ActivityEntry,
  ActivityFilter,
  ActivityKind,
  ActivityKindMap,
  ActivityTone,
  actorInitials,
  formatRelativeTime,
  groupActivityByDay,
  toDate,
} from './activity-timeline.types';
import { MinuteClock } from './minute-clock';

/** 種類對照表裡找不到的 kind 用這個（不丟錯，避免後端多一種紀錄就整條時間軸壞掉）。 */
const FALLBACK_KIND: ActivityKind = { icon: 'history', tone: 'neutral' };

/** 色調對到 `--app-{tone}-*` 的名稱。 */
const TONE_CLASS: Record<ActivityTone, string> = {
  neutral: 'neutral',
  info: 'info',
  success: 'positive',
  warning: 'warning',
  danger: 'danger',
};

interface EntryTime {
  iso: string;
  ago: string;
  full: string;
}

let nextId = 0;

/**
 * 活動紀錄：「誰在何時改了什麼」的時間軸。語意是 `<ol>`，依當地日期分組（今天／昨天／日期＋星期）。
 *
 * - 每筆：操作者縮寫圓章（系統紀錄用系統圖示）、使用端組好的摘要句、相對時間（滑過或聚焦顯示完整時間）、
 *   可展開的「欄位：舊 → 新」（超過 `collapseAfter` 筆預設收合）、留言引用區塊。
 * - 相對時間與今天／昨天分組讀共用的分鐘時鐘（`MinuteClock`），元件銷毀時釋放。
 * - 篩選、載入更多都只送事件，資料由使用端提供；元件不篩選、不排序。
 * - 線與節點只用語意 token，質地要特調時在 `.lib-activity-timeline` 上設 `--tl-*` 變數（CONTRACT.md）。
 */
@Component({
  selector: 'lib-activity-timeline',
  imports: [MatButtonModule, MatChipsModule, MatProgressSpinnerModule, MatTooltipModule, EmptyStateComponent],
  templateUrl: './activity-timeline.component.html',
  styleUrl: './activity-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lib-activity-timeline',
    '[attr.aria-busy]': "loading() || loadingMore() ? 'true' : null",
  },
})
export class ActivityTimelineComponent {
  readonly entries = input.required<readonly ActivityEntry[]>();
  /** 種類 → 圖示與色調。 */
  readonly kinds = input.required<ActivityKindMap>();
  /** 第一次載入：顯示骨架。 */
  readonly loading = input(false);
  /** 還有更舊的紀錄：底部顯示「載入更多」。 */
  readonly hasMore = input(false);
  /** 正在載入更多：按鈕轉圈、停用。 */
  readonly loadingMore = input(false);
  /** 篩選 chip；不給就不顯示篩選列。第一個視為「全部」（空狀態文字依此區分）。 */
  readonly filters = input<readonly ActivityFilter[]>([]);
  /**
   * 目前的篩選 id；null 時是第一個。使用者換篩選時更新它並送出 `(filterChange)`（帶新的 id），
   * 所以可以寫 `[(filter)]`，也可以只聽 `(filterChange)`。
   */
  readonly filter = model<string | null>(null);
  /** 日期分組標題的層級（`aria-level`），依頁面結構調整。 */
  readonly headingLevel = input(3);
  /** 變更超過幾筆時預設收合。 */
  readonly collapseAfter = input(3);
  /** 系統紀錄（actor 是 null）圓章的圖示。 */
  readonly systemIcon = input('settings');

  /** 按了「載入更多」。 */
  readonly loadMore = output<void>();

  protected readonly labels = assertActivityTimelineLabels(inject(ACTIVITY_TIMELINE_LABELS, { optional: true }));
  private readonly i18n = inject(I18nService);
  private readonly clock = inject(MinuteClock);
  protected readonly idPrefix = `lib-activity-${nextId++}`;

  /** 展開中的變更清單（entry id）。 */
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  private readonly rtf = computed(() => new Intl.RelativeTimeFormat(this.i18n.current().intl, { numeric: 'auto' }));
  private readonly fullFormat = computed(
    () => new Intl.DateTimeFormat(this.i18n.current().intl, { dateStyle: 'medium', timeStyle: 'short' }),
  );
  private readonly weekdayFormat = computed(() => new Intl.DateTimeFormat(this.i18n.current().intl, { weekday: 'short' }));

  protected readonly currentFilter = computed(() => this.filter() ?? this.filters()[0]?.id ?? null);
  protected readonly isFiltered = computed(() => {
    const first = this.filters()[0]?.id;
    return first !== undefined && this.currentFilter() !== first;
  });

  protected readonly groups = computed<ActivityDayGroup[]>(() =>
    groupActivityByDay(this.entries(), new Date(this.clock.now())),
  );

  protected readonly times = computed(() => {
    const now = new Date(this.clock.now());
    const rtf = this.rtf();
    const full = this.fullFormat();
    const map = new Map<string, EntryTime>();
    for (const entry of this.entries()) {
      const at = toDate(entry.at);
      map.set(entry.id, { iso: at.toISOString(), ago: formatRelativeTime(at, now, rtf), full: full.format(at) });
    }
    return map;
  });

  constructor() {
    const release = this.clock.acquire();
    inject(DestroyRef).onDestroy(release);
  }

  protected heading(group: ActivityDayGroup): string {
    if (group.kind === 'today') return this.labels.today;
    if (group.kind === 'yesterday') return this.labels.yesterday;
    return this.labels.dayHeading
      .replace('{date}', this.i18n.date(group.date))
      .replace('{weekday}', this.weekdayFormat().format(group.date));
  }

  protected kindOf(entry: ActivityEntry): ActivityKind {
    return this.kinds()[entry.kind] ?? FALLBACK_KIND;
  }

  protected toneOf(entry: ActivityEntry): string {
    return TONE_CLASS[this.kindOf(entry).tone] ?? 'neutral';
  }

  protected initials(entry: ActivityEntry): string {
    return entry.actor ? actorInitials(entry.actor) : '';
  }

  protected timeOf(entry: ActivityEntry): EntryTime {
    return this.times().get(entry.id) ?? { iso: '', ago: '', full: '' };
  }

  protected isCollapsible(entry: ActivityEntry): boolean {
    return (entry.changes?.length ?? 0) > this.collapseAfter();
  }

  protected isExpanded(entry: ActivityEntry): boolean {
    return !this.isCollapsible(entry) || this.expanded().has(entry.id);
  }

  protected toggleChanges(entry: ActivityEntry): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(entry.id)) next.delete(entry.id);
      else next.add(entry.id);
      return next;
    });
  }

  protected expandLabel(entry: ActivityEntry): string {
    return this.labels.expandChanges.replace('{count}', String(entry.changes?.length ?? 0));
  }

  protected onFilterChange(event: MatChipListboxChange): void {
    const value = event.value as string | null | undefined;
    if (!value) {
      // 再按一次已選的 chip 會取消選取；篩選一定要有一個，選回原本那個。
      event.source.value = this.currentFilter();
      return;
    }
    if (value === this.currentFilter()) return;
    this.filter.set(value);
  }
}
