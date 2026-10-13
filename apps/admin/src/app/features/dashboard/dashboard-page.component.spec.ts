import { beforeEach, describe, expect, it } from 'vitest';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, provideRouter } from '@angular/router';
import { AccessService, provideAccess } from '@admin-template/access';
import { DEMO_ACCESS_CONFIG } from '../../core/access/demo-access';
import { HeaderComponent } from '../../layout/header/header.component';
import { makeTicketDemoData } from '../tickets/data/ticket-demo-data';
import { isOverdue } from '../tickets/data/ticket-format';
import { TICKET_DEMO_TODAY, TICKET_REPOSITORY_DELAY } from '../tickets/data/ticket.repository';
import { TICKET_TEST_TODAY } from '../tickets/testing/ticket-page-host';
import { DashboardPageComponent } from './dashboard-page.component';
import { computeDashboard, myTodo, myTodoListParams, parsePeriod, periodRange } from './dashboard-stats';

@Component({
  selector: 'app-dashboard-test-host',
  imports: [RouterOutlet, HeaderComponent],
  template: `<app-header [defaultTitle]="{ title: '', breadcrumbs: [] }" /><router-outlet />`,
})
class HostComponent {}

@Component({ template: '<p data-page="list">工單列表</p>' })
class ListStubComponent {}

@Component({ template: '<p data-page="detail">工單詳情</p>' })
class DetailStubComponent {}

describe('dashboard-stats', () => {
  const today = TICKET_TEST_TODAY; // 2026-10-14（週三）15:00

  it('期間：7 天按日、30 天每 3 天、本季按週；上一期等長', () => {
    const week = periodRange('7d', today);
    expect(week.buckets).toHaveLength(7);
    expect(week.start).toEqual(new Date(2026, 9, 8));
    expect(week.end).toEqual(new Date(2026, 9, 15));
    expect(week.prevStart).toEqual(new Date(2026, 9, 1));
    expect(periodRange('30d', today).buckets).toHaveLength(10);
    const quarter = periodRange('quarter', today);
    expect(quarter.start).toEqual(new Date(2026, 9, 1));
    expect(quarter.buckets).toHaveLength(2);
    expect(quarter.prevStart).toEqual(new Date(2026, 6, 1));
    expect(quarter.prevEnd).toEqual(new Date(2026, 6, 15));
    expect(parsePeriod('quarter')).toBe('quarter');
    expect(parsePeriod('bogus')).toBe('7d');
  });

  it('數字小卡、趨勢與分布的數字對得起來', () => {
    const { tickets } = makeTicketDemoData(today);
    const resolved = new Map<string, string>();
    const stats = computeDashboard(tickets, resolved, '30d', today);
    expect(stats.trend.series[0].values.reduce((a, b) => (a ?? 0) + (b ?? 0), 0)).toBe(stats.created.value);
    expect(stats.byStatus.reduce((sum, s) => sum + s.value, 0)).toBe(stats.created.value);
    const byCategory = stats.byCategory.series.flatMap((s) => s.values).reduce((a, b) => (a ?? 0) + (b ?? 0), 0);
    expect(byCategory).toBe(stats.created.value);
    expect(stats.open.value).toBe(tickets.filter((t) => ['open', 'in-progress', 'waiting'].includes(t.status)).length);
  });

  it('待辦：只有指派給我、未結案的；逾期的排前面', () => {
    const { tickets } = makeTicketDemoData(today);
    const list = myTodo(tickets, 'staff-02', today);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((t) => t.assigneeId === 'staff-02' && !['resolved', 'closed'].includes(t.status))).toBe(true);
    const flags = list.map((t) => isOverdue(t.dueDate, t.status, today));
    const firstNotOverdue = flags.indexOf(false);
    expect(firstNotOverdue === -1 || flags.slice(firstNotOverdue).every((f) => !f)).toBe(true);
    expect(myTodo(tickets, null, today)).toEqual([]);
    expect(JSON.parse(myTodoListParams('staff-02').f)).toEqual([
      { field: 'assignee', type: 'multiSelect', values: ['staff-02'] },
      { field: 'status', type: 'multiSelect', values: ['open', 'in-progress', 'waiting'] },
    ]);
  });
});

describe('DashboardPageComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let el: HTMLElement;
  let router: Router;

  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r));
    }
    fixture.detectChanges();
  };
  const navigate = async (url: string) => {
    await router.navigateByUrl(url);
    await settle();
  };
  const periodButton = (id: string) => el.querySelector<HTMLButtonElement>(`[data-period="${id}"]`)!;
  const statLabel = (id: string) => el.querySelector(`[data-stat="${id}"] .sc-label`)!.textContent!.trim();
  const trendPoints = () => el.querySelectorAll('[data-chart="trend"] rect.lib-chart__hit').length;

  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // 測試環境沒有 localStorage 時略過
    }
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'templates/dashboard', component: DashboardPageComponent },
          { path: 'templates/tickets', component: ListStubComponent },
          { path: 'templates/tickets/:id', component: DetailStubComponent },
        ]),
        provideAccess(DEMO_ACCESS_CONFIG),
        { provide: TICKET_REPOSITORY_DELAY, useValue: 0 },
        { provide: TICKET_DEMO_TODAY, useValue: () => TICKET_TEST_TODAY },
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
    el = fixture.nativeElement;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('預設 7 天（網址不寫）；切到 30 天寫進 ?period=30d，小卡標題與趨勢跟著換', async () => {
    await navigate('/templates/dashboard');
    expect(periodButton('7d').getAttribute('aria-pressed')).toBe('true');
    expect(statLabel('created')).toBe('本週新增');
    expect(trendPoints()).toBe(7);

    periodButton('30d').click();
    await settle();
    expect(router.url).toBe('/templates/dashboard?period=30d');
    expect(periodButton('30d').getAttribute('aria-pressed')).toBe('true');
    expect(periodButton('7d').getAttribute('aria-pressed')).toBe('false');
    expect(statLabel('created')).toBe('近 30 天新增');
    expect(trendPoints()).toBe(10);
    expect(el.querySelector('[data-stat="open"] [data-stat-change]')!.textContent).toContain('較一個月前');

    periodButton('7d').click();
    await settle();
    expect(router.url).toBe('/templates/dashboard');
  });

  it('從網址還原期間（?period=quarter，本季按週）', async () => {
    await navigate('/templates/dashboard?period=quarter');
    expect(periodButton('quarter').getAttribute('aria-pressed')).toBe('true');
    expect(statLabel('created')).toBe('本季新增');
    expect(trendPoints()).toBe(2);
  });

  it('待辦：最多 5 筆，連到工單詳情；「查看全部」帶著負責人與未結案的篩選', async () => {
    await navigate('/templates/dashboard');
    const items = Array.from(el.querySelectorAll<HTMLAnchorElement>('a[data-todo]'));
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(5);
    expect(items[0].getAttribute('href')).toMatch(/^\/templates\/tickets\/TK-\d+$/);

    const all = el.querySelector<HTMLAnchorElement>('a[data-todo-all]')!;
    const url = new URL(all.getAttribute('href')!, 'http://x');
    expect(url.pathname).toBe('/templates/tickets');
    expect(JSON.parse(url.searchParams.get('f')!)[0]).toEqual({ field: 'assignee', type: 'multiSelect', values: ['staff-02'] });

    items[0].click();
    await settle();
    expect(router.url).toMatch(/^\/templates\/tickets\/TK-\d+$/);
    expect(el.querySelector('[data-page="detail"]')).not.toBeNull();
  });

  it('「未結案」整張卡是連結，打開只看未結案的工單列表', async () => {
    await navigate('/templates/dashboard');
    const card = el.querySelector<HTMLAnchorElement>('a[data-stat="open"]')!;
    const url = new URL(card.getAttribute('href')!, 'http://x');
    expect(url.pathname).toBe('/templates/tickets');
    expect(JSON.parse(url.searchParams.get('f')!)[0].values).toEqual(['open', 'in-progress', 'waiting']);
  });

  it('檢視者也看得到；對不到負責人的身分顯示「沒有指派給你的待辦」', async () => {
    const access = TestBed.inject(AccessService);
    access.signIn('u-viewer');
    await navigate('/templates/dashboard');
    expect(el.querySelector('[data-chart="trend"]')).not.toBeNull();
    access.signIn('u-member'); // 王小明不是任何工單的負責人
    await settle();
    expect(el.querySelector('a[data-todo]')).toBeNull();
    expect(el.querySelector('.db-todo lib-empty-state')!.textContent).toContain('沒有指派給你的待辦');
  });

  it('載入失敗顯示錯誤，重試拿掉 ?demo=error', async () => {
    await navigate('/templates/dashboard?demo=error');
    expect(el.querySelector('[data-state="error"]')).not.toBeNull();
    el.querySelector<HTMLButtonElement>('.lib-error-state__retry')!.click();
    await settle();
    expect(router.url).toBe('/templates/dashboard');
    expect(el.querySelector('[data-state="error"]')).toBeNull();
  });
});
