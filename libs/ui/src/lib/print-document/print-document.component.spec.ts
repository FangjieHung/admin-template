import { describe, it, expect, afterEach, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrintDocumentComponent } from './print-document.component';
import { PrintCellDirective, PrintTableComponent } from './print-table.component';
import {
  PRINT_DOCUMENT_LABELS,
  PrintDocumentLabels,
  assertPrintDocumentLabels,
  formatPrintLabel,
} from './print-document-labels';
import type { PrintOrientation, PrintPaper, PrintSummaryRow, PrintTableColumn } from './print-document.types';
import { buildPrintPageCss, counterContent, cssString, estimatePages, normalizeMargins, paperSize } from './print-page-css';

const LABELS: PrintDocumentLabels = {
  toolbar: '列印工具',
  print: '列印',
  downloadPdf: '下載 PDF',
  pdfHint: '會打開列印對話框，目的地選「另存為 PDF」',
  preview: '{title}的列印預覽',
  pageEstimate: '預覽約 {pages} 頁',
  pageGuide: '第 {page} 頁',
  pageCounter: '第 {page} 頁，共 {pages} 頁',
  numberLabel: '單號',
  dateLabel: '日期',
  signatureDate: '日期',
  fileName: '{number}-{title}',
  noItems: '沒有明細',
};

interface Line {
  name: string;
  qty: number;
  amount: number;
}

@Component({
  imports: [PrintDocumentComponent, PrintTableComponent, PrintCellDirective],
  template: `
    @if (shown()) {
      <lib-print-document
        [title]="title()"
        [number]="number()"
        date="2026/10/14"
        [paper]="paper()"
        [orientation]="orientation()"
        [margin]="margin()"
        [signatures]="signatures()"
        [toolbar]="toolbar()"
      >
        <div libPrintBrand><span class="lib-print-brand-name">示範公司</span></div>
        <dl libPrintInfo class="lib-print-fields"><div><dt>客戶</dt><dd>示範客戶</dd></div></dl>
        @if (withTable()) {
          <lib-print-table label="明細" [columns]="columns" [rows]="rows()" [summary]="summary()" [keepWithSummary]="keep()">
            <ng-template libPrintCell="name" [libPrintCellOf]="rows()" let-row let-i="index"><b data-cell>{{ i + 1 }}. {{ row.name }}</b></ng-template>
          </lib-print-table>
        }
        <section libPrintNotes><p class="lib-print-note">備註內容</p></section>
        <p libPrintFooter>頁尾說明</p>
      </lib-print-document>
    }
  `,
})
class HostComponent {
  readonly shown = signal(true);
  readonly title = signal('服務報價單');
  readonly number = signal('Q-2026-001');
  readonly paper = signal<PrintPaper>('A4');
  readonly orientation = signal<PrintOrientation>('portrait');
  readonly margin = signal<number | { top: number }>(15);
  readonly signatures = signal<string[]>(['客戶簽名', '服務人員']);
  readonly toolbar = signal(true);
  readonly keep = signal(3);
  readonly withTable = signal(true);
  readonly columns: PrintTableColumn<Line>[] = [
    { key: 'name', label: '品項' },
    { key: 'qty', label: '數量', align: 'end' },
    { key: 'amount', label: '金額', align: 'end', width: '30mm', value: (row) => row.amount.toLocaleString('en-US') },
  ];
  readonly rows = signal<Line[]>(
    Array.from({ length: 6 }, (_, i) => ({ name: `品項 ${i + 1}`, qty: i + 1, amount: (i + 1) * 1200 })),
  );
  readonly summary = signal<PrintSummaryRow[]>([
    { label: '小計', value: '25,200' },
    { label: '稅額', value: '1,260' },
    { label: '合計', value: '26,460', emphasis: true },
  ]);
}

describe('PrintDocumentComponent（列印版面）', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;

  async function setup(labels: PrintDocumentLabels | null = LABELS) {
    TestBed.configureTestingModule({
      providers: labels ? [{ provide: PRINT_DOCUMENT_LABELS, useValue: labels }] : [],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const sheet = () => el.querySelector<HTMLElement>('.lib-print-sheet')!;
  const pageStyle = () => document.head.querySelector<HTMLStyleElement>('style[data-lib-print-page]');

  afterEach(() => {
    vi.restoreAllMocks();
    document.title = '';
  });

  it('頁首有標題、單號、日期與 brand 插槽；資訊區、備註、頁尾都投影進紙張', async () => {
    await setup();
    const head = sheet().querySelector('.lib-print-sheet__head')!;
    expect(head.querySelector('[role="heading"]')?.textContent?.trim()).toBe('服務報價單');
    expect(head.querySelector('[role="heading"]')?.getAttribute('aria-level')).toBe('2');
    expect(head.textContent).toContain('單號');
    expect(head.querySelector('[data-print-number]')?.textContent?.trim()).toBe('Q-2026-001');
    expect(head.textContent).toContain('2026/10/14');
    expect(head.querySelector('.lib-print-brand-name')?.textContent).toBe('示範公司');
    expect(sheet().querySelector('[libPrintInfo]')?.textContent).toContain('示範客戶');
    expect(sheet().querySelector('[libPrintNotes]')?.textContent).toContain('備註內容');
    expect(sheet().querySelector('[libPrintFooter]')?.textContent).toContain('頁尾說明');
    expect(sheet().getAttribute('aria-label')).toBe('服務報價單的列印預覽');
  });

  it('簽名欄的數量與標題由輸入決定；空陣列就沒有簽名欄', async () => {
    await setup();
    const titles = () => Array.from(el.querySelectorAll('.lib-print-sign__title')).map((n) => n.textContent?.trim());
    expect(titles()).toEqual(['客戶簽名', '服務人員']);
    host.signatures.set(['申請人', '服務人員', '主管核准']);
    fixture.detectChanges();
    expect(titles()).toEqual(['申請人', '服務人員', '主管核准']);
    host.signatures.set([]);
    fixture.detectChanges();
    expect(el.querySelector('[data-print-signatures]')).toBeNull();
  });

  it('紙張尺寸與方向：A4 直式 210mm 寬、Letter 橫式 279.4mm 寬；@page 規則換成對應的 size 與頁邊', async () => {
    await setup();
    const doc = el.querySelector('lib-print-document')!;
    expect(doc.getAttribute('data-paper')).toBe('A4');
    expect(doc.getAttribute('data-orientation')).toBe('portrait');
    expect(sheet().style.width).toBe('210mm');
    expect(sheet().style.padding).toBe('15mm');
    const name = sheet().getAttribute('data-print-page')!;
    expect(pageStyle()?.textContent).toContain(`@page ${name} {`);
    expect(pageStyle()?.textContent).toContain('size: A4 portrait;');
    expect(pageStyle()?.textContent).toContain('margin: 15mm 15mm 15mm 15mm;');
    expect(pageStyle()?.textContent).toContain(`.lib-print-sheet[data-print-page="${name}"] { page: ${name}; }`);
    expect(pageStyle()?.textContent).toContain(`:root:has(.lib-print-sheet[data-print-page="${name}"]) { page: ${name}; }`);

    host.paper.set('Letter');
    host.orientation.set('landscape');
    host.margin.set({ top: 20 });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(doc.getAttribute('data-paper')).toBe('Letter');
    expect(doc.getAttribute('data-orientation')).toBe('landscape');
    expect(sheet().style.width).toBe('279.4mm');
    expect(sheet().style.padding).toBe('20mm 15mm 15mm');
    expect(pageStyle()?.textContent).toContain('size: letter landscape;');
    expect(pageStyle()?.textContent).toContain('margin: 20mm 15mm 15mm 15mm;');
  });

  it('頁尾：@page 的 margin box 印單號與「第 N 頁，共 M 頁」（佔位換成 CSS counter）', async () => {
    await setup();
    const css = pageStyle()!.textContent!;
    expect(css).toContain('@bottom-left { content: "Q-2026-001";');
    expect(css).toContain('@bottom-right { content: "第 " counter(page) " 頁，共 " counter(pages) " 頁";');
  });

  it('列印按鈕呼叫 window.print()，只印這一份；document.title 暫時換成「單號-標題」，afterprint 之後還原', async () => {
    await setup();
    document.title = '原本的標題';
    let titleDuringPrint = '';
    let targetDuringPrint = false;
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      titleDuringPrint = document.title;
      targetDuringPrint = sheet().classList.contains('lib-print-sheet--target');
    });

    el.querySelector<HTMLButtonElement>('[data-print-action="print"]')!.click();
    expect(print).toHaveBeenCalledTimes(1);
    expect(titleDuringPrint).toBe('Q-2026-001-服務報價單');
    expect(targetDuringPrint).toBe(true);
    expect(document.title).toBe('Q-2026-001-服務報價單');

    window.dispatchEvent(new Event('afterprint'));
    expect(document.title).toBe('原本的標題');
    expect(sheet().classList.contains('lib-print-sheet--target')).toBe(false);
  });

  it('下載 PDF 一樣打開列印對話框（按鈕有說明「另存為 PDF」）；沒有單號時檔名只用標題', async () => {
    await setup();
    host.number.set('');
    fixture.detectChanges();
    document.title = '頁面';
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const pdf = el.querySelector<HTMLButtonElement>('[data-print-action="pdf"]')!;
    const hint = document.getElementById(pdf.getAttribute('aria-describedby')!);
    expect(hint?.textContent).toContain('另存為 PDF');
    pdf.click();
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.title).toBe('服務報價單');
    window.dispatchEvent(new Event('afterprint'));
    expect(document.title).toBe('頁面');
  });

  it('使用者直接按 Ctrl＋P（beforeprint）：一樣換檔名，印完還原', async () => {
    await setup();
    document.title = '頁面';
    window.dispatchEvent(new Event('beforeprint'));
    expect(document.title).toBe('Q-2026-001-服務報價單');
    window.dispatchEvent(new Event('afterprint'));
    expect(document.title).toBe('頁面');
  });

  it('toolbar=false 不畫工具列；元件移除時 @page 規則一起移除', async () => {
    await setup();
    expect(el.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe('列印工具');
    expect(el.querySelector('[data-print-estimate]')?.textContent).toBe('預覽約 1 頁');
    host.toolbar.set(false);
    fixture.detectChanges();
    expect(el.querySelector('[role="toolbar"]')).toBeNull();
    expect(pageStyle()).not.toBeNull();
    host.shown.set(false);
    fixture.detectChanges();
    expect(pageStyle()).toBeNull();
  });

  it('明細表：數字欄靠右（data-align="end"）、自訂儲存格範本、小計／稅額／合計列', async () => {
    await setup();
    const table = el.querySelector('table.lib-print-table')!;
    expect(table.getAttribute('aria-label')).toBe('明細');
    expect(Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent?.trim())).toEqual(['品項', '數量', '金額']);
    expect(Array.from(table.querySelectorAll('thead th')).map((th) => th.getAttribute('data-align'))).toEqual(['start', 'end', 'end']);
    expect(table.querySelectorAll('col')[2].getAttribute('style')).toContain('width: 30mm');
    const rows = Array.from(table.querySelectorAll('tr.lib-print-table__row'));
    expect(rows).toHaveLength(6);
    expect(rows[0].querySelector('[data-cell]')?.textContent?.trim()).toBe('1. 品項 1');
    expect(rows[5].querySelector('[data-cell]')?.textContent?.trim()).toBe('6. 品項 6');
    expect(rows[5].querySelectorAll('td')[2].textContent?.trim()).toBe('7,200');
    expect(rows[5].querySelectorAll('td')[2].getAttribute('data-align')).toBe('end');
    const totals = Array.from(table.querySelectorAll('tr.lib-print-table__total'));
    expect(totals.map((tr) => tr.textContent?.replace(/\s+/g, ''))).toEqual(['小計25,200', '稅額1,260', '合計26,460']);
    expect(totals[2].classList.contains('is-emphasis')).toBe(true);
    expect(totals[0].querySelector('th')?.getAttribute('colspan')).toBe('2');
  });

  it('最後 keepWithSummary 列、合計列與結尾（備註、簽名欄、頁尾）在同一個不切開的區段；沒有明細表時結尾畫在紙張最後', async () => {
    await setup();
    const tail = () => el.querySelector('tbody.lib-print-table__tail')!;
    const rowNames = (scope: Element) =>
      Array.from(scope.querySelectorAll('tr.lib-print-table__row [data-cell]')).map((n) => n.textContent?.trim());
    expect(rowNames(tail())).toEqual(['4. 品項 4', '5. 品項 5', '6. 品項 6']);
    expect(rowNames(el.querySelector('tbody:not(.lib-print-table__tail)')!)).toEqual(['1. 品項 1', '2. 品項 2', '3. 品項 3']);
    const closing = tail().querySelector('tr.lib-print-table__closing > td')!;
    expect(closing.getAttribute('colspan')).toBe('3');
    expect(closing.querySelector('[libPrintNotes]')?.textContent).toContain('備註內容');
    expect(closing.querySelectorAll('.lib-print-sign')).toHaveLength(2);
    expect(closing.querySelector('[libPrintFooter]')?.textContent).toContain('頁尾說明');
    expect(el.querySelector('.lib-print-sheet__closing')).toBeNull();

    host.keep.set(0);
    fixture.detectChanges();
    expect(rowNames(tail())).toEqual([]);
    expect(tail().querySelectorAll('tr.lib-print-table__total')).toHaveLength(3);

    host.rows.set([]);
    fixture.detectChanges();
    expect(el.querySelector('.lib-print-table__empty')?.textContent?.trim()).toBe('沒有明細');

    host.withTable.set(false);
    fixture.detectChanges();
    const own = el.querySelector('.lib-print-sheet__closing')!;
    expect(own.querySelector('[libPrintNotes]')?.textContent).toContain('備註內容');
    expect(own.querySelectorAll('.lib-print-sign')).toHaveLength(2);
    expect(own.querySelector('[libPrintFooter]')?.textContent).toContain('頁尾說明');
  });

  it('沒有提供 PRINT_DOCUMENT_LABELS 時丟出明確的錯誤；少一句也會列出缺哪一句', async () => {
    await expect(setup(null)).rejects.toThrow('PRINT_DOCUMENT_LABELS');
    expect(() => assertPrintDocumentLabels({ ...LABELS, pageCounter: '' })).toThrow('「pageCounter」');
  });
});

describe('列印版面的文字佔位與 @page 規則', () => {
  it('formatPrintLabel 換掉 {title}、{number}、{page}、{pages}，沒給的佔位原樣留著', () => {
    expect(formatPrintLabel('{number}-{title}', { number: 'Q-1', title: '報價單' })).toBe('Q-1-報價單');
    expect(formatPrintLabel('預覽約 {pages} 頁', { pages: 3 })).toBe('預覽約 3 頁');
    expect(formatPrintLabel('第 {page} 頁 {unknown}', { page: 2 })).toBe('第 2 頁 {unknown}');
  });

  it('counterContent 把頁碼佔位換成 counter()，其他文字變成跳脫過的 CSS 字串', () => {
    expect(counterContent('第 {page} 頁，共 {pages} 頁')).toBe('"第 " counter(page) " 頁，共 " counter(pages) " 頁"');
    expect(counterContent('Page {page} of {pages}')).toBe('"Page " counter(page) " of " counter(pages)');
    expect(counterContent('{page}/{pages}')).toBe('counter(page) "/" counter(pages)');
    expect(counterContent('{number} · {page}', { number: 'A"1' })).toBe('"A\\"1 · " counter(page)');
    expect(cssString('a\\b"c\nd')).toBe('"a\\\\b\\"c\\A d"');
  });

  it('紙張尺寸、頁邊與頁數估計', () => {
    expect(paperSize('A4', 'portrait')).toEqual({ width: 210, height: 297 });
    expect(paperSize('A4', 'landscape')).toEqual({ width: 297, height: 210 });
    expect(paperSize('Letter', 'portrait')).toEqual({ width: 215.9, height: 279.4 });
    expect(normalizeMargins(12)).toEqual({ top: 12, right: 12, bottom: 12, left: 12 });
    expect(normalizeMargins({ bottom: 20 })).toEqual({ top: 15, right: 15, bottom: 20, left: 15 });
    const pagePx = 267 * (96 / 25.4);
    expect(estimatePages(0, 267)).toBe(1);
    expect(estimatePages(pagePx, 267)).toBe(1);
    expect(estimatePages(pagePx + 10, 267)).toBe(2);
    expect(estimatePages(pagePx * 2.5, 267)).toBe(3);
    // 不切開的區段跨過分頁線：整段移到下一頁再算（1.97 頁的內容，區段在 0.9～1.1 頁 → 往後推 0.1 頁 → 3 頁）
    expect(estimatePages(pagePx * 1.97, 267)).toBe(2);
    expect(estimatePages(pagePx * 1.97, 267, { top: pagePx * 0.9, height: pagePx * 0.2 })).toBe(3);
    expect(estimatePages(pagePx * 1.97, 267, { top: pagePx * 0.5, height: pagePx * 0.2 })).toBe(2);
    // 比一頁還高的區段不移（瀏覽器也只能切開）
    expect(estimatePages(pagePx * 1.5, 267, { top: 10, height: pagePx * 1.2 })).toBe(2);
  });

  it('buildPrintPageCss：沒有單號就不印頁尾左側', () => {
    const css = buildPrintPageCss({
      name: 'lib-print-9',
      paper: 'Letter',
      orientation: 'portrait',
      margins: { top: 10, right: 12, bottom: 14, left: 16 },
      counter: counterContent('{page}/{pages}'),
      footerStart: '',
    });
    expect(css).toContain('@page lib-print-9 {');
    expect(css).toContain('size: letter portrait;');
    expect(css).toContain('margin: 10mm 12mm 14mm 16mm;');
    expect(css).not.toContain('@bottom-left');
    expect(css).toContain('@bottom-right { content: counter(page) "/" counter(pages);');
  });
});
