import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  CSP_NONCE,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  TemplateRef,
  ViewEncapsulation,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { PRINT_CLOSING_HOST, PrintClosingHost } from './print-closing';
import { PRINT_DOCUMENT_LABELS, assertPrintDocumentLabels, formatPrintLabel } from './print-document-labels';
import type { PrintMargins, PrintOrientation, PrintPaper } from './print-document.types';
import {
  PX_PER_MM,
  buildPrintPageCss,
  counterContent,
  estimatePages,
  normalizeMargins,
  pageContentHeight,
  paperSize,
} from './print-page-css';

let nextId = 0;

/** 列印中的那份單據：列印按鈕按下時標上，afterprint 時拿掉（同一頁有好幾份單據時只印這一份）。 */
const TARGET_CLASS = 'lib-print-sheet--target';

/**
 * 單據的列印版面：螢幕上是「紙張預覽」（依紙張實際比例畫在灰色桌面上，窄螢幕等比縮小，畫出大約的分頁位置），
 * 列印時只印紙張本身——殼層（側欄、頁首、浮動面板、提示訊息）與頁面上的其他內容全部隱藏，一律白紙黑字。
 *
 * 內容用具名插槽組成（都是可選的，寫在元件標籤裡的元素上）：
 * - `[libPrintBrand]` 頁首左側：logo 或公司名稱、地址。右側是 `title`、`number`、`date`。
 * - `[libPrintInfo]` 資訊區（客戶、聯絡人…；可用 `.lib-print-fields` 排成兩欄）。
 * - 沒有標記的內容：明細表（`lib-print-table`）與其他正文。
 * - `[libPrintNotes]` 備註。
 * - `signatures` 簽名欄（標題陣列；空陣列就不畫）。
 * - `[libPrintFooter]` 頁尾說明（印在最後一頁的內容後面）。每一頁的頁邊另有單號與「第 N 頁，共 M 頁」。
 * 備註、簽名欄、頁尾是單據的「結尾」：有明細表時接在最後一張明細表的合計列後面、跟最後幾列一起不切開（見 print-closing.ts），
 * 所以明細表要放在正文的最後。
 *
 * 「列印」與「下載 PDF」都打開瀏覽器的列印對話框（PDF 由對話框的「另存為 PDF」產生，文字可選取、中文字型由系統嵌入）；
 * 列印前把 document.title 暫時換成「單號-標題」（存檔時的預設檔名），afterprint 時換回來。
 *
 * 樣式不封裝（ViewEncapsulation.None）：列印時隱藏殼層的規則必須作用在整份文件上，`lib-print-table` 也要套到使用端的表格。
 * 這些規則只在頁面上有這個元件時才載入（跟著 lazy chunk），見 CONTRACT.md「列印版面」。
 */
@Component({
  selector: 'lib-print-document',
  imports: [MatButton, NgTemplateOutlet],
  providers: [{ provide: PRINT_CLOSING_HOST, useExisting: PrintDocumentComponent }],
  templateUrl: './print-document.component.html',
  styleUrl: './print-document.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lib-print-document',
    '[attr.data-paper]': 'paper()',
    '[attr.data-orientation]': 'orientation()',
  },
})
export class PrintDocumentComponent implements PrintClosingHost {
  protected readonly labels = assertPrintDocumentLabels(inject(PRINT_DOCUMENT_LABELS, { optional: true }));
  private readonly document = inject(DOCUMENT);
  private readonly nonce = inject(CSP_NONCE, { optional: true });

  /** 單據標題（頁首大字，也是存成 PDF 的檔名的一部分），例：「服務報價單」。 */
  readonly title = input.required<string>();
  /** 單號（頁首、每頁頁邊、檔名）。 */
  readonly number = input('');
  /** 日期（頁首，由使用端格式化好）。 */
  readonly date = input('');
  readonly paper = input<PrintPaper>('A4');
  readonly orientation = input<PrintOrientation>('portrait');
  /** 頁邊（mm）：一個數字＝四邊相同，或分別指定。預設 15mm。 */
  readonly margin = input<number | Partial<PrintMargins>>(15);
  /** 簽名欄的標題，一格一個（例：['客戶簽名', '服務人員']）；空陣列就沒有簽名欄。 */
  readonly signatures = input<readonly string[]>([]);
  /** 顯示工具列（列印、下載 PDF、頁數估計）。自己放按鈕時設 false，改呼叫 print()。 */
  readonly toolbar = input(true);
  /** 單據標題的標題層級（頁面上已有 h1 時用 2）。 */
  readonly headingLevel = input(2);

  private readonly uid = nextId++;
  protected readonly hintId = `lib-print-hint-${this.uid}`;
  protected readonly pageName = `lib-print-${this.uid}`;

  readonly closingTemplate = viewChild<TemplateRef<unknown>>('closing');
  private readonly tables = signal<readonly object[]>([]);
  /** 畫結尾的明細表：最後一張（建立順序＝畫面順序）。 */
  readonly closingTable = computed(() => this.tables().at(-1) ?? null);

  private readonly sheet = viewChild.required<ElementRef<HTMLElement>>('sheet');
  private readonly body = viewChild.required<ElementRef<HTMLElement>>('body');
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');

  protected readonly margins = computed(() => normalizeMargins(this.margin()));
  protected readonly size = computed(() => paperSize(this.paper(), this.orientation()));
  /** 一頁可以放內容的高度（mm）。 */
  protected readonly contentHeight = computed(() => pageContentHeight(this.paper(), this.orientation(), this.margins()));

  /** 內容高度（px，未縮放）與預覽區寬度（px）：ResizeObserver 更新。 */
  private readonly bodyHeight = signal(0);
  /** 不切開的結尾區段（明細表最後幾列＋合計＋結尾）離內容頂端的位置與高度（px，未縮放）。 */
  private readonly keepBlock = signal<{ top: number; height: number } | null>(null);
  private readonly stageWidth = signal(0);

  protected readonly pages = computed(() => estimatePages(this.bodyHeight(), this.contentHeight(), this.keepBlock()));
  /** 第 2 頁起每一頁的分頁參考線（離紙張頂端幾 mm）。 */
  protected readonly guides = computed(() => {
    const m = this.margins();
    const h = this.contentHeight();
    return Array.from({ length: this.pages() - 1 }, (_, i) => ({ page: i + 2, top: m.top + h * (i + 1) }));
  });
  /** 紙張高度：撐滿到最後一頁的底。 */
  protected readonly sheetHeight = computed(() => {
    const m = this.margins();
    return m.top + this.contentHeight() * this.pages() + m.bottom;
  });
  /** 窄螢幕等比縮小（不放大）。 */
  protected readonly scale = computed(() => {
    const width = this.stageWidth();
    const paperPx = this.size().width * PX_PER_MM;
    return width > 0 ? Math.min(1, width / paperPx) : 1;
  });
  protected readonly fitWidth = computed(() => this.size().width * PX_PER_MM * this.scale());
  protected readonly fitHeight = computed(() => this.sheetHeight() * PX_PER_MM * this.scale());

  protected readonly estimateText = computed(() => formatPrintLabel(this.labels.pageEstimate, { pages: this.pages() }));
  protected readonly previewLabel = computed(() => formatPrintLabel(this.labels.preview, { title: this.title() }));
  protected guideText(page: number): string {
    return formatPrintLabel(this.labels.pageGuide, { page });
  }

  /** 列印時的 document.title（存成 PDF 時的預設檔名）。 */
  readonly fileName = computed(() => {
    const title = this.title().trim();
    const number = this.number().trim();
    return number ? formatPrintLabel(this.labels.fileName, { number, title }) : title;
  });

  /** @page 規則（紙張、方向、頁邊、頁尾的單號與頁碼）。 */
  readonly pageCss = computed(() =>
    buildPrintPageCss({
      name: this.pageName,
      paper: this.paper(),
      orientation: this.orientation(),
      margins: this.margins(),
      counter: counterContent(this.labels.pageCounter),
      footerStart: this.number().trim(),
    }),
  );

  private styleEl: HTMLStyleElement | null = null;
  private savedTitle: string | null = null;
  private readonly restoreAfterPrint = () => this.endPrint();

  constructor() {
    const destroyRef = inject(DestroyRef);
    const view = this.document.defaultView;

    // @page 規則放在 <head> 的 <style>：@page 不能寫在元素上，紙張、方向、頁邊又是輸入。
    effect(() => {
      const css = this.pageCss();
      if (!this.styleEl) {
        this.styleEl = this.document.createElement('style');
        this.styleEl.setAttribute('data-lib-print-page', this.pageName);
        if (this.nonce) this.styleEl.setAttribute('nonce', this.nonce);
        this.document.head.appendChild(this.styleEl);
      }
      this.styleEl.textContent = css;
    });

    // 使用者自己按 Ctrl＋P（沒有按列印按鈕）：頁面上第一份單據一樣換檔名，印完換回來。
    const onBeforePrint = () => {
      if (this.savedTitle !== null || !this.isPrimary()) return;
      this.beginPrint(false);
    };
    view?.addEventListener('beforeprint', onBeforePrint);

    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.measure());
      observer.observe(this.body().nativeElement);
      observer.observe(this.stage().nativeElement);
      this.measure();
      destroyRef.onDestroy(() => observer.disconnect());
    });

    destroyRef.onDestroy(() => {
      view?.removeEventListener('beforeprint', onBeforePrint);
      if (this.savedTitle !== null) this.endPrint();
      this.styleEl?.remove();
      this.styleEl = null;
    });
  }

  registerTable(table: object): void {
    this.tables.update((list) => [...list, table]);
  }

  unregisterTable(table: object): void {
    this.tables.update((list) => list.filter((t) => t !== table));
  }

  /** 打開列印對話框，只印這一份單據。 */
  print(): void {
    this.beginPrint(true);
    this.document.defaultView?.print();
  }

  /**
   * 下載 PDF：一樣打開列印對話框，由使用者選「另存為 PDF」。不在前端產生 PDF（jsPDF、html2canvas 之類）：
   * 中文字型無法嵌入（專案不提供字型檔），而且整頁會變成點陣圖、文字不能選取。
   */
  downloadPdf(): void {
    this.print();
  }

  private beginPrint(target: boolean): void {
    if (target) {
      this.document.querySelectorAll(`.${TARGET_CLASS}`).forEach((el) => el.classList.remove(TARGET_CLASS));
      this.sheet().nativeElement.classList.add(TARGET_CLASS);
    }
    if (this.savedTitle === null) this.savedTitle = this.document.title;
    this.document.title = this.fileName();
    const view = this.document.defaultView;
    view?.removeEventListener('afterprint', this.restoreAfterPrint);
    view?.addEventListener('afterprint', this.restoreAfterPrint, { once: true });
  }

  private endPrint(): void {
    this.document.defaultView?.removeEventListener('afterprint', this.restoreAfterPrint);
    this.sheet().nativeElement.classList.remove(TARGET_CLASS);
    if (this.savedTitle !== null) this.document.title = this.savedTitle;
    this.savedTitle = null;
  }

  /** 頁面上第一份單據（Ctrl＋P 時由它換檔名）。 */
  private isPrimary(): boolean {
    return this.document.querySelector('.lib-print-sheet') === this.sheet().nativeElement;
  }

  private measure(): void {
    this.bodyHeight.set(this.body().nativeElement.offsetHeight);
    const body = this.body().nativeElement;
    const tails = body.querySelectorAll<HTMLElement>('.lib-print-table__tail');
    const tail = tails[tails.length - 1];
    if (tail) {
      // getBoundingClientRect 已乘上縮放比例，除回去才是紙張上的 px。
      const scale = this.scale() || 1;
      const outer = body.getBoundingClientRect();
      const rect = tail.getBoundingClientRect();
      const next = { top: (rect.top - outer.top) / scale, height: rect.height / scale };
      const prev = this.keepBlock();
      if (!prev || Math.abs(prev.top - next.top) > 0.5 || Math.abs(prev.height - next.height) > 0.5) this.keepBlock.set(next);
    } else if (this.keepBlock()) {
      this.keepBlock.set(null);
    }
    this.stageWidth.set(this.stage().nativeElement.clientWidth);
  }
}
