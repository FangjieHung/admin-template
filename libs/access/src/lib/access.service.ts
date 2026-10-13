import { EnvironmentProviders, Injectable, InjectionToken, computed, inject, makeEnvironmentProviders, signal } from '@angular/core';
import {
  ACCESS_ACTIONS,
  AccessAction,
  AccessCheck,
  AccessFeature,
  AccessRole,
  AccessUser,
  Permission,
  effectivePermissions,
  leastPresetRoleFor,
  sanitizePermissions,
  satisfies,
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

/** 會變動的角色資料：自訂角色、每位使用者的角色指派（沒有列出的使用者沿用 `AccessConfig.users`）。 */
export interface AccessRoleState {
  customRoles: readonly AccessRole[];
  assignments: Readonly<Record<string, readonly string[]>>;
}

/**
 * 目前身分與權限。所有讀取都是 signal：在 template、computed、effect 裡呼叫 `can()` 都會在身分或角色改變時自動更新。
 *
 * 角色管理（複製、修改、刪除角色、指派）在 `@admin-template/access/role-management` 的 `RoleManagementService`：
 * 只有角色頁用得到，拆開後不進 Initial bundle。
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
  readonly permissions = computed<ReadonlySet<Permission>>(
    () => effectivePermissions(this.roles(), this.currentUser()?.roleIds ?? []),
    // 內容相同就視為沒變：改別人的角色、存一個不影響自己的角色時，依賴它的畫面與守門不必重跑。
    { equal: (a, b) => a.size === b.size && [...a].every((p) => b.has(p)) },
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

  /**
   * 寫入自訂角色與指派並保存。給 `RoleManagementService` 用（它負責檢查名稱、預設角色唯讀等規則）；
   * app 請用 `RoleManagementService`，不要直接呼叫。
   * @internal
   */
  updateRoleState(update: (state: AccessRoleState) => AccessRoleState): void {
    const next = update({ customRoles: this.customRoles(), assignments: this.assignments() });
    this.customRoles.set(next.customRoles);
    this.assignments.set(next.assignments);
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
