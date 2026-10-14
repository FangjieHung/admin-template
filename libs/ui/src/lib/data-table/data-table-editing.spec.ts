import { describe, it, expect } from 'vitest';
import {
  editKeyOf,
  formatEditValue,
  isCellEditable,
  isMultiCellPaste,
  normalizeDate,
  parseClipboardGrid,
  parseEditText,
  sameEditValue,
  validateEditValue,
} from './data-table-editing';
import { DataTableColumn, DataTableEditingLabels, DataTableEditor } from './data-table.types';

interface Row {
  id: string;
  name: string;
  ownerId: string | null;
  locked: boolean;
}

const LABELS = {
  required: '必填',
  invalidNumber: '請輸入數字',
  invalidDate: '請輸入日期',
  invalidOption: '「{text}」不是可選的值',
  toggleOn: '是',
  toggleOff: '否',
} as DataTableEditingLabels;

describe('表格內直接編輯的純函式', () => {
  it('editKeyOf：一般欄是 key，虛擬欄是 editor.field；沒有 editor 是 null', () => {
    const field: DataTableColumn<Row> = { key: 'name', label: '名稱', editor: { type: 'text' } };
    const virtual: DataTableColumn<Row> = {
      key: 'owner',
      virtual: true,
      label: '負責人',
      value: (r) => r.ownerId,
      editor: { type: 'text', field: 'ownerId' },
    };
    expect(editKeyOf(field)).toBe('name');
    expect(editKeyOf(virtual)).toBe('ownerId');
    expect(editKeyOf({ key: 'name', label: '名稱' } as DataTableColumn<Row>)).toBeNull();
  });

  it('isCellEditable 依 canEdit 決定每一列', () => {
    const col: DataTableColumn<Row> = { key: 'name', label: '名稱', editor: { type: 'text', canEdit: (r) => !r.locked } };
    expect(isCellEditable(col, { id: 'a', name: '', ownerId: null, locked: false })).toBe(true);
    expect(isCellEditable(col, { id: 'b', name: '', ownerId: null, locked: true })).toBe(false);
  });

  it('數字：去掉千分位、空白是 null、不是數字回傳錯誤', () => {
    const editor: DataTableEditor<Row> = { type: 'number' };
    expect(parseEditText(editor, ' 1,250 ', LABELS)).toEqual({ ok: true, value: 1250 });
    expect(parseEditText(editor, '', LABELS)).toEqual({ ok: true, value: null });
    expect(parseEditText(editor, '12a', LABELS)).toEqual({ ok: false, error: '請輸入數字' });
  });

  it('日期：接受 YYYY-MM-DD 與 Excel 常見的 YYYY/M/D，拒絕不存在的日期', () => {
    expect(normalizeDate('2026/1/5')).toBe('2026-01-05');
    expect(normalizeDate('2026-02-30')).toBeNull();
    expect(parseEditText({ type: 'date' }, '2026.10.14', LABELS)).toEqual({ ok: true, value: '2026-10-14' });
    expect(parseEditText({ type: 'date' }, '下週', LABELS)).toEqual({ ok: false, error: '請輸入日期' });
  });

  it('下拉：比對選項文字或值（不分大小寫）；開關：是／否與 true/false', () => {
    const select: DataTableEditor<Row> = {
      type: 'select',
      options: [
        { value: 'high', label: '高' },
        { value: 'low', label: '低' },
      ],
    };
    expect(parseEditText(select, '高', LABELS)).toEqual({ ok: true, value: 'high' });
    expect(parseEditText(select, 'LOW', LABELS)).toEqual({ ok: true, value: 'low' });
    expect(parseEditText(select, '中', LABELS)).toEqual({ ok: false, error: '「中」不是可選的值' });
    expect(formatEditValue(select, 'low', LABELS)).toBe('低');
    expect(parseEditText({ type: 'toggle' }, '是', LABELS)).toEqual({ ok: true, value: true });
    expect(parseEditText({ type: 'toggle' }, 'FALSE', LABELS)).toEqual({ ok: true, value: false });
    expect(formatEditValue({ type: 'toggle' }, true, LABELS)).toBe('是');
  });

  it('自訂 parse 丟出的錯誤訊息就是這一格的錯誤', () => {
    const editor: DataTableEditor<Row> = {
      type: 'text',
      parse: (t) => {
        if (!t.startsWith('No.')) throw new Error('要用 No. 開頭');
        return t.slice(3);
      },
    };
    expect(parseEditText(editor, 'No.42', LABELS)).toEqual({ ok: true, value: '42' });
    expect(parseEditText(editor, '42', LABELS)).toEqual({ ok: false, error: '要用 No. 開頭' });
  });

  it('validateEditValue：必填先檢查，再跑欄位自己的 validate', () => {
    const editor: DataTableEditor<Row> = { type: 'text', required: true, validate: (v) => (String(v).length > 3 ? '太長' : null) };
    const row = { id: 'a', name: '', ownerId: null, locked: false };
    expect(validateEditValue(editor, ' ', row, LABELS)).toBe('必填');
    expect(validateEditValue(editor, 'abcd', row, LABELS)).toBe('太長');
    expect(validateEditValue(editor, 'abc', row, LABELS)).toBeNull();
  });

  it('sameEditValue：空白、null、undefined 視為相同', () => {
    expect(sameEditValue('', null)).toBe(true);
    expect(sameEditValue(undefined, '  ')).toBe(true);
    expect(sameEditValue(3, 3)).toBe(true);
    expect(sameEditValue(3, '3')).toBe(false);
  });

  it('parseClipboardGrid：Tab 與換行分隔、引號裡的換行與 Tab、CRLF、結尾的換行不算一列', () => {
    expect(parseClipboardGrid('a\tb\r\nc\td\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(parseClipboardGrid('"第一行\n第二行"\t"有""引號"""\nx\t\n')).toEqual([
      ['第一行\n第二行', '有"引號"'],
      ['x', ''],
    ]);
    expect(parseClipboardGrid('單一格')).toEqual([['單一格']]);
    expect(isMultiCellPaste('單一格\n')).toBe(false);
    expect(isMultiCellPaste('a\tb')).toBe(true);
  });
});
