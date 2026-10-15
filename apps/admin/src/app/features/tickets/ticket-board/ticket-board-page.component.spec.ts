import { afterEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { By } from '@angular/platform-browser';
import { TICKET_COUNT } from '../data/ticket-demo-data';
import { Ticket } from '../data/ticket.model';
import { TicketPageHarness, setupTicketPage } from '../testing/ticket-page-host';
import { UNASSIGNED } from './ticket-board-page.component';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function queryOf(url: string): URLSearchParams {
  return new URLSearchParams(url.split('?')[1] ?? '');
}

describe('TicketBoardPageComponent（工單看板樣板）', () => {
  afterEach(() => {
    TestBed.inject(OverlayContainer).getContainerElement().innerHTML = '';
  });

  const card = (h: TicketPageHarness, id: string) => h.el.querySelector<HTMLElement>(`[data-kanban-card="${id}"]`);
  const columnOf = (h: TicketPageHarness, id: string) => card(h, id)?.closest<HTMLElement>('[data-kanban-column], [data-kanban-cell]');
  const statusOf = (h: TicketPageHarness, id: string) => {
    const el = columnOf(h, id);
    return el?.dataset['kanbanColumn'] ?? el?.dataset['kanbanCell'];
  };
  const laneOf = (h: TicketPageHarness, id: string) => card(h, id)?.closest<HTMLElement>('[data-kanban-group]')?.dataset['kanbanGroup'];
  const cardsIn = (h: TicketPageHarness, status: string) =>
    Array.from(h.el.querySelectorAll<HTMLElement>(`[data-kanban-column="${status}"] [data-kanban-card]`)).map((c) => c.dataset['kanbanCard']);
  const altKey = (target: HTMLElement, key: string) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, altKey: true, bubbles: true, cancelable: true }));
  const toastText = () => document.querySelector('.cdk-overlay-container')?.textContent ?? '';
  const pick = async (h: TicketPageHarness, test: (t: Ticket) => boolean) => (await h.repo.list()).find(test)!;

  async function openBoard(url = '/templates/tickets/board'): Promise<TicketPageHarness> {
    const h = await setupTicketPage();
    await h.navigate(url);
    return h;
  }

  it('五欄（待處理…已關閉），每張工單都在自己狀態那一欄；頁首有搜尋、負責人、優先順序與切回列表', async () => {
    const h = await openBoard();
    const titles = Array.from(h.el.querySelectorAll('.kh-title')).map((n) => n.textContent?.trim());
    expect(titles).toEqual(['待處理', '處理中', '等待回覆', '已完成', '已關閉']);
    const all = await h.repo.list();
    for (const status of ['open', 'in-progress', 'waiting', 'resolved', 'closed']) {
      expect(cardsIn(h, status)).toEqual(all.filter((t) => t.status === status).map((t) => t.id));
    }
    expect(h.el.querySelector('[data-ticket-count]')?.textContent).toContain(`共 ${TICKET_COUNT} 張工單`);
    const header = h.el.querySelector('app-header')!;
    expect(Array.from(header.querySelectorAll('lib-filter-select')).map((f) => f.getAttribute('label'))).toEqual(['負責人', '優先順序']);
    expect(header.querySelector('[data-action="list-view"]')?.getAttribute('href')).toBe('/templates/tickets');
    // 只有「待處理」欄底可以新增
    expect(h.el.querySelectorAll('lib-kanban-add-card')).toHaveLength(1);
    expect(h.el.querySelector('[data-kanban-column="open"] lib-kanban-add-card')).not.toBeNull();
  });

  it('工單列表的頁首有「看板」入口，看板的「列表」回到列表', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets');
    const link = h.el.querySelector<HTMLAnchorElement>('app-header [data-action="board-view"]')!;
    expect(link.textContent).toContain('看板');
    expect(link.getAttribute('href')).toBe('/templates/tickets/board');
    link.click();
    await h.settle();
    expect(h.router.url).toBe('/templates/tickets/board');
    expect(h.el.querySelector('app-ticket-board-page lib-kanban-board')).not.toBeNull();
    h.el.querySelector<HTMLAnchorElement>('app-header [data-action="list-view"]')!.click();
    await h.settle();
    expect(h.router.url).toBe('/templates/tickets');
  });

  it('篩選：負責人、優先順序、關鍵字（編號或標題）只留符合的卡片，寫進網址；清除篩選回到全部', async () => {
    const all = await (await setupTicketPage()).repo.list();
    TestBed.resetTestingModule();
    const target = all.find((t) => t.assigneeId && t.priority === 'high')!;
    const h = await openBoard(`/templates/tickets/board?assignee=${target.assigneeId}&priority=high`);
    const expected = all.filter((t) => t.assigneeId === target.assigneeId && t.priority === 'high').map((t) => t.id);
    const shown = Array.from(h.el.querySelectorAll<HTMLElement>('[data-kanban-card]')).map((c) => c.dataset['kanbanCard']);
    expect(shown.sort()).toEqual([...expected].sort());
    expect(h.el.querySelector('[data-ticket-count]')?.textContent).toContain(`符合條件 ${expected.length} 張（共 ${TICKET_COUNT} 張）`);

    // 未指派
    const board = () => h.fixture.debugElement.query(By.css('app-ticket-board-page')).componentInstance as {
      setAssignee(v: string | null): void;
      setPriority(v: string | null): void;
      setQuery(v: string): void;
      clearFilters(): void;
    };
    board().setPriority(null);
    board().setAssignee(UNASSIGNED);
    await h.settle();
    const unassigned = all.filter((t) => !t.assigneeId).map((t) => t.id);
    expect(Array.from(h.el.querySelectorAll<HTMLElement>('[data-kanban-card]')).map((c) => c.dataset['kanbanCard']).sort()).toEqual(unassigned.sort());
    expect(queryOf(h.router.url).get('assignee')).toBe(UNASSIGNED);

    // 關鍵字：編號
    board().setAssignee(null);
    board().setQuery(target.id);
    await h.settle();
    expect(Array.from(h.el.querySelectorAll<HTMLElement>('[data-kanban-card]')).map((c) => c.dataset['kanbanCard'])).toEqual([target.id]);
    expect(queryOf(h.router.url).get('q')).toBe(target.id);

    // 什麼都沒有：提示＋清除篩選
    board().setQuery('不存在的工單標題');
    await h.settle();
    expect(h.el.querySelector('[data-state="no-results"]')).not.toBeNull();
    h.el.querySelector<HTMLButtonElement>('[data-action="clear-filters"]')!.click();
    await h.settle();
    expect(h.el.querySelectorAll('[data-kanban-card]')).toHaveLength(TICKET_COUNT);
    expect(h.router.url).toBe('/templates/tickets/board');
  });

  it('換狀態寫回同一份資料：Alt＋→ 把工單移到「處理中」，資料層的狀態與活動紀錄跟著改；從看板打開詳情，詳情也是新狀態、返回連結回到看板', async () => {
    const h = await openBoard('/templates/tickets/board?priority=medium');
    const ticket = await pick(h, (t) => t.status === 'open' && !!t.assigneeId && t.priority === 'medium');
    altKey(card(h, ticket.id)!, 'ArrowRight');
    await h.settle();
    expect(statusOf(h, ticket.id)).toBe('in-progress');
    expect((await h.repo.get(ticket.id))?.status).toBe('in-progress');
    expect((await h.repo.activity(ticket.id))[0].summary).toBe('你 把狀態從「待處理」改成「處理中」');

    // 點卡片標題打開詳情
    card(h, ticket.id)!.querySelector<HTMLAnchorElement>('[data-action="open-ticket"]')!.click();
    await h.settle();
    expect(h.router.url).toBe(`/templates/tickets/${ticket.id}`);
    expect(h.el.querySelector('lib-status-chip')?.textContent).toContain('處理中');
    const back = h.el.querySelector<HTMLAnchorElement>('[data-action="back"]')!;
    expect(back.textContent).toContain('返回工單看板');
    expect(back.getAttribute('href')).toBe('/templates/tickets/board?priority=medium');
    back.click();
    await h.settle();
    expect(h.router.url).toBe('/templates/tickets/board?priority=medium');
    expect(statusOf(h, ticket.id)).toBe('in-progress');

    // 從列表打開的詳情：返回連結回到列表
    await h.navigate('/templates/tickets');
    await h.navigate(`/templates/tickets/${ticket.id}`);
    expect(h.el.querySelector('[data-action="back"]')?.textContent).toContain('返回工單列表');
  });

  it('依負責人分組：每位負責人一道（最後是未指派），Alt＋↓ 換道＝改負責人並寫回資料；分組寫進網址', async () => {
    const h = await openBoard();
    h.el.querySelector<HTMLButtonElement>('[data-group-mode="assignee"]')!.click();
    await h.settle();
    expect(queryOf(h.router.url).get('group')).toBe('assignee');
    const lanes = Array.from(h.el.querySelectorAll<HTMLElement>('[data-kanban-group]')).map((l) => l.dataset['kanbanGroup']);
    expect(lanes).toHaveLength(13);
    expect(lanes.at(-1)).toBe(UNASSIGNED);
    expect(h.el.querySelectorAll('lib-kanban-column-head')).toHaveLength(5);

    // 找一道裡某一格只有一張的工單：Alt＋↓ 會換到下一道
    const all = await h.repo.list();
    const lone = all.find(
      (t) => t.assigneeId && t.status === 'in-progress' && all.filter((o) => o.assigneeId === t.assigneeId && o.status === 'in-progress').length === 1,
    )!;
    const before = laneOf(h, lone.id)!;
    altKey(card(h, lone.id)!, 'ArrowDown');
    await h.settle();
    const after = laneOf(h, lone.id)!;
    expect(after).not.toBe(before);
    expect(statusOf(h, lone.id)).toBe('in-progress');
    const saved = await h.repo.get(lone.id);
    expect(saved?.assigneeId).toBe(after === UNASSIGNED ? null : after);
    expect((await h.repo.activity(lone.id))[0].kind).toBe('assign');
  });

  it('被擋下：沒有負責人的工單移到「已完成」跳出提示、留在原欄，資料不變', async () => {
    const h = await openBoard();
    // 示範資料裡沒有負責人的都在「待處理」：先往右移到「等待回覆」（允許），再往「已完成」（拒絕）
    const ticket = await pick(h, (t) => t.status === 'open' && !t.assigneeId);
    for (let i = 0; i < 3 && statusOf(h, ticket.id) !== 'waiting'; i++) {
      altKey(card(h, ticket.id)!, 'ArrowRight');
      await h.settle();
    }
    expect(statusOf(h, ticket.id)).toBe('waiting');
    altKey(card(h, ticket.id)!, 'ArrowRight');
    await h.settle();
    await sleep(20);
    expect(statusOf(h, ticket.id)).toBe('waiting');
    expect((await h.repo.get(ticket.id))?.status).toBe('waiting');
    expect(toastText()).toContain(`「${ticket.id}」還沒有負責人，指派之後才能移到「已完成」`);
  });

  it('「待處理」欄底新增工單：建立在同一份資料、出現在待處理最前面；分組模式新增在哪一道就指派給誰', async () => {
    const h = await openBoard();
    const add = (scope: ParentNode, title: string) => {
      scope.querySelector<HTMLButtonElement>('.ka-button')!.click();
      return h.settle().then(() => {
        const input = scope.querySelector<HTMLInputElement>('.ka-input')!;
        input.value = title;
        input.dispatchEvent(new Event('input'));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        return h.settle();
      });
    };
    await add(h.el.querySelector('[data-kanban-column="open"]')!, '會議室冷氣不冷');
    const created = (await h.repo.list())[0];
    expect(created.title).toBe('會議室冷氣不冷');
    expect(created.status).toBe('open');
    expect(created.assigneeId).toBeNull();
    expect(cardsIn(h, 'open')[0]).toBe(created.id);
    expect(toastText()).toContain(`已新增工單 ${created.id}`);

    h.el.querySelector<HTMLButtonElement>('[data-group-mode="assignee"]')!.click();
    await h.settle();
    await add(h.el.querySelector('[data-kanban-group="staff-02"] [data-kanban-cell="open"]')!, '借用投影機');
    const second = (await h.repo.list())[0];
    expect(second.title).toBe('借用投影機');
    expect(second.assigneeId).toBe('staff-02');
    expect(laneOf(h, second.id)).toBe('staff-02');
  });

  it('檢視者：看板唯讀（不能拖、沒有移動選單與新增），顯示只能檢視的說明', async () => {
    const h = await setupTicketPage();
    h.access.signIn('u-viewer');
    await h.navigate('/templates/tickets/board');
    expect(h.el.querySelector('[data-readonly-note]')).not.toBeNull();
    expect(h.el.querySelectorAll('[data-kanban-card]').length).toBe(TICKET_COUNT);
    expect(h.el.querySelector('.kb-move')).toBeNull();
    expect(h.el.querySelector('lib-kanban-add-card')).toBeNull();
  });
});
