import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ACCESS_REPOSITORY, BrowserStorageAccessRepository, ACCESS_STORAGE_KEY } from './access.repository';
import { ACCESS_CONFIG, AccessService } from './access.service';
import { filterByAccess } from './access-filter';
import { RoleManagementService } from './role-management/role-management.service';
import { MemoryAccessRepository, TEST_ACCESS_CONFIG, provideTestAccess } from './testing/access-fixture';

function setup(repository = new MemoryAccessRepository()) {
  TestBed.configureTestingModule({ providers: provideTestAccess(repository) });
  return { access: TestBed.inject(AccessService), roles: TestBed.inject(RoleManagementService), repository };
}

describe('AccessService', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // 沒有 localStorage 的環境略過
    }
  });

  it('第一次開啟用 defaultUserId；can() 兩種寫法都可以', () => {
    const { access } = setup();
    expect(access.currentUser()?.name).toBe('林雅婷');
    expect(access.can('settings', 'edit')).toBe(true);
    expect(access.can('settings:edit')).toBe(true);
    expect(access.can({ feature: 'report', action: 'view' })).toBe(true);
  });

  it('多個角色：實際權限是聯集，換身分時 permissions 立刻改變', () => {
    const { access } = setup();
    access.signIn('u-multi');
    expect(access.currentRoles().map((r) => r.name)).toEqual(['成員', '檢視者']);
    expect(access.can('ticket:create')).toBe(true);
    expect(access.can('settings:view')).toBe(true);
    expect(access.can('settings:edit')).toBe(false);

    access.signIn('u-viewer');
    expect(access.can('ticket:create')).toBe(false);
    access.signOut();
    expect(access.currentUser()).toBeNull();
    expect(access.permissions().size).toBe(0);
  });

  it('提示文字取最低的預設角色：核准→主管，沒有任何預設角色有時用 denied', () => {
    const { access } = setup();
    expect(access.hintFor('ticket:approve')).toBe('需要主管權限');
    expect(access.hintFor('ticket:delete')).toBe('需要系統管理員權限');
  });

  it('預設角色唯讀：改名、改權限、刪除都丟錯，內容不變', () => {
    const { access, roles } = setup();
    expect(() => roles.updateRole('manager', { name: '經理' })).toThrow(/預設角色/);
    expect(() => roles.updateRole('manager', { permissions: [] })).toThrow(/預設角色/);
    expect(() => roles.deleteRole('viewer')).toThrow(/預設角色/);
    expect(access.role('manager')?.name).toBe('主管');
    expect(access.role('manager')?.permissions).toContain('ticket:approve');
  });

  it('複製成自訂角色，可以改名、改權限、刪除；刪除時從使用者身上拿掉', () => {
    const { access, roles, repository } = setup();
    const copy = roles.copyRole('manager', '區域主管');
    expect(copy.preset).toBe(false);
    expect(copy.copiedFrom).toBe('manager');
    expect(copy.permissions).toEqual(access.role('manager')?.permissions);
    expect(access.roles().map((r) => r.id)).toEqual(['admin', 'manager', 'member', 'viewer', copy.id]);

    roles.updateRole(copy.id, { name: '區域經理', permissions: ['ticket:view', 'report:edit' as never] });
    expect(access.role(copy.id)?.name).toBe('區域經理');
    expect(access.role(copy.id)?.permissions).toEqual(['ticket:view']); // 不存在的權限被丟掉

    roles.assignRoles('u-member', ['member', copy.id, 'ghost']);
    expect(access.users().find((u) => u.id === 'u-member')?.roleIds).toEqual(['member', copy.id]);
    expect(access.usersWithRole(copy.id).map((u) => u.id)).toEqual(['u-member']);

    roles.deleteRole(copy.id);
    expect(access.role(copy.id)).toBeUndefined();
    expect(access.users().find((u) => u.id === 'u-member')?.roleIds).toEqual(['member']);
    expect(repository.saved?.customRoles).toEqual([]);
  });

  it('resetToDefaults：清掉自訂角色與指派並保存', () => {
    const { access, roles, repository } = setup();
    const copy = roles.copyRole('manager', '區域主管');
    roles.assignRoles('u-member', [copy.id]);
    roles.resetToDefaults();
    expect(access.roles().map((r) => r.id)).toEqual(['admin', 'manager', 'member', 'viewer']);
    expect(access.users().find((u) => u.id === 'u-member')?.roleIds).toEqual(['member']);
    expect(repository.saved?.customRoles).toEqual([]);
    expect(repository.saved?.assignments).toEqual({});
  });

  it('名稱重複或空白時不能複製或改名', () => {
    const { roles } = setup();
    expect(() => roles.copyRole('manager', ' 主管 ')).toThrow(/taken/);
    const copy = roles.copyRole('manager', '甲');
    expect(() => roles.updateRole(copy.id, { name: '' })).toThrow(/required/);
    expect(roles.validateRoleName('甲', copy.id)).toBeNull();
  });

  it('重新開啟時讀回自訂角色、指派與身分；已登出的狀態也保留', () => {
    const repository = new MemoryAccessRepository();
    const { access: first, roles } = setup(repository);
    const copy = roles.copyRole('member', '外包');
    roles.assignRoles('u-viewer', [copy.id]);
    first.signIn('u-viewer');

    TestBed.resetTestingModule();
    const second = setup(repository).access;
    expect(second.role(copy.id)?.name).toBe('外包');
    expect(second.currentUser()?.id).toBe('u-viewer');
    expect(second.currentRoles().map((r) => r.name)).toEqual(['外包']);

    second.signOut();
    TestBed.resetTestingModule();
    expect(setup(repository).access.currentUser()).toBeNull();
  });

  it('存不了時照常運作，persisted() 變成 false', () => {
    const repository = new MemoryAccessRepository();
    repository.failSave = true;
    const { access, roles } = setup(repository);
    roles.copyRole('viewer', '訪客');
    expect(access.roles()).toHaveLength(5);
    expect(access.persisted()).toBe(false);
  });

  it('localStorage 丟例外或內容損壞時，用 app 宣告的預設值', () => {
    const throwing = new BrowserStorageAccessRepository(() => {
      throw new Error('SecurityError');
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: ACCESS_CONFIG, useValue: TEST_ACCESS_CONFIG },
        { provide: ACCESS_REPOSITORY, useValue: throwing },
      ],
    });
    const access = TestBed.inject(AccessService);
    expect(access.currentUser()?.id).toBe('u-admin');
    access.signIn('u-member');
    expect(access.persisted()).toBe(false);
    expect(access.can('ticket:create')).toBe(true);

    expect(new BrowserStorageAccessRepository(() => null).save({ customRoles: [], assignments: {}, currentUserId: null })).toBe(false);
  });

  it('BrowserStorageAccessRepository：寫入 app.access、讀回；損壞的 JSON 或形狀不對回 null 或只收正確的部分', () => {
    const repo = new BrowserStorageAccessRepository();
    expect(repo.save({ customRoles: [], assignments: { a: ['x'] }, currentUserId: 'a' })).toBe(true);
    expect(ACCESS_STORAGE_KEY.startsWith('app.')).toBe(true);
    expect(repo.load()).toEqual({ customRoles: [], assignments: { a: ['x'] }, currentUserId: 'a' });

    localStorage.setItem(ACCESS_STORAGE_KEY, '{not json');
    expect(repo.load()).toBeNull();

    localStorage.setItem(
      ACCESS_STORAGE_KEY,
      JSON.stringify({ customRoles: [{ id: 'c', name: 'C', permissions: ['ticket:view', 3], preset: true }, { id: 1 }], assignments: { a: 'x' } }),
    );
    expect(repo.load()).toEqual({
      customRoles: [{ id: 'c', name: 'C', preset: false, permissions: ['ticket:view'] }],
      assignments: {},
      currentUserId: null,
    });

    const failing = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } } as unknown as Storage;
    expect(new BrowserStorageAccessRepository(() => failing).save({ customRoles: [], assignments: {}, currentUserId: null })).toBe(false);
  });

  it('filterByAccess：沒標權限的一律留下，其餘依目前身分過濾', () => {
    const { access } = setup();
    const items = [{ id: 'home' }, { id: 'report', access: 'report:view' as const }, { id: 'settings', access: 'settings:view' as const }];
    access.signIn('u-member');
    expect(filterByAccess(items, (c) => access.can(c)).map((i) => i.id)).toEqual(['home']);
    access.signIn('u-viewer');
    expect(filterByAccess(items, (c) => access.can(c)).map((i) => i.id)).toEqual(['home', 'report', 'settings']);
  });
});
