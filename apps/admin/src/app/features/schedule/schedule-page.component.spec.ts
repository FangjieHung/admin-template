import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AccessService, provideAccess } from '@admin-template/access';
import { DEMO_ACCESS_CONFIG } from '../../core/access/demo-access';
import { TICKET_REPOSITORY_DELAY, TicketRepository } from '../tickets/data/ticket.repository';
import { SchedulePageComponent, UNASSIGNED_ROW, ticketToEvent } from './schedule-page.component';
import { Ticket } from '../tickets/data/ticket.model';

@Component({ template: '<p data-page="ticket">ticket</p>' })
class TicketStubComponent {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('SchedulePageComponent（排程樣板）', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      harness.detectChanges();
      await sleep(0);
    }
    harness.detectChanges();
  };

  async function open(user?: string) {
    try {
      localStorage.clear();
    } catch {
      // 測試環境沒有 localStorage 時略過
    }
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'templates/schedule', component: SchedulePageComponent },
          { path: 'templates/tickets/:id', component: TicketStubComponent },
        ]),
        provideAccess(DEMO_ACCESS_CONFIG),
        { provide: TICKET_REPOSITORY_DELAY, useValue: 0 },
      ],
    });
    if (user) TestBed.inject(AccessService).signIn(user);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/templates/schedule', SchedulePageComponent);
    el = harness.routeNativeElement as HTMLElement;
    document.body.appendChild(el);
    await settle();
  }

  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => {
    TestBed.inject(OverlayContainer).getContainerElement().innerHTML = '';
    el?.remove();
  });

  it('工程師一人一列（依組別分組，最後是未指派），有期限的工單排在到期日', async () => {
    await open();
    const rows = el.querySelectorAll('[data-resource-row]');
    expect(rows).toHaveLength(13);
    expect(rows[rows.length - 1].getAttribute('data-resource-row')).toBe(UNASSIGNED_ROW);
    expect([...el.querySelectorAll('.rt__group-label')].map((g) => g.textContent?.trim())).toEqual(['資訊室', '總務組', '人資組', '待指派']);
    expect(el.querySelectorAll('.cal-ev').length).toBeGreaterThan(0);
  });

  it('Alt＋下移到下一位工程師：工單的負責人改了，活動紀錄記一筆「在排程修改了」', async () => {
    await open();
    const repo = TestBed.inject(TicketRepository);
    const button = el.querySelector<HTMLButtonElement>('.cal-ev.is-editable')!;
    const id = button.getAttribute('data-event-id')!;
    const before = (await repo.get(id))!;
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
    await settle();
    const after = (await repo.get(id))!;
    expect(after.assigneeId).not.toBe(before.assigneeId);
    const log = await repo.activity(id);
    expect(log[0].summary).toContain('在排程修改了負責人');
  });

  it('點工單在側邊看詳情，可以打開工單頁', async () => {
    await open();
    el.querySelector<HTMLButtonElement>('.cal-ev')!.click();
    await settle();
    const panel = el.querySelector('.schedule-panel')!;
    expect(panel.querySelector('lib-description-list')).not.toBeNull();
    expect(panel.querySelector('lib-status-chip')).not.toBeNull();
    expect(panel.querySelector('[data-action="open-ticket"]')?.getAttribute('href')).toMatch(/^\/templates\/tickets\/TK-\d+$/);
  });

  it('檢視者唯讀：顯示說明，活動不能拖、沒有鍵盤移動的說明', async () => {
    await open('u-viewer');
    expect(el.querySelector('[data-readonly-note]')).not.toBeNull();
    expect(el.querySelector('.cal-ev.is-editable')).toBeNull();
    expect(el.querySelector('.cal-ev')?.getAttribute('aria-description')).toBeNull();
  });

  it('已完成、已關閉的工單不能拖；沒有期限的不出現', () => {
    const base: Ticket = {
      id: 'TK-1',
      title: '測試',
      status: 'open',
      priority: 'high',
      category: 'other',
      assigneeId: null,
      requesterId: 'req-001',
      createdAt: '2026-10-01T00:00:00.000Z',
      dueDate: '2026-10-20',
      description: '',
      attachmentCount: 0,
    };
    expect(ticketToEvent(base, true)).toMatchObject({ resourceId: UNASSIGNED_ROW, editable: true, allDay: true, category: 'high' });
    expect(ticketToEvent({ ...base, status: 'resolved' }, true)?.editable).toBe(false);
    expect(ticketToEvent({ ...base, dueDate: null }, true)).toBeNull();
  });
});
