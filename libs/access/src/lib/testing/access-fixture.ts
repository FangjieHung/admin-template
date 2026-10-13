import { Provider } from '@angular/core';
import { ACCESS_REPOSITORY, AccessRepository, AccessSnapshot } from '../access.repository';
import { ACCESS_CONFIG, AccessConfig } from '../access.service';

/** 測試用的權限設定（只給 spec 用，不從 index.ts 匯出）。 */
export const TEST_ACCESS_CONFIG: AccessConfig = {
  features: [
    { id: 'ticket', label: '工單' },
    { id: 'project', label: '專案' },
    { id: 'report', label: '報表', actions: ['view'] },
    { id: 'settings', label: '設定', actions: ['view', 'edit'] },
  ],
  presetRoles: [
    {
      id: 'admin',
      name: '系統管理員',
      permissions: [
        'ticket:view', 'ticket:create', 'ticket:edit', 'ticket:delete', 'ticket:approve',
        'project:view', 'project:create', 'project:edit', 'project:delete', 'project:approve',
        'report:view', 'settings:view', 'settings:edit',
      ],
    },
    {
      id: 'manager',
      name: '主管',
      permissions: ['ticket:view', 'ticket:edit', 'ticket:approve', 'project:view', 'project:approve', 'report:view'],
    },
    { id: 'member', name: '成員', permissions: ['ticket:view', 'ticket:create', 'ticket:edit', 'project:view'] },
    { id: 'viewer', name: '檢視者', permissions: ['ticket:view', 'project:view', 'report:view', 'settings:view'] },
  ],
  users: [
    { id: 'u-admin', name: '林雅婷', roleIds: ['admin'] },
    { id: 'u-manager', name: '陳志明', roleIds: ['manager'] },
    { id: 'u-member', name: '王小明', roleIds: ['member'] },
    { id: 'u-viewer', name: '張美玲', roleIds: ['viewer'] },
    { id: 'u-multi', name: '李佩君', roleIds: ['member', 'viewer'] },
  ],
  defaultUserId: 'u-admin',
  labels: {
    actions: { view: '檢視', create: '建立', edit: '編輯', delete: '刪除', approve: '核准' },
    requiresRole: '需要{role}權限',
    denied: '沒有權限',
  },
};

/** 記憶體裡的 repository：可以預先放資料、模擬存不了。 */
export class MemoryAccessRepository implements AccessRepository {
  saved: AccessSnapshot | null;
  failSave = false;
  saves = 0;

  constructor(initial: AccessSnapshot | null = null) {
    this.saved = initial;
  }

  load(): AccessSnapshot | null {
    return this.saved ? structuredClone(this.saved) : null;
  }

  save(snapshot: AccessSnapshot): boolean {
    this.saves++;
    if (this.failSave) return false;
    this.saved = structuredClone(snapshot);
    return true;
  }
}

export function provideTestAccess(repository: AccessRepository = new MemoryAccessRepository(), config = TEST_ACCESS_CONFIG): Provider[] {
  return [
    { provide: ACCESS_CONFIG, useValue: config },
    { provide: ACCESS_REPOSITORY, useValue: repository },
  ];
}
