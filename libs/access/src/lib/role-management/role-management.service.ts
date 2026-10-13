import { Injectable, inject } from '@angular/core';
import { AccessRole, Permission, RoleNameError, assertEditable, copyRole, sanitizePermissions, validateRoleName } from '../access.model';
import { ACCESS_CONFIG, AccessService } from '../access.service';

function defaultRoleId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * 角色管理：複製、修改、刪除自訂角色，指派角色給使用者（預設角色唯讀）。變更會立刻反映在 `AccessService`
 * （`roles()`、`users()`、`can()`）並保存。
 *
 * 跟 `AccessService` 分開，是因為只有角色頁會用到：從深路徑 `@admin-template/access/role-management` 引入，
 * 這段邏輯就跟著角色頁進 lazy chunk，不進 Initial bundle。
 */
@Injectable({ providedIn: 'root' })
export class RoleManagementService {
  private readonly access = inject(AccessService);
  private readonly config = inject(ACCESS_CONFIG);

  /** 檢查角色名稱：空白或跟其他角色同名時回傳錯誤；`exceptId` 是正在改名的角色自己。 */
  validateRoleName(name: string, exceptId?: string): RoleNameError | null {
    return validateRoleName(name, this.access.roles(), exceptId);
  }

  /** 複製一個角色（預設或自訂）成新的自訂角色，回傳新角色。 */
  copyRole(sourceId: string, name: string): AccessRole {
    const source = this.access.role(sourceId);
    if (!source) throw new Error(`access：找不到角色「${sourceId}」`);
    const error = this.validateRoleName(name);
    if (error) throw new Error(`access：角色名稱不可用（${error}）`);
    const created = copyRole(source, (this.config.createRoleId ?? defaultRoleId)(), name);
    this.access.updateRoleState((s) => ({ ...s, customRoles: [...s.customRoles, created] }));
    return created;
  }

  /** 改自訂角色的名稱與權限；預設角色會丟錯。 */
  updateRole(id: string, changes: { name?: string; permissions?: readonly Permission[] }): AccessRole {
    const role = assertEditable(this.access.role(id), id);
    if (changes.name !== undefined) {
      const error = this.validateRoleName(changes.name, id);
      if (error) throw new Error(`access：角色名稱不可用（${error}）`);
    }
    const updated: AccessRole = {
      ...role,
      name: changes.name?.trim() ?? role.name,
      permissions: changes.permissions ? sanitizePermissions(changes.permissions, this.access.features) : role.permissions,
    };
    this.access.updateRoleState((s) => ({ ...s, customRoles: s.customRoles.map((r) => (r.id === id ? updated : r)) }));
    return updated;
  }

  /** 刪除自訂角色，並從所有使用者身上拿掉；預設角色會丟錯。 */
  deleteRole(id: string): void {
    assertEditable(this.access.role(id), id);
    const assignments: Record<string, readonly string[]> = {};
    for (const u of this.access.users()) assignments[u.id] = u.roleIds.filter((r) => r !== id);
    this.access.updateRoleState((s) => ({ customRoles: s.customRoles.filter((r) => r.id !== id), assignments }));
  }

  /** 指定使用者的角色（取代原本的）。不存在的角色 id 會被略過。 */
  assignRoles(userId: string, roleIds: readonly string[]): void {
    if (!this.config.users.some((u) => u.id === userId)) throw new Error(`access：找不到使用者「${userId}」`);
    const known = new Set(this.access.roles().map((r) => r.id));
    const ids = [...new Set(roleIds)].filter((id) => known.has(id));
    this.access.updateRoleState((s) => ({ ...s, assignments: { ...s.assignments, [userId]: ids } }));
  }

  /** 清掉所有自訂角色與指派，回到 app 宣告的預設值（示範用）。 */
  resetToDefaults(): void {
    this.access.updateRoleState(() => ({ customRoles: [], assignments: {} }));
  }
}
