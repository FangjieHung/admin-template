import { describe, it, expect } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ListViewController, sameListViewState } from './list-view-controller';
import { LocalStorageSavedViewRepository } from './local-storage-saved-view.repository';
import { ListViewState, SavedView, SavedViewRepository, SavedViewsLabels } from './saved-view.types';
import { SavedViewsComponent } from './saved-views.component';

/** 簡單的記憶體 Storage；可以讓 getItem／setItem 丟錯，模擬隱私模式或空間已滿。 */
class FakeStorage implements Storage {
  data = new Map<string, string>();
  failGet = false;
  failSet = false;
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    if (this.failGet) throw new DOMException('denied', 'SecurityError');
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failSet) throw new DOMException('full', 'QuotaExceededError');
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const DEFAULTS: ListViewState = { sort: null, filters: [], columns: null, pageSize: 25 };

function makeController(repo: SavedViewRepository) {
  let n = 0;
  return new ListViewController({
    listId: 'items',
    defaults: DEFAULTS,
    repository: repo,
    now: () => new Date('2026-10-13T01:00:00Z'),
    newId: () => `v${++n}`,
  });
}

describe('LocalStorageSavedViewRepository', () => {
  it('存取以「前綴.使用者.清單」為 key，不同使用者互不影響', async () => {
    const storage = new FakeStorage();
    let user = 'u1';
    const repo = new LocalStorageSavedViewRepository({ userId: () => user, storage: () => storage });
    const view: SavedView = {
      id: 'a',
      listId: 'items',
      name: '今天待交車',
      state: DEFAULTS,
      createdAt: '',
      updatedAt: '',
      visibility: 'private',
      sharedWith: [],
    };
    expect(await repo.save(view)).toEqual({ persisted: true });
    expect([...storage.data.keys()]).toEqual(['app.savedViews.u1.items']);
    user = 'u2';
    expect(await repo.list('items')).toEqual([]);
    user = 'u1';
    expect((await repo.list('items')).map((v) => v.name)).toEqual(['今天待交車']);
  });

  it('讀取丟錯、內容壞掉、格式不對：當作沒有檢視（不丟錯），合格的項目照樣讀回', async () => {
    const storage = new FakeStorage();
    storage.failGet = true;
    expect(await new LocalStorageSavedViewRepository({ userId: () => 'u', storage: () => storage }).list('x')).toEqual([]);

    const broken = new FakeStorage();
    broken.data.set('app.savedViews.u.x', '{not json');
    expect(await new LocalStorageSavedViewRepository({ userId: () => 'u', storage: () => broken }).list('x')).toEqual([]);

    const mixed = new FakeStorage();
    mixed.data.set(
      'app.savedViews.u.x',
      JSON.stringify([{ id: 'ok', name: 'A', state: DEFAULTS }, { id: 1, name: 'bad' }, 'junk', { id: 'nostate', name: 'B' }]),
    );
    const views = await new LocalStorageSavedViewRepository({ userId: () => 'u', storage: () => mixed }).list('x');
    expect(views.map((v) => v.id)).toEqual(['ok']);
    expect(views[0]).toMatchObject({ visibility: 'private', sharedWith: [], listId: 'x' });
  });

  it('寫入丟錯或拿不到 storage：回傳 persisted:false，但這次開著的頁面仍讀得到（記憶體）', async () => {
    const storage = new FakeStorage();
    storage.failSet = true;
    const repo = new LocalStorageSavedViewRepository({ userId: () => 'u', storage: () => storage });
    const view: SavedView = {
      id: 'a',
      listId: 'x',
      name: 'A',
      state: DEFAULTS,
      createdAt: '',
      updatedAt: '',
      visibility: 'private',
      sharedWith: [],
    };
    expect(await repo.save(view)).toEqual({ persisted: false });
    expect((await repo.list('x')).map((v) => v.id)).toEqual(['a']);

    const noStorage = new LocalStorageSavedViewRepository({
      userId: () => 'u',
      storage: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    expect(await noStorage.save(view)).toEqual({ persisted: false });
    expect(await noStorage.remove('x', 'a')).toEqual({ persisted: false });
  });
});

describe('ListViewController', () => {
  it('另存新檢視：切過去、「已修改」消失；帶保留欄位 visibility／sharedWith', async () => {
    const repo = new LocalStorageSavedViewRepository({ userId: () => 'u', storage: () => new FakeStorage() });
    const ctrl = makeController(repo);
    await ctrl.load();
    expect(ctrl.modified()).toBe(false);
    ctrl.sort.set({ key: 'due', direction: 'asc' });
    ctrl.setFilters([{ field: 'status', type: 'select', value: 'open' }]);
    expect(ctrl.modified()).toBe(true);
    const view = await ctrl.saveAs('  今天待交車 ');
    expect(view).toMatchObject({ id: 'v1', name: '今天待交車', visibility: 'private', sharedWith: [] });
    expect(ctrl.selectedId()).toBe('v1');
    expect(ctrl.modified()).toBe(false);
    expect((await repo.list('items')).map((v) => v.name)).toEqual(['今天待交車']);
  });

  it('切換檢視會套用它的設定並回到第一頁；切回預設檢視還原預設', async () => {
    const ctrl = makeController(new LocalStorageSavedViewRepository({ userId: () => 'u', storage: () => new FakeStorage() }));
    ctrl.pageSize.set(100);
    ctrl.columns.set({ order: ['b', 'a'], hidden: ['c'] });
    await ctrl.saveAs('寬表');
    ctrl.select(null);
    expect(ctrl.state()).toEqual(DEFAULTS);
    ctrl.page.set(3);
    ctrl.select('v1');
    expect(ctrl.pageSize()).toBe(100);
    expect(ctrl.columns()).toEqual({ order: ['b', 'a'], hidden: ['c'] });
    expect(ctrl.page()).toBe(0);
  });

  it('改動後「已修改」；儲存覆寫目前檢視；還原丟掉改動', async () => {
    const ctrl = makeController(new LocalStorageSavedViewRepository({ userId: () => 'u', storage: () => new FakeStorage() }));
    await ctrl.saveAs('A');
    ctrl.pageSize.set(50);
    expect(ctrl.modified()).toBe(true);
    ctrl.discardChanges();
    expect(ctrl.pageSize()).toBe(25);
    expect(ctrl.modified()).toBe(false);
    ctrl.pageSize.set(50);
    await ctrl.saveCurrent();
    expect(ctrl.modified()).toBe(false);
    expect(ctrl.selectedView()?.state.pageSize).toBe(50);
  });

  it('「已修改」不受篩選條件先後順序影響', () => {
    const a: ListViewState = {
      ...DEFAULTS,
      filters: [
        { field: 'x', type: 'text', text: '1' },
        { field: 'y', type: 'select', value: '2' },
      ],
    };
    const b: ListViewState = { ...DEFAULTS, filters: [...a.filters].reverse() };
    expect(sameListViewState(a, b)).toBe(true);
    expect(sameListViewState(a, { ...a, pageSize: 50 })).toBe(false);
  });

  it('重新命名、刪除；刪掉目前的檢視會回到預設檢視', async () => {
    const repo = new LocalStorageSavedViewRepository({ userId: () => 'u', storage: () => new FakeStorage() });
    const ctrl = makeController(repo);
    await ctrl.saveAs('A');
    ctrl.pageSize.set(100);
    await ctrl.saveAs('B');
    await ctrl.rename('v1', 'A2');
    expect(ctrl.views().map((v) => v.name)).toEqual(['A2', 'B']);
    expect(ctrl.isNameTaken('B')).toBe(true);
    expect(ctrl.isNameTaken('B', 'v2')).toBe(false);
    await ctrl.remove('v2');
    expect(ctrl.selectedId()).toBeNull();
    expect(ctrl.pageSize()).toBe(25);
    expect((await repo.list('items')).map((v) => v.name)).toEqual(['A2']);
  });

  it('存不進去時標示 persistFailed，檢視仍可用；讀取失敗時當作沒有檢視', async () => {
    const storage = new FakeStorage();
    storage.failSet = true;
    const ctrl = makeController(new LocalStorageSavedViewRepository({ userId: () => 'u', storage: () => storage }));
    await ctrl.saveAs('A');
    expect(ctrl.persistFailed()).toBe(true);
    expect(ctrl.views()).toHaveLength(1);

    const failing: SavedViewRepository = {
      list: () => Promise.reject(new Error('offline')),
      save: () => Promise.reject(new Error('offline')),
      remove: () => Promise.reject(new Error('offline')),
    };
    const ctrl2 = makeController(failing);
    await ctrl2.load();
    expect(ctrl2.views()).toEqual([]);
    await ctrl2.saveAs('X');
    expect(ctrl2.persistFailed()).toBe(true);
  });
});

const LABELS: SavedViewsLabels = {
  trigger: '檢視：{name}',
  title: '檢視',
  defaultView: '預設檢視',
  modified: '已修改',
  save: '儲存檢視',
  saveAs: '另存新檢視',
  discard: '還原',
  rename: '重新命名',
  remove: '刪除檢視',
  name: '檢視名稱',
  confirm: '儲存',
  cancel: '取消',
  close: '關閉',
  removeConfirm: '確定刪除「{name}」？',
  removeAction: '刪除',
  nameRequired: '請輸入名稱',
  nameTaken: '已有同名的檢視',
  notPersisted: '無法存到這台裝置，關閉頁面後會遺失',
};

@Component({
  imports: [SavedViewsComponent],
  template: `<lib-saved-views [controller]="ctrl" [labels]="labels" />`,
})
class HostComponent {
  readonly labels = LABELS;
  readonly ctrl = makeController(new LocalStorageSavedViewRepository({ userId: () => 'u', storage: () => new FakeStorage() }));
}

describe('SavedViewsComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const ctrl = fixture.componentInstance.ctrl;
    const settle = async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const panel = () => document.querySelector('.sv-panel') as HTMLElement | null;
    const open = () => {
      (el.querySelector('.sv-trigger') as HTMLButtonElement).click();
      fixture.detectChanges();
    };
    const button = (cls: string) => panel()!.querySelector(`.${cls}`) as HTMLButtonElement;
    const typeName = (name: string) => {
      const input = panel()!.querySelector('input') as HTMLInputElement;
      input.value = name;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, el, ctrl, settle, panel, open, button, typeName };
  }

  it('預設顯示「預設檢視」；狀態改動後出現「已修改」', () => {
    const { fixture, el, ctrl } = setup();
    expect(el.querySelector('.sv-trigger')?.getAttribute('aria-label')).toBe('檢視：預設檢視');
    expect(el.querySelector('.sv-modified')).toBeNull();
    ctrl.pageSize.set(50);
    fixture.detectChanges();
    expect(el.querySelector('.sv-modified')?.textContent?.trim()).toBe('已修改');
  });

  it('另存新檢視：空白名稱與重複名稱擋下並提示，送出後切到新檢視', async () => {
    const { el, ctrl, settle, panel, open, button, typeName, fixture } = setup();
    open();
    button('sv-save-as').click();
    fixture.detectChanges();
    button('sv-submit').click();
    await settle();
    expect(panel()!.querySelector('.sv-error')?.textContent).toContain('請輸入名稱');
    expect(panel()!.querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
    typeName('今天待交車');
    button('sv-submit').click();
    await settle();
    expect(ctrl.views().map((v) => v.name)).toEqual(['今天待交車']);
    expect(el.querySelector('.sv-trigger')?.getAttribute('aria-label')).toBe('檢視：今天待交車');
    expect(panel()).toBeNull();

    open();
    button('sv-save-as').click();
    fixture.detectChanges();
    typeName('今天待交車');
    button('sv-submit').click();
    await settle();
    expect(panel()!.querySelector('.sv-error')?.textContent).toContain('已有同名的檢視');
    expect(ctrl.views()).toHaveLength(1);
  });

  it('清單切換檢視（aria-current 標示目前的）', async () => {
    const { ctrl, settle, panel, open, fixture } = setup();
    await ctrl.saveAs('A');
    ctrl.select(null);
    await settle();
    open();
    const options = [...panel()!.querySelectorAll('.sv-option')] as HTMLButtonElement[];
    expect(options.map((o) => o.textContent?.trim().replace(/^✓\s*/, ''))).toEqual(['預設檢視', 'A']);
    expect(options[0].getAttribute('aria-current')).toBe('true');
    options[1].click();
    fixture.detectChanges();
    expect(ctrl.selectedId()).toBe('v1');
  });

  it('重新命名與刪除（刪除要再確認）', async () => {
    const { ctrl, settle, panel, open, button, typeName, fixture } = setup();
    await ctrl.saveAs('A');
    await settle();
    open();
    button('sv-rename').click();
    fixture.detectChanges();
    expect((panel()!.querySelector('input') as HTMLInputElement).value).toBe('A');
    typeName('A 改');
    button('sv-submit').click();
    await settle();
    expect(ctrl.views()[0].name).toBe('A 改');

    open();
    button('sv-remove').click();
    fixture.detectChanges();
    expect(panel()!.querySelector('.sv-confirm')?.textContent).toContain('確定刪除「A 改」？');
    button('sv-remove-confirm').click();
    await settle();
    expect(ctrl.views()).toEqual([]);
    expect(ctrl.selectedId()).toBeNull();
  });

  it('子畫面按 Esc 先回清單，再按一次才關閉', () => {
    const { panel, open, button, fixture } = setup();
    open();
    button('sv-save-as').click();
    fixture.detectChanges();
    const esc = () => {
      panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
    };
    esc();
    expect(panel()?.querySelector('.sv-list')).not.toBeNull();
    esc();
    expect(panel()).toBeNull();
  });
});
