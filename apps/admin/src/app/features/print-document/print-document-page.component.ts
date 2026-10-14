import { Component, computed, signal } from '@angular/core';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import {
  PrintCellDirective,
  PrintDocumentComponent,
  PrintOrientation,
  PrintPaper,
  PrintTableComponent,
} from '@admin-template/ui';
import { PRINT_DOCUMENT_LABEL_PROVIDERS } from '../../shared/ui/print-document-labels';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';
import { PART_COLUMNS, PART_LINES, QUOTE_COLUMNS, QUOTE_LINES, partSummary, quoteSummary } from './demo-print-data';

const ENTRY = detailOf('print-document');

interface Choice<T> {
  value: T;
  label: string;
}

/** 列印與 PDF 版面展示頁（/components/print-document）。 */
@Component({
  selector: 'app-print-document-page',
  imports: [
    MatSlideToggle,
    PrintDocumentComponent,
    PrintTableComponent,
    PrintCellDirective,
    ShowcasePageComponent,
    DemoBlockComponent,
  ],
  providers: [...PRINT_DOCUMENT_LABEL_PROVIDERS],
  templateUrl: './print-document-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './print-document-page.component.scss'],
})
export class PrintDocumentPageComponent {
  protected readonly entry = ENTRY;

  // ---- (a)＋(b) 服務報價單：跨頁，可切換紙張、方向、簽名欄 ----
  protected readonly quoteLines = QUOTE_LINES;
  protected readonly quoteColumns = QUOTE_COLUMNS;
  protected readonly quoteSummary = quoteSummary(QUOTE_LINES);
  protected readonly papers: readonly Choice<PrintPaper>[] = [
    { value: 'A4', label: 'A4' },
    { value: 'Letter', label: 'Letter' },
  ];
  protected readonly orientations: readonly Choice<PrintOrientation>[] = [
    { value: 'portrait', label: '直式' },
    { value: 'landscape', label: '橫式' },
  ];
  protected readonly paper = signal<PrintPaper>('A4');
  protected readonly orientation = signal<PrintOrientation>('portrait');
  protected readonly withSignatures = signal(true);
  protected readonly quoteSignatures = computed(() => (this.withSignatures() ? ['客戶確認', '業務承辦', '主管核准'] : []));

  // ---- (c) 短單據 ----
  protected readonly partLines = PART_LINES;
  protected readonly partColumns = PART_COLUMNS;
  protected readonly partSummary = partSummary(PART_LINES);

  protected readonly whenToUse = [
    '報價單、服務單、領料單、出貨單這類要列印、簽名或寄給客戶的單據。',
    '需要固定格式的 PDF：用瀏覽器的「另存為 PDF」，文字可以選取、搜尋，中文字型由系統嵌入。',
    '明細很長、會跨好幾頁：表頭每頁重印、列不會被切開，合計與簽名欄不會單獨落到新的一頁。',
  ];
  protected readonly avoid = [
    '要在伺服器批次產生、自動寄出的 PDF：請在後端用排版引擎產生，這個元件只負責瀏覽器端的列印。',
    '報表或圖表的整頁截圖：直接用頁面本身的列印（圖表元件已有列印樣式）。',
    '需要逐字精準套印在既有表格紙上：各家瀏覽器、印表機的邊界不同，請改用後端產生的 PDF。',
  ];

  protected readonly usage = `// 頁面的 providers：畫面文字（{title}、{number}、{page}、{pages} 會被換掉）
providers: [{ provide: PRINT_DOCUMENT_LABELS, useValue: ZH_TW_PRINT_DOCUMENT }]

readonly columns: PrintTableColumn<QuoteLine>[] = [
  { key: 'name', label: '品項／說明' },
  { key: 'qty', label: '數量', align: 'end', width: '15mm' },
  { key: 'amount', label: '金額', align: 'end', value: (row) => formatAmount(row.qty * row.price) },
];

<lib-print-document
  title="服務報價單"
  number="Q-20261014-07"
  date="2026/10/14"
  paper="A4"
  orientation="portrait"
  [margin]="15"
  [signatures]="['客戶確認', '業務承辦']"
>
  <div libPrintBrand><span class="lib-print-brand-name">示範資訊服務有限公司</span>地址、電話</div>
  <dl libPrintInfo class="lib-print-fields">
    <div><dt>客戶</dt><dd>示範客戶有限公司</dd></div>
  </dl>
  <lib-print-table label="報價明細" [columns]="columns" [rows]="lines" [summary]="summary">
    <ng-template libPrintCell="name" [libPrintCellOf]="lines" let-row>
      <b>{{ row.name }}</b><br /><small>{{ row.detail }}</small>
    </ng-template>
  </lib-print-table>
  <section libPrintNotes><p class="lib-print-note">報價有效期限 30 天。</p></section>
  <p libPrintFooter>本報價單由系統產生。</p>
</lib-print-document>

// 自己放按鈕：[toolbar]="false"，再呼叫元件的 print()
<lib-print-document #doc [toolbar]="false" … />
<button (click)="doc.print()">列印</button>`;

  protected readonly api: ApiSection[] = [
    {
      title: 'lib-print-document 輸入與方法',
      rows: [
        { name: 'title', type: 'string', default: '必填', description: '單據標題：頁首大字，也是存成 PDF 的預設檔名的一部分。' },
        { name: 'number／date', type: 'string', default: "''", description: '單號與日期（由使用端格式化好），印在頁首右側；單號另外印在每一頁的頁邊左下角。' },
        { name: 'paper', type: "'A4' | 'Letter'", default: "'A4'", description: '紙張：螢幕預覽依實際尺寸（mm）畫，列印時寫進 @page 的 size。' },
        { name: 'orientation', type: "'portrait' | 'landscape'", default: "'portrait'", description: '直式或橫式。' },
        { name: '[margin]', type: 'number | Partial<PrintMargins>', default: '15', description: '頁邊（mm）：一個數字四邊相同，或 { top, right, bottom, left } 分別指定。' },
        { name: '[signatures]', type: 'string[]', default: '[]', description: '簽名欄的標題，一格一個（數量與標題自訂）；空陣列就不畫。簽名欄不會單獨落到新的一頁頂端。' },
        { name: '[toolbar]', type: 'boolean', default: 'true', description: '工具列：列印、下載 PDF、說明與頁數估計。' },
        { name: '[headingLevel]', type: 'number', default: '2', description: '單據標題的標題層級（頁面已有 h1）。' },
        { name: 'print()', type: 'void', description: '打開列印對話框，只印這一份（同頁的其他單據不印）。列印前把 document.title 換成「單號-標題」，afterprint 時還原。' },
        { name: 'downloadPdf()', type: 'void', description: '一樣打開列印對話框，由使用者選「另存為 PDF」：不在前端產生 PDF（中文字型無法嵌入、會變成點陣圖）。' },
      ],
    },
    {
      title: '插槽與輔助 class',
      rows: [
        { name: '[libPrintBrand]', type: '插槽', description: '頁首左側：logo（img／svg，最高 14mm）或公司名稱（.lib-print-brand-name）、地址電話。' },
        { name: '[libPrintInfo]', type: '插槽', description: '資訊區：客戶、聯絡人、期限…；dl.lib-print-fields 排成兩欄，整列的項目加 .is-wide。' },
        { name: '（沒有標記的內容）', type: '插槽', description: '正文：明細表 lib-print-table，或其他段落（.lib-print-section-title、.lib-print-note）。' },
        { name: '[libPrintNotes]', type: '插槽', description: '備註：有明細表時接在最後一張明細表的合計列後面，跟最後幾列一起不切開（所以明細表放在正文最後）。' },
        { name: '[libPrintFooter]', type: '插槽', description: '頁尾說明，印在最後一頁的內容後面。每一頁的頁邊另有單號與「第 N 頁，共 M 頁」。' },
        { name: '.lib-print-num', type: 'class', description: '等寬數字（金額、日期、單號）；列印不分質地，不換等寬字型。' },
      ],
    },
    {
      title: 'lib-print-table',
      rows: [
        { name: '[columns]', type: 'PrintTableColumn<T>[]', default: '必填', description: "key（預設顯示 row[key]）、label、align（'end' 靠右並用等寬數字）、width（例：'15mm'）、value(row, index) 改寫顯示文字。" },
        { name: '[rows]', type: 'T[]', default: '必填', description: '明細列。表頭每頁重印，每一列不會切在兩頁。' },
        { name: '[summary]', type: 'PrintSummaryRow[]', default: '[]', description: '小計、稅額、合計（值由使用端格式化）：標籤跨前面的欄、值在最後一欄；emphasis 是最後的總計。' },
        { name: '[keepWithSummary]', type: 'number', default: '3', description: '最後幾列明細跟合計列、單據的結尾（備註、簽名欄、頁尾）放在同一個不切開的區段：合計與簽名欄不會單獨落到新的一頁。0 表示只有合計與結尾在一起。' },
        { name: 'ng-template[libPrintCell]', type: 'PrintCellContext<T>', description: '自訂儲存格：let-row、let-i="index"；加 [libPrintCellOf]="rows" 讓 let-row 有型別。' },
        { name: 'table.lib-print-table', type: 'class', description: '想自己寫 <table> 時掛這個 class，套同一組樣式：資料列加 .lib-print-table__row、數字欄的儲存格加 data-align="end"；最後幾列與合計放進 tbody.lib-print-table__tail（整組不切開）。' },
      ],
    },
    {
      title: '列印時',
      rows: [
        { name: '只印單據', type: '—', description: '頁面上有單據時，列印只印紙張本身：殼層（側欄、頁首、外觀面板、提示訊息、通知）與頁面其他內容全部隱藏，直接按 Ctrl＋P 也一樣。規則跟著元件載入，不在主樣式裡。' },
        { name: '白紙黑字', type: '—', description: '紙張用元件自己的中性 token（--lib-print-ink、--lib-print-rule…），不跟質地、配色、深色模式變；螢幕預覽的紙張也是白的。' },
        { name: '頁碼', type: '—', description: 'Chrome 131 起用 @page 的頁邊印「第 N 頁，共 M 頁」與單號；不支援的瀏覽器不印頁碼（其他照常）。' },
        { name: 'PRINT_DOCUMENT_LABELS', type: 'PrintDocumentLabels', default: '必填', description: '13 句畫面文字（按鈕、說明、頁碼、檔名…）；少一句會在建立元件時丟出錯誤。' },
      ],
    },
  ];
}
