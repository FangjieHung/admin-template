import { describe, it, expect, afterEach } from 'vitest';
import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TreeTableComponent } from './tree-table.component';
import { DataTableCellDirective } from '../data-table/data-table-cell.directive';
import { TREE_LABELS, TreeLabels } from './tree-labels';
import type { TreeKey, TreeLoadChildren, TreeTableColumn } from './tree.types';

const TREE_TEST_LABELS: TreeLabels = {
  loading: '載入中',
  loadFailed: '無法載入「{name}」的內容',
  retry: '重試',
  retryHint: '按右方向鍵重試',
  noResults: '找不到符合「{query}」的項目',
  noRows: '沒有資料',
};

interface Item {
  id: string;
  name: string;
  owner: string;
  progress: number;
  children?: Item[];
}

const PLAN: Item[] = [
  {
    id: 'p1',
    name: '官網改版',
    owner: '林',
    progress: 40,
    children: [
      { id: 'p1-a', name: '需求訪談', owner: '林', progress: 100, children: [{ id: 'p1-a1', name: '訪談紀錄', owner: '王', progress: 100 }] },
      { id: 'p1-b', name: '視覺設計', owner: '陳', progress: 20 },
    ],
  },
  { id: 'p2', name: '帳務整併', owner: '王', progress: 0 },
];

const COLUMNS: TreeTableColumn<Item>[] = [
  { key: 'name', label: '名稱' },
  { key: 'owner', label: '負責人' },
  { key: 'pct', label: '進度', virtual: true, align: 'end', value: (r) => `${r.progress}%` },
];

@Component({
  imports: [TreeTableComponent, DataTableCellDirective],
  template: `
    <lib-tree-table
      label="專案進度"
      [rows]="rows()"
      [columns]="columns"
      [rowKey]="key"
      [loadChildren]="load()"
      [(expandedKeys)]="expanded"
      (activate)="activated.push($event.id)"
    >
      <ng-template dtCell="owner" let-row><span class="t-owner">負責：{{ row.owner }}</span></ng-template>
    </lib-tree-table>
  `,
})
class HostComponent {
  readonly rows = signal<Item[]>(PLAN);
  readonly columns = COLUMNS;
  readonly load = signal<TreeLoadChildren<Item> | null>(null);
  readonly expanded = signal<readonly TreeKey[]>([]);
  readonly key = (r: Item) => r.id;
  activated: string[] = [];
  readonly table = viewChild(TreeTableComponent);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('TreeTableComponent（樹狀表）', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;

  async function settle(rounds = 3): Promise<void> {
    for (let i = 0; i < rounds; i++) {
      fixture.detectChanges();
      await sleep(0);
    }
    fixture.detectChanges();
  }

  async function setup(configure?: (h: HostComponent) => void): Promise<void> {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: TREE_LABELS, useValue: TREE_TEST_LABELS }],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    configure?.(host);
    el = fixture.nativeElement as HTMLElement;
    await settle();
  }

  const rows = () => Array.from(el.querySelectorAll<HTMLElement>('tr[data-tree-row]'));
  const row = (name: string) => rows().find((tr) => tr.querySelector('.tt-name')?.textContent?.trim() === name)!;
  const names = () => rows().map((tr) => tr.querySelector('.tt-name')?.textContent?.trim());
  /** 鍵盤接收器：整張表唯一的 tab stop（aria-activedescendant 指向目前的列）。 */
  const sink = () => el.querySelector<HTMLInputElement>('.tt-sink')!;
  const press = async (key: string, init: KeyboardEventInit = {}) => {
    sink().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
    await settle();
  };
  const focusedName = () =>
    document.activeElement === sink()
      ? el.querySelector(`#${sink().getAttribute('aria-activedescendant')}`)?.querySelector('.tt-name')?.textContent?.trim()
      : `(${document.activeElement?.tagName})`;

  afterEach(() => fixture?.destroy());

  it('ARIA：treegrid、欄位標題、每列 aria-level／setsize／posinset，只有父列有 aria-expanded；外觀掛 .dt-table', async () => {
    await setup();
    const table = el.querySelector('table')!;
    expect(table.getAttribute('role')).toBe('treegrid');
    expect(table.getAttribute('aria-label')).toBe('專案進度');
    expect(table.classList).toContain('dt-table');
    expect(Array.from(table.querySelectorAll('th')).map((th) => th.textContent?.trim())).toEqual(['名稱', '負責人', '進度']);
    expect(names()).toEqual(['官網改版', '帳務整併']);
    const p1 = row('官網改版');
    expect([p1.getAttribute('aria-level'), p1.getAttribute('aria-posinset'), p1.getAttribute('aria-setsize')]).toEqual(['1', '1', '2']);
    expect(p1.getAttribute('aria-expanded')).toBe('false');
    expect(row('帳務整併').hasAttribute('aria-expanded')).toBe(false);
    expect(p1.querySelectorAll('[role="gridcell"]').length).toBe(3);
    // 儲存格：dtCell 範本、value、靠右的數字欄掛 ui-text-numeric
    expect(p1.querySelector('.t-owner')?.textContent).toBe('負責：林');
    const pct = p1.querySelectorAll('td')[2];
    expect(pct.textContent?.trim()).toBe('40%');
    expect(pct.classList).toContain('ui-text-numeric');
    expect(p1.querySelector('td')!.classList).toContain('tt-first');
  });

  it('展開鈕：點擊展開收合，子列縮排、寫回 [(expandedKeys)]；expandAll()／collapseAll()', async () => {
    await setup();
    row('官網改版').querySelector<HTMLElement>('.tt-toggle')!.click();
    await settle();
    expect(names()).toEqual(['官網改版', '需求訪談', '視覺設計', '帳務整併']);
    expect(host.expanded()).toEqual(['p1']);
    const child = row('需求訪談');
    expect(child.getAttribute('aria-level')).toBe('2');
    expect(child.querySelector<HTMLElement>('.tt-first-inner')!.style.getPropertyValue('--tr-depth')).toBe('1');
    host.table()!.expandAll();
    await settle();
    expect(names()).toEqual(['官網改版', '需求訪談', '訪談紀錄', '視覺設計', '帳務整併']);
    host.table()!.collapseAll();
    await settle();
    expect(names()).toEqual(['官網改版', '帳務整併']);
  });

  it('treegrid 鍵盤（列模式）：↑↓ 換列、→ 展開再到第一個子列、← 收合再回到父列、Home／End、Enter；只有一個 tab stop', async () => {
    await setup();
    const tabStops = () => Array.from(el.querySelectorAll<HTMLElement>('input, button, tr')).filter((n) => n.tabIndex >= 0);
    expect(tabStops()).toEqual([sink()]);
    expect(sink().getAttribute('aria-activedescendant')).toBe(row('官網改版').id);
    expect(sink().getAttribute('aria-controls')).toBe(el.querySelector('table')!.id);
    row('官網改版').focus();
    await settle();
    expect(document.activeElement).toBe(sink());
    await press('ArrowRight');
    expect(row('官網改版').getAttribute('aria-expanded')).toBe('true');
    expect(focusedName()).toBe('官網改版');
    await press('ArrowRight');
    expect(focusedName()).toBe('需求訪談');
    expect(row('需求訪談').classList).toContain('is-active');
    await press('ArrowDown');
    expect(focusedName()).toBe('視覺設計');
    await press('ArrowUp');
    await press('ArrowRight');
    await press('ArrowRight');
    expect(focusedName()).toBe('訪談紀錄');
    await press('ArrowLeft');
    expect(focusedName()).toBe('需求訪談');
    await press('ArrowLeft');
    expect(row('需求訪談').getAttribute('aria-expanded')).toBe('false');
    await press('ArrowLeft');
    expect(focusedName()).toBe('官網改版');
    await press('End');
    expect(focusedName()).toBe('帳務整併');
    await press('Home', { ctrlKey: true });
    expect(focusedName()).toBe('官網改版');
    await press('*');
    await press('Enter');
    expect(host.activated).toEqual(['p1']);
    row('帳務整併').click();
    await settle();
    expect(host.activated).toEqual(['p1', 'p2']);
    expect(focusedName()).toBe('帳務整併');
  });

  it('預輸入：英數與輸入法確定的字都比對第一欄開頭；組字中的鍵不導覽', async () => {
    await setup((h) => h.expanded.set(['p1']));
    row('官網改版').focus();
    await settle();
    await press('v'); // 沒有英文名稱：不動
    expect(focusedName()).toBe('官網改版');
    await new Promise((r) => setTimeout(r, 550)); // 停手後重新開始
    sink().dispatchEvent(new CompositionEvent('compositionstart', { data: '', bubbles: true }));
    await settle();
    expect(sink().classList).toContain('is-composing');
    await press('ArrowDown', { isComposing: true, keyCode: 229 });
    expect(focusedName()).toBe('官網改版');
    sink().dispatchEvent(new CompositionEvent('compositionend', { data: '帳', bubbles: true }));
    await settle();
    expect(focusedName()).toBe('帳務整併');
    await new Promise((r) => setTimeout(r, 550));
    sink().dispatchEvent(new CompositionEvent('compositionstart', { data: '', bubbles: true }));
    sink().dispatchEvent(new CompositionEvent('compositionend', { data: '視覺', bubbles: true }));
    await settle();
    expect(focusedName()).toBe('視覺設計');
  });

  it('延遲載入：轉圈、失敗時下一列顯示錯誤與重試，重試成功後顯示子列', async () => {
    let attempts = 0;
    let resolve!: (list: Item[]) => void;
    await setup((h) => {
      h.rows.set([{ id: 'x', name: '新專案', owner: '林', progress: 0 }]);
      h.load.set(() => {
        attempts++;
        return attempts === 1 ? Promise.reject(new Error('boom')) : new Promise<Item[]>((r) => (resolve = r));
      });
    });
    row('新專案').focus();
    await settle();
    await press('ArrowRight');
    const status = el.querySelector('.tt-status-row')!;
    expect(status.textContent).toContain('無法載入「新專案」的內容');
    expect(row('新專案').getAttribute('aria-describedby')).toBe(status.querySelector('.tt-error-text')!.id);
    await press('ArrowRight'); // → 重試
    expect(attempts).toBe(2);
    expect(row('新專案').getAttribute('aria-busy')).toBe('true');
    expect(row('新專案').querySelector('.tt-spinner')).not.toBeNull();
    expect(el.querySelector('.tt-status-row')).toBeNull();
    resolve([{ id: 'x1', name: '規劃', owner: '王', progress: 10 }]);
    await settle();
    expect(names()).toEqual(['新專案', '規劃']);
  });

  it('重試鈕：點擊重新載入', async () => {
    let attempts = 0;
    await setup((h) => {
      h.rows.set([{ id: 'x', name: '新專案', owner: '林', progress: 0 }]);
      h.load.set(() => (++attempts === 1 ? Promise.reject(new Error('boom')) : Promise.resolve([{ id: 'x1', name: '規劃', owner: '王', progress: 10 }])));
    });
    row('新專案').querySelector<HTMLElement>('.tt-toggle')!.click();
    await settle();
    el.querySelector<HTMLButtonElement>('.tt-retry')!.click();
    await settle();
    expect(names()).toEqual(['新專案', '規劃']);
  });

  it('沒有資料列時顯示 noRows', async () => {
    await setup((h) => h.rows.set([]));
    expect(el.querySelector('table')).toBeNull();
    expect(el.querySelector('.tt-empty')?.textContent?.trim()).toBe('沒有資料');
  });
});
