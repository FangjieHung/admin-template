import { describe, it, expect } from 'vitest';
import {
  applyFilters,
  dateConditionRange,
  describeCondition,
  isConditionEmpty,
  matchesCondition,
  removeCondition,
  upsertCondition,
} from './filter-predicates';
import { FilterCondition, FilterField, FilterLabels } from './filter.types';

interface Row {
  id: string;
  name: string;
  owner: string;
  status: 'open' | 'done' | 'hold';
  due: string | null;
  amount: number | null;
}

const rows: Row[] = [
  { id: '1', name: 'Alpha 專案', owner: '王小明', status: 'open', due: '2026-10-13T10:00:00', amount: 1200 },
  { id: '2', name: 'Beta', owner: '陳大同', status: 'done', due: '2026-10-11T23:59:00', amount: 5000 },
  { id: '3', name: 'Gamma', owner: '林美惠', status: 'hold', due: '2026-10-17T08:00:00', amount: null },
  { id: '4', name: 'delta', owner: '王小明', status: 'open', due: null, amount: 300 },
];

const fields: FilterField<Row>[] = [
  { id: 'keyword', label: '關鍵字', type: 'text', value: (r) => [r.name, r.owner] },
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
  { id: 'statusOne', label: '單一狀態', type: 'select', options: [{ value: 'open', label: '進行中' }], value: (r) => r.status },
  { id: 'due', label: '到期日', type: 'dateRange', value: (r) => r.due },
  { id: 'amount', label: '金額', type: 'numberRange', unit: '元', value: (r) => r.amount },
];

const field = (id: string) => fields.find((f) => f.id === id)!;
// 2026-10-13 是星期二；本週（週日起算）＝ 10/11–10/17。
const NOW = new Date(2026, 9, 13, 9, 0);
const ids = (rs: readonly Row[]) => rs.map((r) => r.id);

describe('條件比對（各類型）', () => {
  it('文字：不分大小寫的「包含」，任一個值符合就算', () => {
    const c: FilterCondition = { field: 'keyword', type: 'text', text: '  ALPHA ' };
    expect(ids(applyFilters(rows, fields, [c], NOW))).toEqual(['1']);
    expect(ids(applyFilters(rows, fields, [{ field: 'keyword', type: 'text', text: '王' }], NOW))).toEqual(['1', '4']);
  });

  it('單選：值相等', () => {
    expect(ids(applyFilters(rows, fields, [{ field: 'statusOne', type: 'select', value: 'open' }], NOW))).toEqual(['1', '4']);
  });

  it('多選：值在清單裡', () => {
    const c: FilterCondition = { field: 'status', type: 'multiSelect', values: ['done', 'hold'] };
    expect(ids(applyFilters(rows, fields, [c], NOW))).toEqual(['2', '3']);
  });

  it('日期：今天、本週（週日起 7 天）、自訂區間含迄日整天；沒有日期的列不符合', () => {
    expect(ids(applyFilters(rows, fields, [{ field: 'due', type: 'dateRange', preset: 'today' }], NOW))).toEqual(['1']);
    expect(ids(applyFilters(rows, fields, [{ field: 'due', type: 'dateRange', preset: 'week' }], NOW))).toEqual([
      '1',
      '2',
      '3',
    ]);
    expect(
      ids(applyFilters(rows, fields, [{ field: 'due', type: 'dateRange', from: '2026-10-11', to: '2026-10-13' }], NOW)),
    ).toEqual(['1', '2']);
    expect(ids(applyFilters(rows, fields, [{ field: 'due', type: 'dateRange', from: '2026-10-14' }], NOW))).toEqual(['3']);
    const week = dateConditionRange({ field: 'due', type: 'dateRange', preset: 'week' }, NOW);
    expect(week.from).toEqual(new Date(2026, 9, 11));
    expect(week.to).toEqual(new Date(2026, 9, 18));
  });

  it('數字區間：含兩端；只有下限或上限也可以；沒有數值的列不符合', () => {
    expect(ids(applyFilters(rows, fields, [{ field: 'amount', type: 'numberRange', min: 300, max: 1200 }], NOW))).toEqual([
      '1',
      '4',
    ]);
    expect(ids(applyFilters(rows, fields, [{ field: 'amount', type: 'numberRange', min: 1000 }], NOW))).toEqual(['1', '2']);
    expect(ids(applyFilters(rows, fields, [{ field: 'amount', type: 'numberRange', max: 300 }], NOW))).toEqual(['4']);
  });

  it('多個條件是 AND', () => {
    const conds: FilterCondition[] = [
      { field: 'keyword', type: 'text', text: '王' },
      { field: 'amount', type: 'numberRange', min: 1000 },
    ];
    expect(ids(applyFilters(rows, fields, conds, NOW))).toEqual(['1']);
  });

  it('空條件不篩；找不到欄位（舊檢視裡已刪除的欄位）的條件被忽略', () => {
    expect(isConditionEmpty({ field: 'keyword', type: 'text', text: '  ' })).toBe(true);
    expect(isConditionEmpty({ field: 'amount', type: 'numberRange' })).toBe(true);
    expect(isConditionEmpty({ field: 'due', type: 'dateRange' })).toBe(true);
    expect(applyFilters(rows, fields, [{ field: 'gone', type: 'text', text: 'x' }], NOW)).toBe(rows);
  });

  it('條件型別與欄位型別不一致時視為不篩（不會把所有列濾掉）', () => {
    expect(matchesCondition(rows[0], field('amount'), { field: 'amount', type: 'text', text: 'zzz' }, NOW)).toBe(true);
  });
});

describe('upsert / remove', () => {
  it('同一欄位只留一個條件（取代且位置不變）；空條件等於移除', () => {
    let conds: FilterCondition[] = [];
    conds = upsertCondition(conds, { field: 'keyword', type: 'text', text: 'a' });
    conds = upsertCondition(conds, { field: 'amount', type: 'numberRange', min: 1 });
    conds = upsertCondition(conds, { field: 'keyword', type: 'text', text: 'b' });
    expect(conds).toEqual([
      { field: 'keyword', type: 'text', text: 'b' },
      { field: 'amount', type: 'numberRange', min: 1 },
    ]);
    conds = upsertCondition(conds, { field: 'keyword', type: 'text', text: '' });
    expect(conds.map((c) => c.field)).toEqual(['amount']);
    expect(removeCondition(conds, 'amount')).toEqual([]);
  });
});

describe('chip 文字', () => {
  const labels: FilterLabels = {
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
  const d = (c: FilterCondition) => describeCondition(c, field(c.field), labels);

  it('各類型的說明文字', () => {
    expect(d({ field: 'keyword', type: 'text', text: ' abc ' })).toBe('關鍵字：含「abc」');
    expect(d({ field: 'statusOne', type: 'select', value: 'open' })).toBe('單一狀態：進行中');
    expect(d({ field: 'status', type: 'multiSelect', values: ['open', 'hold'] })).toBe('狀態：進行中、暫停');
    expect(d({ field: 'due', type: 'dateRange', preset: 'today' })).toBe('到期日：今天');
    expect(d({ field: 'due', type: 'dateRange', from: '2026-10-01', to: '2026-10-31' })).toBe('到期日：2026/10/01–2026/10/31');
    expect(d({ field: 'due', type: 'dateRange', to: '2026-10-31' })).toBe('到期日：至 2026/10/31');
    expect(d({ field: 'due', type: 'dateRange', from: '2026-10-01' })).toBe('到期日：2026/10/01 起');
    expect(d({ field: 'amount', type: 'numberRange', min: 1000, max: 5000 })).toBe('金額：1,000–5,000 元');
    expect(d({ field: 'amount', type: 'numberRange', min: 1000 })).toBe('金額：1,000 元 以上');
    expect(d({ field: 'amount', type: 'numberRange', max: 300 })).toBe('金額：300 元 以下');
  });
});
