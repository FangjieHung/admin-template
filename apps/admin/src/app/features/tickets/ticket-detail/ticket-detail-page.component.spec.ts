import { beforeAll, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { By } from '@angular/platform-browser';
import { DOMParser as PmDOMParser } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import { RichTextEditorComponent } from '@admin-template/ui';
import { NotificationCenterService } from '../../../core/notifications/notification-center.service';
import { setupTicketPage } from '../testing/ticket-page-host';
import { TicketListMemory } from '../ticket-list/ticket-list-url';
import { TicketDetailPageComponent } from './ticket-detail-page.component';

function overlayToast(): HTMLElement | null {
  return TestBed.inject(OverlayContainer).getContainerElement().querySelector('lib-toast');
}

describe('TicketDetailPageComponent（詳情頁樣板）', () => {
  beforeAll(() => {
    // jsdom 沒有版面：留言輸入框（ProseMirror）算游標座標時要用的 API 補上空的版本。
    Range.prototype.getBoundingClientRect ??= () => new DOMRect(0, 0, 0, 0);
    Range.prototype.getClientRects ??= () => Object.assign([] as DOMRect[], { item: () => null }) as unknown as DOMRectList;
    document.elementFromPoint ??= () => null;
  });

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
    // 列印只要能檢視就看得到，連到工單服務單。
    expect(h.el.querySelector('[data-action="print"]')?.getAttribute('href')).toBe('/templates/tickets/TK-2048/print');

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
  it('留言：顯示示範留言；留言並 @同事後多一則留言，頁首鈴鐺的未讀數加一；檢視者沒有輸入框', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets/TK-2048');
    const section = h.el.querySelector('[data-panel="comments"]') as HTMLElement;
    expect(section.querySelector('h3')?.textContent).toContain('留言（3）');
    expect(section.querySelectorAll('.lc-item')).toHaveLength(3);
    // 示範身分林雅婷（u-admin）自己的那一則可以編輯、刪除
    expect(section.querySelectorAll('[data-comment-action]')).toHaveLength(2);

    const center = TestBed.inject(NotificationCenterService);
    const runtime = await center.load();
    runtime.setAutoPush(false);
    await h.settle();
    const unreadBefore = center.unread();

    const composer = section.querySelector('.lc-composer lib-rich-text-editor') as HTMLElement;
    const editorCmp = h.fixture.debugElement.query((d) => d.nativeElement === composer).componentInstance as RichTextEditorComponent;
    await editorCmp.whenReady();
    const view = (composer.querySelector('.lib-rte__mount') as HTMLElement & { libRichTextView: EditorView }).libRichTextView;
    const box = document.createElement('div');
    box.innerHTML = '<p>請 <span data-type="mention" data-id="staff-06" data-label="黃冠宇">@黃冠宇</span> 協助送修</p>';
    view.dispatch(view.state.tr.replaceSelection(PmDOMParser.fromSchema(view.state.schema).parseSlice(box)));
    await h.settle();
    (section.querySelector('[data-comment-send]') as HTMLButtonElement).click();
    await h.settle();
    await new Promise((r) => setTimeout(r, 400));
    await h.settle();

    expect(section.querySelector('h3')?.textContent).toContain('留言（4）');
    const comments = await h.repo.comments('TK-2048');
    expect(comments.at(-1)?.author.name).toBe('林雅婷');
    expect(comments.at(-1)?.html).toContain('data-id="staff-06"');
    const list = await runtime.source.list({ filter: 'all', limit: 1 }, new AbortController().signal);
    expect(list.items[0].title).toBe('林雅婷在 TK-2048 提到 黃冠宇');
    expect(center.unread()).toBe(unreadBefore + 1);

    h.access.signIn('u-viewer');
    await h.settle();
    expect(section.querySelector('.lc-composer')).toBeNull();
    expect(section.querySelectorAll('[data-comment-action]')).toHaveLength(0);
  });
});
