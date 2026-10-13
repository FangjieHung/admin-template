import { describe, expect, it } from 'vitest';
import { convertToParamMap } from '@angular/router';
import { readListUrl, sameListParams, toListQueryParams } from './ticket-list-url';

const OPTIONS = { sortKeys: ['id', 'dueDate'], pageSizes: [25, 50, 100] };
const DEFAULTS = { filters: [], sort: null, pageSize: 25 };

describe('列表狀態 ↔ 網址 query params', () => {
  it('預設狀態不寫任何參數；有變更的才寫，頁碼從 1 起算', () => {
    expect(toListQueryParams({ q: '', view: null, filters: [], sort: null, pageSize: 25, page: 0 }, DEFAULTS)).toEqual({
      q: null,
      view: null,
      f: null,
      sort: null,
      size: null,
      page: null,
    });
    const params = toListQueryParams(
      {
        q: ' 印表機 ',
        view: null,
        filters: [{ field: 'status', type: 'multiSelect', values: ['waiting'] }],
        sort: { key: 'dueDate', direction: 'asc' },
        pageSize: 50,
        page: 2,
      },
      DEFAULTS,
    );
    expect(params).toEqual({
      q: '印表機',
      view: null,
      f: '[{"field":"status","type":"multiSelect","values":["waiting"]}]',
      sort: 'dueDate.asc',
      size: '50',
      page: '3',
    });
  });

  it('讀回來的結果跟寫出去的一致（重新整理後還原）', () => {
    const state = {
      q: '印表機',
      view: null,
      filters: [{ field: 'status', type: 'multiSelect' as const, values: ['waiting'] }],
      sort: { key: 'dueDate', direction: 'desc' as const },
      pageSize: 100,
      page: 1,
    };
    const params = toListQueryParams(state, DEFAULTS);
    const read = readListUrl(convertToParamMap(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null))), OPTIONS);
    expect(read).toEqual({ q: '印表機', view: null, filters: state.filters, sort: state.sort, pageSize: 100, page: 1 });
  });

  it('選了已儲存檢視：只寫跟檢視不同的部分；跟檢視不同的「不排序」寫成 sort=none', () => {
    const base = { filters: [{ field: 'priority', type: 'multiSelect' as const, values: ['urgent'] }], sort: { key: 'id', direction: 'asc' as const }, pageSize: 50 };
    const params = toListQueryParams({ q: '', view: 'v1', filters: base.filters, sort: null, pageSize: 50, page: 0 }, base);
    expect(params).toEqual({ q: null, view: 'v1', f: null, sort: 'none', size: null, page: null });
    expect(readListUrl(convertToParamMap({ view: 'v1', sort: 'none' }), OPTIONS)).toEqual({ q: '', view: 'v1', sort: null, page: 0 });
  });

  it('網址被亂改：不認得的排序欄、每頁筆數、壞掉的 JSON、負的頁碼都忽略', () => {
    expect(readListUrl(convertToParamMap({ sort: 'evil.asc', size: '7', f: '{oops', page: '-3' }), OPTIONS)).toEqual({
      q: '',
      view: null,
      page: 0,
    });
    expect(readListUrl(convertToParamMap({ f: '[1,{"field":"status","type":"select","value":"open"}]' }), OPTIONS).filters).toEqual([
      { field: 'status', type: 'select', value: 'open' },
    ]);
  });

  it('sameListParams 只比較列表的參數（null 與沒寫一樣；demo 不算）', () => {
    expect(sameListParams({ q: null, page: '2', demo: 'error' }, { page: '2' })).toBe(true);
    expect(sameListParams({ page: '2' }, { page: '3' })).toBe(false);
  });
});
