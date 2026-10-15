import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DataTableComponent } from './data-table.component';
import { DataTableCellDirective } from './data-table-cell.directive';
import {
  DataTableBatchSaveFn,
  DataTableCellSaveFn,
  DataTableColumn,
  DataTableEditMode,
  DataTableEditingLabels,
  DataTableLabels,
} from './data-table.types';
import { ToastService } from '../toast/toast.service';
import { RELATION_SELECT_LABELS } from '../relation-select/relation-select-labels';
import { createArraySource } from '../relation-select/relation-source';

interface Task {
  id: string;
  code: string;
  title: string;
  hours: number | null;
  status: 'todo' | 'doing' | 'done';
  ownerId: string | null;
  urgent: boolean;
  locked: boolean;
}

const EDITING: DataTableEditingLabels = {
  editCell: '修改{row}的{column}',
  readOnly: '這一格不能修改',
  required: '必填',
  invalidNumber: '請輸入數字',
  invalidDate: '請輸入日期',
  invalidOption: '「{text}」不是可選的值',
  notFound: '找不到「{text}」',
  toggleOn: '是',
  toggleOff: '否',
  saving: '儲存中',
  saved: '已儲存{column}',
  saveFailed: '儲存失敗，已還原',
  saveFailedToast: '{column}儲存失敗',
  retry: '重試',
  undo: '復原',
  undone: '已復原{column}',
  dirty: '已修改',
  dirtyCount: '已修改 {count} 格',
  errorCount: '有 {count} 個錯誤',
  discard: '捨棄',
  saveAll: '儲存全部',
  nextError: '跳到下一個錯誤',
  barLabel: '未儲存的修改',
  batchSaved: '已儲存 {count} 格',
  batchSaveFailed: '儲存失敗，修改的內容還在',
  discarded: '已捨棄修改',
  pasted: '已貼上 {count} 格',
  pasteErrors: '{count} 格有錯誤',
  pasteSkipped: '{count} 格不能修改，已略過',
  editRow: '編輯',
  editRowLabel: '編輯{row}',
  save: '儲存',
  cancel: '取消',
};

const BASE_LABELS: DataTableLabels = {
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
};

const OWNERS = [
  { id: 'u1', name: '王小明' },
  { id: 'u2', name: '林美惠' },
];

function makeRows(): Task[] {
  return [
    { id: 't1', code: 'T-1', title: '整理需求', hours: 4, status: 'todo', ownerId: 'u1', urgent: false, locked: false },
    { id: 't2', code: 'T-2', title: '畫線框稿', hours: 8, status: 'doing', ownerId: null, urgent: true, locked: false },
    { id: 't3', code: 'T-3', title: '驗收', hours: null, status: 'done', ownerId: 'u2', urgent: false, locked: true },
  ];
}

function makeColumns(): DataTableColumn<Task>[] {
  return [
    { key: 'code', label: '編號', frozen: true },
    { key: 'title', label: '標題', editor: { type: 'text', required: true, canEdit: (r) => !r.locked } },
    {
      key: 'hours',
      label: '工時',
      align: 'end',
      editor: {
        type: 'number',
        canEdit: (r) => !r.locked,
        validate: (v) => (typeof v === 'number' && v > 40 ? '不能超過 40' : null),
      },
    },
    {
      key: 'status',
      label: '狀態',
      editor: {
        type: 'select',
        options: [
          { value: 'todo', label: '待辦' },
          { value: 'doing', label: '進行中' },
          { value: 'done', label: '完成' },
        ],
      },
    },
    {
      key: 'owner',
      virtual: true,
      label: '負責人',
      value: (r) => OWNERS.find((o) => o.id === r.ownerId)?.name ?? '',
      editor: {
        type: 'relation',
        field: 'ownerId',
        source: createArraySource(OWNERS, { idOf: (o) => o.id, textOf: (o) => o.name }) as never,
        displayWith: (o) => (o as { name: string }).name,
      },
    },
    { key: 'urgent', label: '急件', editor: { type: 'toggle' } },
  ];
}

@Component({
  imports: [DataTableComponent, DataTableCellDirective],
  template: `
    <lib-data-table
      [columns]="columns()"
      [rows]="rows()"
      [labels]="labels()"
      [showExport]="false"
      [selectable]="selectable()"
      [editMode]="mode()"
      [onCellSave]="cellSave"
      [onBatchSave]="batchSave"
      (dirtyChange)="dirty.set($event)"
    />
  `,
})
class EditHostComponent {
  readonly table = viewChild.required(DataTableComponent<Task>);
  readonly columns = signal(makeColumns());
  readonly rows = signal<Task[]>(makeRows());
  readonly labels = signal<DataTableLabels>({ ...BASE_LABELS, editing: EDITING });
  readonly mode = signal<DataTableEditMode>('instant');
  readonly selectable = signal(false);
  readonly dirty = signal(false);
  cellSave: DataTableCellSaveFn<Task> = vi.fn(async (row, key, value) => {
    this.rows.update((rows) => rows.map((r) => (r.id === row.id ? { ...r, [key]: value } : r)));
  });
  batchSave: DataTableBatchSaveFn<Task> = vi.fn(async () => undefined);
}

class FakeToast {
  readonly calls: { type: string; message: string; action?: string; resolve: (v: boolean) => void }[] = [];
  private push(type: string, message: string, options?: { action?: string }) {
    let resolve!: (v: boolean) => void;
    const actionClicked = new Promise<boolean>((r) => (resolve = r));
    this.calls.push({ type, message, action: options?.action, resolve });
    return { actionClicked, afterDismissed: Promise.resolve(), dismiss: () => resolve(false) };
  }
  success = (m: string, o?: { action?: string }) => this.push('success', m, o);
  info = (m: string, o?: { action?: string }) => this.push('info', m, o);
  warning = (m: string, o?: { action?: string }) => this.push('warning', m, o);
  error = (m: string, o?: { action?: string }) => this.push('error', m, o);
}

describe('DataTable 表格內直接編輯', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<EditHostComponent>>;
  let host: EditHostComponent;
  let el: HTMLElement;
  let toast: FakeToast;

  async function settle(): Promise<void> {
    for (let i = 0; i < 6; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r, 0));
    }
    fixture.detectChanges();
  }

  async function setup(configure?: (h: EditHostComponent) => void): Promise<void> {
    toast = new FakeToast();
    TestBed.configureTestingModule({
      imports: [EditHostComponent],
      providers: [
        { provide: ToastService, useValue: toast },
        {
          provide: RELATION_SELECT_LABELS,
          useValue: {
            loading: '載入中',
            empty: '沒有項目',
            noResults: '找不到「{query}」',
            hasMore: '還有更多',
            create: '建立「{query}」',
            searchFailed: '搜尋失敗',
            retry: '重試',
            clear: '清除',
            resolveFailed: '找不到（{id}）',
          },
        },
      ],
    });
    fixture = TestBed.createComponent(EditHostComponent);
    host = fixture.componentInstance;
    configure?.(host);
    el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    await settle();
    // 編輯控制器是動態 import：第一次載入比較慢，等到它出現。
    const editable = host.columns().some((c) => c.editor);
    for (let i = 0; editable && !host.table()['edit']() && i < 50; i++) {
      await new Promise((r) => setTimeout(r, 10));
      await settle();
    }
  }

  function paste(target: Element, text: string): void {
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: (t: string) => (t === 'text/plain' ? text : '') } });
    target.dispatchEvent(event);
  }

  afterEach(() => {
    el?.remove();
  });

  const cell = (row: number, key: string) =>
    [...el.querySelectorAll<HTMLElement>(`td[data-dt-row="${row}"]`)].find((td) => td.getAttribute('data-dt-col') === key)!;
  const key = async (target: Element, k: string, init: KeyboardEventInit = {}) => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
    await settle();
  };
  const editor = () => el.querySelector<HTMLInputElement & HTMLSelectElement>('[data-dt-editor]');
  /** 焦點所在的格子：格子本身，或格子裡的鍵盤接收器（文字、數字、關聯欄）。 */
  const focusedCell = () => (document.activeElement as HTMLElement | null)?.closest('td') ?? null;
  const sink = () => el.querySelector<HTMLInputElement>('[data-dt-sink]');
  const type = async (text: string) => {
    const input = editor()!;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  };
  const live = () => el.querySelector('.dt-edit-live')?.textContent?.trim() ?? '';

  describe('鍵盤模型', () => {
    beforeEach(() => setup());

    it('開啟編輯時表格是 role=grid，只有一格 tabindex=0；不能改的格子 aria-readonly', () => {
      const table = el.querySelector('table')!;
      expect(table.getAttribute('role')).toBe('grid');
      expect(el.querySelectorAll('td[tabindex="0"]')).toHaveLength(1);
      expect(cell(0, 'code').getAttribute('tabindex')).toBe('0');
      expect(cell(0, 'code').getAttribute('aria-readonly')).toBe('true');
      expect(cell(0, 'title').hasAttribute('aria-readonly')).toBe(false);
      expect(cell(2, 'title').getAttribute('aria-readonly')).toBe('true'); // canEdit：鎖定的列
      expect(el.querySelector('th.dt-col--editable')?.textContent).toContain('標題');
    });

    it('方向鍵移動目前的格子並移動焦點；Home／End 到列首列尾', async () => {
      cell(0, 'code').focus();
      await key(cell(0, 'code'), 'ArrowRight');
      expect(focusedCell()).toBe(cell(0, 'title'));
      // 唯一的 tab stop 跟著走：標題欄可以打字，是格子裡的鍵盤接收器（格子本身 -1）
      expect(document.activeElement).toBe(sink());
      expect(cell(0, 'title').getAttribute('tabindex')).toBe('-1');
      expect(cell(0, 'code').getAttribute('tabindex')).toBe('-1');
      await key(cell(0, 'title'), 'ArrowDown');
      expect(focusedCell()).toBe(cell(1, 'title'));
      await key(cell(1, 'title'), 'End');
      expect(focusedCell()).toBe(cell(1, 'urgent'));
      await key(cell(1, 'urgent'), 'Home');
      expect(focusedCell()).toBe(cell(1, 'code'));
      await key(cell(1, 'code'), 'ArrowUp');
      await key(cell(0, 'code'), 'ArrowUp');
      expect(focusedCell()).toBe(cell(0, 'code'));
    });

    it('Enter 開始編輯（保留原值），Esc 取消並把焦點放回格子', async () => {
      await key(cell(0, 'title'), 'Enter');
      expect(editor()?.value).toBe('整理需求');
      expect(editor()?.getAttribute('aria-label')).toBe('修改T-1的標題');
      expect(document.activeElement).toBe(editor());
      await type('改了一半');
      await key(editor()!, 'Escape');
      expect(editor()).toBeNull();
      expect(cell(0, 'title').textContent).toContain('整理需求');
      expect(focusedCell()).toBe(cell(0, 'title'));
      expect(host.cellSave).not.toHaveBeenCalled();
    });

    it('打字開始編輯時，那個字取代原本的內容；Enter 存檔並往下一列', async () => {
      await key(cell(0, 'title'), '新');
      expect(editor()?.value).toBe('新');
      await type('新標題');
      await key(editor()!, 'Enter');
      expect(host.cellSave).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), 'title', '新標題', expect.any(AbortSignal));
      expect(cell(0, 'title').textContent).toContain('新標題');
      expect(focusedCell()).toBe(cell(1, 'title'));
    });

    it('F2 也開始編輯；Tab 存檔並往右、Shift+Tab 往左', async () => {
      await key(cell(1, 'title'), 'F2');
      await type('線框稿 v2');
      await key(editor()!, 'Tab');
      expect(host.cellSave).toHaveBeenCalledTimes(1);
      expect(focusedCell()).toBe(cell(1, 'hours'));
      await key(cell(1, 'hours'), 'Enter');
      await key(editor()!, 'Tab', { shiftKey: true });
      expect(focusedCell()).toBe(cell(1, 'title'));
    });

    it('雙擊開始編輯；在不能改的格子按 Enter 念「這一格不能修改」', async () => {
      cell(1, 'hours').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await settle();
      expect(editor()?.value).toBe('8');
      await key(editor()!, 'Escape');
      await key(cell(2, 'title'), 'Enter');
      expect(editor()).toBeNull();
      expect(live()).toBe('這一格不能修改');
    });

    it('資料重新排序後焦點不會掉：仍在同一列同一格', async () => {
      cell(1, 'title').focus();
      await key(cell(1, 'title'), 'ArrowRight');
      expect(focusedCell()).toBe(cell(1, 'hours'));
      host.rows.update((rows) => [...rows].reverse());
      await settle();
      // t2 還在中間；換成 t1 被移到最後
      host.rows.update((rows) => [rows[1], rows[0], rows[2]]);
      await settle();
      const focused = focusedCell()!;
      expect(focused.getAttribute('data-dt-col')).toBe('hours');
      expect(focused.closest('tr')?.textContent).toContain('T-2');
    });
  });

  describe('輸入法（鍵盤接收器）', () => {
    beforeEach(() => setup());

    /** 聚焦一格：格子本身拿到焦點後，可以打字的格子會把焦點交給格子裡的接收器。 */
    const focusCell = async (row: number, k: string) => {
      cell(row, k).focus();
      await settle();
    };
    const fire = (target: Element, event: Event) => {
      target.dispatchEvent(event);
      return event;
    };
    const ime = (target: Element, type: 'compositionstart' | 'compositionupdate' | 'compositionend', data: string) =>
      fire(target, new CompositionEvent(type, { data, bubbles: true }));

    it('文字、數字、關聯欄的目前格子放一個看不見的接收器當唯一 tab stop；名稱是格子內容（內容本身對報讀器隱藏，只念一次）', async () => {
      await focusCell(0, 'title');
      const s = sink()!;
      expect(cell(0, 'title').contains(s)).toBe(true);
      expect(document.activeElement).toBe(s);
      expect(el.querySelectorAll('[data-dt-sink]')).toHaveLength(1);
      expect(cell(0, 'title').getAttribute('tabindex')).toBe('-1');
      expect(el.querySelectorAll('td[tabindex="0"]')).toHaveLength(0);
      expect(s.getAttribute('inputmode')).toBe('none'); // 觸控裝置點格子不跳出螢幕鍵盤
      const label = el.querySelector(`#${s.getAttribute('aria-labelledby')}`)!;
      expect(label.getAttribute('aria-hidden')).toBe('true');
      expect(label.textContent?.trim()).toBe('整理需求');
      expect(cell(0, 'title').contains(label)).toBe(true);
      // 數字、關聯欄也有；編號（不能改）、下拉、開關維持焦點在格子本身
      await key(s, 'ArrowRight');
      expect(cell(0, 'hours').contains(document.activeElement)).toBe(true);
      expect(document.activeElement).toBe(sink());
      await key(sink()!, 'ArrowRight');
      expect(document.activeElement).toBe(cell(0, 'status'));
      expect(sink()).toBeNull();
      await key(cell(0, 'status'), 'ArrowRight');
      expect(document.activeElement).toBe(sink());
      expect(cell(0, 'owner').contains(sink())).toBe(true);
      await key(sink()!, 'Home');
      expect(document.activeElement).toBe(cell(0, 'code'));
      expect(cell(0, 'code').getAttribute('tabindex')).toBe('0');
    });

    it('用注音開始編輯：組字時格子畫成編輯中、接收器顯示注音；確定「王」開啟編輯器，值是「王」（不掉第一個注音、不重複）', async () => {
      await focusCell(0, 'title');
      const s = sink()!;
      // 輸入法處理中的 keydown（Process／229）不攔、不開編輯器
      const down = fire(s, new KeyboardEvent('keydown', { key: 'Process', keyCode: 229, bubbles: true, cancelable: true }));
      expect(down.defaultPrevented).toBe(false);
      ime(s, 'compositionstart', '');
      for (const text of ['ㄨ', 'ㄨㄤ', 'ㄨㄤˊ']) {
        s.value = text;
        ime(s, 'compositionupdate', text);
        fire(s, new KeyboardEvent('keydown', { key: 'Process', keyCode: 229, isComposing: true, bubbles: true, cancelable: true }));
      }
      await settle();
      expect(editor()).toBeNull();
      expect(cell(0, 'title').classList).toContain('dt-cell--editing');
      expect(cell(0, 'title').classList).toContain('dt-cell--composing');
      expect(sink()).toBe(s); // 同一個元素：組字沒有被打斷
      expect(document.activeElement).toBe(s);
      // 選字用的方向鍵、確定用的 Enter 是給輸入法的
      await key(s, 'ArrowDown', { isComposing: true, keyCode: 229 });
      await key(s, 'Enter', { isComposing: true, keyCode: 229 });
      expect(focusedCell()).toBe(cell(0, 'title'));
      expect(editor()).toBeNull();
      s.value = '王';
      ime(s, 'compositionend', '王');
      await settle();
      expect(editor()?.value).toBe('王');
      expect(document.activeElement).toBe(editor());
      expect(editor()!.selectionStart).toBe(1); // 游標在最後，接著打
      expect(cell(0, 'title').classList).not.toContain('dt-cell--composing');
      await type('王小明');
      await key(editor()!, 'Enter');
      expect(host.cellSave).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), 'title', '王小明', expect.any(AbortSignal));
      expect(focusedCell()).toBe(cell(1, 'title'));
    });

    it('Safari 的順序（compositionend 之後才插入確定的字）不會變成兩個字；取消組字留在格子上', async () => {
      await focusCell(0, 'title');
      let s = sink()!;
      ime(s, 'compositionstart', '');
      ime(s, 'compositionend', '王');
      s.value = '王';
      fire(s, new InputEvent('input', { data: '王', inputType: 'insertFromComposition', bubbles: true }));
      await settle();
      expect(editor()?.value).toBe('王');
      await key(editor()!, 'Escape');
      expect(focusedCell()).toBe(cell(0, 'title'));
      s = sink()!;
      ime(s, 'compositionstart', '');
      s.value = 'ㄨ';
      ime(s, 'compositionend', ''); // Esc 取消組字
      await settle();
      expect(editor()).toBeNull();
      expect(cell(0, 'title').classList).not.toContain('dt-cell--composing');
      expect(cell(0, 'title').textContent).toContain('整理需求');
    });

    it('英數照舊直接取代；聽寫等沒有組字事件的輸入也開始編輯；數字欄、關聯欄用輸入法開始編輯', async () => {
      await focusCell(0, 'title');
      const down = fire(sink()!, new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
      expect(down.defaultPrevented).toBe(true); // 字不會掉進接收器
      await settle();
      expect(editor()?.value).toBe('a');
      expect(sink()).toBeNull();
      await key(editor()!, 'Escape');
      const s = sink()!;
      s.value = '語音輸入';
      fire(s, new InputEvent('input', { data: '語音輸入', inputType: 'insertText', bubbles: true }));
      await settle();
      expect(editor()?.value).toBe('語音輸入');
      await key(editor()!, 'Escape');
      await key(sink()!, 'ArrowRight');
      ime(sink()!, 'compositionstart', '');
      ime(sink()!, 'compositionend', '１２');
      await settle();
      expect(editor()?.value).toBe('１２');
      await key(editor()!, 'Escape');
      await key(sink()!, 'ArrowRight');
      await key(cell(0, 'status'), 'ArrowRight');
      ime(sink()!, 'compositionstart', '');
      ime(sink()!, 'compositionend', '林');
      for (let i = 0; !el.querySelector('lib-relation-select') && i < 30; i++) {
        await new Promise((r) => setTimeout(r, 10));
        await settle();
      }
      expect(el.querySelector('lib-relation-select')).not.toBeNull();
      const context = host.table()['edit']()!.editing()!.spec.context as { text: string; seeded: boolean };
      expect([context.text, context.seeded]).toEqual(['林', true]); // 確定的字交給關聯欄當搜尋字
    });

    it('即時儲存時在接收器上貼上：不開始編輯、字不會掉進接收器（跟焦點在格子本身時一樣）', async () => {
      await focusCell(0, 'title');
      const event = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { getData: () => '貼上的字' } });
      sink()!.dispatchEvent(event);
      await settle();
      expect(event.defaultPrevented).toBe(true);
      expect(editor()).toBeNull();
      expect(host.cellSave).not.toHaveBeenCalled();
    });
  });

  describe('即時儲存', () => {
    beforeEach(() => setup());

    it('值有錯時留在編輯狀態、不送出（必填、欄位自己的 validate、數字格式）', async () => {
      await key(cell(0, 'title'), 'Enter');
      await type('   ');
      await key(editor()!, 'Enter');
      expect(editor()).not.toBeNull();
      expect(editor()!.getAttribute('aria-invalid')).toBe('true');
      expect(el.querySelector('.dt-ed__error')?.textContent).toContain('必填');
      expect(live()).toContain('必填');
      await key(editor()!, 'Escape');

      await key(cell(0, 'hours'), 'Enter');
      await type('abc');
      await key(editor()!, 'Tab');
      expect(el.querySelector('.dt-ed__error')?.textContent).toContain('請輸入數字');
      await type('99');
      expect(el.querySelector('.dt-ed__error')?.textContent).toContain('不能超過 40');
      await type('12');
      expect(el.querySelector('.dt-ed__error')).toBeNull();
      await key(editor()!, 'Enter');
      expect(host.cellSave).toHaveBeenCalledTimes(1);
      expect(host.rows()[0].hours).toBe(12);
    });

    it('儲存中顯示轉圈，成功後提示「已儲存」並可復原', async () => {
      let finish!: () => void;
      host.cellSave = vi.fn((row, k, value) => {
        return new Promise<void>((resolve) => {
          finish = () => {
            host.rows.update((rows) => rows.map((r) => (r.id === row.id ? { ...r, [k]: value } : r)));
            resolve();
          };
        });
      });
      fixture.detectChanges();
      await key(cell(0, 'hours'), '6');
      await key(editor()!, 'Enter');
      expect(cell(0, 'hours').getAttribute('aria-busy')).toBe('true');
      expect(cell(0, 'hours').querySelector('.dt-spinner')).not.toBeNull();
      expect(cell(0, 'hours').textContent).toContain('6'); // 先顯示新值
      finish();
      await settle();
      expect(cell(0, 'hours').hasAttribute('aria-busy')).toBe(false);
      expect(cell(0, 'hours').querySelector('.dt-cell-status--saved')).not.toBeNull();
      expect(live()).toContain('已儲存工時');
      const success = toast.calls.find((c) => c.type === 'success')!;
      expect(success.action).toBe('復原');

      // 復原：用原本的值再存一次
      success.resolve(true);
      await settle();
      expect(host.cellSave).toHaveBeenCalledTimes(2);
      expect((host.cellSave as ReturnType<typeof vi.fn>).mock.calls[1][2]).toBe(4);
      finish();
      await settle();
      expect(host.rows()[0].hours).toBe(4);
      expect(toast.calls.some((c) => c.type === 'info' && c.message === '已復原工時')).toBe(true);
    });

    it('失敗時還原原本的值、格子裡寫出原因，提示可以重試', async () => {
      let fail = true;
      host.cellSave = vi.fn(async (row, k, value) => {
        if (fail) throw new Error('500');
        host.rows.update((rows) => rows.map((r) => (r.id === row.id ? { ...r, [k]: value } : r)));
      });
      fixture.detectChanges();
      await key(cell(1, 'title'), 'Enter');
      await type('會失敗');
      await key(editor()!, 'Enter');
      expect(cell(1, 'title').textContent).toContain('畫線框稿');
      expect(cell(1, 'title').getAttribute('aria-invalid')).toBe('true');
      expect(cell(1, 'title').querySelector('.dt-cell-error')?.textContent).toContain('儲存失敗，已還原');
      expect(live()).toContain('標題儲存失敗');
      const error = toast.calls.find((c) => c.type === 'error')!;
      expect(error.message).toBe('標題儲存失敗');
      expect(error.action).toBe('重試');

      fail = false;
      error.resolve(true);
      await settle();
      expect(host.cellSave).toHaveBeenCalledTimes(2);
      expect(cell(1, 'title').textContent).toContain('會失敗');
      expect(cell(1, 'title').hasAttribute('aria-invalid')).toBe(false);
    });

    it('reject 一個字串時，那句話顯示在格子裡', async () => {
      host.cellSave = vi.fn(async () => Promise.reject('這個標題已經有人用了'));
      fixture.detectChanges();
      await key(cell(0, 'title'), 'Enter');
      await type('重複');
      await key(editor()!, 'Enter');
      expect(cell(0, 'title').querySelector('.dt-cell-error')?.textContent).toContain('這個標題已經有人用了');
    });

    it('下拉欄：Enter 打開原生 select，選了按 Enter 存檔；沒有 dtCell 時顯示選項文字', async () => {
      expect(cell(0, 'status').textContent).toContain('待辦');
      await key(cell(0, 'status'), 'Enter');
      const select = editor()!;
      expect(select.tagName).toBe('SELECT');
      select.value = '2'; // 完成
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      await key(select, 'Enter');
      expect(host.cellSave).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), 'status', 'done', expect.any(AbortSignal));
      expect(cell(0, 'status').textContent).toContain('完成');
    });

    it('開關欄：空白鍵切換並存檔，格子寫出「是／否」', async () => {
      expect(cell(0, 'urgent').textContent).toContain('否');
      await key(cell(0, 'urgent'), ' ');
      expect(host.cellSave).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), 'urgent', true, expect.any(AbortSignal));
      expect(cell(0, 'urgent').textContent).toContain('是');
    });

    it('關聯欄：Enter 打開 relation-select（名稱是欄位＋這一列）', async () => {
      await key(cell(0, 'owner'), 'Enter');
      const rel = el.querySelector('lib-relation-select');
      expect(rel).not.toBeNull();
      expect(rel!.querySelector('input')?.getAttribute('aria-label')).toBe('修改T-1的負責人');
      rel!.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await settle();
      expect(el.querySelector('lib-relation-select')).toBeNull();
    });

    it('開始編輯時格子鎖住打開前的寬高（欄寬、列高不跳），換格時換鎖、關閉編輯器時放開', async () => {
      const box = (width: number, height: number) => ({ width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
      vi.spyOn(cell(0, 'title'), 'getBoundingClientRect').mockReturnValue(box(190.5, 44.25));
      vi.spyOn(cell(0, 'hours'), 'getBoundingClientRect').mockReturnValue(box(96, 44.25));
      await key(cell(0, 'title'), 'Enter');
      expect(editor()).not.toBeNull();
      const title = cell(0, 'title');
      expect([title.style.width, title.style.minWidth, title.style.height]).toEqual(['190.5px', '190.5px', '44.25px']);
      // Tab：確定往右，下一格（數字）開始編輯時鎖住它、放開上一格
      await key(editor()!, 'Tab');
      await key(cell(0, 'hours'), 'Enter');
      expect(editor()).not.toBeNull();
      expect(title.getAttribute('style') ?? '').toBe('');
      expect([cell(0, 'hours').style.width, cell(0, 'hours').style.height]).toEqual(['96px', '44.25px']);
      await key(editor()!, 'Escape');
      expect(editor()).toBeNull();
      expect(cell(0, 'hours').getAttribute('style') ?? '').toBe('');
    });

    it('關聯欄：打字開始編輯，搜尋框是打的字（原本的值查完也不蓋回去），以它搜尋並列出候選；Esc 取消回到原值', async () => {
      cell(0, 'owner').focus();
      await settle();
      const s = sink()!;
      s.value = '林';
      s.dispatchEvent(new InputEvent('input', { data: '林', inputType: 'insertText', bubbles: true }));
      await settle();
      for (let i = 0; !el.querySelector('lib-relation-select') && i < 30; i++) {
        await new Promise((r) => setTimeout(r, 10));
        await settle();
      }
      const input = el.querySelector<HTMLInputElement>('lib-relation-select input')!;
      // 原本的值（王小明）查詢完成、搜尋回來之後
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 100));
        await settle();
      }
      expect(input.value).toBe('林');
      expect(document.activeElement).toBe(input);
      const options = [...document.querySelectorAll('.lib-relation-select-panel mat-option')].map((o) => o.textContent?.trim());
      expect(options).toEqual(['林美惠']);
      // 第一次 Esc 關清單、第二次取消：格子回到原值，沒有存檔。keyCode 27 跟真的瀏覽器一樣（mat-autocomplete 看 keyCode，
      // 而且清單關著也會 preventDefault Esc）。
      await key(input, 'Escape', { keyCode: 27 });
      expect(document.querySelectorAll('.lib-relation-select-panel mat-option')).toHaveLength(0);
      expect(el.querySelector('lib-relation-select')).not.toBeNull();
      await key(input, 'Escape', { keyCode: 27 });
      expect(el.querySelector('lib-relation-select')).toBeNull();
      expect(cell(0, 'owner').textContent).toContain('王小明');
      expect(host.cellSave).not.toHaveBeenCalled();
    });
  });

  describe('批次修改', () => {
    beforeEach(() => setup((h) => h.mode.set('batch')));

    it('改過的格子標成已修改，批次列顯示數量；捨棄後恢復原狀', async () => {
      await key(cell(0, 'title'), 'Enter');
      await type('A');
      await key(editor()!, 'Enter');
      await key(cell(1, 'hours'), '3');
      await key(editor()!, 'Enter');
      expect(host.cellSave).not.toHaveBeenCalled();
      expect(cell(0, 'title').classList.contains('dt-cell--dirty')).toBe(true);
      expect(cell(0, 'title').querySelector('.dt-sr-only')?.textContent).toBe('已修改');
      expect(el.querySelector('[data-dt-dirty-count]')?.textContent).toBe('已修改 2 格');
      expect(host.dirty()).toBe(true);
      expect(host.table().dirty()).toBe(true);

      (el.querySelector('[data-action="discard"]') as HTMLButtonElement).click();
      await settle();
      expect(cell(0, 'title').textContent).toContain('整理需求');
      expect(el.querySelector('[data-dt-batch-bar]')).toBeNull();
      expect(host.dirty()).toBe(false);
    });

    it('改回原本的值不算修改', async () => {
      await key(cell(0, 'title'), 'Enter');
      await type('整理需求');
      await key(editor()!, 'Enter');
      expect(cell(0, 'title').classList.contains('dt-cell--dirty')).toBe(false);
      expect(el.querySelector('[data-dt-batch-bar]')).toBeNull();
    });

    it('有錯的格子照樣記下但擋住「儲存全部」，跳到下一個錯誤', async () => {
      await key(cell(0, 'hours'), '9');
      await type('99');
      await key(editor()!, 'Enter'); // 有錯，批次修改仍然離開
      expect(editor()).toBeNull();
      expect(cell(0, 'hours').classList.contains('dt-cell--error')).toBe(true);
      expect(cell(0, 'hours').querySelector('.dt-cell-error')?.textContent).toContain('不能超過 40');
      expect(el.querySelector('[data-dt-error-count]')?.textContent).toContain('有 1 個錯誤');

      cell(2, 'code').focus();
      (el.querySelector('[data-action="save-all"]') as HTMLButtonElement).click();
      await settle();
      expect(host.batchSave).not.toHaveBeenCalled();
      expect(focusedCell()).toBe(cell(0, 'hours'));

      cell(2, 'code').focus();
      (el.querySelector('[data-action="next-error"]') as HTMLButtonElement).click();
      await settle();
      expect(focusedCell()).toBe(cell(0, 'hours'));

      // 修好再存
      await key(cell(0, 'hours'), 'Enter');
      await type('10');
      await key(editor()!, 'Enter');
      (el.querySelector('[data-action="save-all"]') as HTMLButtonElement).click();
      await settle();
      expect(host.batchSave).toHaveBeenCalledWith([
        { row: expect.objectContaining({ id: 't1' }), key: 'hours', value: 10, previous: 4 },
      ]);
      expect(toast.calls.some((c) => c.type === 'success' && c.message === '已儲存 1 格')).toBe(true);
      expect(el.querySelector('[data-dt-batch-bar]')).toBeNull();
    });

    it('儲存失敗時修改保留，提示可以重試', async () => {
      host.batchSave = vi.fn(async () => {
        throw new Error('offline');
      });
      fixture.detectChanges();
      await key(cell(0, 'title'), 'Enter');
      await type('B');
      await key(editor()!, 'Enter');
      expect(await host.table().saveChanges()).toBe(false);
      await settle();
      expect(cell(0, 'title').classList.contains('dt-cell--dirty')).toBe(true);
      expect(toast.calls.find((c) => c.type === 'error')?.action).toBe('重試');
    });

    it('貼上一整塊：往右往下填、每格檢查，不能改的格子略過', async () => {
      cell(0, 'title').focus();
      await settle();
      paste(sink()!, '新標題一\t5\n新標題二\tabc\n第三列\t1\n'); // 焦點在格子裡的鍵盤接收器上
      await settle();
      expect(cell(0, 'title').textContent).toContain('新標題一');
      expect(cell(0, 'hours').textContent).toContain('5');
      expect(cell(1, 'title').textContent).toContain('新標題二');
      expect(cell(1, 'hours').classList.contains('dt-cell--error')).toBe(true);
      expect(cell(1, 'hours').textContent).toContain('請輸入數字');
      expect(cell(2, 'title').textContent).toContain('驗收'); // 鎖定的列
      expect(el.querySelector('[data-dt-dirty-count]')?.textContent).toBe('已修改 4 格');
      expect(live()).toBe('已貼上 4 格，1 格有錯誤，2 格不能修改，已略過');
    });

    it('貼上到下拉、關聯、開關欄：比對文字，找不到時標成錯誤', async () => {
      await host.table()['edit']()!.paste(0, 'status', '完成\t林美惠\t是\n進行\t不存在的人\tno');
      await settle();
      const changes = host.table()['edit']()!.changes();
      expect(changes.map((c) => [c.row.id, c.key, c.value])).toEqual([
        ['t1', 'status', 'done'],
        ['t1', 'ownerId', 'u2'],
        ['t1', 'urgent', true],
        ['t2', 'status', '進行'],
        ['t2', 'ownerId', '不存在的人'],
        ['t2', 'urgent', false],
      ]);
      expect(cell(1, 'status').textContent).toContain('「進行」不是可選的值');
      expect(cell(1, 'owner').textContent).toContain('找不到「不存在的人」');
      expect(cell(0, 'owner').textContent).toContain('林美惠');
    });
  });

  it('沒有 editor 的表格：沒有 grid、沒有 tabindex，不載入編輯控制器', async () => {
    await setup((h) => h.columns.set(makeColumns().map(({ editor: _e, ...c }) => c as DataTableColumn<Task>)));
    expect(el.querySelector('table')!.hasAttribute('role')).toBe(false);
    expect(el.querySelector('td[tabindex]')).toBeNull();
    expect(el.querySelector('.dt-editable')).toBeNull();
    expect(el.querySelector('lib-data-table-edit-chrome')).toBeNull();
    expect(host.table()['edit']()).toBeNull();
  });

  it('有 editor 卻沒給 labels.editing：丟出明確的錯誤', async () => {
    toast = new FakeToast();
    TestBed.configureTestingModule({ imports: [EditHostComponent], providers: [{ provide: ToastService, useValue: toast }] });
    fixture = TestBed.createComponent(EditHostComponent);
    fixture.componentInstance.labels.set(BASE_LABELS);
    expect(() => fixture.detectChanges()).toThrow(/labels\.editing/);
    fixture.componentInstance.columns.set([{ key: 'code', label: '編號' }]);
    fixture.detectChanges();
  });

  describe('手機卡片版', () => {
    let original: typeof window.matchMedia;
    beforeEach(async () => {
      original = window.matchMedia;
      window.matchMedia = ((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
      })) as unknown as typeof window.matchMedia;
      await setup();
    });
    afterEach(() => {
      window.matchMedia = original;
    });

    it('不做儲存格層級的編輯：每張卡片一顆「編輯」，打開整列表單存檔', async () => {
      expect(el.querySelector('table')!.hasAttribute('role')).toBe(false);
      expect(el.querySelector('td[tabindex]')).toBeNull();
      const buttons = el.querySelectorAll<HTMLButtonElement>('[data-dt-edit-row]');
      expect(buttons).toHaveLength(3); // 鎖定的列仍可改狀態、負責人、急件
      expect(buttons[0].getAttribute('aria-label')).toBe('編輯T-1');
      buttons[0].click();
      await settle();
      const form = el.querySelector('.dt-row-form')!;
      expect(form.getAttribute('aria-label')).toBe('編輯T-1');
      expect(form.querySelector('label[for]')?.textContent).toContain('標題');
      const title = form.querySelector<HTMLInputElement>('[data-field="title"] input')!;
      expect(title.value).toBe('整理需求');

      title.value = '';
      title.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      (form.querySelector('[data-action="row-save"]') as HTMLButtonElement).click();
      await settle();
      expect(host.cellSave).not.toHaveBeenCalled();
      expect(form.querySelector('[data-field="title"] .dt-ed__error')?.textContent).toContain('必填');

      title.value = '手機改的';
      title.dispatchEvent(new Event('input', { bubbles: true }));
      const urgent = form.querySelector<HTMLInputElement>('[data-field="urgent"] input[type="checkbox"]')!;
      urgent.checked = true;
      urgent.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      (form.querySelector('[data-action="row-save"]') as HTMLButtonElement).click();
      await settle();
      expect(host.cellSave).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), 'title', '手機改的', expect.any(AbortSignal));
      expect(host.cellSave).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), 'urgent', true, expect.any(AbortSignal));
      expect(el.querySelector('.dt-row-form')).toBeNull();
      expect(host.rows()[0].title).toBe('手機改的');
      expect(document.activeElement).toBe(el.querySelector('[data-dt-edit-row="0"]'));
    });

    it('取消：關掉表單，不送出', async () => {
      el.querySelector<HTMLButtonElement>('[data-dt-edit-row="1"]')!.click();
      await settle();
      (el.querySelector('[data-action="row-cancel"]') as HTMLButtonElement).click();
      await settle();
      expect(el.querySelector('.dt-row-form')).toBeNull();
      expect(host.cellSave).not.toHaveBeenCalled();
    });
  });
});
