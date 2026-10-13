import { describe, expect, it } from 'vitest';
import {
  AccessRole,
  allPermissions,
  columnState,
  copyRole,
  effectivePermissions,
  leastPresetRoleFor,
  parsePermission,
  rowState,
  samePermissions,
  sanitizePermissions,
  satisfies,
  toRequirements,
  toggleColumn,
  togglePermission,
  toggleRow,
  uniqueCopyName,
  validateRoleName,
} from './access.model';
import { TEST_ACCESS_CONFIG } from './testing/access-fixture';

const FEATURES = TEST_ACCESS_CONFIG.features;
const ROLES: AccessRole[] = TEST_ACCESS_CONFIG.presetRoles.map((r) => ({ ...r, preset: true }));

describe('權限模型', () => {
  it('解析「功能:動作」字串；格式錯誤回 null，toRequirements 直接丟錯', () => {
    expect(parsePermission('project:edit')).toEqual({ feature: 'project', action: 'edit' });
    expect(parsePermission('project:fly')).toBeNull();
    expect(parsePermission('edit')).toBeNull();
    expect(() => toRequirements('project:fly' as never)).toThrow(/不是有效的權限/);
    expect(toRequirements(['ticket:view', { feature: 'report', action: 'view' }])).toHaveLength(2);
  });

  it('多個角色的權限是聯集；不存在的角色 id 被略過', () => {
    const granted = effectivePermissions(ROLES, ['member', 'viewer', 'ghost']);
    expect(granted.has('ticket:create')).toBe(true); // 成員
    expect(granted.has('settings:view')).toBe(true); // 檢視者
    expect(granted.has('ticket:delete')).toBe(false); // 兩者都沒有
    expect(satisfies(granted, ['ticket:edit', 'report:view'])).toBe(true);
    expect(satisfies(granted, ['ticket:edit', 'settings:edit'])).toBe(false);
    expect(effectivePermissions(ROLES, []).size).toBe(0);
  });

  it('「需要哪個角色」取最低的預設角色（宣告順序由高到低）', () => {
    expect(leastPresetRoleFor(ROLES, 'ticket:approve')?.name).toBe('主管');
    expect(leastPresetRoleFor(ROLES, 'ticket:create')?.name).toBe('成員');
    expect(leastPresetRoleFor(ROLES, 'settings:edit')?.name).toBe('系統管理員');
    expect(leastPresetRoleFor(ROLES, 'report:delete' as never)).toBeNull();
  });

  it('只留下已宣告的功能與適用的動作，並依矩陣順序排列', () => {
    expect(sanitizePermissions(['report:edit', 'settings:edit', 'ghost:view', 'ticket:view'], FEATURES)).toEqual([
      'ticket:view',
      'settings:edit',
    ]);
    expect(allPermissions(FEATURES)).toHaveLength(5 + 5 + 1 + 2);
  });

  it('複製角色：新的自訂角色、權限是複本、記錄來源', () => {
    const copy = copyRole(ROLES[1], 'custom-1', '  主管（副本） ');
    expect(copy).toEqual({ id: 'custom-1', name: '主管（副本）', preset: false, permissions: ROLES[1].permissions, copiedFrom: 'manager' });
    expect(copy.permissions).not.toBe(ROLES[1].permissions);
  });

  it('角色名稱：不可空白、不可重複（不分大小寫）；副本名稱自動加序號', () => {
    expect(validateRoleName('  ', ROLES)).toBe('required');
    expect(validateRoleName(' 主管 ', ROLES)).toBe('taken');
    expect(validateRoleName('主管', ROLES, 'manager')).toBeNull();
    const suffix = (n: number) => (n === 1 ? '（副本）' : `（副本 ${n}）`);
    const withCopy = [...ROLES, copyRole(ROLES[1], 'c1', '主管（副本）')];
    expect(uniqueCopyName('主管', ROLES, suffix)).toBe('主管（副本）');
    expect(uniqueCopyName('主管', withCopy, suffix)).toBe('主管（副本 2）');
  });

  it('整列切換：還沒全勾就全勾、全勾時全取消；狀態有 all／some／none', () => {
    const ticket = FEATURES[0];
    let perms = togglePermission([], 'ticket:view', true);
    expect(rowState(perms, ticket)).toBe('some');
    perms = toggleRow(perms, ticket);
    expect(rowState(perms, ticket)).toBe('all');
    expect(perms).toHaveLength(5);
    perms = toggleRow(perms, ticket);
    expect(rowState(perms, ticket)).toBe('none');
  });

  it('整欄切換只動到有這個動作的功能（報表沒有「編輯」）', () => {
    let perms = toggleColumn([], FEATURES, 'edit');
    expect(perms.sort()).toEqual(['project:edit', 'settings:edit', 'ticket:edit']);
    expect(columnState(perms, FEATURES, 'edit')).toBe('all');
    perms = toggleColumn(perms, FEATURES, 'edit');
    expect(perms).toEqual([]);
    expect(columnState(['ticket:view'], FEATURES, 'view')).toBe('some');
  });

  it('比較權限內容不管順序', () => {
    expect(samePermissions(['ticket:view', 'project:view'], ['project:view', 'ticket:view'])).toBe(true);
    expect(samePermissions(['ticket:view'], ['ticket:view', 'project:view'])).toBe(false);
  });
});
