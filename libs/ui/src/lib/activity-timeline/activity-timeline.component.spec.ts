import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivityTimelineComponent } from './activity-timeline.component';
import { ACTIVITY_TIMELINE_LABELS, ActivityTimelineLabels } from './activity-timeline-labels';
import { ActivityEntry, ActivityFilter, ActivityKindMap, formatRelativeTime, groupActivityByDay } from './activity-timeline.types';
import { MINUTE_CLOCK_INTERVAL, MinuteClock } from './minute-clock';

const LABELS: ActivityTimelineLabels = {
  today: '今天',
  yesterday: '昨天',
  dayHeading: '{date}（{weekday}）',
  system: '系統',
  loadMore: '載入更多',
  expandChanges: '展開 {count} 筆變更',
  collapseChanges: '收合變更',
  emptyValue: '（空白）',
  changedTo: '改成',
  empty: '還沒有活動紀錄',
  emptyFiltered: '沒有符合篩選條件的紀錄',
  filters: '篩選活動紀錄',
  loading: '載入中',
};

const KINDS: ActivityKindMap = {
  status: { icon: 'sync_alt', tone: 'info' },
  comment: { icon: 'chat', tone: 'neutral' },
  close: { icon: 'check_circle', tone: 'success' },
};

const FILTERS: ActivityFilter[] = [
  { id: 'all', label: '全部' },
  { id: 'changes', label: '變更' },
  { id: 'comments', label: '留言' },
];

/** 2026-10-14（週三）10:00，當地時間。 */
const NOW = new Date(2026, 9, 14, 10, 0, 0);
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

@Component({
  imports: [ActivityTimelineComponent],
  template: `
    <lib-activity-timeline
      [entries]="entries()"
      [kinds]="kinds"
      [loading]="loading()"
      [hasMore]="hasMore()"
      [loadingMore]="loadingMore()"
      [filters]="filters()"
      [(filter)]="filter"
      (loadMore)="loadMoreCount = loadMoreCount + 1"
      (filterChange)="filterEvents.push($event)"
    />
  `,
})
class HostComponent {
  readonly entries = signal<ActivityEntry[]>([]);
  readonly kinds = KINDS;
  readonly loading = signal(false);
  readonly hasMore = signal(false);
  readonly loadingMore = signal(false);
  readonly filters = signal<ActivityFilter[]>([]);
  readonly filter = signal<string | null>(null);
  loadMoreCount = 0;
  readonly filterEvents: (string | null)[] = [];
}

describe('ActivityTimelineComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let el: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: ACTIVITY_TIMELINE_LABELS, useValue: LABELS }],
    });
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
  });

  function render(entries: ActivityEntry[], setup?: (host: HostComponent) => void) {
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.entries.set(entries);
    setup?.(fixture.componentInstance);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
    return fixture;
  }

  const headings = () => Array.from(el.querySelectorAll('[role="heading"]')).map((h) => h.textContent?.trim());

  it('依日期分組：今天、昨天、其他日期（I18nService 的日期格式＋星期），每組是一個 <ol>', () => {
    render([
      { id: 'a', actor: { name: '王宗翰' }, at: minutesAgo(3), kind: 'status', summary: '王宗翰 把狀態改成「處理中」' },
      { id: 'b', actor: { name: '林雅婷' }, at: minutesAgo(30), kind: 'comment', summary: '林雅婷 留言' },
      { id: 'c', actor: null, at: new Date(2026, 9, 13, 18, 0), kind: 'status', summary: '系統自動指派' },
      { id: 'd', actor: { name: '陳志明' }, at: new Date(2026, 9, 10, 9, 0), kind: 'close', summary: '陳志明 關閉工單' },
    ]);
    expect(headings()).toEqual(['今天', '昨天', '2026/10/10（週六）']);
    const lists = el.querySelectorAll('ol.tl-list');
    expect(lists).toHaveLength(3);
    expect(lists[0].querySelectorAll(':scope > li')).toHaveLength(2);
    expect(el.querySelector('[role="heading"]')?.getAttribute('aria-level')).toBe('3');
  });

  it('跨年：12/31 是昨天、12/30 顯示完整年份', () => {
    const now = new Date(2026, 0, 1, 8, 0);
    const groups = groupActivityByDay(
      [
        { id: '1', actor: null, at: new Date(2026, 0, 1, 7, 0), kind: 'status', summary: '' },
        { id: '2', actor: null, at: new Date(2025, 11, 31, 23, 50), kind: 'status', summary: '' },
        { id: '3', actor: null, at: new Date(2025, 11, 30, 12, 0), kind: 'status', summary: '' },
      ],
      now,
    );
    expect(groups.map((g) => [g.key, g.kind])).toEqual([
      ['2026-01-01', 'today'],
      ['2025-12-31', 'yesterday'],
      ['2025-12-30', 'date'],
    ]);

    vi.setSystemTime(now);
    render([
      { id: '2', actor: null, at: new Date(2025, 11, 31, 23, 50), kind: 'status', summary: '' },
      { id: '3', actor: null, at: new Date(2025, 11, 30, 12, 0), kind: 'status', summary: '' },
    ]);
    expect(headings()).toEqual(['昨天', '2025/12/30（週二）']);
  });

  it('每筆：系統圓章、摘要、<time datetime> 的相對時間', () => {
    render([
      { id: 'a', actor: { name: 'alice' }, at: minutesAgo(3), kind: 'status', summary: 'alice 改了狀態' },
      { id: 'b', actor: null, at: minutesAgo(90), kind: 'unknown-kind', summary: '系統自動關閉' },
    ]);
    const items = el.querySelectorAll('li.tl-item');
    expect(items[0].querySelector('.tl-avatar')?.textContent?.trim()).toBe('A');
    expect(items[0].getAttribute('data-tone')).toBe('info');
    const system = items[1].querySelector('.tl-avatar--system');
    expect(system?.getAttribute('role')).toBe('img');
    expect(system?.getAttribute('aria-label')).toBe('系統');
    // 對照表沒有的種類用中性的預設圖示，不丟錯。
    expect(items[1].getAttribute('data-tone')).toBe('neutral');

    const time = items[0].querySelector('time') as HTMLElement;
    expect(time.getAttribute('datetime')).toBe(minutesAgo(3).toISOString());
    expect(time.textContent?.trim()).toBe('3 分鐘前');
    expect(time.getAttribute('tabindex')).toBe('0');
    expect(items[1].querySelector('time')?.textContent?.trim()).toBe('1 小時前');
  });

  it('相對時間隨共用時鐘每分鐘更新；元件銷毀後計時器清掉', async () => {
    render([{ id: 'a', actor: { name: '王' }, at: minutesAgo(3), kind: 'status', summary: '' }]);
    const clock = TestBed.inject(MinuteClock);
    expect(clock.running).toBe(true);
    const time = () => el.querySelector('time')?.textContent?.trim();
    expect(time()).toBe('3 分鐘前');

    await vi.advanceTimersByTimeAsync(MINUTE_CLOCK_INTERVAL);
    fixture.detectChanges();
    expect(time()).toBe('4 分鐘前');

    fixture.destroy();
    expect(clock.running).toBe(false);
  });

  it('formatRelativeTime：現在、分鐘、小時、昨天、天、月', () => {
    const rtf = new Intl.RelativeTimeFormat('zh-TW', { numeric: 'auto' });
    const at = (ms: number) => new Date(NOW.getTime() - ms);
    expect(formatRelativeTime(at(20_000), NOW, rtf)).toBe('現在');
    expect(formatRelativeTime(at(59 * 60_000), NOW, rtf)).toBe('59 分鐘前');
    expect(formatRelativeTime(at(5 * 3_600_000), NOW, rtf)).toBe('5 小時前');
    expect(formatRelativeTime(new Date(2026, 9, 13, 8, 0), NOW, rtf)).toBe('昨天');
    expect(formatRelativeTime(new Date(2026, 9, 10, 8, 0), NOW, rtf)).toBe('4 天前');
    expect(formatRelativeTime(new Date(2026, 7, 1), NOW, rtf)).toBe('2 個月前');
  });

  it('變更 3 筆以內直接列出；超過 3 筆預設收合，按鈕有 aria-expanded，展開後再收合', () => {
    const changes = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ field: `欄位${i + 1}`, from: i === 0 ? null : `舊${i}`, to: `新${i}` }));
    render([
      { id: 'few', actor: null, at: minutesAgo(1), kind: 'status', summary: '', changes: changes(3) },
      { id: 'many', actor: null, at: minutesAgo(2), kind: 'status', summary: '', changes: changes(5) },
    ]);
    const [few, many] = Array.from(el.querySelectorAll('li.tl-item'));
    expect(few.querySelector('.tl-toggle')).toBeNull();
    expect((few.querySelector('.tl-changes') as HTMLElement).hidden).toBe(false);
    expect(few.querySelectorAll('.tl-change')).toHaveLength(3);
    expect(few.querySelector('.tl-change__from')?.textContent?.trim()).toBe('（空白）');
    expect(few.querySelector('.tl-change .tl-sr-only')?.textContent).toBe('改成');

    const toggle = many.querySelector('.tl-toggle') as HTMLButtonElement;
    const list = many.querySelector('.tl-changes') as HTMLElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(list.id);
    expect(toggle.querySelector('span:last-child')?.textContent?.trim()).toBe('展開 5 筆變更');
    expect(list.hidden).toBe(true);

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(list.hidden).toBe(false);
    expect(toggle.querySelector('span:last-child')?.textContent?.trim()).toBe('收合變更');

    toggle.click();
    fixture.detectChanges();
    expect(list.hidden).toBe(true);
  });

  it('留言以 blockquote 呈現', () => {
    render([{ id: 'a', actor: { name: '王' }, at: minutesAgo(1), kind: 'comment', summary: '王 留言', body: '已更換碳粉匣。' }]);
    expect(el.querySelector('blockquote.tl-body')?.textContent?.trim()).toBe('已更換碳粉匣。');
  });

  it('hasMore 時顯示載入更多，按下送出 loadMore；loadingMore 時停用並轉圈', () => {
    render([{ id: 'a', actor: null, at: minutesAgo(1), kind: 'status', summary: '' }]);
    expect(el.querySelector('.tl-more')).toBeNull();

    fixture.componentInstance.hasMore.set(true);
    fixture.detectChanges();
    const button = el.querySelector('.tl-more button') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('載入更多');
    button.click();
    expect(fixture.componentInstance.loadMoreCount).toBe(1);

    fixture.componentInstance.loadingMore.set(true);
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
    expect(el.querySelector('.tl-more mat-spinner')).not.toBeNull();
    expect(el.querySelector('lib-activity-timeline')?.getAttribute('aria-busy')).toBe('true');
  });

  it('loading 時顯示骨架（含報讀器文字），不顯示紀錄', () => {
    render([{ id: 'a', actor: null, at: minutesAgo(1), kind: 'status', summary: '' }], (h) => h.loading.set(true));
    expect(el.querySelector('.tl-skeleton')).not.toBeNull();
    expect(el.querySelector('.tl-skeleton .tl-sr-only')?.textContent).toBe('載入中');
    expect(el.querySelector('li.tl-item')).toBeNull();
  });

  it('篩選 chip：按下其他 chip 送出 filterChange 並更新 filter；再按目前的不會取消', () => {
    render([{ id: 'a', actor: null, at: minutesAgo(1), kind: 'status', summary: '' }], (h) => h.filters.set(FILTERS));
    const listbox = el.querySelector('mat-chip-listbox') as HTMLElement;
    expect(listbox.getAttribute('aria-label')).toBe('篩選活動紀錄');
    const options = () => Array.from(el.querySelectorAll<HTMLElement>('mat-chip-option'));
    const selected = () => options().map((o) => o.classList.contains('mat-mdc-chip-selected'));
    expect(selected()).toEqual([true, false, false]);

    const press = (option: HTMLElement) => {
      (option.querySelector('.mdc-evolution-chip__action--primary') as HTMLElement).click();
      fixture.detectChanges();
    };
    press(options()[1]);
    expect(fixture.componentInstance.filterEvents).toEqual(['changes']);
    expect(fixture.componentInstance.filter()).toBe('changes');
    expect(selected()).toEqual([false, true, false]);

    press(options()[1]);
    expect(fixture.componentInstance.filterEvents).toEqual(['changes']);
    expect(selected()).toEqual([false, true, false]);
  });

  it('空狀態：沒有紀錄用 lib-empty-state；篩選中（不是第一個）改用篩選後的文字', () => {
    render([], (h) => h.filters.set(FILTERS));
    expect(el.querySelector('lib-empty-state')?.textContent).toContain('還沒有活動紀錄');

    fixture.componentInstance.filter.set('comments');
    fixture.detectChanges();
    expect(el.querySelector('lib-empty-state')?.textContent).toContain('沒有符合篩選條件的紀錄');
    expect(el.querySelector('lib-empty-state')?.getAttribute('data-kind')).toBe('no-results');
  });

  it('沒有提供文字、或少了某一句時，建立元件就丟錯並列出缺的名稱', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HostComponent] });
    expect(() => TestBed.createComponent(HostComponent).detectChanges()).toThrow(/ACTIVITY_TIMELINE_LABELS/);

    TestBed.resetTestingModule();
    const partial: Partial<ActivityTimelineLabels> = { ...LABELS };
    delete partial.loadMore;
    delete partial.system;
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: ACTIVITY_TIMELINE_LABELS, useValue: partial }],
    });
    expect(() => TestBed.createComponent(HostComponent).detectChanges()).toThrow(/「system」「loadMore」/);
  });
});
