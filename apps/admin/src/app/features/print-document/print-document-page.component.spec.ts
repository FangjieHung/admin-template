import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PrintDocumentPageComponent } from './print-document-page.component';
import { QUOTE_LINES, formatAmount } from './demo-print-data';

describe('PrintDocumentPageComponent（列印與 PDF 版面展示頁）', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  const demo = (id: string) => el.querySelector<HTMLElement>(`[data-demo="${id}"]`)!;
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      harness.detectChanges();
      await new Promise((r) => setTimeout(r));
    }
    harness.detectChanges();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: PrintDocumentPageComponent }])] });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/components/print-document', PrintDocumentPageComponent);
    el = harness.routeNativeElement as HTMLElement;
    await settle();
  });

  afterEach(() => vi.restoreAllMocks());

  it('服務報價單：30 列明細、小計／營業稅／合計，三格簽名欄', () => {
    const quote = demo('quote');
    expect(quote.querySelector('[role="heading"]')?.textContent?.trim()).toBe('服務報價單');
    expect(quote.querySelectorAll('tr.lib-print-table__row')).toHaveLength(30);
    expect(QUOTE_LINES).toHaveLength(30);
    const subtotal = QUOTE_LINES.reduce((sum, line) => sum + line.qty * line.price, 0);
    const summary = Array.from(quote.querySelectorAll('tr.lib-print-table__total')).map((tr) => tr.textContent?.replace(/\s+/g, ''));
    expect(summary).toEqual([
      `小計${formatAmount(subtotal)}`,
      `營業稅（5%）${formatAmount(Math.round(subtotal * 0.05))}`,
      `合計（新臺幣）${formatAmount(subtotal + Math.round(subtotal * 0.05))}`,
    ]);
    expect(Array.from(quote.querySelectorAll('.lib-print-sign__title')).map((n) => n.textContent?.trim())).toEqual([
      '客戶確認',
      '業務承辦',
      '主管核准',
    ]);
  });

  it('切換 A4／Letter、直式／橫式、簽名欄：紙張預覽跟著換', async () => {
    const quote = demo('quote');
    const sheet = () => quote.querySelector<HTMLElement>('.lib-print-sheet')!;
    expect(sheet().style.width).toBe('210mm');

    el.querySelector<HTMLButtonElement>('[data-paper-choice="Letter"]')!.click();
    await settle();
    expect(quote.getAttribute('data-paper')).toBe('Letter');
    expect(sheet().style.width).toBe('215.9mm');
    expect(el.querySelector('[data-paper-choice="Letter"]')?.getAttribute('aria-pressed')).toBe('true');

    el.querySelector<HTMLButtonElement>('[data-orientation-choice="landscape"]')!.click();
    await settle();
    expect(quote.getAttribute('data-orientation')).toBe('landscape');
    expect(sheet().style.width).toBe('279.4mm');

    el.querySelector<HTMLElement>('[data-toggle="signatures"] button')!.click();
    await settle();
    expect(quote.querySelector('[data-print-signatures]')).toBeNull();
  });

  it('短單據只有 3 列與 1 列合計；按「列印」只印這一份（其他單據不是列印目標）', () => {
    const parts = demo('parts');
    expect(parts.querySelectorAll('tr.lib-print-table__row')).toHaveLength(3);
    expect(parts.querySelector('tr.lib-print-table__total')?.textContent?.replace(/\s+/g, '')).toBe('合計數量7');

    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    parts.querySelector<HTMLButtonElement>('[data-print-action="print"]')!.click();
    expect(print).toHaveBeenCalledTimes(1);
    expect(parts.querySelector('.lib-print-sheet')?.classList.contains('lib-print-sheet--target')).toBe(true);
    expect(demo('quote').querySelector('.lib-print-sheet')?.classList.contains('lib-print-sheet--target')).toBe(false);
    expect(document.title).toBe('MR-20261014-03-零件領用單');
    window.dispatchEvent(new Event('afterprint'));
    expect(parts.querySelector('.lib-print-sheet')?.classList.contains('lib-print-sheet--target')).toBe(false);
  });
});
