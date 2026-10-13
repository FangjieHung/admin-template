import { AccessConfig, AccessFeature, allPermissions, permissionOf } from '@admin-template/access';

/**
 * 展示 app 的權限設定（示範資料，中性）：新專案把功能、預設角色換成自己的，使用者改成從後端取得。
 * 這份檔案在 Initial bundle 裡（側欄過濾、路由守門都要用），只放必要的名稱。
 * 純前端只能隱藏畫面，不是安全防護；接後端時伺服器必須再檢查一次。
 */
export const DEMO_FEATURES: readonly AccessFeature[] = [
  { id: 'ticket', label: '工單' },
  { id: 'project', label: '專案' },
  { id: 'contact', label: '聯絡人', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'report', label: '報表', actions: ['view'] },
  // 系統設定（角色與權限）。殼層的「設定」頁（外觀偏好）是個人設定，不受這裡管。
  { id: 'settings', label: '設定', actions: ['view', 'edit'] },
];

const ALL = allPermissions(DEMO_FEATURES);
const VIEW_ALL = DEMO_FEATURES.map((f) => permissionOf(f.id, 'view'));

export const DEMO_ACCESS_CONFIG: AccessConfig = {
  features: DEMO_FEATURES,
  // 由高到低：「需要{role}權限」的提示取最低的那個符合的角色。
  presetRoles: [
    { id: 'admin', name: '系統管理員', permissions: ALL },
    { id: 'manager', name: '主管', permissions: ALL.filter((p) => !p.startsWith('settings:')) },
    {
      id: 'member',
      name: '成員',
      permissions: ['ticket:view', 'ticket:create', 'ticket:edit', 'project:view', 'project:create', 'project:edit', 'contact:view'],
    },
    { id: 'viewer', name: '檢視者', permissions: VIEW_ALL },
  ],
  users: [
    { id: 'u-admin', name: '林雅婷', roleIds: ['admin'] },
    { id: 'u-manager', name: '陳志明', roleIds: ['manager'] },
    { id: 'u-member', name: '王小明', roleIds: ['member'] },
    { id: 'u-viewer', name: '張美玲', roleIds: ['viewer'] },
    { id: 'u-multi', name: '李佩君', roleIds: ['member', 'viewer'] },
  ],
  defaultUserId: 'u-admin',
  forbiddenPath: '/forbidden',
  labels: {
    actions: { view: '檢視', create: '建立', edit: '編輯', delete: '刪除', approve: '核准' },
    requiresRole: '需要{role}權限',
    denied: '沒有權限',
  },
};
