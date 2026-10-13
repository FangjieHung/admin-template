import { EnvironmentProviders, Injectable, InjectionToken, computed, inject, makeEnvironmentProviders, signal } from '@angular/core';
import {
  ACCESS_ACTIONS,
  AccessAction,
  AccessCheck,
  AccessFeature,
  AccessRole,
  AccessUser,
  Permission,
  assertEditable,
  copyRole,
  effectivePermissions,
  leastPresetRoleFor,
  sanitizePermissions,
  satisfies,
  validateRoleName,
} from './access.model';
import { ACCESS_REPOSITORY, AccessSnapshot } from './access.repository';

/** 權限層需要的畫面文字（libs/access 不內建使用者可見字串）。 */
export interface AccessLabels {
  /** 五種動作的名稱，例：`{ view: '檢視', … }`。 */
  actions: Record<AccessAction, string>;
  /** 停用＋提示時的說明，`{role}` 換成最低符合的預設角色名稱，例：「需要{role}權限」。 */
  requiresRole: string;
  /** 沒有任何預設角色符合時的說明，例：「沒有權限」。 */
  denied: string;
}

/** app 宣告的權限設定：功能、預設角色、使用者（示範帳號或從後端取得的清單）。 */
export interface AccessConfig {
  features: readonly AccessFeature[];
  /** 由高到低排列（「需要{role}權限」的提示取最低的那個符合的角色）。 */
  presetRoles: readonly Omit<AccessRole, 'preset'>[];
  users: readonly AccessUser[];
  /** 第一次開啟（沒有存過身分）時的使用者；不給就是未登入。 */
  defaultUserId?: string;
  /** 沒有權限時導向的網址，預設 `/forbidden`（網址列維持原本的網址）。 */
  forbiddenPath?: string;
  labels: AccessLabels;
  /** 自訂角色的 id 產生方式；預設 `custom-<時間>-<亂數>`。 */
  createRoleId?: () => string;
}

export const ACCESS_CONFIG = new InjectionToken<AccessConfig>('ACCESS_CONFIG');

/** 在 app 根層提供一次：`providers: [provideAccess(MY_ACCESS_CONFIG)]`。 */
export function provideAccess(config: AccessConfig): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: ACCESS_CONFIG, useValue: config }]);
}

function defaultRoleId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * 目前身分與權限。所有讀取都是 signal：在 template、computed、effect 裡呼叫 `can()` 都會在身分或角色改變時自動更新。
 *
 * 純前端只能隱藏或停用畫面，不是安全防護；接後端時伺服器必須再檢查一次。
 */
@Injectable({ providedIn: 'root' })
export class AccessService {
  private readonly config = inject(ACCESS_CONFIG);
  private readonly repository = inject(ACCESS_REPOSITORY);

  readonly features = this.config.features;
  readonly actions = ACCESS_ACTIONS;
  readonly labels = this.config.labels;
  readonly forbiddenPath = this.config.forbiddenPath ?? '/forbidden';

  private readonly presetRoles: readonly AccessRole[] = this.config.presetRoles.map((r) => ({
    ...r,
    preset: true,
    permissions: sanitizePermissions(r.permissions, this.config.features),
  }));

  private readonly customRoles = signal<readonly AccessRole[]>([]);
  private readonly assignments = signal<Readonly<Record<string, readonly string[]>>>({});
  private readonly currentUserId = signal<string | null>(null);
  private readonly persistedState = signal(true);

  /** 預設角色在前、自訂角色在後。 */
  readonly roles = computed<readonly AccessRole[]>(() => [...this.presetRoles, ...this.customRoles()]);
  readonly users = computed<readonly AccessUser[]>(() =>
    this.config.users.map((u) => ({ ...u, roleIds: this.assignments()[u.id] ?? u.roleIds })),
  );
  readonly currentUser = computed<AccessUser | null>(() => this.users().find((u) => u.id === this.currentUserId()) ?? null);
  /** 目前使用者的角色（不存在的角色 id 已略過）。 */
  readonly currentRoles = computed<readonly AccessRole[]>(() => {
    const ids = this.currentUser()?.roleIds ?? [];
    return this.roles().filter((r) => ids.includes(r.id));
  });
  /** 目前使用者的實際權限：所有角色的聯集。 */
  readonly permissions = computed<ReadonlySet<Permission>>(() =>
    effectivePermissions(this.roles(), this.currentUser()?.roleIds ?? []),
  );
  /** 最近一次儲存是否成功；false 時提示「無法存到這台裝置」。 */
  readonly persisted = this.persistedState.asReadonly();

  constructor() {
    const snapshot = this.repository.load();
    if (snapshot) {
      this.customRoles.set(
        snapshot.customRoles
          .filter((r) => !this.presetRoles.some((p) => p.id === r.id))
          .map((r) => ({ ...r, preset: false, permissions: sanitizePermissions(r.permissions, this.features) })),
      );
      this.assignments.set(snapshot.assignments);
    }
    const userId = snapshot ? snapshot.currentUserId : (this.config.defaultUserId ?? null);
    this.currentUserId.set(this.config.users.some((u) => u.id === userId) ? userId : null);
  }

  // ---- 查詢 ----

  /**
   * 目前身分有沒有權限。兩種寫法：`can('project', 'edit')`、`can('project:edit')`；
   * 也可以傳陣列（全部都要有）。
   */
  can(featureOrCheck: string | AccessCheck, action?: AccessAction): boolean {
    const check: AccessCheck = action ? { feature: featureOrCheck as string, action } : (featureOrCheck as AccessCheck);
    return satisfies(this.permissions(), check);
  }

  /** 停用＋提示用的說明，例：「需要主管權限」。 */
  hintFor(check: AccessCheck): string {
    const role = leastPresetRoleFor(this.roles(), check);
    return role ? this.labels.requiresRole.replace('{role}', role.name) : this.labels.denied;
  }

  role(id: string): AccessRole | undefined {
    return this.roles().find((r) => r.id === id);
  }

  /** 有幾位使用者用這個角色。 */
  usersWithRole(roleId: string): AccessUser[] {
    return this.users().filter((u) => u.roleIds.includes(roleId));
  }

  validateRoleName(name: string, exceptId?: string) {
    return validateRoleName(name, this.roles(), exceptId);
  }

  // ---- 身分 ----

  signIn(userId: string): void {
    if (!this.config.users.some((u) => u.id === userId)) throw new Error(`access：找不到使用者「${userId}」`);
    this.currentUserId.set(userId);
    this.persist();
  }

  signOut(): void {
    this.currentUserId.set(null);
    this.persist();
  }

  // ---- 角色管理（預設角色唯讀） ----

  /** 複製一個角色（預設或自訂）成新的自訂角色，回傳新角色。 */
  copyRole(sourceId: string, name: string): AccessRole {
    const source = this.role(sourceId);
    if (!source) throw new Error(`access：找不到角色「${sourceId}」`);
    const error = this.validateRoleName(name);
    if (error) throw new Error(`access：角色名稱不可用（${error}）`);
    const created = copyRole(source, (this.config.createRoleId ?? defaultRoleId)(), name);
    this.customRoles.update((list) => [...list, created]);
    this.persist();
    return created;
  }

  /** 改自訂角色的名稱與權限；預設角色會丟錯。 */
  updateRole(id: string, changes: { name?: string; permissions?: readonly Permission[] }): AccessRole {
    const role = assertEditable(this.role(id), id);
    if (changes.name !== undefined) {
      const error = this.validateRoleName(changes.name, id);
      if (error) throw new Error(`access：角色名稱不可用（${error}）`);
    }
    const updated: AccessRole = {
      ...role,
      name: changes.name?.trim() ?? role.name,
      permissions: changes.permissions ? sanitizePermissions(changes.permissions, this.features) : role.permissions,
    };
    this.customRoles.update((list) => list.map((r) => (r.id === id ? updated : r)));
    this.persist();
    return updated;
  }

  /** 刪除自訂角色，並從所有使用者身上拿掉；預設角色會丟錯。 */
  deleteRole(id: string): void {
    assertEditable(this.role(id), id);
    this.customRoles.update((list) => list.filter((r) => r.id !== id));
    const next: Record<string, readonly string[]> = {};
    for (const u of this.users()) next[u.id] = u.roleIds.filter((r) => r !== id);
    this.assignments.set(next);
    this.persist();
  }

  /** 指定使用者的角色（取代原本的）。不存在的角色 id 會被略過。 */
  assignRoles(userId: string, roleIds: readonly string[]): void {
    if (!this.config.users.some((u) => u.id === userId)) throw new Error(`access：找不到使用者「${userId}」`);
    const known = new Set(this.roles().map((r) => r.id));
    this.assignments.update((a) => ({ ...a, [userId]: [...new Set(roleIds)].filter((id) => known.has(id)) }));
    this.persist();
  }

  /** 清掉所有自訂角色與指派，回到 app 宣告的預設值（示範用）。 */
  resetToDefaults(): void {
    this.customRoles.set([]);
    this.assignments.set({});
    this.persist();
  }

  private persist(): void {
    const snapshot: AccessSnapshot = {
      customRoles: this.customRoles().map((r) => ({ ...r, permissions: [...r.permissions] })),
      assignments: Object.fromEntries(Object.entries(this.assignments()).map(([k, v]) => [k, [...v]])),
      currentUserId: this.currentUserId(),
    };
    this.persistedState.set(this.repository.save(snapshot));
  }
}
