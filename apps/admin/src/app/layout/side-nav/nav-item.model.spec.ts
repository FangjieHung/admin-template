import { describe, it, expect } from 'vitest';
import { isNavGroup } from './nav-item.model';

describe('isNavGroup', () => {
  it('有 children 的項目判斷為 group', () => {
    expect(isNavGroup({ label: '資料呈現', icon: 'table_view', children: [] })).toBe(true);
  });

  it('沒有 children 的項目判斷為 leaf', () => {
    expect(isNavGroup({ route: '/', label: '首頁', icon: 'home' })).toBe(false);
  });
});
