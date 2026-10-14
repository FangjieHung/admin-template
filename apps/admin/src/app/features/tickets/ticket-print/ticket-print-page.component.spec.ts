import { describe, expect, it } from 'vitest';
import { setupTicketPage } from '../testing/ticket-page-host';

describe('TicketPrintPageComponent（工單服務單樣板）', () => {
  it('用 lib-print-document 排出工單服務單：單號、標題、資訊區、服務紀錄（由舊到新）、簽名欄與返回詳情的連結', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets/TK-2048/print');
    const ticket = (await h.repo.get('TK-2048'))!;
    const activity = await h.repo.activity('TK-2048');

    const doc = h.el.querySelector<HTMLElement>('lib-print-document[data-state="ready"]')!;
    expect(doc).not.toBeNull();
    expect(doc.querySelector('[role="heading"]')?.textContent?.trim()).toBe('工單服務單');
    expect(doc.querySelector('[data-print-number]')?.textContent?.trim()).toBe('TK-2048');
    expect(doc.querySelector('[data-print-title]')?.textContent?.trim()).toBe(ticket.title);
    expect(doc.querySelector('[libPrintInfo]')?.textContent).toContain('申請人');
    expect(h.el.querySelector('app-header h1')?.textContent).toBe('列印工單 TK-2048');

    const rows = Array.from(doc.querySelectorAll('tr.lib-print-table__row'));
    expect(rows).toHaveLength(activity.length);
    expect(rows[0].textContent).toContain(activity[activity.length - 1].summary);
    expect(rows[rows.length - 1].textContent).toContain(activity[0].summary);
    expect(Array.from(doc.querySelectorAll('.lib-print-sign__title')).map((n) => n.textContent?.trim())).toEqual([
      '申請人簽收',
      '服務人員',
    ]);

    const back = h.el.querySelector<HTMLAnchorElement>('a[data-back]')!;
    expect(back.getAttribute('href')).toBe('/templates/tickets/TK-2048');
    back.click();
    await h.settle();
    expect(h.router.url).toBe('/templates/tickets/TK-2048');
  });

  it('檢視者也能列印', async () => {
    const h = await setupTicketPage();
    h.access.signIn('u-viewer');
    await h.navigate('/templates/tickets/TK-2048/print');
    expect(h.el.querySelector('lib-print-document')).not.toBeNull();
  });

  it('工單不存在時顯示「找不到工單」與回列表', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets/TK-9999/print');
    expect(h.el.querySelector('[data-state="not-found"]')?.textContent).toContain('找不到工單 TK-9999');
    expect(h.el.querySelector('lib-print-document')).toBeNull();
  });
});
