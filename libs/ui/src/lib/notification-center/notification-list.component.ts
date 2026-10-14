import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
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
import { MatButton } from '@angular/material/button';
import { EmptyStateComponent } from '../feedback-state/empty-state.component';
import { ErrorStateComponent } from '../feedback-state/error-state.component';
import { SkeletonComponent } from '../feedback-state/skeleton.component';
import { I18nService } from '../i18n/i18n.service';
import { MinuteClock } from '../activity-timeline/minute-clock';
import { calendarDaysBetween, formatRelativeTime } from '../activity-timeline/activity-timeline.types';
import { isAbortError } from '../relation-select/relation-source';
import {
  NOTIFICATION_CENTER_LABELS,
  assertNotificationCenterLabels,
  formatNotificationLabel,
} from './notification-center-labels';
import {
  NotificationAction,
  NotificationEvent,
  NotificationFilter,
  NotificationItem,
  NotificationSource,
  matchesNotificationQuery,
  notificationTime,
} from './notification-source';
import { NotificationItemComponent, NotificationItemTime } from './notification-item.component';

/** 頁面提供的類別篩選（「指派給我」「提及」「系統」）。 */
export interface NotificationCategory {
  id: string;
  label: string;
}

export type NotificationGroupKind = 'today' | 'yesterday' | 'earlier';

export interface NotificationGroup {
  kind: NotificationGroupKind;
  items: readonly NotificationItem[];
}

/** 依當地日期分成今天、昨天、更早（保持傳入的順序，通常是新到舊）。 */
export function groupNotifications(items: readonly NotificationItem[], now: Date): NotificationGroup[] {
  const groups: { kind: NotificationGroupKind; items: NotificationItem[] }[] = [];
  for (const item of items) {
    const days = calendarDaysBetween(new Date(notificationTime(item)), now);
    const kind: NotificationGroupKind = days <= 0 ? 'today' : days === 1 ? 'yesterday' : 'earlier';
    const group = groups.find((g) => g.kind === kind);
    if (group) group.items.push(item);
    else groups.push({ kind, items: [item] });
  }
  const order: NotificationGroupKind[] = ['today', 'yesterday', 'earlier'];
  return groups.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

export interface NotificationActionEvent {
  item: NotificationItem;
  action: NotificationAction;
}

type Status = 'loading' | 'ready' | 'error';

let nextId = 0;

/**
 * 通知清單：全部／未讀、選填的類別篩選、依今天／昨天／更早分組、標為已讀／未讀、移除、全部標為已讀、載入更多，
 * 以及載入中、沒有通知、載入失敗三種狀態。資料全部經過 `NotificationSource`，元件不認得路由（點通知送出 `(open)`）。
 *
 * 鍵盤：上下鍵在通知之間移動（Home／End 到頭尾），Enter 打開，Delete 移除；Tab 只停在目前那一則與它的按鈕。
 * 新通知送達時（`source.changes` 的 `added`）放到最上面，並用 polite 的 live region 念出來（`announceArrivals`）。
 */
@Component({
  selector: 'lib-notification-list',
  imports: [MatButton, EmptyStateComponent, ErrorStateComponent, SkeletonComponent, NotificationItemComponent],
  templateUrl: './notification-list.component.html',
  styleUrl: './notification-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lib-notification-list lib-notification-center',
    '[attr.aria-busy]': "status() === 'loading' || loadingMore()",
  },
})
export class NotificationListComponent {
  readonly source = input.required<NotificationSource>();
  /** 類別篩選；不給就不顯示類別列。 */
  readonly categories = input<readonly NotificationCategory[]>([]);
  /** 全部或未讀，可以 `[(filter)]`。 */
  readonly filter = model<NotificationFilter>('all');
  /** 目前的類別 id；null 是不限類別，可以 `[(category)]`。 */
  readonly category = model<string | null>(null);
  /** 一頁幾則。 */
  readonly pageSize = input(10);
  /** 分組標題的層級（`aria-level`），依頁面結構調整。 */
  readonly headingLevel = input(3);
  /** false：新通知送達時不念（例如頁面另外用提示訊息通知）。 */
  readonly announceArrivals = input(true);

  /** 點了有 `link` 的通知（元件已經把它標為已讀）；由頁面決定怎麼導覽。 */
  readonly open = output<NotificationItem>();
  /** 按了通知上的動作鈕（元件已經把它標為已讀）。 */
  readonly action = output<NotificationActionEvent>();

  protected readonly labels = assertNotificationCenterLabels(inject(NOTIFICATION_CENTER_LABELS, { optional: true }));
  private readonly i18n = inject(I18nService);
  private readonly clock = inject(MinuteClock);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly idPrefix = `lib-notif-${nextId++}`;

  protected readonly status = signal<Status>('loading');
  protected readonly items = signal<readonly NotificationItem[]>([]);
  private readonly nextCursor = signal<string | null>(null);
  protected readonly loadingMore = signal(false);
  protected readonly unreadTotal = signal<number | null>(null);
  protected readonly announcement = signal('');
  private readonly activeId = signal<string | null>(null);
  private readonly busyAll = signal(false);

  protected readonly hasMore = computed(() => this.nextCursor() !== null);
  protected readonly canMarkAll = computed(() => !this.busyAll() && (this.unreadTotal() ?? 0) > 0);
  protected readonly unreadBadge = computed(() => {
    const n = this.unreadTotal();
    return n === null || n === 0 ? '' : n > 99 ? '99+' : String(n);
  });
  protected readonly groups = computed(() => groupNotifications(this.items(), new Date(this.clock.now())));
  /** Tab 停在哪一則：最後聚焦的那一則，不在清單裡了就是第一則。 */
  protected readonly tabbableId = computed(() => {
    const items = this.items();
    const id = this.activeId();
    return id && items.some((item) => item.id === id) ? id : (items[0]?.id ?? null);
  });

  private readonly rtf = computed(() => new Intl.RelativeTimeFormat(this.i18n.current().intl, { numeric: 'auto' }));
  private readonly fullFormat = computed(
    () => new Intl.DateTimeFormat(this.i18n.current().intl, { dateStyle: 'medium', timeStyle: 'short' }),
  );
  protected readonly times = computed(() => {
    const now = new Date(this.clock.now());
    const rtf = this.rtf();
    const full = this.fullFormat();
    const map = new Map<string, NotificationItemTime>();
    for (const item of this.items()) {
      const at = new Date(notificationTime(item));
      map.set(item.id, { iso: at.toISOString(), ago: formatRelativeTime(at, now, rtf), full: full.format(at) });
    }
    return map;
  });
  private readonly categoryNames = computed(() => new Map(this.categories().map((c) => [c.id, c.label])));

  private controller: AbortController | null = null;
  private pendingArrivals: NotificationItem[] = [];
  private arrivalTimer: ReturnType<typeof setTimeout> | null = null;
  private announceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const release = this.clock.acquire();
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      release();
      this.controller?.abort();
      if (this.arrivalTimer) clearTimeout(this.arrivalTimer);
      if (this.announceTimer) clearTimeout(this.announceTimer);
    });

    // 換來源、篩選或類別時重新載入第一頁（取消上一次）。
    effect(() => {
      const source = this.source();
      const filter = this.filter();
      const category = this.category();
      untracked(() => void this.reload(source, filter, category));
    });

    // 伺服器推播：讓這個清單與其他畫面（鈴鐺面板、全部通知頁）保持一致。
    effect((onCleanup) => {
      const changes = this.source().changes;
      if (!changes) return;
      const sub = changes.subscribe((event) => this.apply(event));
      onCleanup(() => sub.unsubscribe());
    });
  }

  /** 重新載入第一頁（錯誤狀態的「重試」、使用端想手動刷新時）。 */
  refresh(): void {
    void this.reload(this.source(), this.filter(), this.category());
  }

  /** 把焦點放到第一則通知（沒有通知時放到篩選列），面板打開時用。 */
  focusFirst(): void {
    const id = this.tabbableId();
    if (id) this.focusItem(id);
    else this.host.nativeElement.querySelector<HTMLElement>('.nl-pill')?.focus();
  }

  protected setFilter(filter: NotificationFilter): void {
    if (this.filter() !== filter) this.filter.set(filter);
  }

  protected setCategory(category: string | null): void {
    if (this.category() !== category) this.category.set(category);
  }

  protected timeOf(item: NotificationItem): NotificationItemTime {
    return this.times().get(item.id) ?? { iso: '', ago: '', full: '' };
  }

  protected categoryOf(item: NotificationItem): string {
    return (item.category && this.categoryNames().get(item.category)) || '';
  }

  protected groupHeading(kind: NotificationGroupKind): string {
    return this.labels[kind];
  }

  protected onFocused(item: NotificationItem): void {
    this.activeId.set(item.id);
  }

  protected onActivate(item: NotificationItem): void {
    if (!item.read) void this.setRead(item, true, false);
    if (item.link) this.open.emit({ ...item, read: true });
  }

  protected onAction(item: NotificationItem): void {
    if (!item.action) return;
    if (!item.read) void this.setRead(item, true, false);
    this.action.emit({ item: { ...item, read: true }, action: item.action });
  }

  protected onToggleRead(item: NotificationItem): void {
    void this.setRead(item, !item.read, true);
  }

  protected onKeydown(item: NotificationItem, event: KeyboardEvent): void {
    const ids = this.items().map((i) => i.id);
    const index = ids.indexOf(item.id);
    let target: string | undefined;
    switch (event.key) {
      case 'ArrowDown':
        target = ids[Math.min(index + 1, ids.length - 1)];
        break;
      case 'ArrowUp':
        target = ids[Math.max(index - 1, 0)];
        break;
      case 'Home':
        target = ids[0];
        break;
      case 'End':
        target = ids[ids.length - 1];
        break;
      case 'Delete':
        event.preventDefault();
        void this.onRemove(item);
        return;
      default:
        return;
    }
    event.preventDefault();
    if (target) this.focusItem(target);
  }

  protected async onRemove(item: NotificationItem): Promise<void> {
    const before = this.items();
    const index = before.findIndex((i) => i.id === item.id);
    if (index === -1) return;
    const hadFocus = this.host.nativeElement.contains(document.activeElement);
    const next = before[index + 1] ?? before[index - 1] ?? null;
    this.items.set(before.filter((i) => i.id !== item.id));
    if (!item.read) this.unreadTotal.update((n) => (n === null ? n : Math.max(0, n - 1)));
    if (hadFocus) this.afterRender(() => (next ? this.focusItem(next.id) : this.focusFirst()));
    try {
      await this.source().remove(item.id);
      this.announce(formatNotificationLabel(this.labels.announceRemoved, { title: item.title }));
    } catch {
      // 還原：放回原本的位置（期間有新通知插在前面也不影響相對順序）。
      this.items.update((list) => (list.some((i) => i.id === item.id) ? list : insertAt(list, before, item)));
      this.announce(this.labels.actionFailed);
      void this.refreshCount();
    }
  }

  protected async markAllRead(): Promise<void> {
    if (!this.canMarkAll()) return;
    const before = this.items();
    const count = this.unreadTotal();
    this.busyAll.set(true);
    this.items.set(before.map((item) => (item.read ? item : { ...item, read: true })));
    this.unreadTotal.set(0);
    try {
      await this.source().markAllRead();
      this.announce(this.labels.announceAllRead);
    } catch {
      this.items.set(before);
      this.unreadTotal.set(count);
      this.announce(this.labels.actionFailed);
    } finally {
      this.busyAll.set(false);
    }
  }

  protected async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) return;
    this.loadingMore.set(true);
    const controller = this.controller ?? new AbortController();
    try {
      const page = await this.source().list(
        { filter: this.filter(), category: this.category(), cursor, limit: this.pageSize() },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const known = new Set(this.items().map((i) => i.id));
      this.items.update((list) => [...list, ...page.items.filter((i) => !known.has(i.id))]);
      this.nextCursor.set(page.nextCursor ?? null);
    } catch (error) {
      if (!isAbortError(error)) this.announce(this.labels.actionFailed);
    } finally {
      this.loadingMore.set(false);
    }
  }

  private async reload(source: NotificationSource, filter: NotificationFilter, category: string | null): Promise<void> {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.status.set('loading');
    this.loadingMore.set(false);
    void this.refreshCount();
    try {
      const page = await source.list({ filter, category, limit: this.pageSize() }, controller.signal);
      if (controller.signal.aborted) return;
      this.items.set(page.items);
      this.nextCursor.set(page.nextCursor ?? null);
      this.status.set('ready');
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted) return;
      this.items.set([]);
      this.nextCursor.set(null);
      this.status.set('error');
    }
  }

  private async refreshCount(): Promise<void> {
    try {
      this.unreadTotal.set(await this.source().unreadCount());
    } catch {
      // 未讀數拿不到時不顯示數字，清單本身照常。
      this.unreadTotal.set(null);
    }
  }

  private async setRead(item: NotificationItem, read: boolean, announce: boolean): Promise<void> {
    if (item.read === read) return;
    this.patch([item.id], read);
    this.unreadTotal.update((n) => (n === null ? n : Math.max(0, n + (read ? -1 : 1))));
    try {
      await this.source().markRead([item.id], read);
      if (announce) {
        const template = read ? this.labels.announceRead : this.labels.announceUnread;
        this.announce(formatNotificationLabel(template, { title: item.title }));
      }
    } catch {
      this.patch([item.id], !read);
      this.announce(this.labels.actionFailed);
      void this.refreshCount();
    }
  }

  private patch(ids: readonly string[], read: boolean): void {
    const set = new Set(ids);
    this.items.update((list) => list.map((item) => (set.has(item.id) && item.read !== read ? { ...item, read } : item)));
  }

  private apply(event: NotificationEvent): void {
    switch (event.type) {
      case 'added': {
        const query = { filter: this.filter(), category: this.category() };
        if (this.status() === 'ready' && matchesNotificationQuery(event.item, query)) {
          if (!this.items().some((i) => i.id === event.item.id)) this.items.update((list) => [event.item, ...list]);
        }
        this.queueArrival(event.item);
        break;
      }
      case 'read':
        this.patch(event.ids, event.read);
        break;
      case 'all-read':
        this.items.update((list) => list.map((item) => (item.read ? item : { ...item, read: true })));
        break;
      case 'removed':
        this.items.update((list) => list.filter((item) => item.id !== event.id));
        break;
    }
    void this.refreshCount();
  }

  // 一次送達好幾則時合併成一句：「有 3 則新通知：（最新那則的標題）」。
  private queueArrival(item: NotificationItem): void {
    if (!this.announceArrivals()) return;
    this.pendingArrivals.push(item);
    if (this.arrivalTimer) return;
    this.arrivalTimer = setTimeout(() => {
      this.arrivalTimer = null;
      const list = this.pendingArrivals;
      this.pendingArrivals = [];
      const newest = list[list.length - 1];
      if (newest) this.announce(formatNotificationLabel(this.labels.announceNew, { count: list.length, title: newest.title }));
    }, 300);
  }

  // 同一句連念兩次時報讀器可能不念：先清空，下一個 tick 再放進去。
  private announce(message: string): void {
    this.announcement.set('');
    if (this.announceTimer) clearTimeout(this.announceTimer);
    this.announceTimer = setTimeout(() => {
      this.announceTimer = null;
      this.announcement.set(message);
    }, 30);
  }

  private focusItem(id: string): void {
    this.activeId.set(id);
    const el = this.host.nativeElement.querySelector<HTMLElement>(`[data-notification-main="${cssEscape(id)}"]`);
    el?.focus();
  }

  private afterRender(fn: () => void): void {
    afterNextRender(fn, { injector: this.injector });
  }

}

/** 失敗還原時把 `item` 放回它在 `before` 裡的相對位置。 */
function insertAt(list: readonly NotificationItem[], before: readonly NotificationItem[], item: NotificationItem): NotificationItem[] {
  const order = new Map(before.map((entry, i) => [entry.id, i]));
  const at = order.get(item.id) ?? 0;
  const index = list.findIndex((entry) => (order.get(entry.id) ?? -1) > at);
  return index === -1 ? [...list, item] : [...list.slice(0, index), item, ...list.slice(index)];
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&');
}
