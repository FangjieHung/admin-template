import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { By } from '@angular/platform-browser';
import { setupTicketPage } from '../testing/ticket-page-host';
import { TicketListMemory } from '../ticket-list/ticket-list-url';
import { TicketDetailPageComponent } from './ticket-detail-page.component';

function overlayToast(): HTMLElement | null {
  return TestBed.inject(OverlayContainer).getContainerElement().querySelector('lib-toast');
}

describe('TicketDetailPageComponent（詳情頁樣板）', () => {
  it('顯示標題、狀態、編號與摘要；返回列表帶著列表的篩選與頁碼', async () => {
    const h = await setupTicketPage();
    TestBed.inject(TicketListMemory).queryParams = { page: '2', q: '網路' };
    await h.navigate('/templates/tickets/TK-2048');
    const ticket = await h.repo.get('TK-2048');

    expect(h.el.querySelector('[libDetailTitle]')?.textContent?.trim()).toBe(ticket?.title);
    expect(h.el.querySelector('[libDetailMeta]')?.textContent).toContain('TK-2048');
    expect(h.el.querySelector('app-header h1')?.textContent).toBe('工單 TK-2048');
    const back = h.el.querySelector('a.ticket-back') as HTMLAnchorElement;
    expect(back.getAttribute('href')).toBe('/templates/tickets?page=2&q=%E7%B6%B2%E8%B7%AF');
  });

  it('id 不存在：顯示「找不到工單」與回列表，不是空白', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets/TK-9999');
    expect(h.el.querySelector('[data-state="not-found"]')?.textContent).toContain('找不到工單 TK-9999');
    expect(h.el.querySelector('lib-detail-layout')).toBeNull();
    (h.el.querySelector('[data-state="not-found"] button') as HTMLButtonElement).click();
    await h.settle();
    expect(h.router.url).toBe('/templates/tickets');
  });

  it('權限：檢視者看不到編輯、指派、關閉、刪除', async () => {
    const h = await setupTicketPage();
    h.access.signIn('u-viewer');
    await h.navigate('/templates/tickets/TK-2048');
    for (const action of ['edit', 'assign', 'close', 'reopen', 'delete']) {
      expect(h.el.querySelector(`[data-action="${action}"]`)).toBeNull();
    }

    h.access.signIn('u-admin');
    await h.settle();
    expect(h.el.querySelector('[data-action="edit"]')?.getAttribute('href')).toBe('/templates/tickets/TK-2048/edit');
  });

  it('關閉工單：確認後狀態變「已關閉」、活動紀錄多一筆「你 把狀態從 A 改成 B」；提示可以復原', async () => {
    const h = await setupTicketPage();
    await h.repo.setStatus(['TK-2048'], 'in-progress', { name: '測試' });
    await h.navigate('/templates/tickets/TK-2048');
    const before = (await h.repo.activity('TK-2048')).length;

    (h.el.querySelector('[data-action="close"]') as HTMLButtonElement).click();
    await h.settle();

    expect((await h.repo.get('TK-2048'))?.status).toBe('closed');
    const activity = await h.repo.activity('TK-2048');
    expect(activity).toHaveLength(before + 1);
    expect(activity[0].summary).toBe('你 把狀態從「處理中」改成「已關閉」');
    expect(h.el.querySelector('[data-tab="activity"]')?.textContent).toContain(`（${before + 1}）`);
    expect(h.el.querySelector('[data-action="reopen"]')).not.toBeNull();
    expect(overlayToast()?.textContent).toContain('已關閉工單 TK-2048');

    (overlayToast()?.querySelector('button') as HTMLButtonElement).click();
    await h.settle();
    expect((await h.repo.get('TK-2048'))?.status).toBe('in-progress');
  });

  it('指派：對話框選人後寫進資料與活動紀錄；活動紀錄分頁列出最新一筆', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets/TK-2048');
    h.dialog.next = { assigneeId: 'staff-06' };

    (h.el.querySelector('[data-action="assign"]') as HTMLButtonElement).click();
    await h.settle();
    expect(h.dialog.opened[0]).toMatchObject({ ticketId: 'TK-2048' });
    expect((await h.repo.get('TK-2048'))?.assigneeId).toBe('staff-06');

    (h.el.querySelector('[data-tab="activity"]') as HTMLElement).click();
    await h.settle();
    expect(h.el.querySelector('[data-panel="activity"] lib-activity-timeline')?.textContent).toContain('你 把工單指派給 黃冠宇');
  });

  it('刪除：確認後刪掉並回到列表', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets/TK-2048');
    const layout = h.el.querySelector('lib-detail-layout');
    expect(layout).not.toBeNull();
    const page = h.fixture.debugElement.query(By.directive(TicketDetailPageComponent));
    await page.componentInstance['remove']();
    await h.settle();
    expect(await h.repo.get('TK-2048')).toBeNull();
    expect(h.router.url).toBe('/templates/tickets');
  });
});
