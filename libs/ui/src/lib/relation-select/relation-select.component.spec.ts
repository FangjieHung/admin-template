import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { OverlayContainer } from '@angular/cdk/overlay';
import { RELATION_SELECT_DEBOUNCE, RELATION_SELECT_LOADING_DELAY, RelationSelectComponent } from './relation-select.component';
import { RELATION_SELECT_LABELS, RelationSelectLabels } from './relation-select-labels';
import { RelationPage, RelationSource, createArraySource, highlightSegments } from './relation-source';

interface Person {
  id: string;
  name: string;
  email: string;
}

const LABELS: RelationSelectLabels = {
  loading: '載入中',
  empty: '沒有可選擇的項目',
  noResults: '找不到符合「{query}」的項目',
  hasMore: '還有更多，請輸入更多字縮小範圍',
  create: '建立「{query}」',
  searchFailed: '搜尋失敗',
  retry: '重試',
  clear: '清除',
  resolveFailed: '找不到這筆資料（{id}）',
};

const PEOPLE: Person[] = [
  { id: 'u1', name: '王小明', email: 'ming@example.com' },
  { id: 'u2', name: '陳大同', email: 'datong@example.com' },
  { id: 'u3', name: 'Alice Wang', email: 'alice@example.com' },
  { id: 'u4', name: '林美惠', email: 'meihui@example.com' },
];

interface Call {
  query: string;
  signal: AbortSignal;
  resolve: (page: RelationPage<Person>) => void;
  reject: (error: unknown) => void;
}

/** 搜尋與 getById 都由測試決定何時回應。 */
class ControlledSource implements RelationSource<Person> {
  readonly calls: Call[] = [];
  readonly byId: { id: string; resolve: (p: Person | null) => void; reject: (e: unknown) => void }[] = [];
  idOf = (p: Person) => p.id;
  search(query: string, signal: AbortSignal): Promise<RelationPage<Person>> {
    return new Promise((resolve, reject) => this.calls.push({ query, signal, resolve, reject }));
  }
  getById(id: string): Promise<Person | null> {
    return new Promise((resolve, reject) => this.byId.push({ id, resolve, reject }));
  }
  last(): Call {
    return this.calls[this.calls.length - 1];
  }
}

@Component({
  imports: [RelationSelectComponent],
  template: `
    <lib-relation-select
      label="負責人"
      hint="輸入姓名或 email"
      [source]="source"
      [displayWith]="name"
      [secondaryWith]="email"
      [avatarWith]="initials"
      [allowCreate]="allowCreate()"
      [maxResults]="max()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [(value)]="value"
      (createRequested)="created.push($event)"
      (selectionChange)="changes.push($event)"
    />
  `,
})
class HostComponent {
  source: RelationSource<Person> = new ControlledSource();
  readonly value = signal<string | null>(null);
  readonly allowCreate = signal(false);
  readonly max = signal(20);
  readonly disabled = signal(false);
  readonly readonly = signal(false);
  readonly created: string[] = [];
  readonly changes: (Person | null)[] = [];
  readonly name = (p: Person) => p.name;
  readonly email = (p: Person) => p.email;
  readonly initials = (p: Person) => p.name.slice(-2);
}

@Component({
  imports: [RelationSelectComponent, ReactiveFormsModule],
  template: `
    <lib-relation-select
      label="負責人"
      errorMessage="請選擇負責人"
      [source]="source"
      [displayWith]="name"
      [formControl]="control"
    />
  `,
})
class FormHostComponent {
  readonly source = createArraySource(PEOPLE, { idOf: (p) => p.id, textOf: (p) => p.name, secondaryOf: (p) => p.email });
  readonly control = new FormControl<string | null>(null, Validators.required);
  readonly name = (p: Person) => p.name;
}

describe('createArraySource', () => {
  const source = createArraySource(PEOPLE, { idOf: (p) => p.id, textOf: (p) => p.name, secondaryOf: (p) => p.email, limit: 2 });
  const signal = new AbortController().signal;

  it('不分大小寫，比對主文字與第二行；回傳前 limit 筆與 hasMore', async () => {
    expect((await source.search('ALICE', signal)).items.map((p) => p.id)).toEqual(['u3']);
    expect((await source.search('datong', signal)).items.map((p) => p.id)).toEqual(['u2']);
    const all = await source.search('  ', signal);
    expect(all.items.map((p) => p.id)).toEqual(['u1', 'u2']);
    expect(all.hasMore).toBe(true);
    expect((await source.search('example', signal)).hasMore).toBe(true);
    expect((await source.search('美惠', signal)).hasMore).toBe(false);
  });

  it('getById 找得到回傳那一筆、找不到回 null；已 abort 的 signal 丟 AbortError', async () => {
    expect(await source.getById('u4')).toBe(PEOPLE[3]);
    expect(await source.getById('nope')).toBeNull();
    const abort = new AbortController();
    abort.abort();
    await expect(source.search('a', abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('items 給函式時每次搜尋讀最新的清單', async () => {
    const list = [...PEOPLE];
    const live = createArraySource(() => list, { idOf: (p) => p.id, textOf: (p) => p.name });
    list.push({ id: 'u9', name: '新聯絡人', email: '' });
    expect((await live.search('新聯絡', signal)).items.map((p) => p.id)).toEqual(['u9']);
    expect(await live.getById('u9')).toBe(list[4]);
  });
});

describe('highlightSegments', () => {
  it('不分大小寫切出所有比對到的片段', () => {
    expect(highlightSegments('Alice Wang alice', 'ALI')).toEqual([
      { text: 'Ali', match: true },
      { text: 'ce Wang ', match: false },
      { text: 'ali', match: true },
      { text: 'ce', match: false },
    ]);
    expect(highlightSegments('王小明', '')).toEqual([{ text: '王小明', match: false }]);
    expect(highlightSegments('王小明', '張')).toEqual([{ text: '王小明', match: false }]);
  });
});

describe('RelationSelectComponent', () => {
  let overlay: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [{ provide: RELATION_SELECT_LABELS, useValue: LABELS }] });
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
  });

  afterEach(() => {
    overlay.innerHTML = '';
    vi.useRealTimers();
  });

  function setup(configure?: (host: HostComponent) => void) {
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    configure?.(host);
    fixture.detectChanges();
    const source = host.source as ControlledSource;
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    return { fixture, host, source, input };
  }

  async function settle(fixture: ComponentFixture<unknown>, ms = 0): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  }

  function type(input: HTMLInputElement, text: string): void {
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }

  function options(): HTMLElement[] {
    return Array.from(overlay.querySelectorAll<HTMLElement>('mat-option'));
  }

  function optionTexts(): string[] {
    return options().map((o) => o.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  it('聚焦時立刻搜一次空字串，結果出現在清單（主文字、第二行、圓章）', async () => {
    const { fixture, source, input } = setup();
    input.focus();
    await settle(fixture);
    expect(source.calls.map((c) => c.query)).toEqual(['']);
    source.last().resolve({ items: PEOPLE.slice(0, 2), hasMore: false });
    await settle(fixture);
    expect(options()).toHaveLength(2);
    expect(options()[0].querySelector('.rs-avatar')?.textContent?.trim()).toBe('小明');
    expect(options()[0].querySelector('.rs-option__secondary')?.textContent?.trim()).toBe('ming@example.com');
  });

  it('輸入後停 250ms 才搜；連續輸入只搜最後的字', async () => {
    const { fixture, source, input } = setup();
    input.focus();
    await settle(fixture);
    source.last().resolve({ items: [], hasMore: false });
    await settle(fixture);
    type(input, '王');
    await settle(fixture, 100);
    type(input, '王小');
    await settle(fixture, RELATION_SELECT_DEBOUNCE - 1);
    expect(source.calls.map((c) => c.query)).toEqual(['']);
    await settle(fixture, 1);
    expect(source.calls.map((c) => c.query)).toEqual(['', '王小']);
  });

  it('新搜尋會 abort 舊的；晚到的舊回應不會蓋掉新結果', async () => {
    const { fixture, source, input } = setup();
    input.focus();
    await settle(fixture);
    const first = source.last();
    type(input, '陳');
    await settle(fixture, RELATION_SELECT_DEBOUNCE);
    const second = source.last();
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
    second.resolve({ items: [PEOPLE[1]], hasMore: false });
    await settle(fixture);
    first.resolve({ items: PEOPLE, hasMore: false });
    await settle(fixture);
    expect(optionTexts()).toHaveLength(1);
    expect(overlay.querySelector('.rs-option__primary')?.textContent?.trim()).toBe('陳大同');
  });

  it('比對到的字用 <mark> 加粗（不拼 innerHTML）', async () => {
    const { fixture, source, input } = setup();
    input.focus();
    type(input, 'ali');
    await settle(fixture, RELATION_SELECT_DEBOUNCE);
    source.last().resolve({ items: [PEOPLE[2]], hasMore: false });
    await settle(fixture);
    const marks = Array.from(options()[0].querySelectorAll('mark.rs-match')).map((m) => m.textContent);
    expect(marks).toEqual(['Ali', 'ali']);
  });

  it('超過 150ms 才顯示「載入中」那一行，並寫進 aria-live', async () => {
    const { fixture, input } = setup();
    input.focus();
    await settle(fixture, RELATION_SELECT_LOADING_DELAY - 10);
    expect(overlay.querySelector('[data-state="loading"]')).toBeNull();
    await settle(fixture, 10);
    expect(overlay.querySelector('[data-state="loading"]')?.textContent).toContain('載入中');
    expect(fixture.nativeElement.querySelector('.rs-sr-only')?.textContent?.trim()).toBe('載入中');
  });

  it('選一筆：value 是 id、輸入框是主文字、送出 selectionChange', async () => {
    const { fixture, host, source, input } = setup();
    input.focus();
    await settle(fixture);
    source.last().resolve({ items: PEOPLE, hasMore: false });
    await settle(fixture);
    options()[1].click();
    await settle(fixture);
    expect(host.value()).toBe('u2');
    expect(input.value).toBe('陳大同');
    expect(host.changes).toEqual([PEOPLE[1]]);
  });

  it('打了字沒選就離開：輸入框還原成已選項的文字', async () => {
    const { fixture, host, source, input } = setup();
    input.focus();
    await settle(fixture);
    source.last().resolve({ items: PEOPLE, hasMore: false });
    await settle(fixture);
    options()[0].click();
    await settle(fixture);
    type(input, '半截');
    await settle(fixture, RELATION_SELECT_DEBOUNCE);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    input.blur();
    await settle(fixture);
    expect(input.value).toBe('王小明');
    expect(host.value()).toBe('u1');
  });

  it('沒選過就打字離開：輸入框清空', async () => {
    const { fixture, host, input } = setup();
    input.focus();
    type(input, 'xyz');
    await settle(fixture, RELATION_SELECT_DEBOUNCE);
    input.blur();
    await settle(fixture);
    expect(input.value).toBe('');
    expect(host.value()).toBeNull();
  });

  it('初始帶 id：解析中顯示骨架與唯讀，解析完顯示主文字', async () => {
    const { fixture, source, input } = setup((h) => h.value.set('u4'));
    await settle(fixture);
    expect(source.byId.map((c) => c.id)).toEqual(['u4']);
    expect(fixture.nativeElement.querySelector('.rs-resolving')).not.toBeNull();
    expect(input.readOnly).toBe(true);
    expect(input.getAttribute('aria-busy')).toBe('true');
    source.byId[0].resolve(PEOPLE[3]);
    await settle(fixture);
    expect(fixture.nativeElement.querySelector('.rs-resolving')).toBeNull();
    expect(input.value).toBe('林美惠');
    expect(input.readOnly).toBe(false);
  });

  it('初始 id 查不到或失敗：輸入框顯示 id 本身＋提示，欄位不空白', async () => {
    const { fixture, host, source, input } = setup((h) => h.value.set('u404'));
    await settle(fixture);
    source.byId[0].resolve(null);
    await settle(fixture);
    expect(input.value).toBe('u404');
    expect(fixture.nativeElement.querySelector('.rs-hint--error')?.textContent).toContain('找不到這筆資料（u404）');
    host.value.set('u500');
    await settle(fixture);
    source.byId[1].reject(new Error('500'));
    await settle(fixture);
    expect(input.value).toBe('u500');
  });

  it('startSearch：輸入框換成那段字並立刻搜尋；初始值查完不蓋回去，沒選就離開時還原成已選項', async () => {
    const { fixture, source, input } = setup((h) => h.value.set('u1'));
    await settle(fixture);
    input.focus();
    const select = fixture.debugElement.children[0].componentInstance as RelationSelectComponent<Person>;
    select.startSearch('林');
    await settle(fixture);
    expect(input.value).toBe('林');
    expect(input.readOnly).toBe(false); // 打進來的字可以接著改
    expect(fixture.nativeElement.querySelector('.rs-resolving')).toBeNull();
    expect(source.calls.map((c) => c.query)).toEqual(['林']);
    source.byId[0].resolve(PEOPLE[0]);
    source.last().resolve({ items: [PEOPLE[3]], hasMore: false });
    await settle(fixture);
    expect(input.value).toBe('林');
    expect(optionTexts()).toEqual(['美惠林美惠meihui@example.com']);
    input.blur();
    await settle(fixture);
    expect(input.value).toBe('王小明');
  });

  it('外部改 value：先前的解析作廢，新的 id 重新查', async () => {
    const { fixture, host, source, input } = setup((h) => h.value.set('u1'));
    await settle(fixture);
    host.value.set('u2');
    await settle(fixture);
    source.byId[1].resolve(PEOPLE[1]);
    source.byId[0].resolve(PEOPLE[0]);
    await settle(fixture);
    expect(input.value).toBe('陳大同');
  });

  it('清除鈕：有值才出現，按下 value 變 null 並送出 null', async () => {
    const { fixture, host, source, input } = setup((h) => h.value.set('u1'));
    await settle(fixture);
    expect(fixture.nativeElement.querySelector('.rs-clear')).toBeNull(); // 解析中不給清
    source.byId[0].resolve(PEOPLE[0]);
    await settle(fixture);
    const clear = fixture.nativeElement.querySelector('.rs-clear') as HTMLButtonElement;
    expect(clear.getAttribute('aria-label')).toBe('清除');
    clear.click();
    await settle(fixture);
    expect(host.value()).toBeNull();
    expect(input.value).toBe('');
    expect(host.changes).toEqual([null]);
    expect(fixture.nativeElement.querySelector('.rs-clear')).toBeNull();
  });

  it('停用、唯讀：沒有清除鈕，不會搜尋', async () => {
    const { fixture, host, source, input } = setup((h) => {
      h.value.set('u1');
      h.readonly.set(true);
    });
    await settle(fixture);
    source.byId[0].resolve(PEOPLE[0]);
    await settle(fixture);
    expect(fixture.nativeElement.querySelector('.rs-clear')).toBeNull();
    input.focus();
    await settle(fixture);
    expect(source.calls).toHaveLength(0);
    host.readonly.set(false);
    host.disabled.set(true);
    await settle(fixture);
    expect(input.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.rs-clear')).toBeNull();
  });

  it('找不到：顯示「找不到符合…」；allowCreate 時多一個建立選項，按下送出 createRequested', async () => {
    const { fixture, host, source, input } = setup((h) => h.allowCreate.set(true));
    input.focus();
    type(input, ' 新客戶 ');
    await settle(fixture, RELATION_SELECT_DEBOUNCE);
    source.last().resolve({ items: [], hasMore: false });
    await settle(fixture);
    expect(overlay.querySelector('[data-state="empty"]')?.textContent).toContain('找不到符合「新客戶」的項目');
    expect(fixture.nativeElement.querySelector('.rs-sr-only')?.textContent).toContain('找不到符合「新客戶」的項目');
    const create = overlay.querySelector('[data-action="create"]') as HTMLElement;
    expect(create.textContent).toContain('建立「新客戶」');
    create.click();
    await settle(fixture);
    expect(host.created).toEqual(['新客戶']);
    expect(host.value()).toBeNull();
  });

  it('沒開 allowCreate、或已有完全相同的項目時，不出現建立選項', async () => {
    const { fixture, host, source, input } = setup();
    input.focus();
    type(input, 'zzz');
    await settle(fixture, RELATION_SELECT_DEBOUNCE);
    source.last().resolve({ items: [], hasMore: false });
    await settle(fixture);
    expect(overlay.querySelector('[data-action="create"]')).toBeNull();
    host.allowCreate.set(true);
    type(input, '王小明');
    await settle(fixture, RELATION_SELECT_DEBOUNCE);
    source.last().resolve({ items: [PEOPLE[0]], hasMore: false });
    await settle(fixture);
    expect(overlay.querySelector('[data-action="create"]')).toBeNull();
  });

  it('hasMore 或超過 maxResults：清單只顯示上限筆數，底部提示請輸入更多字', async () => {
    const { fixture, source, input } = setup((h) => h.max.set(2));
    input.focus();
    await settle(fixture);
    source.last().resolve({ items: PEOPLE, hasMore: false });
    await settle(fixture);
    expect(overlay.querySelectorAll('.rs-option')).toHaveLength(2);
    expect(overlay.querySelector('[data-state="more"]')?.textContent).toContain('還有更多，請輸入更多字縮小範圍');
  });

  it('搜尋失敗：顯示「搜尋失敗」與重試；重試成功後換成結果', async () => {
    const { fixture, source, input } = setup();
    input.focus();
    await settle(fixture);
    source.last().reject(new Error('network'));
    await settle(fixture);
    expect(overlay.querySelector('[data-state="error"]')?.textContent).toContain('搜尋失敗');
    expect(fixture.nativeElement.querySelector('.rs-sr-only')?.textContent).toContain('搜尋失敗');
    (overlay.querySelector('[data-action="retry"]') as HTMLElement).click();
    await settle(fixture);
    expect(source.calls).toHaveLength(2);
    expect(source.last().query).toBe('');
    source.last().resolve({ items: PEOPLE.slice(0, 1), hasMore: false });
    await settle(fixture, 10);
    expect(overlay.querySelector('[data-state="error"]')).toBeNull();
    expect(overlay.querySelectorAll('.rs-option')).toHaveLength(1);
  });

  it('被 abort 的搜尋不算失敗', async () => {
    const { fixture, source, input } = setup();
    input.focus();
    await settle(fixture);
    const first = source.last();
    type(input, '王');
    await settle(fixture, RELATION_SELECT_DEBOUNCE);
    first.reject(new DOMException('Aborted', 'AbortError'));
    await settle(fixture);
    expect(overlay.querySelector('[data-state="error"]')).toBeNull();
  });
});

describe('RelationSelectComponent（表單與畫面文字）', () => {
  afterEach(() => {
    TestBed.inject(OverlayContainer).getContainerElement().innerHTML = '';
  });

  it('沒提供 RELATION_SELECT_LABELS：建立時丟出明確錯誤', () => {
    TestBed.configureTestingModule({});
    expect(() => TestBed.createComponent(HostComponent).detectChanges()).toThrow(/RELATION_SELECT_LABELS/);
  });

  it('少了某一句：錯誤訊息列出缺少的名稱', () => {
    const partial: Partial<RelationSelectLabels> = { ...LABELS };
    delete partial.retry;
    TestBed.configureTestingModule({ providers: [{ provide: RELATION_SELECT_LABELS, useValue: partial }] });
    expect(() => TestBed.createComponent(HostComponent).detectChanges()).toThrow(/「retry」/);
  });

  it('reactive forms：setValue 帶 id 會解析文字、選取寫回 id、required 碰過後顯示 Material 錯誤', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: RELATION_SELECT_LABELS, useValue: LABELS }] });
    const fixture = TestBed.createComponent(FormHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input') as HTMLInputElement;
    const control = fixture.componentInstance.control;
    expect(el.querySelector('mat-error')).toBeNull();
    expect(input.required).toBe(true);

    control.markAsTouched();
    fixture.detectChanges();
    expect(el.querySelector('mat-error')?.textContent).toContain('請選擇負責人');
    expect(el.querySelector('.mat-form-field-invalid')).not.toBeNull();

    control.setValue('u2');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(input.value).toBe('陳大同');
    expect(el.querySelector('mat-error')).toBeNull();

    control.disable();
    fixture.detectChanges();
    expect(input.disabled).toBe(true);
    control.enable();
    fixture.detectChanges();

    input.focus();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const option = Array.from(overlay.querySelectorAll<HTMLElement>('mat-option')).find((o) => o.textContent?.includes('林美惠'));
    option?.click();
    fixture.detectChanges();
    expect(control.value).toBe('u4');
    expect(control.touched).toBe(true);
  });
});
