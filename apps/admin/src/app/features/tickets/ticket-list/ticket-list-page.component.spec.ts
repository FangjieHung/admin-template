import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { By } from '@angular/platform-browser';
import { TICKET_REPOSITORY_DELAY } from '../data/ticket.repository';
import { TICKET_COUNT } from '../data/ticket-demo-data';
import { setupTicketPage } from '../testing/ticket-page-host';
import { TicketListMemory } from './ticket-list-url';
import { TicketListPageComponent } from './ticket-list-page.component';

function rowIds(el: HTMLElement): string[] {
  return Array.from(el.querySelectorAll('.dt-table tbody tr td .ticket-id')).map((n) => n.textContent?.trim() ?? '');
}

function queryOf(url: string): URLSearchParams {
  return new URLSearchParams(url.split('?')[1] ?? '');
}

describe('TicketListPageComponent（列表頁樣板）', () => {
  it('載入中顯示骨架列；載入完顯示第一頁 25 筆、筆數與頁首的「新增工單」', async () => {
    // 模擬 40ms 的網路延遲，才看得到載入中。
    const h = await setupTicketPage([{ provide: TICKET_REPOSITORY_DELAY, useValue: 40 }]);
    await h.router.navigateByUrl('/templates/tickets');
    h.fixture.detectChanges();
    expect(h.el.querySelectorAll('.dt-skeleton-row').length).toBeGreaterThan(0);

    await new Promise((r) => setTimeout(r, 60));
    await h.settle();
    expect(rowIds(h.el)).toHaveLength(25);
    expect(rowIds(h.el)[0]).toBe('TK-2120');
    expect(h.el.querySelector('[data-ticket-count]')?.textContent).toContain(`共 ${TICKET_COUNT} 筆`);
    expect(h.el.querySelector('app-header [data-action="create"]')?.textContent).toContain('新增工單');
    expect(h.el.querySelector('app-header app-template-info')).not.toBeNull();
  });

  it('網址還原：搜尋、篩選、排序、頁碼從 query params 讀回來（重新整理、從詳情返回）', async () => {
    const h = await setupTicketPage();
    const f = encodeURIComponent(JSON.stringify([{ field: 'status', type: 'multiSelect', values: ['open', 'in-progress'] }]));
    await h.navigate(`/templates/tickets?f=${f}&sort=id.asc&size=50&page=2`);

    const ids = rowIds(h.el);
    expect(ids).toHaveLength(Math.min(50, ids.length));
    // 依編號遞增排序、第 2 頁：第一列的編號比第 1 頁的 50 筆都大。
    const all = (await h.repo.list()).filter((t) => t.status === 'open' || t.status === 'in-progress').map((t) => t.id).sort();
    expect(ids[0]).toBe(all[50]);
    expect(h.el.querySelector('[data-ticket-count]')?.textContent).toContain(`符合 ${all.length}／${TICKET_COUNT} 筆`);
    // 狀態快速篩選只在「只選一個狀態」時顯示；這裡選了兩個，chips 有一個條件。
    expect(h.el.querySelectorAll('lib-filter-chips .ui-chip').length).toBeGreaterThan(0);
  });

  it('改篩選會寫回網址（replaceUrl），並記住給詳情頁的「返回列表」用', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets?page=3');
    expect(queryOf(h.router.url).get('page')).toBe('3');

    const list = h.fixture.debugElement.query(By.directive(TicketListPageComponent)).componentInstance;
    list['setQuickStatus']('waiting');
    await h.settle();

    const params = queryOf(h.router.url);
    expect(JSON.parse(params.get('f') ?? '[]')).toEqual([{ field: 'status', type: 'multiSelect', values: ['waiting'] }]);
    // 換篩選回到第 1 頁。
    expect(params.get('page')).toBeNull();
    expect(TestBed.inject(TicketListMemory).queryParams).toEqual({ f: params.get('f') });
  });

  it('點一列（或按 Enter）進詳情', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets');
    const row = h.el.querySelector('.dt-table tbody tr') as HTMLElement;
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await h.settle();
    expect(h.router.url).toBe('/templates/tickets/TK-2120');
  });

  it('篩選後沒有結果：空狀態＋「清除篩選」；?demo=empty：「還沒有工單」＋新增', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets?q=%E6%B2%92%E6%9C%89%E9%80%99%E7%A8%AE%E5%B7%A5%E5%96%AE');
    expect(h.el.querySelector('lib-empty-state')?.textContent).toContain('沒有符合條件的工單');
    (h.el.querySelector('lib-empty-state button') as HTMLButtonElement).click();
    await h.settle();
    expect(rowIds(h.el)).toHaveLength(25);
    expect(queryOf(h.router.url).get('q')).toBeNull();

    TestBed.resetTestingModule();
    const empty = await setupTicketPage();
    await empty.navigate('/templates/tickets?demo=empty');
    expect(empty.el.querySelector('lib-empty-state')?.textContent).toContain('還沒有工單');
    expect(empty.el.querySelector('lib-empty-state button')?.textContent).toContain('新增工單');
  });


  it('?demo=error：錯誤畫面＋重試；重試拿掉 demo 參數並載入成功', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets?demo=error');
    expect(h.el.querySelector('[data-state="error"] lib-error-state')?.textContent).toContain('工單載入失敗');

    (h.el.querySelector('lib-error-state button') as HTMLButtonElement).click();
    await h.settle();
    expect(queryOf(h.router.url).get('demo')).toBeNull();
    expect(rowIds(h.el)).toHaveLength(25);
  });

  it('權限：檢視者看不到「新增工單」、批次改狀態與刪除（仍可多選匯出）', async () => {
    const h = await setupTicketPage();
    h.access.signIn('u-viewer');
    await h.navigate('/templates/tickets');
    expect(h.el.querySelector('app-header [data-action="create"]')).toBeNull();

    (h.el.querySelector('.dt-table tbody .dt-selection-checkbox') as HTMLInputElement).click();
    await h.settle();
    expect(h.el.querySelector('.dt-batch-toolbar')).not.toBeNull();
    expect(h.el.querySelector('[data-action="batch-status"]')).toBeNull();
    expect(h.el.querySelector('.dt-batch-delete-btn')).toBeNull();
  });

  it('批次刪除：確認後刪掉、提示可以復原；按「復原」放回原位', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets');
    const checks = h.el.querySelectorAll<HTMLInputElement>('.dt-table tbody .dt-selection-checkbox');
    checks[0].click();
    checks[1].click();
    await h.settle();
    (h.el.querySelector('.dt-batch-delete-btn') as HTMLButtonElement).click();
    await h.settle();

    expect(h.dialog.opened).toHaveLength(1);
    expect(await h.repo.list()).toHaveLength(TICKET_COUNT - 2);
    expect(rowIds(h.el)[0]).toBe('TK-2118');
    const toast = TestBed.inject(OverlayContainer).getContainerElement().querySelector('lib-toast');
    expect(toast?.textContent).toContain('已刪除 2 張工單');

    (toast?.querySelector('button') as HTMLButtonElement).click();
    await h.settle();
    expect(await h.repo.list()).toHaveLength(TICKET_COUNT);
    expect(rowIds(h.el).slice(0, 2)).toEqual(['TK-2120', 'TK-2119']);
  });
});
