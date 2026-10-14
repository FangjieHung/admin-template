import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { InlineEditPageComponent } from './inline-edit-page.component';

describe('InlineEditPageComponent（表格內直接編輯展示頁）', () => {
  let answer = true;
  let opened = 0;

  beforeEach(() => {
    answer = true;
    opened = 0;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: MatDialog,
          useValue: {
            open: () => {
              opened++;
              return { afterClosed: () => of(answer) };
            },
          },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(OverlayContainer).getContainerElement().innerHTML = '';
    document.body.querySelectorAll('app-inline-edit-page').forEach((n) => n.remove());
  });

  async function setup() {
    const fixture = TestBed.createComponent(InlineEditPageComponent);
    fixture.componentInstance.delayMs = 0;
    const el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    const settle = async () => {
      for (let i = 0; i < 8; i++) {
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise((r) => setTimeout(r, 0));
      }
      fixture.detectChanges();
    };
    await settle();
    for (let i = 0; i < 30 && el.querySelectorAll('table[role="grid"]').length < 4; i++) {
      await new Promise((r) => setTimeout(r, 10));
      await settle();
    }
    const demo = (name: string) => el.querySelector<HTMLElement>(`[data-demo="${name}"]`)!;
    const cell = (name: string, row: number, key: string) =>
      [...demo(name).querySelectorAll<HTMLElement>(`td[data-dt-row="${row}"]`)].find((td) => td.getAttribute('data-dt-col') === key)!;
    const key = async (target: Element, k: string) => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
      await settle();
    };
    const type = async (text: string) => {
      const input = el.querySelector<HTMLInputElement>('[data-dt-editor]')!;
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
    };
    return { fixture, el, settle, demo, cell, key, type };
  }

  it('四個示範都是可編輯的 grid；工時填 13 時儲存失敗並還原，提示可以重試', async () => {
    const { el, cell, key, type } = await setup();
    expect(el.querySelectorAll('table[role="grid"]')).toHaveLength(4);

    await key(cell('instant', 0, 'hours'), 'Enter');
    await type('13');
    await key(el.querySelector('[data-dt-editor]')!, 'Enter');
    expect(cell('instant', 0, 'hours').textContent).toContain('6');
    expect(cell('instant', 0, 'hours').querySelector('.dt-cell-error')?.textContent).toContain('伺服器拒絕了 13 小時');
    const toast = TestBed.inject(OverlayContainer).getContainerElement().querySelector('lib-toast');
    expect(toast?.textContent).toContain('工時儲存失敗');
    expect(toast?.textContent).toContain('重試');

    await key(cell('instant', 1, 'hours'), 'Enter');
    await type('12');
    await key(el.querySelector('[data-dt-editor]')!, 'Enter');
    expect(cell('instant', 1, 'hours').textContent).toContain('12');
    expect(el.querySelector('[data-last-save]')?.textContent).toContain('P-102 的 hours → 12');
  });

  it('批次示範：貼上示範的一塊，兩格有錯；有未儲存的修改時離開先問', async () => {
    const { fixture, el, cell, settle } = await setup();
    const block = el.querySelector('[data-paste-block]')!.textContent!;
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => block } });
    cell('batch', 0, 'email').dispatchEvent(event);
    await settle();
    expect(el.querySelector('[data-demo="batch"] [data-dt-dirty-count]')?.textContent).toBe('已修改 7 格');
    expect(el.querySelector('[data-demo="batch"] [data-dt-error-count]')?.textContent).toContain('有 2 個錯誤');
    expect(cell('batch', 1, 'email').textContent).toContain('Email 格式不正確');
    expect(cell('batch', 2, 'dept').textContent).toContain('「研發部」不是可選的值');
    expect(el.querySelector('[data-people-dirty]')?.textContent).toBe('有未儲存的修改');

    answer = false;
    expect(await fixture.componentInstance.canLeave()).toBe(false);
    expect(opened).toBe(1);
    answer = true;
    expect(await fixture.componentInstance.canLeave()).toBe(true);
    await settle();
    expect(el.querySelector('[data-demo="batch"] [data-dt-batch-bar]')).toBeNull();
  });

  it('每一列的權限：已結案的專案整列唯讀，按 Enter 念「這一格不能修改」', async () => {
    const { el, cell, key } = await setup();
    expect(cell('locked', 4, 'progress').getAttribute('aria-readonly')).toBe('true');
    expect(cell('locked', 4, 'progress').querySelector('.dt-edit-icon')).toBeNull();
    expect(cell('locked', 0, 'progress').hasAttribute('aria-readonly')).toBe(false);
    await key(cell('locked', 4, 'progress'), 'Enter');
    expect(el.querySelector('[data-dt-editor]')).toBeNull();
    expect(el.querySelector('[data-demo="locked"] .dt-edit-live')?.textContent).toContain('這一格不能修改');
  });
});
