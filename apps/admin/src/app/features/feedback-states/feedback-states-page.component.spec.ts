import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FeedbackStatesPageComponent } from './feedback-states-page.component';

describe('FeedbackStatesPageComponent（載入、空白、錯誤展示頁）', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  async function render() {
    const fixture = TestBed.createComponent(FeedbackStatesPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  function pill(el: HTMLElement, group: string, label: string): HTMLButtonElement {
    const buttons = Array.from(el.querySelectorAll(`[aria-label="${group}"] button`)) as HTMLButtonElement[];
    const button = buttons.find((b) => b.textContent?.trim() === label);
    if (!button) throw new Error(`找不到「${group}」的「${label}」`);
    return button;
  }

  it('分段按鈕即時切換 lib-async-state 的 5 種狀態', async () => {
    const { fixture, el } = await render();
    const panel = el.querySelector('.contact-panel') as HTMLElement;
    expect(panel.getAttribute('aria-busy')).toBe('true');
    expect(panel.querySelector('lib-skeleton')?.getAttribute('data-variant')).toBe('list');
    expect(pill(el, '清單狀態', '載入中').getAttribute('aria-pressed')).toBe('true');

    pill(el, '清單狀態', '有資料').click();
    fixture.detectChanges();
    expect(panel.querySelectorAll('.contact-list li').length).toBe(6);

    pill(el, '清單狀態', '尚無資料').click();
    fixture.detectChanges();
    expect(panel.querySelector('lib-empty-state')?.textContent).toContain('還沒有聯絡人');

    pill(el, '清單狀態', '篩選後沒有結果').click();
    fixture.detectChanges();
    const empty = panel.querySelector('lib-empty-state') as HTMLElement;
    expect(empty.dataset['kind']).toBe('no-results');
    (empty.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(panel.querySelectorAll('.contact-list li').length).toBe(6);

    pill(el, '清單狀態', '錯誤').click();
    fixture.detectChanges();
    expect(panel.querySelector('[role="alert"]')?.textContent).toContain('聯絡人載入失敗');
    (panel.querySelector('.lib-error-state__retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(panel.getAttribute('aria-busy')).toBe('true');
  });

  it('資料表：載入中是骨架列，篩選後沒有結果用 dtEmpty 的「清除篩選」', async () => {
    const { fixture, el } = await render();
    const card = el.querySelector('.table-card') as HTMLElement;
    expect(card.querySelectorAll('.dt-skeleton-row').length).toBe(4);

    pill(el, '資料表狀態', '尚無資料').click();
    fixture.detectChanges();
    expect(card.querySelector('lib-empty-state')?.textContent).toContain('還沒有專案');

    pill(el, '資料表狀態', '篩選後沒有結果').click();
    fixture.detectChanges();
    const empty = card.querySelector('lib-empty-state') as HTMLElement;
    expect(empty.textContent).toContain('沒有符合條件的專案');
    (empty.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(card.querySelectorAll('tbody tr').length).toBe(4);
    expect(card.querySelector('.dt-skeleton-row')).toBeNull();
  });

  it('骨架 5 種形狀都在，「靜止」鈕讓骨架不閃光', async () => {
    const { fixture, el } = await render();
    const variants = Array.from(el.querySelectorAll('.skeleton-grid lib-skeleton')).map((s) => s.getAttribute('data-variant'));
    expect(variants).toEqual(['text', 'list', 'table', 'kpi', 'card']);
    pill(el, '骨架動畫', '靜止').click();
    fixture.detectChanges();
    for (const s of Array.from(el.querySelectorAll('.skeleton-grid lib-skeleton'))) {
      expect(s.classList).toContain('lib-skeleton--static');
    }
  });
});
