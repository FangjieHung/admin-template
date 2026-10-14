import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommandPaletteComponent } from './command-palette.component';
import { COMMAND_PALETTE_LABELS, CommandPaletteLabels } from './command-palette-labels';
import { commandMatchSegments, filterCommands, matchCommand } from './command-match';
import {
  CommandHistory,
  CommandItem,
  CommandProvider,
  createLocalStorageCommandHistory,
  createMemoryCommandHistory,
  createStaticCommandProvider,
} from './command-palette.types';

const LABELS: CommandPaletteLabels = {
  input: '搜尋頁面、資料或動作',
  placeholder: '搜尋…',
  subPlaceholder: '在「{title}」中搜尋…',
  results: '搜尋結果',
  recent: '最近使用',
  loading: '搜尋中…',
  groupError: '{group}暫時無法搜尋',
  noResults: '找不到「{query}」',
  noResultsHint: '換個關鍵字試試',
  resultCount: '{count} 個結果',
  current: '目前使用中',
  hasChildren: '有子選項',
  back: '返回上一層（{title}）',
  close: '取消',
  hintNavigate: '選擇',
  hintRun: '執行',
  hintClose: '關閉',
  hintBack: '返回',
};

describe('matchCommand／filterCommands（比對與排序）', () => {
  const items = [
    { title: '工單列表', subtitle: '頁面樣板' },
    { title: 'Ticket List', keywords: ['tickets'] },
    { title: '新增工單' },
    { title: 'Material 元件總覽', keywords: ['kitchen sink'] },
    { title: '資料表', subtitle: 'data-table' },
    { title: 'Settings', subtitle: '設定' },
  ];

  it('開頭 > 字首 > 包含 > 依序出現；不分大小寫', () => {
    const list = [{ title: 'Notable' }, { title: 'Data table' }, { title: 'Tablet' }, { title: 'Tab label' }, { title: 'TaBLe' }];
    // 整段相同（TaBLe）> 開頭（Tablet）> 字首（Data table）> 包含（Notable）> t-a-b-l-e 依序出現（Tab label）。
    expect(filterCommands('table', list).map((i) => i.title)).toEqual(['TaBLe', 'Tablet', 'Data table', 'Notable', 'Tab label']);
    expect(filterCommands('tbl', [{ title: 'Ticket board list' }, { title: 'Notes' }]).map((i) => i.title)).toEqual(['Ticket board list']);
  });

  it('中文直接比對子字串；標題比說明重要，說明比關鍵字重要', () => {
    expect(filterCommands('工單', items).map((i) => i.title)).toEqual(['工單列表', '新增工單']);
    expect(filterCommands('sink', items).map((i) => i.title)).toEqual(['Material 元件總覽']);
    const ranked = filterCommands('設定', [{ title: 'Settings', subtitle: '設定' }, { title: '設定頁' }]);
    expect(ranked.map((i) => i.title)).toEqual(['設定頁', 'Settings']);
  });

  it('有空白時每個詞都要對到；標記範圍合併並分在標題與說明', () => {
    expect(filterCommands('ticket list', items).map((i) => i.title)).toEqual(['Ticket List']);
    expect(filterCommands('ticket 設定', items)).toEqual([]);
    const match = matchCommand('工單 樣板', items[0])!;
    expect(match.title).toEqual([[0, 2]]);
    expect(match.subtitle).toEqual([[2, 4]]);
    expect(commandMatchSegments('工單列表', match.title)).toEqual([
      { text: '工單', match: true },
      { text: '列表', match: false },
    ]);
    expect(matchCommand('xyz', items[0])).toBeNull();
  });

  it('同分時標題短的在前；空查詢原樣回傳（限筆數）', () => {
    expect(filterCommands('', items, 2)).toEqual(items.slice(0, 2));
    expect(filterCommands('set', [{ title: 'Settings page' }, { title: 'Settings' }]).map((i) => i.title)).toEqual([
      'Settings',
      'Settings page',
    ]);
  });
});

describe('最近使用的儲存', () => {
  afterEach(() => localStorage.clear());

  it('localStorage：壞掉的內容當作沒有紀錄，不丟錯', () => {
    localStorage.setItem('k', '{not json');
    const history = createLocalStorageCommandHistory('k');
    expect(history.read()).toEqual([]);
    history.write([{ providerId: 'p', id: '1', title: 'A', kind: 'page' }]);
    expect(history.read()).toEqual([{ providerId: 'p', id: '1', title: 'A', kind: 'page' }]);
    localStorage.setItem('k', JSON.stringify([{ id: 1 }, { providerId: 'p', id: '2', title: 'B', kind: 'record' }]));
    expect(history.read().map((r) => r.id)).toEqual(['2']);
  });
});

@Component({
  imports: [CommandPaletteComponent],
  template: `<lib-command-palette
    [providers]="providers()"
    [history]="history"
    [mode]="mode()"
    [(query)]="query"
    (selected)="selectedLog.push($event.id)"
    (closed)="closedCount = closedCount + 1"
  />`,
})
class HostComponent {
  readonly providers = signal<readonly CommandProvider[]>([]);
  readonly mode = signal<'dialog' | 'inline'>('inline');
  readonly query = signal('');
  history: CommandHistory = createMemoryCommandHistory();
  selectedLog: string[] = [];
  closedCount = 0;
}

function page(id: string, title: string, extra: Partial<CommandItem> = {}): CommandItem {
  return { id, title, kind: 'page', run: vi.fn(), ...extra };
}

describe('CommandPaletteComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;
  let input: HTMLInputElement;

  const pages = [page('home', '首頁'), page('tickets', '工單列表'), page('new', '新增工單'), page('table', '資料表'), page('settings', '設定')];
  const pagesProvider = createStaticCommandProvider({ id: 'pages', label: '頁面', items: () => pages });

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [{ provide: COMMAND_PALETTE_LABELS, useValue: LABELS }] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(providers: readonly CommandProvider[], configure?: (h: HostComponent) => void): void {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    host.providers.set(providers);
    configure?.(host);
    fixture.detectChanges();
    el = fixture.nativeElement;
    input = el.querySelector('input')!;
  }

  async function settle(ms = 0): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  }

  function type(text: string): void {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function key(k: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
    input.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  const options = () => Array.from(el.querySelectorAll<HTMLElement>('[lib-command-option]'));
  const titles = () => options().map((o) => o.querySelector('.co-title')!.textContent!.trim());
  const groupLabels = () => Array.from(el.querySelectorAll('.cmdk-group__heading')).map((h) => h.textContent!.trim());
  const active = () => el.querySelector<HTMLElement>('[lib-command-option].is-active');

  it('沒有提供畫面文字時丟出明確錯誤；少一句時列出缺的名稱', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    expect(() => TestBed.createComponent(HostComponent).detectChanges()).toThrow(/COMMAND_PALETTE_LABELS/);
    TestBed.resetTestingModule();
    const { hintBack: _drop, ...partial } = LABELS;
    TestBed.configureTestingModule({ providers: [{ provide: COMMAND_PALETTE_LABELS, useValue: partial }] });
    expect(() => TestBed.createComponent(HostComponent).detectChanges()).toThrow(/「hintBack」/);
  });

  it('combobox／listbox／group／option 的角色與關係；輸入時同步來源立刻顯示，並標記比對到的字', () => {
    setup([pagesProvider]);
    expect(input.getAttribute('role')).toBe('combobox');
    const list = el.querySelector('[role="listbox"]')!;
    expect(input.getAttribute('aria-controls')).toBe(list.id);
    type('工單');
    expect(titles()).toEqual(['工單列表', '新增工單']);
    const group = el.querySelector('[role="group"]')!;
    expect(el.querySelector(`#${group.getAttribute('aria-labelledby')}`)?.textContent?.trim()).toBe('頁面');
    expect(options()[0].getAttribute('role')).toBe('option');
    expect(Array.from(options()[1].querySelectorAll('mark')).map((m) => m.textContent)).toEqual(['工單']);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[0].id);
    expect(options()[0].getAttribute('aria-selected')).toBe('true');
  });

  it('上下鍵移動並頭尾相接，Home／End 到頭尾；aria-activedescendant 跟著換', () => {
    setup([pagesProvider]);
    type('工');
    expect(titles()).toEqual(['工單列表', '新增工單']);
    key('ArrowDown');
    expect(active()?.textContent).toContain('新增工單');
    expect(input.getAttribute('aria-activedescendant')).toBe(active()!.id);
    key('ArrowDown');
    expect(active()?.textContent).toContain('工單列表');
    key('ArrowUp');
    expect(active()?.textContent).toContain('新增工單');
    key('Home');
    expect(active()?.textContent).toContain('工單列表');
    key('End');
    expect(active()?.textContent).toContain('新增工單');
  });

  it('滑鼠移動換目前那一列；點一下執行', () => {
    setup([pagesProvider]);
    type('工');
    options()[1].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    fixture.detectChanges();
    expect(active()?.textContent).toContain('新增工單');
    options()[1].click();
    expect(host.selectedLog).toEqual(['new']);
    expect(pages[2].run).toHaveBeenCalledTimes(1);
  });

  it('Enter 執行目前那一列（先送出 selected），並記進最近使用；空白查詢列出最近使用（最多 5 筆）與建議', async () => {
    const suggest = { ...createStaticCommandProvider({ id: 'acts', label: '動作', items: () => [], suggestions: () => [page('a1', '新增聯絡人', { kind: 'action' })] }) };
    setup([pagesProvider, suggest]);
    expect(groupLabels()).toEqual(['動作']);
    for (const q of ['首頁', '工單列表', '新增', '資料', '設定', '首頁']) {
      type(q);
      key('Enter');
    }
    expect(host.selectedLog).toEqual(['home', 'tickets', 'new', 'table', 'settings', 'home']);
    expect(host.history.read().map((r) => r.id)).toEqual(['home', 'settings', 'table', 'new', 'tickets']);
    type('');
    await settle();
    expect(groupLabels()).toEqual(['最近使用', '動作']);
    expect(titles()).toEqual(['首頁', '設定', '資料表', '新增工單', '工單列表', '新增聯絡人']);
  });

  it('中文輸入法選字中的 Enter 不執行', () => {
    setup([pagesProvider]);
    type('工');
    key('Enter', { isComposing: true });
    expect(host.selectedLog).toEqual([]);
  });

  it('Esc：先清空查詢，再按一次送出 closed；沒有結果時顯示「找不到」並帶出查詢', () => {
    setup([pagesProvider]);
    type('zzz');
    expect(el.querySelector('lib-empty-state')?.textContent).toContain('找不到「zzz」');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    key('Escape');
    expect(host.query()).toBe('');
    expect(host.closedCount).toBe(0);
    key('Escape');
    expect(host.closedCount).toBe(1);
  });

  it('mode="dialog" 時 Tab 留在面板、有「取消」鈕（觸控與窄螢幕才顯示）；inline 時照常離開、沒有取消鈕', () => {
    setup([pagesProvider], (h) => h.mode.set('dialog'));
    expect(key('Tab').defaultPrevented).toBe(true);
    const close = el.querySelector<HTMLButtonElement>('.cmdk-close')!;
    expect(close.textContent).toBe('取消');
    close.click();
    expect(host.closedCount).toBe(1);
    host.mode.set('inline');
    fixture.detectChanges();
    expect(key('Tab').defaultPrevented).toBe(false);
    expect(el.querySelector('.cmdk-close')).toBeNull();
  });

  it('非同步來源：停手 150ms 才搜尋、換字時取消上一次；等待時這一組顯示載入列', async () => {
    const calls: { query: string; signal: AbortSignal; resolve: (items: CommandItem[]) => void }[] = [];
    const records: CommandProvider = {
      id: 'records',
      label: '工單',
      async: true,
      search: (query, signal) => new Promise((resolve) => calls.push({ query, signal, resolve })),
    };
    setup([pagesProvider, records]);
    type('工');
    type('工單');
    expect(groupLabels()).toEqual(['頁面', '工單']);
    expect(el.querySelector('[data-group="records"] .cmdk-status')?.textContent).toContain('搜尋中');
    await settle(100);
    expect(calls).toHaveLength(0);
    await settle(60);
    expect(calls.map((c) => c.query)).toEqual(['工單']);
    type('工單 1');
    expect(calls[0].signal.aborted).toBe(true);
    calls[0].resolve([page('stale', '舊結果', { kind: 'record' })]);
    await settle(150);
    expect(calls.map((c) => c.query)).toEqual(['工單', '工單 1']);
    calls[1].resolve([page('TK-1', '印表機卡紙', { kind: 'record', subtitle: 'TK-1' })]);
    await settle();
    expect(titles()).toEqual(['印表機卡紙']);
    expect(el.querySelector('.cmdk-status')).toBeNull();
  });

  it('某一組失敗只在那一組顯示錯誤，其他組照常；minQueryLength 不到不搜尋', async () => {
    const failing: CommandProvider = {
      id: 'broken',
      label: '專案',
      async: true,
      search: () => Promise.reject(new Error('boom')),
    };
    const picky: CommandProvider = { id: 'picky', label: '聯絡人', minQueryLength: 3, search: vi.fn(() => []) };
    setup([pagesProvider, failing, picky]);
    type('工單');
    await settle(200);
    expect(titles()).toEqual(['工單列表', '新增工單']);
    expect(el.querySelector('[data-group="broken"] .cmdk-status--error')?.textContent).toContain('專案暫時無法搜尋');
    expect(picky.search).not.toHaveBeenCalled();
    expect(el.querySelector('lib-empty-state')).toBeNull();
  });

  it('兩段式動作：Enter 打開子清單（麵包屑、提示字），子清單可篩選；空白時 Backspace 回上一層', async () => {
    const pick = vi.fn();
    const actions = createStaticCommandProvider({
      id: 'acts',
      label: '動作',
      items: () => [
        {
          id: 'texture',
          title: '切換質地',
          kind: 'action',
          children: () => [
            { id: 'material', title: 'Material', kind: 'action', run: () => pick('material') },
            { id: 'brutal', title: 'Brutal 新粗野', kind: 'action', current: true, run: () => pick('brutal') },
          ],
        },
      ],
    });
    setup([actions]);
    const scrolled: Element[] = [];
    // jsdom 沒有 scrollIntoView：記下被捲進畫面的是哪一列。
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
    type('質地');
    expect(options()[0].textContent).toContain('有子選項');
    key('Enter');
    await settle();
    expect(scrolled.at(-1)?.textContent).toContain('Brutal');
    delete (Element.prototype as Partial<Element>).scrollIntoView;
    expect(el.querySelector('.cmdk-crumb')?.textContent).toContain('切換質地');
    expect(input.placeholder).toBe('在「切換質地」中搜尋…');
    expect(titles()).toEqual(['Material', 'Brutal 新粗野']);
    expect(options()[1].textContent).toContain('目前使用中');
    // 子清單一打開停在目前使用中的那一項。
    expect(active()?.textContent).toContain('Brutal');
    expect(host.selectedLog).toEqual([]);
    type('bru');
    expect(titles()).toEqual(['Brutal 新粗野']);
    key('Backspace');
    expect(el.querySelector('.cmdk-crumb')).not.toBeNull();
    type('');
    key('Backspace');
    expect(el.querySelector('.cmdk-crumb')).toBeNull();
    // 再進去一次，Enter 執行子項目。
    type('質地');
    key('Enter');
    await settle();
    key('ArrowUp');
    key('Enter');
    expect(pick).toHaveBeenCalledWith('material');
    expect(host.selectedLog).toEqual(['material']);
  });

  it('Esc 在子清單裡：有字先清空，空白時回上一層，在最上層才送出 closed', async () => {
    const actions = createStaticCommandProvider({
      id: 'acts',
      label: '動作',
      items: () => [{ id: 'x', title: '切換配色', kind: 'action', children: async () => [page('c1', 'Verdant 綠')] }],
    });
    setup([actions]);
    type('配色');
    key('Enter');
    await settle();
    expect(titles()).toEqual(['Verdant 綠']);
    type('v');
    key('Escape');
    expect(host.query()).toBe('');
    expect(el.querySelector('.cmdk-crumb')).not.toBeNull();
    key('Escape');
    expect(el.querySelector('.cmdk-crumb')).toBeNull();
    key('Escape');
    expect(host.closedCount).toBe(1);
  });
});
