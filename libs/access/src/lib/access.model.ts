/**
 * 權限模型（純 TypeScript，不依賴 Angular）：權限 = 功能 × 動作。
 *
 * - 功能（feature）由 app 宣告（`AccessConfig.features`），這裡不寫死任何功能。
 * - 角色分「預設角色」（app 宣告、唯讀）與「自訂角色」（複製預設角色後修改）。
 * - 一位使用者可以有多個角色，實際權限是各角色權限的聯集。
 *
 * 這一層只決定畫面要不要顯示或啟用；純前端無法擋住真正的請求，接後端時伺服器必須再檢查一次。
 */

/** 動作：檢視、建立、編輯、刪除、核准。順序就是矩陣欄位的順序。 */
export const ACCESS_ACTIONS = ['view', 'create', 'edit', 'delete', 'approve'] as const;
export type AccessAction = (typeof ACCESS_ACTIONS)[number];

/** 權限字串：`<功能 id>:<動作>`，例：`project:edit`。 */
export type Permission = `${string}:${AccessAction}`;

/** app 宣告的一個功能。 */
export interface AccessFeature {
  /** 不含冒號的 id，例：`ticket`。 */
  id: string;
  /** 畫面上的名稱，例：「工單」。 */
  label: string;
  /** 這個功能有哪些動作；不給就是全部五種。矩陣裡不適用的格子顯示「—」。 */
  actions?: readonly AccessAction[];
}

export interface AccessRole {
  id: string;
  name: string;
  /** 預設角色：app 宣告、唯讀；只能複製成自訂角色後再改。 */
  preset: boolean;
  permissions: readonly Permission[];
  /** 自訂角色是從哪個角色複製來的（只是記錄）。 */
  copiedFrom?: string;
}

export interface AccessUser {
  id: string;
  name: string;
  /** 這位使用者的角色（可以多個）。 */
  roleIds: readonly string[];
}

/** 一個要求：「需要某功能的某動作」。也可以寫成字串 `'project:edit'`。 */
export interface AccessRequirement {
  feature: string;
  action: AccessAction;
}

/** 指令、守門、側欄接受的寫法：字串、物件，或多個（全部都要有）。 */
export type AccessCheck = Permission | AccessRequirement | readonly (Permission | AccessRequirement)[];

export function isAccessAction(value: string): value is AccessAction {
  return (ACCESS_ACTIONS as readonly string[]).includes(value);
}

export function permissionOf(feature: string, action: AccessAction): Permission {
  return `${feature}:${action}`;
}

/** `'project:edit'` → `{ feature: 'project', action: 'edit' }`；格式不對回 null。 */
export function parsePermission(value: string): AccessRequirement | null {
  const at = value.lastIndexOf(':');
  if (at <= 0) return null;
  const feature = value.slice(0, at);
  const action = value.slice(at + 1);
  return isAccessAction(action) ? { feature, action } : null;
}

/** 把任何一種寫法攤平成要求清單；格式錯誤的字串會丟錯（寫錯權限名稱應該在開發時就發現）。 */
export function toRequirements(check: AccessCheck): AccessRequirement[] {
  const list = (Array.isArray(check) ? check : [check]) as (Permission | AccessRequirement)[];
  return list.map((item) => {
    if (typeof item !== 'string') return item;
    const parsed = parsePermission(item);
    if (!parsed) throw new Error(`access：「${item}」不是有效的權限，格式是「功能:動作」（動作：${ACCESS_ACTIONS.join('、')}）`);
    return parsed;
  });
}

/** 功能實際有的動作（沒宣告就是全部）。 */
export function actionsOf(feature: AccessFeature): readonly AccessAction[] {
  return feature.actions ?? ACCESS_ACTIONS;
}

/** 所有功能 × 適用動作的完整權限清單（系統管理員這種「全部」角色用）。 */
export function allPermissions(features: readonly AccessFeature[]): Permission[] {
  return features.flatMap((f) => actionsOf(f).map((a) => permissionOf(f.id, a)));
}

/** 多個角色的權限聯集；不存在的角色 id 直接略過。 */
export function effectivePermissions(roles: readonly AccessRole[], roleIds: readonly string[]): ReadonlySet<Permission> {
  const byId = new Map(roles.map((r) => [r.id, r]));
  const result = new Set<Permission>();
  for (const id of roleIds) {
    for (const p of byId.get(id)?.permissions ?? []) result.add(p);
  }
  return result;
}

/** 權限集合是否滿足要求（多個要求時全部都要有）。 */
export function satisfies(granted: ReadonlySet<Permission>, check: AccessCheck): boolean {
  return toRequirements(check).every((r) => granted.has(permissionOf(r.feature, r.action)));
}

/**
 * 「需要哪個角色」的提示：在預設角色裡找出最低的那個（預設角色由高到低宣告，取最後一個符合的）。
 * 沒有任何預設角色符合時回 null。
 */
export function leastPresetRoleFor(roles: readonly AccessRole[], check: AccessCheck): AccessRole | null {
  const presets = roles.filter((r) => r.preset);
  for (let i = presets.length - 1; i >= 0; i--) {
    if (satisfies(new Set(presets[i].permissions), check)) return presets[i];
  }
  return null;
}

// ---- 角色清單的操作（不改動輸入，回傳新陣列） ----

export type RoleNameError = 'required' | 'taken';

/** 名稱不可空白、不可與其他角色重複（不分大小寫、忽略前後空白）。 */
export function validateRoleName(name: string, roles: readonly AccessRole[], exceptId?: string): RoleNameError | null {
  const trimmed = name.trim();
  if (!trimmed) return 'required';
  const key = trimmed.toLocaleLowerCase();
  return roles.some((r) => r.id !== exceptId && r.name.trim().toLocaleLowerCase() === key) ? 'taken' : null;
}

/** 複製任何角色（預設或自訂）成一個新的自訂角色。 */
export function copyRole(source: AccessRole, id: string, name: string): AccessRole {
  return { id, name: name.trim(), preset: false, permissions: [...source.permissions], copiedFrom: source.id };
}

export function assertEditable(role: AccessRole | undefined, id: string): AccessRole {
  if (!role) throw new Error(`access：找不到角色「${id}」`);
  if (role.preset) throw new Error(`access：「${role.name}」是預設角色，不能修改或刪除；請先複製成自訂角色`);
  return role;
}

/** 只留下已宣告的功能與它適用的動作（防止舊資料或手改的儲存內容帶進不存在的權限）。 */
export function sanitizePermissions(permissions: Iterable<string>, features: readonly AccessFeature[]): Permission[] {
  const valid = new Set<string>(allPermissions(features));
  const order = allPermissions(features);
  const picked = new Set([...permissions].filter((p) => valid.has(p)));
  return order.filter((p) => picked.has(p));
}
