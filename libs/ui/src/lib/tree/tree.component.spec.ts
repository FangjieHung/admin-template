import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { TreeComponent } from './tree.component';
import { TreeNodeDirective } from './tree-node.directive';
import { TreeHighlightComponent, splitTreeHighlight } from './tree-highlight.component';
import { TREE_LABELS, TreeLabels } from './tree-labels';
import { toggleCheckedKeys, computeCheckStates } from './tree-check';
import type { TreeFilter, TreeKey, TreeLoadChildren, TreeSearchMatch, TreeSelectionMode, TreeServerSearch } from './tree.types';

const TREE_TEST_LABELS: TreeLabels = {
  loading: '載入中',
  loadFailed: '無法載入「{name}」的內容',
  retry: '重試',
  retryHint: '按右方向鍵重試',
  noResults: '找不到符合「{query}」的項目',
  noRows: '沒有資料',
  searchLoadedOnly: '只搜尋已載入的項目',
  searching: '搜尋中',
  searchFailed: '無法搜尋未載入的項目',
};

interface Unit {
  id: string;
  name: string;
  children?: Unit[];
}

const ORG: Unit[] = [
  {
    id: 'co',
    name: '總公司',
    children: [
      { id: 'rd', name: '研發部', children: [{ id: 'fe', name: '前端組' }, { id: 'be', name: '後端組' }] },
      { id: 'ops', name: '營運部', children: [{ id: 'cs', name: '客服組' }] },
      { id: 'fin', name: '財務部' },
    ],
  },
  { id: 'lab', name: '實驗室' },
];

const FRUIT: Unit[] = [
  { id: 'a', name: 'Apple' },
  { id: 'b1', name: 'Banana' },
  { id: 'b2', name: 'Blueberry' },
  { id: 'c', name: 'Cherry' },
];

@Component({
  imports: [TreeComponent, TreeNodeDirective, TreeHighlightComponent],
  template: `
    @if (controlled) {
      <lib-tree
        label="組織架構"
        [nodes]="nodes()"
        [nodeKey]="key"
        [nodeLabel]="name"
        [selection]="selection()"
        [loadChildren]="load()"
        [filterText]="query()"
        [filter]="predicate()"
        [serverSearch]="search()"
        [(expandedKeys)]="expanded"
        [(currentKey)]="current"
        [(checkedKeys)]="checked"
        (activate)="activated.push($event.id)"
      >
        <ng-template libTreeNode [libTreeNodeOf]="nodes()" let-node let-level="level" let-q="query">
          <span class="t-name"><lib-tree-highlight [text]="node.name" [query]="q" /></span><span class="t-level">{{ level }}</span>
        </ng-template>
      </lib-tree>
    } @else {
      <lib-tree
        label="組織架構"
        [nodes]="nodes()"
        [nodeKey]="key"
        [nodeLabel]="name"
        [selection]="selection()"
        [loadChildren]="load()"
        [filterText]="query()"
        (activate)="activated.push($event.id)"
      />
    }
  `,
})
class HostComponent {
  controlled = true;
  readonly nodes = signal<Unit[]>(ORG);
  readonly selection = signal<TreeSelectionMode>('none');
  readonly load = signal<TreeLoadChildren<Unit> | null>(null);
  readonly query = signal('');
  readonly predicate = signal<TreeFilter<Unit> | null>(null);
  readonly search = signal<TreeServerSearch | null>(null);
  readonly expanded = signal<readonly TreeKey[]>([]);
  readonly current = signal<TreeKey | null>(null);
  readonly checked = signal<readonly TreeKey[]>([]);
  readonly key = (u: Unit) => u.id;
  readonly name = (u: Unit) => u.name;
  activated: string[] = [];
  readonly tree = viewChild(TreeComponent);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('TreeComponent（樹狀選單）', () => {
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

  const items = () => Array.from(el.querySelectorAll<HTMLElement>('[role="treeitem"]'));
  /** 依節點名稱找 treeitem（名稱由 aria-labelledby 指向的內容提供）。 */
  const item = (name: string) =>
    items().find((li) => el.querySelector(`#${li.getAttribute('aria-labelledby')}`)?.textContent?.includes(name))!;
  const names = () =>
    items().map((li) => el.querySelector(`#${li.getAttribute('aria-labelledby')}`)?.querySelector('.t-name, lib-tree-highlight')?.textContent?.trim());
  const row = (name: string) => item(name).querySelector<HTMLElement>(':scope > .tr-row')!;
  const toggle = (name: string) => item(name).querySelector<HTMLElement>(':scope > .tr-row > .tr-toggle')!;
  const check = (name: string) => item(name).querySelector<HTMLInputElement>(':scope > .tr-row > .tr-check')!;
  /** 鍵盤接收器：整棵樹唯一的 tab stop（看不見的輸入框，aria-activedescendant 指向目前節點）。 */
  const sink = () => el.querySelector<HTMLInputElement>('.tr-sink')!;
  const press = async (key: string, target: Element | null = sink(), init: KeyboardEventInit = {}) => {
    target!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
    await settle();
  };
  /** 焦點在接收器上時，目前節點（aria-activedescendant）的名稱。 */
  const focusedName = () => {
    const active = document.activeElement as HTMLElement | null;
    if (active !== sink()) return `(${active?.tagName})`;
    const li = el.querySelector(`#${active.getAttribute('aria-activedescendant')}`);
    return el.querySelector(`#${li?.getAttribute('aria-labelledby')}`)?.querySelector('.t-name, lib-tree-highlight')?.textContent?.trim();
  };
  /** 模擬輸入法組字：compositionstart → 每一段 compositionupdate（輸入框的值跟著變）→ compositionend（確定的字）。 */
  const compose = async (steps: string[], committed: string) => {
    const input = sink();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Process', keyCode: 229, bubbles: true, cancelable: true }));
    input.dispatchEvent(new CompositionEvent('compositionstart', { data: '', bubbles: true }));
    for (const text of steps) {
      input.value = text;
      input.dispatchEvent(new CompositionEvent('compositionupdate', { data: text, bubbles: true }));
      input.dispatchEvent(new InputEvent('input', { data: text, inputType: 'insertCompositionText', isComposing: true, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Process', keyCode: 229, isComposing: true, bubbles: true, cancelable: true }));
      await settle();
    }
    // 輸入框裡留著最後一段組字（取消組字時 data 是空字串，不能拿輸入框的值來比對）
    input.dispatchEvent(new CompositionEvent('compositionend', { data: committed, bubbles: true }));
    await settle();
  };

  afterEach(() => fixture?.destroy());

  it('沒有提供畫面文字或少了一句時，建立元件就丟出錯誤並列出缺的名稱', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    expect(() => TestBed.createComponent(HostComponent).detectChanges()).toThrow(/TREE_LABELS/);
    TestBed.resetTestingModule();
    const { retry: _r, ...partial } = TREE_TEST_LABELS;
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [{ provide: TREE_LABELS, useValue: partial }] });
    expect(() => TestBed.createComponent(HostComponent).detectChanges()).toThrow(/「retry」/);
  });

  it('ARIA：tree／treeitem／group、aria-level／setsize／posinset，只有父節點有 aria-expanded；名稱來自節點內容', async () => {
    await setup((h) => h.expanded.set(['co']));
    const tree = el.querySelector('[role="tree"]')!;
    expect(tree.getAttribute('aria-label')).toBe('組織架構');
    expect(names()).toEqual(['總公司', '研發部', '營運部', '財務部', '實驗室']);
    const co = item('總公司');
    expect([co.getAttribute('aria-level'), co.getAttribute('aria-posinset'), co.getAttribute('aria-setsize')]).toEqual(['1', '1', '2']);
    expect(co.getAttribute('aria-expanded')).toBe('true');
    const group = co.querySelector(':scope > [role="group"]')!;
    expect(group.querySelectorAll(':scope > [role="treeitem"]').length).toBe(3);
    const fin = item('財務部');
    expect([fin.getAttribute('aria-level'), fin.getAttribute('aria-posinset'), fin.getAttribute('aria-setsize')]).toEqual(['2', '3', '3']);
    expect(fin.hasAttribute('aria-expanded')).toBe(false);
    expect(item('研發部').getAttribute('aria-expanded')).toBe('false');
    // none 模式：沒有 aria-selected／aria-checked
    expect(co.hasAttribute('aria-selected')).toBe(false);
    expect(co.hasAttribute('aria-checked')).toBe(false);
    // 範本拿得到層級
    expect(fin.querySelector('.t-level')?.textContent).toBe('2');
  });

  it('單一 tab stop：鍵盤接收器（aria-activedescendant 指向目前節點）；節點本身拿到焦點時交回接收器', async () => {
    await setup((h) => h.expanded.set(['co']));
    const tabStops = () => Array.from(el.querySelectorAll<HTMLElement>('input, button, li')).filter((n) => n.tabIndex >= 0);
    expect(tabStops()).toEqual([sink()]);
    expect(sink().getAttribute('aria-activedescendant')).toBe(item('總公司').id);
    expect(sink().getAttribute('aria-controls')).toBe(el.querySelector('[role="tree"]')!.id);
    expect(sink().getAttribute('aria-label')).toBe('組織架構');
    expect(sink().getAttribute('inputmode')).toBe('none'); // 觸控裝置點節點不會跳出螢幕鍵盤
    expect(items().every((li) => li.getAttribute('tabindex') === '-1')).toBe(true);
    item('總公司').focus(); // 例：報讀器把焦點移到這個項目
    await settle();
    expect(document.activeElement).toBe(sink());
    await press('ArrowDown');
    expect(sink().getAttribute('aria-activedescendant')).toBe(item('研發部').id);
    expect(item('研發部').classList).toContain('is-active');
    expect(focusedName()).toBe('研發部');
    // 除了 treeitem，樹裡沒有其他 tab stop（勾選框、重試鈕都是 -1）
    host.selection.set('multiple');
    await settle();
    expect(el.querySelectorAll('[role="tree"] input, [role="tree"] button').length).toBeGreaterThan(0);
    el.querySelectorAll('[role="tree"] input, [role="tree"] button').forEach((n) => expect(n.getAttribute('tabindex')).toBe('-1'));
  });

  it('非受控：沒綁 expandedKeys 時，點展開鈕由元件自己記住展開狀態', async () => {
    await setup((h) => (h.controlled = false));
    expect(items().length).toBe(2);
    toggle('總公司').click();
    await settle();
    expect(items().length).toBe(5);
    expect(item('總公司').getAttribute('aria-expanded')).toBe('true');
    toggle('研發部').click();
    await settle();
    expect(items().length).toBe(7);
    toggle('總公司').click();
    await settle();
    expect(items().length).toBe(2);
    // 再展開時記得研發部原本是展開的
    toggle('總公司').click();
    await settle();
    expect(items().length).toBe(7);
  });

  it('受控：[(expandedKeys)] 由使用端改就展開；使用者展開收合也寫回使用端', async () => {
    await setup();
    host.expanded.set(['co', 'ops']);
    await settle();
    expect(names()).toEqual(['總公司', '研發部', '營運部', '客服組', '財務部', '實驗室']);
    toggle('研發部').click();
    await settle();
    expect(host.expanded()).toEqual(['co', 'ops', 'rd']);
    toggle('總公司').click();
    await settle();
    expect(host.expanded()).toEqual(['ops', 'rd']);
    expect(items().length).toBe(2);
  });

  it('expandAll()／collapseAll()：一次展開所有已知的父節點、全部收合', async () => {
    await setup();
    host.tree()!.expandAll();
    await settle();
    expect(host.expanded()).toEqual(['co', 'rd', 'ops']);
    expect(items().length).toBe(8);
    host.tree()!.collapseAll();
    await settle();
    expect(host.expanded()).toEqual([]);
    expect(items().length).toBe(2);
  });

  it('鍵盤：↑↓ 移動、→ 展開再進入第一個子節點、← 收合再回到父節點、Home／End', async () => {
    await setup();
    item('總公司').focus();
    await press('ArrowRight'); // 展開，焦點不動
    expect(item('總公司').getAttribute('aria-expanded')).toBe('true');
    expect(focusedName()).toBe('總公司');
    await press('ArrowRight'); // 進入第一個子節點
    expect(focusedName()).toBe('研發部');
    await press('ArrowDown');
    expect(focusedName()).toBe('營運部');
    await press('ArrowUp');
    expect(focusedName()).toBe('研發部');
    await press('ArrowRight'); // 展開研發部
    await press('ArrowRight'); // 前端組
    expect(focusedName()).toBe('前端組');
    await press('ArrowRight'); // 葉節點：不動
    expect(focusedName()).toBe('前端組');
    await press('ArrowLeft'); // 葉節點：回到父節點
    expect(focusedName()).toBe('研發部');
    await press('ArrowLeft'); // 展開中：收合，焦點不動
    expect(item('研發部').getAttribute('aria-expanded')).toBe('false');
    expect(focusedName()).toBe('研發部');
    await press('ArrowLeft'); // 回到總公司
    expect(focusedName()).toBe('總公司');
    await press('ArrowUp'); // 已經是第一個：不動
    expect(focusedName()).toBe('總公司');
    await press('End');
    expect(focusedName()).toBe('實驗室');
    await press('ArrowDown'); // 已經是最後一個：不動
    expect(focusedName()).toBe('實驗室');
    await press('Home');
    expect(focusedName()).toBe('總公司');
  });

  it('鍵盤：* 展開同一層所有節點；Enter 送出 activate', async () => {
    await setup((h) => h.expanded.set(['co']));
    item('研發部').focus();
    await press('*');
    expect(item('研發部').getAttribute('aria-expanded')).toBe('true');
    expect(item('營運部').getAttribute('aria-expanded')).toBe('true');
    expect(focusedName()).toBe('研發部');
    await press('Enter');
    expect(host.activated).toEqual(['rd']);
  });

  it('預輸入：打字跳到名稱開頭相符的下一個節點，同一個字連按就輪流跳，停手 500ms 後重新開始', async () => {
    await setup((h) => h.nodes.set(FRUIT));
    item('Apple').focus();
    await press('b');
    expect(focusedName()).toBe('Banana');
    await press('b');
    expect(focusedName()).toBe('Blueberry');
    await press('b');
    expect(focusedName()).toBe('Banana');
    await sleep(550);
    await press('c');
    expect(focusedName()).toBe('Cherry');
    await press('h'); // 「ch」：仍符合 Cherry，不跳走
    expect(focusedName()).toBe('Cherry');
    await sleep(550);
    await press('a'); // 從尾端繞回開頭
    expect(focusedName()).toBe('Apple');
    await press('z'); // 「az」沒有符合：不動
    expect(focusedName()).toBe('Apple');
  });

  it('輸入法預輸入：組字中不跳、方向鍵與 Enter 留給輸入法；確定「財」跳到「財務部」，確定兩個字比對開頭兩個字', async () => {
    await setup((h) => h.expanded.set(['co']));
    item('總公司').focus();
    await settle();
    const process = new KeyboardEvent('keydown', { key: 'Process', keyCode: 229, bubbles: true, cancelable: true });
    sink().dispatchEvent(process);
    expect(process.defaultPrevented).toBe(false); // 不攔：讓輸入法開始組字
    sink().dispatchEvent(new CompositionEvent('compositionstart', { data: '', bubbles: true }));
    sink().value = 'ㄘㄞˊ';
    await settle();
    expect(sink().classList).toContain('is-composing'); // 組字時看得到小框
    await press('ArrowDown', sink(), { isComposing: true, keyCode: 229 }); // 選字用的方向鍵
    expect(focusedName()).toBe('總公司');
    await press('Enter', sink(), { isComposing: true, keyCode: 229 }); // 確定組字的 Enter 不是 activate
    expect(host.activated).toEqual([]);
    sink().dispatchEvent(new CompositionEvent('compositionend', { data: '財', bubbles: true }));
    await settle();
    expect(sink().classList).not.toContain('is-composing');
    expect(sink().value).toBe('');
    expect(focusedName()).toBe('財務部');
    await sleep(550);
    await compose(['ㄧ', 'ㄧㄥˊ', '營', '營ㄩ', '營運'], '營運');
    expect(focusedName()).toBe('營運部');
    await sleep(550);
    await compose(['ㄕ', '實'], ''); // 取消組字（Esc）：輸入框還留著候選字也不跳
    expect(focusedName()).toBe('營運部');
    // 英數照舊；中途插入的文字（聽寫、表情符號面板）也算
    await sleep(550);
    sink().value = '實驗';
    sink().dispatchEvent(new InputEvent('input', { data: '實驗', inputType: 'insertText', bubbles: true }));
    await settle();
    expect(focusedName()).toBe('實驗室');
    expect(sink().value).toBe('');
  });

  it('輸入法預輸入：compositionend 之後同一輪的 input（Safari）不會再算一次', async () => {
    await setup((h) => h.nodes.set([{ id: 'x1', name: '財務部' }, { id: 'x2', name: '財產' }, { id: 'x3', name: '人資' }]));
    item('人資').focus();
    await settle();
    sink().dispatchEvent(new CompositionEvent('compositionstart', { data: '', bubbles: true }));
    sink().dispatchEvent(new CompositionEvent('compositionend', { data: '財', bubbles: true }));
    sink().value = '財';
    sink().dispatchEvent(new InputEvent('input', { data: '財', inputType: 'insertFromComposition', bubbles: true }));
    await settle();
    expect(focusedName()).toBe('財務部'); // 不是「財財」→ 輪流跳到「財產」
  });

  describe('延遲載入的全部展開與伺服器端搜尋', () => {
    const LAZY: Record<string, Unit[]> = {
      a: [{ id: 'a1', name: '甲一' }, { id: 'a2', name: '甲二' }],
      b: [{ id: 'b1', name: '乙一' }],
      a1: [{ id: 'a1x', name: '甲一之一' }],
      a2: [{ id: 'a2x', name: '甲二之一' }],
      b1: [{ id: 'b1x', name: '深處的報表' }],
      a1x: [],
      a2x: [],
      b1x: [],
    };
    const ROOTS: Unit[] = [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }];
    let calls: string[];
    let inFlight: number;
    let maxInFlight: number;
    let gates: Map<string, { resolve: () => void; reject: () => void }>;
    const manual: TreeLoadChildren<Unit> = (node) => {
      calls.push(node.id);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise<Unit[]>((resolve, reject) =>
        gates.set(node.id, {
          resolve: () => (inFlight--, resolve(LAZY[node.id] ?? [])),
          reject: () => (inFlight--, reject(new Error('boom'))),
        }),
      );
    };
    const release = async (...ids: string[]) => {
      ids.forEach((id) => gates.get(id)!.resolve());
      await settle();
    };

    beforeEach(() => {
      calls = [];
      inFlight = 0;
      maxInFlight = 0;
      gates = new Map();
    });

    it('expandAll()：一層一層載入，同時最多 concurrency 個請求，載入中轉圈；到 maxLoads 就停並回報', async () => {
      await setup((h) => {
        h.nodes.set(ROOTS);
        h.load.set(manual);
      });
      const done = host.tree()!.expandAll({ maxLoads: 4, concurrency: 2 });
      await settle();
      expect(calls).toEqual(['a', 'b']);
      expect(item('甲').getAttribute('aria-busy')).toBe('true');
      expect(item('甲').querySelector('.tr-spinner')).not.toBeNull();
      expect(el.querySelector('[role="tree"]')!.getAttribute('aria-busy')).toBe('true');
      expect(host.tree()!.expandAllProgress()).toEqual({ loaded: 0, failed: 0, pending: 2, limitReached: false });
      await release('a', 'b');
      // 第二層：a1、a2（b1 排在後面，但上限只剩 2 個）
      expect(calls).toEqual(['a', 'b', 'a1', 'a2']);
      expect(names()).toEqual(['甲', '甲一', '甲二', '乙', '乙一']);
      await release('a1', 'a2');
      const result = await done;
      await settle();
      expect(result).toEqual({ loaded: 4, failed: 0, limitReached: true, cancelled: false });
      expect(maxInFlight).toBe(2);
      expect(calls).not.toContain('b1');
      expect(host.expanded()).toEqual(['a', 'b', 'a1', 'a2']);
      expect(names()).toEqual(['甲', '甲一', '甲一之一', '甲二', '甲二之一', '乙', '乙一']);
      expect(item('乙一').getAttribute('aria-expanded')).toBe('false'); // 沒載入的維持收合
      expect(host.tree()!.expandAllProgress()).toBeNull();
      expect(el.querySelector('[role="tree"]')!.hasAttribute('aria-busy')).toBe(false);
    });

    it('expandAll()：失敗的節點展開顯示錯誤、不中斷其他節點；cancelExpandAll() 之後不再送新的請求', async () => {
      await setup((h) => {
        h.nodes.set(ROOTS);
        h.load.set(manual);
      });
      const done = host.tree()!.expandAll({ concurrency: 2 });
      await settle();
      gates.get('a')!.reject();
      await release('b');
      expect(item('甲').querySelector('.tr-error')).not.toBeNull();
      expect(item('甲').getAttribute('aria-expanded')).toBe('true');
      expect(calls).toEqual(['a', 'b', 'b1']);
      host.tree()!.cancelExpandAll();
      await release('b1');
      const result = await done;
      expect(result).toEqual({ loaded: 1, failed: 1, limitReached: false, cancelled: true });
      expect(calls).toEqual(['a', 'b', 'b1']); // 沒有再載入 b1x
      expect(item('乙一').getAttribute('aria-expanded')).toBe('false'); // 停止後回來的結果不展開
    });

    it('伺服器端搜尋：照回傳的祖先路徑一層一層載入，找到的節點出現且祖先自動展開；搜尋中顯示「搜尋中」', async () => {
      let answer!: (m: TreeSearchMatch[]) => void;
      const queries: string[] = [];
      await setup((h) => {
        h.nodes.set(ROOTS);
        h.load.set((node) => (calls.push(node.id), Promise.resolve(LAZY[node.id] ?? [])));
        h.search.set((q) => (queries.push(q), new Promise<TreeSearchMatch[]>((r) => (answer = r))));
      });
      host.query.set('報');
      await settle();
      host.query.set('報表');
      await settle();
      // 搜尋中：本機沒有結果時不顯示「找不到」，改顯示搜尋中
      expect(el.querySelector('.tr-empty')).toBeNull();
      const note = () => el.querySelector('.tr-search-note');
      expect(note()?.getAttribute('role')).toBe('status');
      expect(note()?.textContent?.trim()).toBe('搜尋中');
      await sleep(300);
      expect(queries).toEqual(['報表']); // 停手 250ms 才送，前一個字不送
      answer([{ key: 'b1x', ancestors: ['b', 'b1'] }]);
      await sleep(0);
      await settle(6);
      expect(calls).toEqual(['b', 'b1']);
      expect(names()).toEqual(['乙', '乙一', '深處的報表']);
      expect(item('乙一').getAttribute('aria-expanded')).toBe('true');
      expect(item('深處的報表').querySelector('mark')?.textContent).toBe('報表');
      expect(note()).toBeNull();
      expect(host.expanded()).toEqual([]); // 跟本機搜尋一樣，不寫回 expandedKeys
    });

    it('伺服器端搜尋：名稱不含搜尋字的結果也保留；搜尋字換掉後晚到的結果丟掉；失敗時說明', async () => {
      const answers = new Map<string, (m: TreeSearchMatch[]) => void>();
      let fail = false;
      await setup((h) => {
        h.nodes.set(ROOTS);
        h.load.set((node) => Promise.resolve(LAZY[node.id] ?? []));
        h.search.set((q) => (fail ? Promise.reject(new Error('down')) : new Promise<TreeSearchMatch[]>((r) => answers.set(q, r))));
      });
      host.query.set('report');
      await settle();
      await sleep(300);
      host.query.set('a2x');
      await settle();
      answers.get('report')!([{ key: 'b1x', ancestors: ['b', 'b1'] }]); // 晚到：丟掉
      await sleep(300);
      answers.get('a2x')!([{ key: 'a2x', ancestors: ['a', 'a2'] }]); // 例：伺服器用編號比對，名稱不含搜尋字
      await sleep(0);
      await settle(6);
      expect(names()).toEqual(['甲', '甲二', '甲二之一']);
      host.query.set('');
      await settle();
      fail = true;
      host.query.set('乙');
      await settle();
      await sleep(300);
      await settle();
      expect(names()).toEqual(['乙']); // 已載入的結果照樣顯示
      expect(el.querySelector('.tr-search-note')?.textContent?.trim()).toBe('無法搜尋未載入的項目');
    });

    it('沒有伺服器端搜尋的延遲載入樹：搜尋結果下方說明「只搜尋已載入的項目」；靜態的樹不顯示', async () => {
      await setup((h) => {
        h.nodes.set(ROOTS);
        h.load.set((node) => Promise.resolve(LAZY[node.id] ?? []));
      });
      host.query.set('甲');
      await settle();
      expect(names()).toEqual(['甲']);
      expect(el.querySelector('.tr-search-note')?.textContent?.trim()).toBe('只搜尋已載入的項目');
      expect(el.querySelector('.tr-search-note')?.hasAttribute('role')).toBe(false);
      host.load.set(null);
      await settle();
      expect(el.querySelector('.tr-search-note')).toBeNull();
    });
  });

  it('single：點擊或 Enter／Space 讓節點成為目前項目（aria-selected）並送出 activate；[(currentKey)] 雙向', async () => {
    await setup((h) => {
      h.selection.set('single');
      h.expanded.set(['co']);
    });
    expect(item('總公司').getAttribute('aria-selected')).toBe('false');
    row('研發部').click();
    await settle();
    expect(host.current()).toBe('rd');
    expect(item('研發部').getAttribute('aria-selected')).toBe('true');
    expect(row('研發部').classList).toContain('is-current');
    expect(focusedName()).toBe('研發部');
    expect(host.activated).toEqual(['rd']);
    await press('ArrowDown');
    expect(host.current()).toBe('rd'); // 選取不跟著焦點走
    await press(' ');
    expect(host.current()).toBe('ops');
    await press('ArrowDown');
    await press('Enter');
    expect(host.current()).toBe('fin');
    expect(host.activated).toEqual(['rd', 'ops', 'fin']);
    // 使用端改 currentKey：畫面跟著換；目前項目拿到 tab stop
    host.current.set('lab');
    await settle();
    expect(item('實驗室').getAttribute('aria-selected')).toBe('true');
    expect(items().filter((li) => li.getAttribute('aria-selected') === 'true').length).toBe(1);
  });

  it('multiple 三態：勾父節點連帶勾子孫；勾一個子節點父節點半勾；子孫全勾時父節點自動全勾', async () => {
    await setup((h) => {
      h.selection.set('multiple');
      h.expanded.set(['co', 'rd', 'ops']);
    });
    expect(item('總公司').getAttribute('aria-checked')).toBe('false');
    // 勾一個葉節點：父節點、祖父節點變半勾
    check('前端組').click();
    await settle();
    expect(host.checked()).toEqual(['fe']);
    expect(item('前端組').getAttribute('aria-checked')).toBe('true');
    expect(item('研發部').getAttribute('aria-checked')).toBe('mixed');
    expect(check('研發部').indeterminate).toBe(true);
    expect(check('研發部').checked).toBe(false);
    expect(item('總公司').getAttribute('aria-checked')).toBe('mixed');
    // 勾另一個：研發部全勾（自動）
    item('後端組').focus();
    await press(' ');
    expect(host.checked()).toEqual(['rd', 'fe', 'be']);
    expect(item('研發部').getAttribute('aria-checked')).toBe('true');
    expect(check('研發部').checked).toBe(true);
    expect(check('研發部').indeterminate).toBe(false);
    // 勾總公司：全部勾
    row('總公司').click();
    await settle();
    expect(host.checked()).toEqual(['co', 'rd', 'fe', 'be', 'ops', 'cs', 'fin']);
    // 取消一個孫節點：祖先退成半勾
    check('客服組').click();
    await settle();
    expect(host.checked()).toEqual(['rd', 'fe', 'be', 'fin']);
    expect(item('營運部').getAttribute('aria-checked')).toBe('false');
    expect(item('總公司').getAttribute('aria-checked')).toBe('mixed');
    // 半勾的父節點：按一下變全勾
    check('總公司').click();
    await settle();
    expect(host.checked()).toEqual(['co', 'rd', 'fe', 'be', 'ops', 'cs', 'fin']);
    // 全勾的父節點：按一下全部取消
    check('總公司').click();
    await settle();
    expect(host.checked()).toEqual([]);
    // multiple 模式點列＝勾選，不送 activate；Enter 仍送 activate
    expect(host.activated).toEqual([]);
    item('實驗室').focus();
    await press('Enter');
    expect(host.activated).toEqual(['lab']);
  });

  it('multiple：使用端給的 checkedKeys 只有父節點時，子孫一起顯示全勾', async () => {
    await setup((h) => {
      h.selection.set('multiple');
      h.expanded.set(['co', 'rd']);
      h.checked.set(['rd']);
    });
    expect(item('前端組').getAttribute('aria-checked')).toBe('true');
    expect(item('總公司').getAttribute('aria-checked')).toBe('mixed');
  });

  it('延遲載入：展開時顯示轉圈（aria-busy），載入完放進子節點；收合再展開不重新載入', async () => {
    const calls: string[] = [];
    let resolve!: (list: Unit[]) => void;
    await setup((h) => {
      h.nodes.set([{ id: 'p', name: '專案群組' }, { id: 'q', name: '空群組' }]);
      h.load.set((node) => {
        calls.push(node.id);
        return node.id === 'q' ? Promise.resolve([]) : new Promise<Unit[]>((r) => (resolve = r));
      });
    });
    expect(item('專案群組').getAttribute('aria-expanded')).toBe('false'); // 還不知道有沒有子節點：先畫展開鈕
    item('專案群組').focus();
    await press('ArrowRight');
    expect(calls).toEqual(['p']);
    expect(item('專案群組').getAttribute('aria-busy')).toBe('true');
    expect(item('專案群組').querySelector('.tr-spinner')).not.toBeNull();
    expect(item('專案群組').querySelector('.tr-sr')?.textContent).toBe('載入中');
    resolve([{ id: 'p1', name: '子專案甲' }]);
    await settle();
    expect(item('專案群組').hasAttribute('aria-busy')).toBe(false);
    expect(names()).toEqual(['專案群組', '子專案甲', '空群組']);
    await press('ArrowLeft');
    await press('ArrowRight');
    expect(calls).toEqual(['p']);
    expect(names()).toContain('子專案甲');
    // 載入回空陣列：變成葉節點
    toggle('空群組').click();
    await settle();
    expect(item('空群組').hasAttribute('aria-expanded')).toBe(false);
  });

  it('延遲載入失敗：節點下方顯示錯誤與「重試」；按重試（或 →）重新載入，成功後顯示子節點', async () => {
    let attempts = 0;
    await setup((h) => {
      h.nodes.set([{ id: 'p', name: '專案群組' }]);
      h.load.set(() => {
        attempts++;
        return attempts === 1 ? Promise.reject(new Error('boom')) : Promise.resolve([{ id: 'p1', name: '子專案甲' }]);
      });
    });
    toggle('專案群組').click();
    await settle();
    const li = item('專案群組');
    const error = li.querySelector('.tr-error')!;
    expect(error.textContent).toContain('無法載入「專案群組」的內容');
    // 描述只指向訊息文字（不含圖示的連字與「重試」鈕）
    const description = el.querySelector(`#${li.getAttribute('aria-describedby')}`)!;
    expect(description.textContent).toBe('無法載入「專案群組」的內容按右方向鍵重試');
    expect(error.contains(description)).toBe(true);
    expect(error.querySelector('.tr-sr')?.textContent).toBe('按右方向鍵重試');
    expect(li.getAttribute('aria-expanded')).toBe('true');
    expect(li.hasAttribute('aria-busy')).toBe(false);
    li.querySelector<HTMLButtonElement>('.tr-retry')!.click();
    await settle();
    expect(attempts).toBe(2);
    expect(li.querySelector('.tr-error')).toBeNull();
    expect(names()).toEqual(['專案群組', '子專案甲']);
    expect(focusedName()).toBe('專案群組');
  });

  it('延遲載入失敗：按 → 也會重試；收合後再展開會重新載入（Observable 也可以）', async () => {
    const subject = new Subject<Unit[]>();
    let attempts = 0;
    await setup((h) => {
      h.nodes.set([{ id: 'p', name: '專案群組' }]);
      h.load.set(() => {
        attempts++;
        return subject;
      });
    });
    item('專案群組').focus();
    await press('ArrowRight');
    subject.error(new Error('boom'));
    await settle();
    expect(item('專案群組').querySelector('.tr-error')).not.toBeNull();
    const retry$ = new Subject<Unit[]>();
    host.load.set(() => {
      attempts++;
      return retry$;
    });
    await settle();
    await press('ArrowRight');
    expect(attempts).toBe(2);
    expect(item('專案群組').getAttribute('aria-busy')).toBe('true');
    retry$.next([{ id: 'p1', name: '子專案甲' }]);
    await settle();
    expect(names()).toEqual(['專案群組', '子專案甲']);
  });

  it('延遲載入＋三態：勾了還沒載入的節點，載入後子節點全部算勾並寫回 checkedKeys', async () => {
    await setup((h) => {
      h.selection.set('multiple');
      h.nodes.set([{ id: 'p', name: '專案群組' }, { id: 'x', name: '其他' }]);
      h.load.set(() => Promise.resolve([{ id: 'p1', name: '子專案甲' }, { id: 'p2', name: '子專案乙' }]));
    });
    check('專案群組').click();
    await settle();
    expect(host.checked()).toEqual(['p']);
    toggle('專案群組').click();
    await settle();
    expect(host.checked()).toEqual(['p', 'p1', 'p2']);
    expect(item('子專案乙').getAttribute('aria-checked')).toBe('true');
    check('子專案乙').click();
    await settle();
    expect(host.checked()).toEqual(['p1']);
    expect(item('專案群組').getAttribute('aria-checked')).toBe('mixed');
  });

  it('搜尋：保留符合的節點與祖先、祖先自動展開（不能收合）、用 <mark> 標出比對到的字；沒有結果時顯示空狀態', async () => {
    await setup();
    host.query.set('組');
    await settle();
    expect(names()).toEqual(['總公司', '研發部', '前端組', '後端組', '營運部', '客服組']);
    expect(item('研發部').getAttribute('aria-expanded')).toBe('true');
    expect(host.expanded()).toEqual([]); // 搜尋的自動展開不寫回 expandedKeys
    const marks = Array.from(item('前端組').querySelectorAll(':scope > .tr-row mark')).map((m) => m.textContent);
    expect(marks).toEqual(['組']);
    expect(item('研發部').querySelector(':scope > .tr-row mark')).toBeNull();
    // 祖先：← 不收合，改回到父節點
    item('研發部').focus();
    await press('ArrowLeft');
    expect(item('研發部').getAttribute('aria-expanded')).toBe('true');
    expect(focusedName()).toBe('總公司');
    // aria-setsize 依看得到的兄弟計算
    expect(item('營運部').getAttribute('aria-setsize')).toBe('2');
    host.query.set('不存在');
    await settle();
    expect(el.querySelector('[role="tree"]')).toBeNull();
    const empty = el.querySelector('.tr-empty')!;
    expect(empty.getAttribute('role')).toBe('status');
    expect(empty.textContent?.trim()).toBe('找不到符合「不存在」的項目');
    host.query.set('');
    await settle();
    expect(names()).toEqual(['總公司', '實驗室']);
  });

  it('搜尋：[filter] 謂詞取代文字比對；不給範本時預設內容也會標字', async () => {
    await setup((h) => (h.controlled = false));
    host.query.set('apple');
    host.nodes.set(FRUIT);
    await settle();
    expect(items().length).toBe(1);
    expect(item('Apple').querySelector('mark')?.textContent).toBe('Apple');
    fixture.destroy();
    TestBed.resetTestingModule();
    await setup((h) => h.predicate.set((u) => u.id === 'cs'));
    expect(names()).toEqual(['總公司', '營運部', '客服組']);
  });
});

describe('三態勾選與標字（純函式）', () => {
  const access = {
    key: (u: Unit) => u.id,
    children: (u: Unit) => u.children ?? null,
  };

  it('toggleCheckedKeys 依樹的順序回傳正規化的清單', () => {
    expect(toggleCheckedKeys(ORG, access, new Set(), 'rd')).toEqual(['rd', 'fe', 'be']);
    expect(toggleCheckedKeys(ORG, access, new Set(['rd', 'fe', 'be']), 'fe')).toEqual(['be']);
    expect(toggleCheckedKeys(ORG, access, new Set(['rd', 'fe', 'be', 'cs']), 'fin')).toEqual(['co', 'rd', 'fe', 'be', 'ops', 'cs', 'fin']);
    const states = computeCheckStates(ORG, access, new Set(['fe']));
    expect([states.get('rd'), states.get('co'), states.get('lab')]).toEqual(['mixed', 'mixed', 'unchecked']);
  });

  it('splitTreeHighlight 不分大小寫、標出所有出現的位置', () => {
    expect(splitTreeHighlight('Blue berry blue', 'BLUE')).toEqual([
      { text: 'Blue', hit: true },
      { text: ' berry ', hit: false },
      { text: 'blue', hit: true },
    ]);
    expect(splitTreeHighlight('abc', '  ')).toEqual([{ text: 'abc', hit: false }]);
  });
});
