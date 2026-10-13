import { describe, expect, it } from 'vitest';
import { FormControl, Validators } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { setupTicketPage } from '../testing/ticket-page-host';
import { collectFormErrors, fieldMessage, notBlank } from './form-errors';
import { TICKET_FORM_FIELDS, TicketFormPageComponent } from './ticket-form-page.component';

function type(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (!input) throw new Error(`找不到 ${selector}`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('錯誤摘要的規則（form-errors.ts）', () => {
  it('依欄位順序列出無效的欄位與第一個符合的訊息；只有空白算沒填', () => {
    const controls = {
      title: new FormControl('   ', [Validators.required, notBlank]),
      category: new FormControl(null, Validators.required),
      priority: new FormControl('medium', Validators.required),
      requesterId: new FormControl(null, Validators.required),
      assigneeId: new FormControl(null),
      dueDate: new FormControl(null),
      description: new FormControl(''),
    };
    expect(collectFormErrors(controls, TICKET_FORM_FIELDS)).toEqual([
      { key: 'title', label: '標題', message: '請輸入標題' },
      { key: 'category', label: '分類', message: '請選擇分類' },
      { key: 'requesterId', label: '申請人', message: '請選擇申請人' },
    ]);
    expect(fieldMessage(TICKET_FORM_FIELDS[0], { somethingElse: true })).toBe('標題的內容不正確');
  });
});

describe('TicketFormPageComponent（表單頁樣板）', () => {
  it('新增：空白送出 → 頂端錯誤摘要列出欄位、焦點在第一個錯誤欄位（標題），欄位顯示 mat-error', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets/new');
    expect(h.el.querySelector('app-header h1')?.textContent).toBe('新增工單');

    (h.el.querySelector('[data-action="save"]') as HTMLButtonElement).click();
    await h.settle();

    const summary = h.el.querySelector('[data-error-summary]');
    expect(summary?.getAttribute('role')).toBe('alert');
    expect(Array.from(summary?.querySelectorAll('a') ?? []).map((a) => a.getAttribute('data-summary-field'))).toEqual([
      'title',
      'category',
      'requesterId',
    ]);
    expect(document.activeElement).toBe(h.el.querySelector('[data-field="title"] input'));
    expect(h.el.querySelector('[data-field="title"] mat-error')?.textContent).toContain('請輸入標題');

    // 點摘要的連結跳到那個欄位。
    (summary?.querySelector('[data-summary-field="category"]') as HTMLAnchorElement).click();
    expect(document.activeElement).toBe(h.el.querySelector('[data-field="category"] .mat-mdc-select'));

    // 修好一個欄位，摘要即時少一項。
    type(h.el, '[data-field="title"] input', '新的工單');
    await h.settle();
    expect(h.el.querySelectorAll('[data-error-summary] a')).toHaveLength(2);
  });

  it('標題超過 80 字：字數提示與錯誤訊息', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets/new');
    type(h.el, '[data-field="title"] input', '字'.repeat(81));
    await h.settle();
    // 還沒離開欄位：字數提示。
    expect(h.el.querySelector('[data-field="title"] mat-hint')?.textContent).toContain('81/80');
    (h.el.querySelector('[data-field="title"] input') as HTMLInputElement).dispatchEvent(new Event('blur'));
    await h.settle();
    // 離開欄位後換成錯誤訊息（Material 的錯誤會取代提示，所以訊息裡也帶字數）。
    expect(h.el.querySelector('[data-field="title"] mat-error')?.textContent).toContain('標題不能超過 80 個字（81/80）');
  });

  it('canDeactivate：沒改過直接離開；改過就問（選「繼續編輯」留在頁面）', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets/TK-2048/edit');
    const form = h.fixture.debugElement.query(By.directive(TicketFormPageComponent)).componentInstance as TicketFormPageComponent;
    expect(form.isDirty()).toBe(false);
    expect(await form.canLeave()).toBe(true);
    expect(h.dialog.opened).toHaveLength(0);

    type(h.el, '[data-field="title"] input', '改過的標題');
    await h.settle();
    expect(form.isDirty()).toBe(true);
    h.dialog.next = false;
    await h.router.navigateByUrl('/templates/tickets');
    await h.settle();
    expect(h.dialog.opened).toHaveLength(1);
    expect(h.router.url).toBe('/templates/tickets/TK-2048/edit');

    // 改回原本的值就不算未存。
    const original = await h.repo.get('TK-2048');
    type(h.el, '[data-field="title"] input', original?.title ?? '');
    await h.settle();
    expect(form.isDirty()).toBe(false);
  });

  it('編輯：載入資料 → 改標題存檔 → 存進資料層、導到詳情頁，之後離開不再提醒', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets/TK-2048/edit');
    const original = await h.repo.get('TK-2048');
    expect((h.el.querySelector('[data-field="title"] input') as HTMLInputElement).value).toBe(original?.title);

    type(h.el, '[data-field="title"] input', '印表機換新的碳粉匣');
    await h.settle();
    (h.el.querySelector('[data-action="save"]') as HTMLButtonElement).click();
    await h.settle();

    expect((await h.repo.get('TK-2048'))?.title).toBe('印表機換新的碳粉匣');
    expect((await h.repo.activity('TK-2048'))[0].summary).toBe('你 修改了標題');
    expect(h.router.url).toBe('/templates/tickets/TK-2048');
    expect(h.dialog.opened).toHaveLength(0);
  });

  it('編輯不存在的工單：顯示「找不到工單」', async () => {
    const h = await setupTicketPage();
    await h.navigate('/templates/tickets/TK-9999/edit');
    expect(h.el.querySelector('[data-state="not-found"]')?.textContent).toContain('找不到工單 TK-9999');
    expect(h.el.querySelector('form')).toBeNull();
  });

  it('權限：檢視者直接開 /edit、/new 進「沒有權限」頁', async () => {
    const h = await setupTicketPage();
    h.access.signIn('u-viewer');
    await h.navigate('/templates/tickets/TK-2048/edit');
    expect(h.el.querySelector('[data-page="forbidden"]')).not.toBeNull();
    expect(h.el.querySelector('form')).toBeNull();
    await h.navigate('/templates/tickets/new');
    expect(h.el.querySelector('[data-page="forbidden"]')).not.toBeNull();
  });
});
