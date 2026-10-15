import { describe, it, expect, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { By } from '@angular/platform-browser';
import { ImportWizardComponent } from '@admin-template/ui';
import { setupTicketPage } from '../testing/ticket-page-host';

const CSV = [
  '主旨,分類,優先順序,負責人,到期日',
  '匯入測試：印表機卡紙,硬體,高,王宗翰,2026-11-30',
  '匯入測試：VPN 連不上,網路連線,急,林雅婷,',
  '匯入測試：找不到負責人,軟體,中,路人甲,2026/12/1',
].join('\n');

describe('TicketImportPageComponent（工單匯入樣板）', () => {
  afterEach(() => {
    TestBed.inject(OverlayContainer).getContainerElement().innerHTML = '';
  });

  it('列表的「匯入」只給能新增工單的角色；檢視者直接開網址看到沒有權限', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets');
    expect(h.el.querySelector('app-header [data-action="import"]')?.getAttribute('href')).toBe('/templates/tickets/import');

    h.access.signIn('u-viewer');
    await h.navigate('/templates/tickets/import');
    expect(h.el.querySelector('lib-import-wizard')).toBeNull();
    await h.navigate('/templates/tickets');
    expect(h.el.querySelector('app-header [data-action="create"]')).toBeNull();
    expect(h.el.querySelector('app-header [data-action="import"]')).toBeNull();
  });

  it('匯入後回到列表，新工單在最上面；負責人找不到的列標成錯誤並略過', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets/import');
    const wizard = h.fixture.debugElement.query(By.directive(ImportWizardComponent)).componentInstance as ImportWizardComponent;
    wizard.loadFile(new File([CSV], 'tickets.csv', { type: 'text/csv' }));
    await h.settle();
    const click = async (selector: string) => {
      h.el.querySelector<HTMLElement>(selector)!.click();
      await h.settle();
    };
    await click('.sw-actions__next');
    await click('.sw-actions__next');
    const invalid = h.el.querySelectorAll('.iwp-cell.is-invalid');
    expect(invalid).toHaveLength(1);
    expect(invalid[0].textContent).toContain('找不到這位負責人');

    await click('[data-field="skipInvalid"] input');
    await click('.sw-actions__next');
    await click('.sw-actions__finish');
    expect(h.el.querySelector('[data-stat="created"] dd')?.textContent?.trim()).toBe('2');

    await click('[data-action="done"]');
    expect(h.router.url.split('?')[0]).toBe('/templates/tickets');
    // 匯入完成後離開不再確認
    expect(h.dialog.opened).toHaveLength(0);
    const tickets = await h.repo.list();
    const imported = tickets.filter((t) => t.title.startsWith('匯入測試'));
    expect(imported.map((t) => [t.title, t.category, t.priority, t.assigneeId, t.dueDate])).toEqual([
      ['匯入測試：VPN 連不上', 'network', 'urgent', 'staff-02', null],
      ['匯入測試：印表機卡紙', 'hardware', 'high', 'staff-01', '2026-11-30'],
    ]);
    expect(tickets[0].title).toBe('匯入測試：VPN 連不上');
    expect(document.body.textContent).toContain('已匯入 2 筆工單');
  });

  it('選了檔案還沒匯入就換頁：先確認（選「留在這一頁」不離開）；按「取消」回列表不再問', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets/import');
    const wizard = h.fixture.debugElement.query(By.directive(ImportWizardComponent)).componentInstance as ImportWizardComponent;

    // 還沒選檔：直接離開
    await h.navigate('/templates/tickets');
    expect(h.dialog.opened).toHaveLength(0);

    await h.navigate('/templates/tickets/import');
    const again = h.fixture.debugElement.query(By.directive(ImportWizardComponent)).componentInstance as ImportWizardComponent;
    expect(again).not.toBe(wizard);
    again.loadFile(new File([CSV], 'tickets.csv', { type: 'text/csv' }));
    await h.settle();
    expect(again.hasUnsavedWork()).toBe(true);

    h.dialog.next = false;
    await h.navigate('/templates/tickets');
    expect(h.dialog.opened).toEqual([expect.objectContaining({ title: '還沒完成匯入', confirmLabel: '放棄匯入' })]);
    expect(h.router.url).toBe('/templates/tickets/import');

    h.el.querySelector<HTMLElement>('.sw-actions__cancel')!.click();
    await h.settle();
    expect(h.router.url.split('?')[0]).toBe('/templates/tickets');
    expect(h.dialog.opened).toHaveLength(1);
  });
});
