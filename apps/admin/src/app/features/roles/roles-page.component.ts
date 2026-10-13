import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { AccessRole, AccessService, AccessUser, CanDirective, HasUnsavedChanges } from '@admin-template/access';
import { PermissionMatrixComponent, RoleDraft, uniqueCopyName } from '@admin-template/access/permission-matrix';
import {
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  EmptyStateComponent,
  StatusChipComponent,
  ToastService,
  openConfirmDialog,
} from '@admin-template/ui';
import {
  CONFIRM_DIALOG_LABEL_PROVIDERS,
  PERMISSION_MATRIX_LABEL_PROVIDERS,
  TOAST_PROVIDERS,
} from '../../shared/ui/component-label-providers';
import { ADMIN_DATA_TABLE_LABELS } from '../../shared/ui/data-table-labels';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

const ENTRY = detailOf('roles');
const NAME_ERRORS = { required: '請輸入角色名稱', taken: '已有同名的角色' } as const;

interface UserRow {
  id: string;
  name: string;
  roleIds: readonly string[];
  roleNames: string;
  permissionCount: number;
}

/**
 * 角色與權限（頁面樣板，/components/roles）：角色清單（預設唯讀、自訂可改）、權限矩陣、指派角色給使用者。
 * 需要「設定・檢視」才看得到；「設定・編輯」才能改（沒有時整頁唯讀，修改的按鈕不出現）。
 */
@Component({
  selector: 'app-roles-page',
  imports: [
    MatButtonModule,
    CanDirective,
    PermissionMatrixComponent,
    DataTableComponent,
    DataTableCellDirective,
    EmptyStateComponent,
    StatusChipComponent,
    ShowcasePageComponent,
    DemoBlockComponent,
  ],
  providers: [...PERMISSION_MATRIX_LABEL_PROVIDERS, ...CONFIRM_DIALOG_LABEL_PROVIDERS, ...TOAST_PROVIDERS],
  templateUrl: './roles-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './roles-page.component.scss'],
})
export class RolesPageComponent implements HasUnsavedChanges {
  protected readonly entry = ENTRY;
  protected readonly access = inject(AccessService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  protected readonly tableLabels = ADMIN_DATA_TABLE_LABELS;

  protected readonly draft = new RoleDraft();
  protected readonly selectedId = signal('');
  protected readonly status = signal('');

  protected readonly presetRoles = computed(() => this.access.roles().filter((r) => r.preset));
  protected readonly customRoles = computed(() => this.access.roles().filter((r) => !r.preset));
  protected readonly selected = computed(() => this.access.role(this.selectedId()) ?? this.presetRoles()[0]);
  protected readonly canEdit = computed(() => this.access.can('settings:edit'));
  /** 預設角色、或沒有「設定・編輯」時，矩陣唯讀。 */
  protected readonly readonly = computed(() => this.selected().preset || !this.canEdit());
  protected readonly nameError = computed(() => {
    if (this.readonly()) return null;
    const error = this.access.validateRoleName(this.draft.name(), this.selected().id);
    return error ? NAME_ERRORS[error] : null;
  });

  protected readonly userRows = computed<UserRow[]>(() =>
    this.access.users().map((u) => ({
      id: u.id,
      name: u.name,
      roleIds: u.roleIds,
      roleNames: this.roleNames(u),
      permissionCount: new Set(this.access.roles().filter((r) => u.roleIds.includes(r.id)).flatMap((r) => r.permissions)).size,
    })),
  );

  protected readonly columns: DataTableColumn<UserRow>[] = [
    { key: 'name', label: '使用者', primary: true },
    { key: 'roleNames', label: '角色', primary: true },
    { key: 'permissionCount', label: '實際權限', align: 'end' },
  ];

  constructor() {
    this.load(this.presetRoles()[0]);
  }

  protected permissionCount(role: AccessRole): number {
    return role.permissions.length;
  }

  protected userCount(role: AccessRole): number {
    return this.access.usersWithRole(role.id).length;
  }

  // ---- 選角色（有未儲存的變更時先問） ----

  protected async select(role: AccessRole): Promise<void> {
    if (role.id === this.selectedId()) return;
    if (await this.canLeave()) this.load(role);
  }

  private load(role: AccessRole): void {
    this.selectedId.set(role.id);
    this.draft.load(role);
  }

  // ---- 自訂角色 ----

  protected async copy(): Promise<void> {
    if (!(await this.canLeave())) return;
    const source = this.selected();
    const name = uniqueCopyName(source.name, this.access.roles(), (n) => (n === 1 ? '（副本）' : `（副本 ${n}）`));
    const created = this.access.copyRole(source.id, name);
    this.load(created);
    this.toast.success(`已建立「${created.name}」，可以開始修改權限`);
  }

  protected onNameInput(event: Event): void {
    this.draft.name.set((event.target as HTMLInputElement).value);
  }

  protected save(): void {
    if (!this.draft.dirty() || this.nameError()) return;
    const updated = this.access.updateRole(this.selected().id, {
      name: this.draft.name(),
      permissions: this.draft.permissions(),
    });
    this.draft.load(updated);
    this.toast.success(`已儲存「${updated.name}」`);
  }

  protected discard(): void {
    this.draft.reset();
    this.status.set('已捨棄未儲存的變更');
  }

  protected async remove(): Promise<void> {
    const role = this.selected();
    const users = this.access.usersWithRole(role.id).length;
    const ok = await openConfirmDialog(this.dialog, {
      title: `刪除「${role.name}」？`,
      message: users
        ? `有 ${users} 位使用者使用這個角色，刪除後他們會失去這個角色的權限。刪除後無法復原。`
        : '刪除後無法復原。',
      confirmLabel: '刪除角色',
    });
    if (!ok) return;
    this.access.deleteRole(role.id);
    this.load(this.presetRoles()[0]);
    this.toast.success(`已刪除「${role.name}」`);
  }

  protected async resetDemo(): Promise<void> {
    const ok = await openConfirmDialog(this.dialog, {
      message: '刪除所有自訂角色，並把每位使用者的角色還原成預設？',
      confirmLabel: '還原',
    });
    if (!ok) return;
    this.access.resetToDefaults();
    this.load(this.presetRoles()[0]);
    this.toast.info('已還原示範資料');
  }

  // ---- 指派角色 ----

  protected onAssign(row: UserRow, roleId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const next = checked ? [...row.roleIds, roleId] : row.roleIds.filter((id) => id !== roleId);
    this.access.assignRoles(row.id, next);
    const user = this.access.users().find((u) => u.id === row.id);
    this.status.set(`「${row.name}」的角色：${user ? this.roleNames(user) : ''}`);
  }

  protected hasRole(row: UserRow, roleId: string): boolean {
    return row.roleIds.includes(roleId);
  }

  private roleNames(user: AccessUser): string {
    return this.access.roles().filter((r) => user.roleIds.includes(r.id)).map((r) => r.name).join('、') || '沒有角色';
  }

  // ---- 未儲存的變更 ----

  /** 離開頁面（unsavedChangesGuard）或換角色前：有變更就問要不要捨棄。 */
  async canLeave(): Promise<boolean> {
    if (!this.draft.dirty()) return true;
    const discard = await openConfirmDialog(this.dialog, {
      title: '有尚未儲存的變更',
      message: `「${this.selected().name}」的變更還沒儲存，要捨棄嗎？`,
      confirmLabel: '捨棄變更',
      cancelLabel: '繼續編輯',
    });
    if (discard) this.draft.reset();
    return discard;
  }

  /** 重新整理或關閉分頁：瀏覽器只允許顯示它自己的提示。 */
  @HostListener('window:beforeunload', ['$event'])
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.draft.dirty()) event.preventDefault();
  }

  protected readonly whenToUse = [
    '後台要讓管理者自己調整「誰能做什麼」。',
    '預設角色不夠用時：複製一個最接近的，再改幾格。',
  ];
  protected readonly avoid = [
    '只有固定幾種角色、不需要調整：直接在 provideAccess 宣告預設角色就好，不必放這一頁。',
    '把這裡的設定當成安全防護：伺服器必須再檢查一次。',
  ];

  protected readonly usage = `<!-- 權限矩陣：元件不保存狀態，回傳新的權限清單，什麼時候存由頁面決定 -->
<lib-permission-matrix
  [features]="access.features"
  [actionLabels]="access.labels.actions"
  [value]="draft.permissions()"
  [readonly]="role.preset"
  (valueChange)="draft.permissions.set($event)" />

// 編輯中的角色與未儲存的變更
readonly draft = new RoleDraft();
this.draft.load(role);          // 開始編輯
this.draft.dirty();             // 名稱或權限跟載入時不同
this.access.updateRole(role.id, { name: this.draft.name(), permissions: this.draft.permissions() });

// 預設角色唯讀：複製成自訂角色再改
const copy = this.access.copyRole('manager', '區域主管');

// 離開頁面前確認（頁面實作 canLeave()）
{ path: 'roles', loadComponent: ..., canDeactivate: [unsavedChangesGuard] }`;

  protected readonly api: ApiSection[] = [
    {
      title: 'lib-permission-matrix 輸入',
      rows: [
        { name: '[features]', type: 'AccessFeature[]', default: '必填', description: '列：app 宣告的功能（各自可以只有部分動作，不適用的格子顯示「—」）。' },
        { name: '[actionLabels]', type: 'Record<AccessAction, string>', default: '必填', description: '欄：檢視、建立、編輯、刪除、核准的名稱。' },
        { name: '[value]', type: 'Permission[]', default: '必填', description: '目前勾選的權限（「功能:動作」）。' },
        { name: '[readonly]', type: 'boolean', default: 'false', description: '改成「有／沒有」圖示，沒有勾選框。' },
        { name: '[caption]', type: 'string', default: "''", description: '表格標題（報讀器）。' },
      ],
    },
    {
      title: 'lib-permission-matrix 輸出與注入',
      rows: [
        { name: '(valueChange)', type: 'Permission[]', description: '單格、整列、整欄切換後的新清單。整列／整欄：還沒全勾就全勾，已全勾就全取消。' },
        { name: 'PERMISSION_MATRIX_LABELS', type: 'PermissionMatrixLabels', default: '必填', description: '欄名、每格與批次切換的無障礙名稱（{feature}、{action}）、有／沒有／不適用。' },
        { name: '鍵盤', type: '—', description: 'Tab 依序經過勾選框、空白鍵切換；方向鍵在格子之間移動（跳過不適用的格子）。' },
      ],
    },
    {
      title: 'RoleDraft',
      rows: [
        { name: 'load(role) / reset() / clear()', type: 'void', description: '開始編輯、捨棄變更、清空。' },
        { name: 'name / permissions', type: 'WritableSignal', description: '草稿內容。' },
        { name: 'dirty()', type: 'Signal<boolean>', description: '名稱（忽略前後空白）或權限（不管順序）跟載入時不同。' },
      ],
    },
  ];
}
