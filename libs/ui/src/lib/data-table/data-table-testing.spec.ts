import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataTableCellDirective } from './data-table-cell.directive';
import { DataTableComponent } from './data-table.component';
import { expectExportMatchesDisplay } from './data-table-testing';
import {
  DataTableCellSaveFn,
  DataTableColumn,
  DataTableColumnChooserLabels,
  DataTableColumnPrefs,
  DataTableEditingLabels,
  DataTableLabels,
} from './data-table.types';

interface Row {
  id: string;
  name: string;
  price: number;
  status: 'ok' | 'off';
}

/** 每個鍵回傳鍵名本身：這裡只測比對，不在意文字內容。 */
function keysAsText<L extends object>(): L {
  return new Proxy({}, { get: (_target, key) => String(key) }) as L;
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
  columnChooser: keysAsText<DataTableColumnChooserLabels>(),
  editing: keysAsText<DataTableEditingLabels>(),
};

const ROWS: Row[] = [
  { id: 'p1', name: '甲專案', price: 1200, status: 'ok' },
  { id: 'p2', name: '乙專案', price: 800, status: 'off' },
];

const STATUS_LABELS: Record<Row['status'], string> = { ok: '進行中', off: '暫停' };

const BASE_COLUMNS: DataTableColumn<Row>[] = [
  { key: 'name', label: '名稱', primary: true },
  { key: 'status', label: '狀態', exportValue: (r) => STATUS_LABELS[r.status] },
  { key: 'price', label: '預算', align: 'end' },
];

@Component({
  imports: [DataTableComponent, DataTableCellDirective],
  template: `
    <table class="other">
      <tbody>
        <tr><td data-label="名稱">不是資料表的表格</td></tr>
      </tbody>
    </table>
    <div class="target">
      <lib-data-table
        [columns]="columns()"
        [rows]="rows"
        [labels]="labels"
        [selectable]="selectable()"
        [columnChooser]="true"
        [columnPrefs]="prefs()"
        [onCellSave]="save"
      >
        <ng-template dtCell="status" let-row
          ><span class="material-symbols-rounded" aria-hidden="true">circle</span>{{ statusLabels[row.status] }}</ng-template
        >
        <ng-template dtCell="price" let-row>{{ priceText(row) }}</ng-template>
        <ng-template dtCell="actions" let-row><button type="button">刪除</button></ng-template>
      </lib-data-table>
    </div>
  `,
})
class HostComponent {
  readonly labels = LABELS;
  readonly rows = ROWS;
  readonly statusLabels: Record<string, string> = STATUS_LABELS;
  readonly columns = signal<DataTableColumn<Row>[]>(BASE_COLUMNS);
  readonly selectable = signal(false);
  readonly prefs = signal<DataTableColumnPrefs | null>(null);
  /** 預設畫面加單位「元」，Excel 存裸數字。 */
  readonly withUnit = signal(true);
  readonly save: DataTableCellSaveFn<Row> = async () => undefined;
  priceText(row: Row): string {
    return this.withUnit() ? `${row.price} 元` : String(row.price);
  }
}

describe('expectExportMatchesDisplay', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let target: HTMLElement;
  const check = (...args: [DataTableColumn<Row>[]?, Row[]?, Parameters<typeof expectExportMatchesDisplay<Row>>[3]?]) =>
    expectExportMatchesDisplay(target, args[0] ?? host.columns(), args[1] ?? ROWS, args[2]);
  const messageOf = (fn: () => void): string => {
    try {
      fn();
    } catch (e) {
      return (e as Error).message;
    }
    return '';
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
    target = (fixture.nativeElement as HTMLElement).querySelector('.target')!;
  });

  it('每一格一致時通過；刻意不同的欄寫進例外表', () => {
    expect(() => check(undefined, undefined, { price: '畫面加「元」，Excel 存可以加總的數字' })).not.toThrow();
  });

  it('不一致又沒列例外時失敗，訊息指出第幾列、哪一欄、兩邊各是什麼', () => {
    const message = messageOf(() => check());
    expect(message).toContain('第 1 列');
    expect(message).toContain('預算');
    expect(message).toContain('1200 元');
    expect(message).toContain('「1200」');
  });

  it('畫面與匯出改成一致後不用例外', async () => {
    host.withUnit.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(() => check()).not.toThrow();
  });

  it('exportSkip 的欄（操作欄）不比對；勾選欄不算一欄', async () => {
    host.columns.set([...BASE_COLUMNS, { key: 'actions', virtual: true, label: '操作', exportSkip: true }]);
    host.selectable.set(true);
    await fixture.whenStable();
    expect(() => check(undefined, undefined, { price: '單位' })).not.toThrow();
  });

  it('欄位選擇面板隱藏的欄不比對，順序照畫面（跟匯出一樣）', async () => {
    host.prefs.set({ order: ['price', 'status', 'name'], hidden: ['price'] });
    await fixture.whenStable();
    const labels = Array.from(target.querySelectorAll('tbody tr:first-child td[data-label]')).map((td) =>
      td.getAttribute('data-label'),
    );
    expect(labels).toEqual(['狀態', '名稱']);
    expect(() => check()).not.toThrow();
  });

  it('列數和傳入的 rows 不同時失敗（分頁時只傳目前這一頁）', () => {
    expect(() => check(undefined, [ROWS[0]], { price: '單位' })).toThrow('畫面上有 2 列，但傳入 1 列');
  });

  it('只看範圍內的 lib-data-table；範圍內有兩個以上時要求縮小範圍', () => {
    const root = fixture.nativeElement as HTMLElement;
    // 範圍內唯一的 lib-data-table：旁邊那個一般表格（同樣有 data-label="名稱"）不影響。
    expect(() => expectExportMatchesDisplay(root, host.columns(), ROWS, { price: '單位' })).not.toThrow();
    const twice = document.createElement('div');
    twice.append(root.querySelector('lib-data-table')!.cloneNode(true), root.querySelector('lib-data-table')!.cloneNode(true));
    expect(() => expectExportMatchesDisplay(twice, host.columns(), ROWS)).toThrow('2 個 lib-data-table');
  });

  it('畫面上的欄不在 columns 裡時失敗', () => {
    expect(() => check([{ key: 'name', label: '名稱' }])).toThrow('「狀態」欄，但傳入的 columns 裡沒有');
  });

  it('例外一定要寫理由；例外的 key 一定要是欄位', () => {
    expect(() => check(undefined, undefined, { price: ' ' })).toThrow('沒有寫理由');
    expect(() => check(undefined, undefined, { price: '單位', amount: '舊欄位' })).toThrow('「amount」不是任何一個欄位');
  });

  it('例外可以只放過部分資料列', () => {
    expect(() =>
      check(undefined, undefined, { price: { reason: '只有第一列', when: (_row, i) => i === 0 } }),
    ).toThrow('第 2 列');
  });

  it('dtCell 裡的圖示字（Material Symbols）不算進畫面值', () => {
    expect(target.querySelector('td[data-label="狀態"]')!.textContent).toContain('circle');
    expect(() => check(undefined, undefined, { price: '單位' })).not.toThrow();
  });

  it('可編輯欄的鉛筆提示等裝飾不算進畫面值', async () => {
    host.columns.set([{ key: 'name', label: '名稱', primary: true, editor: { type: 'text' } }, BASE_COLUMNS[2]]);
    await vi.waitFor(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      expect(target.querySelector('td .dt-edit-icon')).not.toBeNull();
    });
    expect(target.querySelector('td .dt-edit-icon')!.textContent).toContain('edit');
    expect(() => check(undefined, undefined, { price: '單位' })).not.toThrow();
  });
});
