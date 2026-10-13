import { describe, it, expect } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DUAL_MONTH_RANGE_PICKER_LABELS } from '../dual-month-range-picker/dual-month-range-picker-labels';
import { AdvancedFilterComponent } from './advanced-filter.component';
import { FilterChipsComponent } from './filter-chips.component';
import { FilterCondition, FilterField, FilterLabels } from './filter.types';

interface Row {
  name: string;
  status: string;
  due: string;
  amount: number;
}

const FILTER_LABELS: FilterLabels = {
  trigger: '篩選',
  triggerWithCount: '篩選（{count}）',
  panelTitle: '新增篩選條件',
  field: '欄位',
  chooseField: '選擇欄位',
  condition: '條件',
  textPlaceholder: '輸入關鍵字',
  selectPlaceholder: '請選擇',
  min: '最小',
  max: '最大',
  presetToday: '今天',
  presetWeek: '本週',
  presetCustom: '自訂區間',
  apply: '套用',
  cancel: '取消',
  close: '關閉',
  chipsLabel: '已套用的篩選條件',
  remove: '移除條件：{label}',
  clearAll: '清除全部',
  chip: '{field}：{value}',
  contains: '含「{text}」',
  atLeast: '{min} 以上',
  atMost: '{max} 以下',
  between: '{min}–{max}',
  dateFrom: '{date} 起',
  dateTo: '至 {date}',
  listSeparator: '、',
};

const FIELDS: FilterField<Row>[] = [
  { id: 'name', label: '名稱', type: 'text', value: (r) => r.name },
  {
    id: 'status',
    label: '狀態',
    type: 'multiSelect',
    options: [
      { value: 'open', label: '進行中' },
      { value: 'done', label: '已完成' },
      { value: 'hold', label: '暫停' },
    ],
    value: (r) => r.status,
  },
  { id: 'kind', label: '類別', type: 'select', options: [{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }], value: () => 'a' },
  { id: 'due', label: '到期日', type: 'dateRange', value: (r) => r.due },
  { id: 'amount', label: '金額', type: 'numberRange', value: (r) => r.amount },
];

@Component({
  imports: [AdvancedFilterComponent, FilterChipsComponent],
  template: `
    <lib-advanced-filter [fields]="fields" [labels]="labels" [(conditions)]="conditions" />
    <lib-filter-chips [fields]="fields" [labels]="labels" [(conditions)]="conditions" />
  `,
})
class HostComponent {
  readonly fields = FIELDS;
  readonly labels = FILTER_LABELS;
  readonly conditions = signal<readonly FilterCondition[]>([]);
}

function setup() {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: DUAL_MONTH_RANGE_PICKER_LABELS,
        useValue: { field: '日期', placeholder: '選擇日期', prevMonth: '上個月', nextMonth: '下個月', monthTitle: '{year}年{month}月' },
      },
    ],
  });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const host = fixture.componentInstance;
  const detect = () => fixture.detectChanges();
  const trigger = () => el.querySelector('.af-trigger') as HTMLButtonElement;
  const panel = () => document.querySelector('.af-panel') as HTMLElement | null;
  const open = () => {
    trigger().click();
    detect();
  };
  const chooseField = (id: string) => {
    const select = panel()!.querySelector('select') as HTMLSelectElement;
    select.value = id;
    select.dispatchEvent(new Event('change'));
    detect();
  };
  const apply = () => {
    (panel()!.querySelector('.af-apply') as HTMLButtonElement).click();
    detect();
  };
  const chips = () => [...el.querySelectorAll('.fc-text')].map((c) => c.textContent?.trim());
  return { el, host, detect, trigger, panel, open, chooseField, apply, chips };
}

describe('AdvancedFilterComponent', () => {
  it('按鈕開出面板（aria-expanded），還沒選欄位時「套用」停用', () => {
    const { trigger, panel, open } = setup();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    open();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(panel()?.getAttribute('role')).toBe('dialog');
    expect((panel()!.querySelector('.af-apply') as HTMLButtonElement).disabled).toBe(true);
  });

  it('文字條件：輸入後套用 → 條件與 chip，面板關閉，按鈕顯示條件數', () => {
    const { host, panel, open, chooseField, apply, chips, trigger, detect } = setup();
    open();
    chooseField('name');
    const input = panel()!.querySelector('input[type=text]') as HTMLInputElement;
    input.value = '  abc ';
    input.dispatchEvent(new Event('input'));
    apply();
    expect(host.conditions()).toEqual([{ field: 'name', type: 'text', text: 'abc' }]);
    expect(panel()).toBeNull();
    detect();
    expect(chips()).toEqual(['名稱：含「abc」']);
    expect(trigger().textContent).toContain('篩選（1）');
  });

  it('多選條件：勾選依選項順序存', () => {
    const { host, panel, open, chooseField, apply } = setup();
    open();
    chooseField('status');
    const boxes = [...panel()!.querySelectorAll('input[type=checkbox]')] as HTMLInputElement[];
    boxes[2].click();
    boxes[0].click();
    apply();
    expect(host.conditions()).toEqual([{ field: 'status', type: 'multiSelect', values: ['open', 'hold'] }]);
  });

  it('單選條件', () => {
    const { host, panel, open, chooseField, apply } = setup();
    open();
    chooseField('kind');
    const selects = panel()!.querySelectorAll('select');
    const select = selects[1] as HTMLSelectElement;
    select.value = 'b';
    select.dispatchEvent(new Event('change'));
    apply();
    expect(host.conditions()).toEqual([{ field: 'kind', type: 'select', value: 'b' }]);
  });

  it('數字區間：最小大於最大時自動對調；按 Enter 直接套用', () => {
    const { host, panel, open, chooseField, detect } = setup();
    open();
    chooseField('amount');
    const [min, max] = [...panel()!.querySelectorAll('input[type=number]')] as HTMLInputElement[];
    min.value = '900';
    min.dispatchEvent(new Event('input'));
    max.value = '100';
    max.dispatchEvent(new Event('input'));
    max.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    detect();
    expect(host.conditions()).toEqual([{ field: 'amount', type: 'numberRange', min: 100, max: 900 }]);
  });

  it('日期：選「今天」存相對選項；選「自訂區間」才出現雙月選擇器', () => {
    const { host, panel, open, chooseField, apply, detect } = setup();
    open();
    chooseField('due');
    const radios = () => [...panel()!.querySelectorAll('input[type=radio]')] as HTMLInputElement[];
    expect(radios()).toHaveLength(3);
    expect(panel()!.querySelector('lib-dual-month-range-picker')).toBeNull();
    radios()[2].click();
    detect();
    expect(panel()!.querySelector('lib-dual-month-range-picker')).not.toBeNull();
    radios()[0].click();
    detect();
    apply();
    expect(host.conditions()).toEqual([{ field: 'due', type: 'dateRange', preset: 'today' }]);
  });

  it('再選同一個欄位＝修改既有條件（同一欄位只有一個條件）', () => {
    const { host, panel, open, chooseField, apply } = setup();
    host.conditions.set([{ field: 'name', type: 'text', text: 'old' }, { field: 'amount', type: 'numberRange', min: 1 }]);
    open();
    chooseField('name');
    const input = panel()!.querySelector('input[type=text]') as HTMLInputElement;
    expect(input.value).toBe('old');
    input.value = 'new';
    input.dispatchEvent(new Event('input'));
    apply();
    expect(host.conditions()).toEqual([
      { field: 'name', type: 'text', text: 'new' },
      { field: 'amount', type: 'numberRange', min: 1 },
    ]);
  });

  it('Esc 關閉面板、焦點回到按鈕，不改條件', () => {
    const { host, panel, open, trigger, detect } = setup();
    open();
    panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    detect();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(host.conditions()).toEqual([]);
  });
});

describe('FilterChipsComponent', () => {
  it('沒有條件時不渲染', () => {
    const { el } = setup();
    expect(el.querySelector('.fc')).toBeNull();
  });

  it('× 移除單一條件（按鈕有名稱）；「清除全部」清空', () => {
    const { el, host, detect, chips } = setup();
    host.conditions.set([
      { field: 'name', type: 'text', text: 'a' },
      { field: 'status', type: 'multiSelect', values: ['done'] },
      { field: 'gone', type: 'text', text: '不顯示' },
    ]);
    detect();
    expect(chips()).toEqual(['名稱：含「a」', '狀態：已完成']);
    const removeBtn = el.querySelector('button[aria-label="移除條件：名稱：含「a」"]') as HTMLButtonElement;
    expect(removeBtn).not.toBeNull();
    removeBtn.click();
    detect();
    expect(host.conditions().map((c) => c.field)).toEqual(['status', 'gone']);
    (el.querySelector('.fc-clear') as HTMLButtonElement).click();
    detect();
    expect(host.conditions()).toEqual([]);
    expect(el.querySelector('.fc')).toBeNull();
  });
});
