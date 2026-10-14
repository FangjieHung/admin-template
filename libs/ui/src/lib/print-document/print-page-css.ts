import type { PrintMargins, PrintOrientation, PrintPaper } from './print-document.types';

/** 紙張直式的寬高（mm）。 */
export const PRINT_PAPER_MM: Readonly<Record<PrintPaper, { width: number; height: number }>> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
};

/** 1mm 等於幾個 CSS px（96 dpi）。 */
export const PX_PER_MM = 96 / 25.4;

/** 依方向換算紙張寬高（mm）。 */
export function paperSize(paper: PrintPaper, orientation: PrintOrientation): { width: number; height: number } {
  const size = PRINT_PAPER_MM[paper] ?? PRINT_PAPER_MM.A4;
  return orientation === 'landscape' ? { width: size.height, height: size.width } : { ...size };
}

/** 頁邊：一個數字＝四邊相同；物件＝分別指定（沒給的邊用 15mm）。 */
export function normalizeMargins(margin: number | Partial<PrintMargins>): PrintMargins {
  if (typeof margin === 'number') return { top: margin, right: margin, bottom: margin, left: margin };
  const fallback = 15;
  return {
    top: margin.top ?? fallback,
    right: margin.right ?? fallback,
    bottom: margin.bottom ?? fallback,
    left: margin.left ?? fallback,
  };
}

/** 一頁可以放內容的高度（mm）。 */
export function pageContentHeight(paper: PrintPaper, orientation: PrintOrientation, margins: PrintMargins): number {
  return paperSize(paper, orientation).height - margins.top - margins.bottom;
}

/**
 * 依內容高度（CSS px）估計頁數：至少 1 頁。`keep` 是不切開的區段（明細表最後幾列＋合計＋結尾）離內容頂端的位置與高度（px）：
 * 它跨過分頁線而且一頁放得下時，整段移到下一頁再算。瀏覽器另外會因「列不切開」、表頭重印多推一點，所以仍是估計。
 */
export function estimatePages(
  contentPx: number,
  contentHeightMm: number,
  keep: { top: number; height: number } | null = null,
): number {
  if (!(contentHeightMm > 0)) return 1;
  const pagePx = contentHeightMm * PX_PER_MM;
  let total = contentPx;
  if (keep && keep.height > 0 && keep.height <= pagePx) {
    const startPage = Math.floor(keep.top / pagePx);
    const end = keep.top + keep.height;
    if (Math.floor((end - 0.5) / pagePx) > startPage) {
      total = (startPage + 1) * pagePx + keep.height + Math.max(0, contentPx - end);
    }
  }
  return Math.max(1, Math.ceil(total / pagePx - 0.001));
}

/** 放進 CSS 字串（雙引號）裡的文字：跳脫反斜線、引號、換行，使用端給的單號不會跑出字串。 */
export function cssString(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\A ')}"`;
}

/**
 * 把「第 {page} 頁，共 {pages} 頁」換成 margin box 的 content 值：
 * `"第 " counter(page) " 頁，共 " counter(pages) " 頁"`。其他 `{name}` 從 values 換成文字。
 */
export function counterContent(template: string, values: Readonly<Record<string, string>> = {}): string {
  const parts: string[] = [];
  let text = '';
  const flush = () => {
    if (text) parts.push(cssString(text));
    text = '';
  };
  const re = /\{(\w+)\}/g;
  let last = 0;
  for (let match = re.exec(template); match; match = re.exec(template)) {
    text += template.slice(last, match.index);
    last = match.index + match[0].length;
    const name = match[1];
    if (name === 'page' || name === 'pages') {
      flush();
      parts.push(`counter(${name})`);
    } else {
      text += name in values ? values[name] : match[0];
    }
  }
  text += template.slice(last);
  flush();
  return parts.length ? parts.join(' ') : '""';
}

export interface PrintPageRuleOptions {
  /** @page 的名字（每份單據一個，讓同一頁有兩份不同紙張的單據也各用各的）。 */
  name: string;
  paper: PrintPaper;
  orientation: PrintOrientation;
  margins: PrintMargins;
  /** 頁尾右側的頁碼（已換成 content 值，見 counterContent）。 */
  counter: string;
  /** 頁尾左側的文字（單號）；空字串就不印。 */
  footerStart: string;
}

/**
 * 列印用的 @page 規則：紙張、方向、頁邊，以及頁尾的 margin box（左：單號；右：第 N 頁，共 M 頁）。
 * Chrome 131 起支援 @page margin box；不支援的瀏覽器會忽略頁尾那兩塊，其餘照常（見 CONTRACT.md「列印版面」）。
 * 頁邊的文字一律中性黑灰，不分質地與配色。
 */
export function buildPrintPageCss(options: PrintPageRuleOptions): string {
  const { name, paper, orientation, margins: m, counter, footerStart } = options;
  const size = `${paper === 'Letter' ? 'letter' : 'A4'} ${orientation}`;
  const box = 'font-family: var(--lib-print-font, var(--font-zh, system-ui, sans-serif)); font-size: 8pt; color: color-mix(in srgb, black 72%, white);';
  return [
    `@page ${name} {`,
    `  size: ${size};`,
    `  margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;`,
    footerStart ? `  @bottom-left { content: ${cssString(footerStart)}; ${box} }` : '',
    `  @bottom-right { content: ${counter}; ${box} }`,
    `}`,
    // 紙張用自己的具名頁；根元素也用同一個名字，紙張後面的空白元素才不會因為換回預設頁而多出一張空白頁。
    // 有列印目標時，根元素用目標那一份的名字（權重較高）。
    `@media print {`,
    `  .lib-print-sheet[data-print-page="${name}"] { page: ${name}; }`,
    `  :root:has(.lib-print-sheet[data-print-page="${name}"]) { page: ${name}; }`,
    `  :root:root:has(.lib-print-sheet--target[data-print-page="${name}"]) { page: ${name}; }`,
    `}`,
  ]
    .filter(Boolean)
    .join('\n');
}
