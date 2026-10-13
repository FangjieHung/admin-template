import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DataTableComponent } from './data-table.component';
import { DataTableColumn, DataTableColumnPrefs, DataTableLabels, DataTableSort } from './data-table.types';

// 進階功能（分頁、排序、欄位選擇、固定欄）。xlsx 用 bare specifier mock（理由見 data-table.component.spec.ts）。
const aoaToSheet = vi.fn((..._args: unknown[]) => ({ mock: 'ws' }));
vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: (...args: unknown[]) => aoaToSheet(...args),
    table_to_sheet: () => ({}),
    book_new: () => ({}),
    book_append_sheet: () => undefined,
  },
  writeFile: () => undefined,
}));

interface Row {
  id: string;
  code: string;
  amount: number;
}

const LABELS: DataTableLabels = {
  exportExcel: '匯出 Excel',
  selectAll: '全選',
  deselectAll: '取消全選',
  selectRow: '選取資料列',
  batchDelete: '刪除',
  selectedCount: '已選 {count} 筆',
  exportSelected: '匯出已選',
  expandRow: '展開',
  collapseRow: '收合',
  exportFailedText: '匯出失敗',
  paging: {
    nav: '分頁',
    pageSizeLabel: '每頁筆數',
    pageSizeOption: '每頁 {size} 筆',
    range: '第 {from}–{to} 筆，共 {total} 筆',
    pageOf: '第 {page} / {pages} 頁',
    firstPage: '第一頁',
    prevPage: '上一頁',
    nextPage: '下一頁',
    lastPage: '最後一頁',
    loadMore: '載入更多',
    shownOf: '已顯示 {shown} / {total} 筆',
  },
  columnChooser: {
    trigger: '顯示欄位',
    title: '顯示欄位',
    reset: '恢復預設',
    moveUp: '上移{label}',
    moveDown: '下移{label}',
    dragHandle: '拖曳調整{label}的順序',
    frozen: '固定欄',
    close: '關閉',
  },
};

function makeRows(n: number): Row[] {
  // amount 刻意打亂，排序後才看得出差別。
  return Array.from({ length: n }, (_, i) => ({
    id: `r${i + 1}`,
    code: `A-${String(i + 1).padStart(3, '0')}`,
    amount: ((i * 37) % 101) * 10,
  }));
}

@Component({
  imports: [DataTableComponent],
  template: `
    <lib-data-table
      [columns]="columns"
      [rows]="rows()"
      [labels]="labels"
      [pageable]="true"
      [sortable]="true"
      [columnChooser]="true"
      [selectable]="selectable()"
      [(pageSize)]="pageSize"
      [(page)]="page"
      [(sort)]="sort"
      [(columnPrefs)]="prefs"
      exportName="items"
    />
  `,
})
class FeatureHostComponent {
  readonly labels = LABELS;
  readonly columns: DataTableColumn<Row>[] = [
    { key: 'code', label: '編號', frozen: true },
    { key: 'amount', label: '金額', align: 'end' },
    { key: 'double', label: '兩倍', virtual: true, value: (r) => r.amount * 2 },
  ];
  readonly rows = signal(makeRows(60));
  readonly selectable = signal(false);
  readonly pageSize = signal(25);
  readonly page = signal(0);
  readonly sort = signal<DataTableSort | null>(null);
  readonly prefs = signal<DataTableColumnPrefs | null>(null);
}

function setup() {
  const fixture = TestBed.createComponent(FeatureHostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const host = fixture.componentInstance;
  const bodyCodes = () => [...el.querySelectorAll('tbody tr')].map((tr) => tr.querySelector('td')?.textContent?.trim());
  const headers = () => [...el.querySelectorAll('thead th')] as HTMLElement[];
  const header = (label: string) => headers().find((th) => th.textContent?.includes(label)) as HTMLElement;
  const btn = (label: string) => el.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
  const detect = () => fixture.detectChanges();
  return { fixture, el, host, bodyCodes, header, btn, detect };
}

describe('DataTable 分頁', () => {
  it('每頁 25 筆、顯示範圍與頁碼文字', () => {
    const { el, bodyCodes } = setup();
    expect(bodyCodes()).toHaveLength(25);
    expect(el.querySelector('.dt-pager__range')?.textContent).toContain('第 1–25 筆，共 60 筆');
    expect(el.querySelector('.dt-pager__page')?.textContent).toContain('第 1 / 3 頁');
  });

  it('下一頁、最後一頁；第一頁時「上一頁」停用，最後一頁時「下一頁」停用', () => {
    const { el, host, btn, bodyCodes, detect } = setup();
    expect(btn('上一頁').disabled).toBe(true);
    btn('下一頁').click();
    detect();
    expect(host.page()).toBe(1);
    expect(bodyCodes()[0]).toBe('A-026');
    btn('最後一頁').click();
    detect();
    expect(bodyCodes()).toHaveLength(10);
    expect(el.querySelector('.dt-pager__range')?.textContent).toContain('第 51–60 筆，共 60 筆');
    expect(btn('下一頁').disabled).toBe(true);
  });

  it('換每頁筆數回到第一頁', () => {
    const { el, host, bodyCodes, detect } = setup();
    host.page.set(2);
    detect();
    const select = el.querySelector('.dt-pager__select') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent?.trim())).toEqual(['每頁 25 筆', '每頁 50 筆', '每頁 100 筆']);
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    detect();
    expect(host.pageSize()).toBe(50);
    expect(host.page()).toBe(0);
    expect(bodyCodes()).toHaveLength(50);
    expect(select.selectedOptions[0].textContent?.trim()).toBe('每頁 50 筆');
  });

  it('資料變少時頁碼夾在最後一頁，不停在空白頁', () => {
    const { host, bodyCodes, detect } = setup();
    host.page.set(2);
    detect();
    host.rows.set(makeRows(30));
    detect();
    expect(bodyCodes()).toEqual(['A-026', 'A-027', 'A-028', 'A-029', 'A-030']);
  });
});

describe('DataTable 手機卡片版：載入更多', () => {
  let listeners: ((e: MediaQueryListEvent) => void)[] = [];
  beforeEach(() => {
    listeners = [];
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width: 640px'),
      media: query,
      addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.push(cb),
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('不顯示分頁鈕，改成「載入更多」累加顯示，全部載完後按鈕消失', () => {
    const { el, bodyCodes, detect } = setup();
    expect(el.querySelector('nav.dt-pager')).toBeNull();
    expect(bodyCodes()).toHaveLength(25);
    const more = () => el.querySelector('.dt-load-more') as HTMLButtonElement | null;
    expect(more()?.textContent).toContain('載入更多');
    more()!.click();
    detect();
    expect(bodyCodes()).toHaveLength(50);
    expect(el.querySelector('.dt-pager__range')?.textContent).toContain('已顯示 50 / 60 筆');
    more()!.click();
    detect();
    expect(bodyCodes()).toHaveLength(60);
    expect(more()).toBeNull();
  });
});

describe('DataTable 排序', () => {
  it('標題是按鈕；點擊循環 aria-sort：none → ascending → descending → none', () => {
    const { header, host, detect } = setup();
    const th = () => header('金額');
    expect(th().getAttribute('aria-sort')).toBe('none');
    const click = () => {
      (th().querySelector('button.dt-sort-btn') as HTMLButtonElement).click();
      detect();
    };
    click();
    expect(th().getAttribute('aria-sort')).toBe('ascending');
    expect(host.sort()).toEqual({ key: 'amount', direction: 'asc' });
    click();
    expect(th().getAttribute('aria-sort')).toBe('descending');
    click();
    expect(th().getAttribute('aria-sort')).toBe('none');
    expect(host.sort()).toBeNull();
  });

  it('沒有 sortValue 的虛擬欄不能排序（沒有按鈕、沒有 aria-sort）', () => {
    const { header } = setup();
    expect(header('兩倍').querySelector('button')).toBeNull();
    expect(header('兩倍').hasAttribute('aria-sort')).toBe(false);
  });

  it('排序作用在全部資料（不是只排這一頁），並回到第一頁', () => {
    const { el, host, detect } = setup();
    host.page.set(1);
    detect();
    (el.querySelectorAll('button.dt-sort-btn')[1] as HTMLButtonElement).click();
    detect();
    expect(host.page()).toBe(0);
    const amounts = [...el.querySelectorAll('tbody tr')].map((tr) => Number(tr.querySelectorAll('td')[1].textContent));
    const all = makeRows(60).map((r) => r.amount).sort((a, b) => a - b);
    expect(amounts).toEqual(all.slice(0, 25));
  });
});

describe('DataTable 匯出：分頁時仍匯出篩選＋排序後的全部資料', () => {
  it('第 2 頁、依金額遞減時匯出 60 筆，順序與排序一致，欄位與畫面相同', async () => {
    const { el, host, detect } = setup();
    host.sort.set({ key: 'amount', direction: 'desc' });
    host.page.set(1);
    detect();
    aoaToSheet.mockClear();
    (el.querySelector('.dt-export-btn') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(aoaToSheet).toHaveBeenCalledTimes(1));
    const aoa = aoaToSheet.mock.calls[0][0] as (string | number)[][];
    expect(aoa[0]).toEqual(['編號', '金額', '兩倍']);
    expect(aoa).toHaveLength(61);
    const amounts = aoa.slice(1).map((r) => r[1] as number);
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
  });

  it('隱藏的欄位不匯出，欄位順序跟著畫面', async () => {
    const { el, host, detect } = setup();
    host.prefs.set({ order: ['code', 'double', 'amount'], hidden: ['amount'] });
    detect();
    aoaToSheet.mockClear();
    (el.querySelector('.dt-export-btn') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(aoaToSheet).toHaveBeenCalledTimes(1));
    expect((aoaToSheet.mock.calls[0][0] as unknown[][])[0]).toEqual(['編號', '兩倍']);
  });
});

describe('DataTable 欄位選擇與固定欄', () => {
  function openChooser(el: HTMLElement, detect: () => void): HTMLElement {
    (el.querySelector('.dt-chooser-trigger') as HTMLButtonElement).click();
    detect();
    return document.querySelector('.dt-chooser') as HTMLElement;
  }

  it('取消勾選隱藏欄位；固定欄的勾選框停用、沒有上下移按鈕', () => {
    const { el, host, detect, header } = setup();
    const panel = openChooser(el, detect);
    const boxes = [...panel.querySelectorAll('input[type=checkbox]')] as HTMLInputElement[];
    expect(boxes[0].disabled).toBe(true);
    expect(panel.querySelector('button[aria-label="上移編號"]')).toBeNull();
    boxes[1].click();
    detect();
    expect(host.prefs()).toEqual({ order: ['code', 'amount', 'double'], hidden: ['amount'] });
    expect(header('金額')).toBeUndefined();
  });

  it('上移／下移（鍵盤可用的替代操作）改變順序，恢復預設回到 null', () => {
    const { el, host, detect } = setup();
    const panel = openChooser(el, detect);
    (panel.querySelector('button[aria-label="下移金額"]') as HTMLButtonElement).click();
    detect();
    expect(host.prefs()).toEqual({ order: ['code', 'double', 'amount'], hidden: [] });
    const headerLabels = [...el.querySelectorAll('thead th:not(.dt-expand-head)')].map((th) => th.textContent?.trim());
    expect(headerLabels).toEqual(['編號', '兩倍', '金額']);
    // 第一個可移動的欄位不能再往上移到固定欄前面。
    expect((panel.querySelector('button[aria-label="上移兩倍"]') as HTMLButtonElement).disabled).toBe(true);
    (panel.querySelector('.dt-chooser__reset') as HTMLButtonElement).click();
    detect();
    expect(host.prefs()).toBeNull();
  });

  it('排回原本的順序時偏好正規化成 null', () => {
    const { el, host, detect } = setup();
    const panel = openChooser(el, detect);
    (panel.querySelector('button[aria-label="下移金額"]') as HTMLButtonElement).click();
    detect();
    (panel.querySelector('button[aria-label="上移金額"]') as HTMLButtonElement).click();
    detect();
    expect(host.prefs()).toBeNull();
  });

  it('固定欄的 th／td 帶 dt-frozen；有勾選欄時勾選欄也固定', () => {
    const { el, host, detect } = setup();
    expect(el.querySelector('thead th')?.classList.contains('dt-frozen')).toBe(true);
    expect(el.querySelectorAll('tbody td.dt-frozen')).toHaveLength(25);
    host.selectable.set(true);
    detect();
    expect(el.querySelector('thead th.dt-selection-head')?.classList.contains('dt-frozen-select')).toBe(true);
  });

  it('橫向捲動後才加上 dt-wrap--scrolled（固定欄的底色與分界）', () => {
    const { el, detect } = setup();
    const wrap = el.querySelector('.dt-wrap') as HTMLElement;
    expect(wrap.classList.contains('dt-wrap--scrolled')).toBe(false);
    Object.defineProperty(wrap, 'scrollLeft', { value: 40, configurable: true });
    wrap.dispatchEvent(new Event('scroll'));
    detect();
    expect(wrap.classList.contains('dt-wrap--scrolled')).toBe(true);
  });
});

describe('DataTable 進階功能預設關閉', () => {
  @Component({
    imports: [DataTableComponent],
    template: `<lib-data-table [columns]="columns" [rows]="rows" [labels]="labels" />`,
  })
  class PlainHostComponent {
    readonly labels = { ...LABELS, paging: undefined, columnChooser: undefined };
    readonly columns: DataTableColumn<Row>[] = [
      { key: 'code', label: '編號' },
      { key: 'amount', label: '金額' },
    ];
    readonly rows = makeRows(60);
  }

  it('沒開 pageable／sortable／columnChooser：全部列都渲染、沒有分頁列、標題不是按鈕、沒有欄位選擇', () => {
    const fixture = TestBed.createComponent(PlainHostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('tbody tr')).toHaveLength(60);
    expect(el.querySelector('.dt-pager')).toBeNull();
    expect(el.querySelector('thead button')).toBeNull();
    expect(el.querySelector('thead th[aria-sort]')).toBeNull();
    expect(el.querySelector('.dt-chooser-trigger')).toBeNull();
    expect(el.querySelector('.dt-frozen')).toBeNull();
  });
});
