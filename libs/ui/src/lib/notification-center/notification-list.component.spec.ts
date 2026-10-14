import { describe, it, expect, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationListComponent, groupNotifications } from './notification-list.component';
import { NOTIFICATION_CENTER_LABELS, NotificationCenterLabels } from './notification-center-labels';
import {
  DemoNotificationSource,
  NotificationItem,
  NotificationSource,
  createDemoNotificationSource,
} from './notification-source';

const LABELS: NotificationCenterLabels = {
  list: '通知',
  filterGroup: '顯示哪些通知',
  filterAll: '全部',
  filterUnread: '未讀',
  categoryGroup: '通知類別',
  categoryAll: '所有類別',
  markAllRead: '全部標為已讀',
  markRead: '將「{title}」標為已讀',
  markUnread: '將「{title}」標為未讀',
  remove: '移除「{title}」',
  unread: '未讀',
  today: '今天',
  yesterday: '昨天',
  earlier: '更早',
  loadMore: '載入更多',
  loading: '載入中',
  empty: '沒有通知',
  emptyUnread: '沒有未讀通知',
  emptyDetail: '有新的指派、提及或系統公告時會出現在這裡',
  error: '通知載入失敗',
  errorHint: '請確認網路連線後再試一次',
  retry: '重試',
  actionFailed: '沒有完成，請再試一次',
  announceNew: '有 {count} 則新通知：{title}',
  announceAllRead: '已將全部通知標為已讀',
  announceRead: '已將「{title}」標為已讀',
  announceUnread: '已將「{title}」標為未讀',
  announceRemoved: '已移除「{title}」',
};

const MIN = 60_000;
const DAY = 86_400_000;

function seed(): NotificationItem[] {
  const now = Date.now();
  return [
    { id: 'a', title: '林雅婷把 TK-2048 指派給你', body: '印表機卡紙', createdAt: now - 2 * MIN, read: false, category: 'assigned', link: '/t/2048', avatar: '林' },
    { id: 'b', title: '王小明在 TK-2051 提到你', createdAt: now - 3 * MIN, read: false, category: 'mention', action: { id: 'reply', label: '回覆' } },
    { id: 'c', title: '專案「官網改版」狀態變更為進行中', createdAt: now - 4 * MIN, read: true, category: 'system', icon: 'sync', tone: 'info' },
    { id: 'd', title: '系統維護公告', createdAt: now - 3 * DAY, read: false, category: 'system', icon: 'build', tone: 'warning' },
    { id: 'e', title: '週報已產生', createdAt: now - 5 * DAY, read: true, category: 'system' },
  ];
}

@Component({
  imports: [NotificationListComponent],
  template: `
    <lib-notification-list
      [source]="source()"
      [categories]="categories"
      [pageSize]="pageSize()"
      [(filter)]="filter"
      [(category)]="category"
      (open)="opened.push($event.id)"
      (action)="actions.push($event.action.id)"
    />
  `,
})
class HostComponent {
  readonly source = signal<NotificationSource>(createDemoNotificationSource(seed(), { latencyMs: 0 }));
  readonly pageSize = signal(10);
  readonly filter = signal<'all' | 'unread'>('all');
  readonly category = signal<string | null>(null);
  readonly categories = [
    { id: 'assigned', label: '指派給我' },
    { id: 'mention', label: '提及' },
    { id: 'system', label: '系統' },
  ];
  opened: string[] = [];
  actions: string[] = [];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('NotificationListComponent（通知清單）', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;

  async function settle(rounds = 4): Promise<void> {
    for (let i = 0; i < rounds; i++) {
      fixture.detectChanges();
      await sleep(0);
    }
    fixture.detectChanges();
  }

  async function setup(source?: NotificationSource, pageSize = 10): Promise<void> {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: NOTIFICATION_CENTER_LABELS, useValue: LABELS }],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    if (source) host.source.set(source);
    host.pageSize.set(pageSize);
    el = fixture.nativeElement as HTMLElement;
    await settle();
  }

  const items = () => Array.from(el.querySelectorAll<HTMLElement>('li.lib-notification-item'));
  const ids = () => items().map((li) => li.dataset['notificationId']);
  const item = (id: string) => el.querySelector<HTMLElement>(`li[data-notification-id="${id}"]`)!;
  const main = (id: string) => item(id).querySelector<HTMLButtonElement>('.ni-main')!;
  const tools = (id: string) => Array.from(item(id).querySelectorAll<HTMLButtonElement>('.ni-tool'));
  const pill = (filter: string) => el.querySelector<HTMLButtonElement>(`[data-filter="${filter}"]`)!;
  const markAll = () => el.querySelector<HTMLButtonElement>('.nl-mark-all')!;
  const live = () => el.querySelector('[aria-live="polite"].nl-sr')!.textContent?.trim();

  afterEach(() => fixture?.destroy());

  it('沒有提供畫面文字或少了一句時，建立元件就丟出錯誤並列出缺的名稱', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    expect(() => TestBed.createComponent(HostComponent).detectChanges()).toThrow(/NOTIFICATION_CENTER_LABELS/);
    TestBed.resetTestingModule();
    const { remove: _r, ...partial } = LABELS;
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: NOTIFICATION_CENTER_LABELS, useValue: partial }],
    });
    expect(() => TestBed.createComponent(HostComponent).detectChanges()).toThrow(/「remove」/);
  });

  it('groupNotifications：依當地日期分成今天、昨天、更早', () => {
    const now = new Date(2026, 9, 14, 10, 0);
    const at = (d: number, h: number) => new Date(2026, 9, d, h, 0).getTime();
    const groups = groupNotifications(
      [
        { id: '1', title: 'x', createdAt: at(14, 9), read: false },
        { id: '2', title: 'x', createdAt: at(13, 23), read: false },
        { id: '3', title: 'x', createdAt: at(13, 1), read: true },
        { id: '4', title: 'x', createdAt: at(10, 9), read: true },
      ],
      now,
    );
    expect(groups.map((g) => [g.kind, g.items.map((i) => i.id)])).toEqual([
      ['today', ['1']],
      ['yesterday', ['2', '3']],
      ['earlier', ['4']],
    ]);
  });

  it('先顯示骨架，載入後依新到舊列出、分組標題、未讀圓點與報讀器文字', async () => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: NOTIFICATION_CENTER_LABELS, useValue: LABELS }],
    });
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.source.set(createDemoNotificationSource(seed(), { latencyMs: 20 }));
    el = fixture.nativeElement;
    fixture.detectChanges();
    expect(el.querySelector('lib-skeleton')).not.toBeNull();
    expect(el.querySelector('lib-notification-list')?.getAttribute('aria-busy')).toBe('true');
    await sleep(40);
    await settle();
    expect(el.querySelector('lib-skeleton')).toBeNull();
    expect(ids()).toEqual(['a', 'b', 'c', 'd', 'e']);
    const headings = Array.from(el.querySelectorAll('.nl-group__heading')).map((h) => h.textContent?.trim());
    expect(headings[headings.length - 1]).toBe('更早');
    expect(el.querySelector('.nl-group__heading')?.getAttribute('aria-level')).toBe('3');
    expect(item('a').classList).toContain('is-unread');
    expect(item('c').classList).not.toContain('is-unread');
    expect(item('a').querySelector('.ni-sr')?.textContent).toBe('未讀');
    expect(item('a').querySelector('.ni-lead--avatar')?.textContent).toBe('林');
    expect(item('b').textContent).toContain('提及');
    // 只有第一則在 Tab 順序裡。
    expect(main('a').tabIndex).toBe(0);
    expect(main('b').tabIndex).toBe(-1);
  });

  it('未讀：只列出未讀，未讀鈕帶數字；沒有未讀時顯示「沒有未讀通知」', async () => {
    await setup();
    expect(pill('unread').textContent).toContain('3');
    pill('unread').click();
    await settle();
    expect(host.filter()).toBe('unread');
    expect(pill('unread').getAttribute('aria-pressed')).toBe('true');
    expect(ids()).toEqual(['a', 'b', 'd']);
    markAll().click();
    await settle();
    pill('all').click();
    await settle();
    pill('unread').click();
    await settle();
    expect(items()).toHaveLength(0);
    expect(el.querySelector('lib-empty-state')?.textContent).toContain('沒有未讀通知');
  });

  it('類別：只列出該類別', async () => {
    await setup();
    el.querySelector<HTMLButtonElement>('[data-category="system"]')!.click();
    await settle();
    expect(host.category()).toBe('system');
    expect(ids()).toEqual(['c', 'd', 'e']);
  });

  it('標為已讀／未讀：畫面、未讀數與資料來源一起更新，並念出結果', async () => {
    const source = createDemoNotificationSource(seed(), { latencyMs: 0 });
    await setup(source);
    expect(tools('a')[0].getAttribute('aria-label')).toBe('將「林雅婷把 TK-2048 指派給你」標為已讀');
    tools('a')[0].click();
    await settle();
    expect(item('a').classList).not.toContain('is-unread');
    expect(source.snapshot().find((i) => i.id === 'a')?.read).toBe(true);
    expect(pill('unread').textContent).toContain('2');
    await sleep(50);
    fixture.detectChanges();
    expect(live()).toBe('已將「林雅婷把 TK-2048 指派給你」標為已讀');
    tools('a')[0].click();
    await settle();
    expect(item('a').classList).toContain('is-unread');
    expect(source.snapshot().find((i) => i.id === 'a')?.read).toBe(false);
  });

  it('全部標為已讀：沒有未讀後按鈕停用', async () => {
    const source = createDemoNotificationSource(seed(), { latencyMs: 0 });
    await setup(source);
    expect(markAll().disabled).toBe(false);
    markAll().click();
    await settle();
    expect(el.querySelectorAll('li.is-unread')).toHaveLength(0);
    expect(await source.unreadCount()).toBe(0);
    expect(markAll().disabled).toBe(true);
  });

  it('點有連結的通知：標為已讀並送出 (open)；動作鈕送出 (action)', async () => {
    await setup();
    main('a').click();
    await settle();
    expect(host.opened).toEqual(['a']);
    expect(item('a').classList).not.toContain('is-unread');
    item('b').querySelector<HTMLButtonElement>('.ni-action')!.click();
    await settle();
    expect(host.actions).toEqual(['reply']);
    expect(item('b').classList).not.toContain('is-unread');
    // 沒有連結的通知只標為已讀，不送出 (open)。
    main('d').click();
    await settle();
    expect(host.opened).toEqual(['a']);
    expect(item('d').classList).not.toContain('is-unread');
  });

  it('移除：從清單拿掉、焦點移到下一則，並念出結果', async () => {
    const source = createDemoNotificationSource(seed(), { latencyMs: 0 });
    await setup(source);
    main('b').focus();
    tools('b')[1].click();
    await settle();
    expect(ids()).toEqual(['a', 'c', 'd', 'e']);
    expect(source.snapshot().some((i) => i.id === 'b')).toBe(false);
    expect(document.activeElement).toBe(main('c'));
    await sleep(50);
    fixture.detectChanges();
    expect(live()).toBe('已移除「王小明在 TK-2051 提到你」');
  });

  it('鍵盤：上下鍵移動焦點、Home／End、Delete 移除', async () => {
    await setup();
    main('a').focus();
    main('a').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle(1);
    expect(document.activeElement).toBe(main('b'));
    expect(main('b').tabIndex).toBe(0);
    expect(main('a').tabIndex).toBe(-1);
    main('b').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await settle(1);
    expect(document.activeElement).toBe(main('e'));
    main('e').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await settle(1);
    expect(document.activeElement).toBe(main('d'));
    main('d').dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    await settle();
    expect(ids()).toEqual(['a', 'b', 'c', 'e']);
    expect(document.activeElement).toBe(main('e'));
  });

  it('載入更多：用游標接著載入，最後一頁沒有按鈕', async () => {
    await setup(undefined, 2);
    expect(ids()).toEqual(['a', 'b']);
    const more = () => el.querySelector<HTMLButtonElement>('.nl-more button');
    more()!.click();
    await settle();
    expect(ids()).toEqual(['a', 'b', 'c', 'd']);
    more()!.click();
    await settle();
    expect(ids()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(more()).toBeNull();
  });

  it('載入失敗：顯示錯誤與重試，重試後列出通知', async () => {
    await setup(createDemoNotificationSource(seed(), { latencyMs: 0, failOnce: true }));
    expect(el.querySelector('lib-error-state')?.textContent).toContain('通知載入失敗');
    el.querySelector<HTMLButtonElement>('lib-error-state button')!.click();
    await settle();
    expect(el.querySelector('lib-error-state')).toBeNull();
    expect(items()).toHaveLength(5);
  });

  it('新通知送達：放到最上面並用 live region 念出（一次好幾則時合併）', async () => {
    const source: DemoNotificationSource = createDemoNotificationSource(seed(), { latencyMs: 0 });
    await setup(source);
    source.push({ id: 'n1', title: '陳怡君在 TK-2060 提到你', category: 'mention' });
    await settle(1);
    expect(ids()[0]).toBe('n1');
    expect(item('n1').classList).toContain('is-unread');
    await sleep(380);
    fixture.detectChanges();
    expect(live()).toBe('有 1 則新通知：陳怡君在 TK-2060 提到你');
    source.push({ id: 'n2', title: '第二則', category: 'system' });
    source.push({ id: 'n3', title: '第三則', category: 'system' });
    await sleep(380);
    await settle(1);
    expect(live()).toBe('有 2 則新通知：第三則');
    expect(ids().slice(0, 3)).toEqual(['n3', 'n2', 'n1']);
    expect(pill('unread').textContent).toContain('6');
  });

  it('新通知不符合目前的篩選時不放進清單', async () => {
    const source = createDemoNotificationSource(seed(), { latencyMs: 0 });
    await setup(source);
    el.querySelector<HTMLButtonElement>('[data-category="assigned"]')!.click();
    await settle();
    source.push({ id: 'n9', title: '系統公告', category: 'system' });
    await settle(1);
    expect(ids()).toEqual(['a']);
  });
});

describe('createDemoNotificationSource', () => {
  it('計時器定期送達新通知，可以停掉', async () => {
    const source = createDemoNotificationSource([], { latencyMs: 0 });
    const got: string[] = [];
    const sub = source.changes.subscribe((e) => e.type === 'added' && got.push(e.item.title));
    source.startTimer(1000, (n) => ({ title: `第 ${n} 則` }));
    expect(source.timerRunning).toBe(true);
    source.stopTimer();
    expect(source.timerRunning).toBe(false);
    source.push({ title: '手動' });
    expect(got).toEqual(['手動']);
    expect(await source.unreadCount()).toBe(1);
    sub.unsubscribe();
  });

  it('abort 的請求以 AbortError 結束', async () => {
    const source = createDemoNotificationSource(seed(), { latencyMs: 50 });
    const controller = new AbortController();
    const pending = source.list({ filter: 'all', limit: 5 }, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
