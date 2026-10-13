import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  AccessService,
  CanDirective,
  DisabledUnlessDirective,
  IdentitySwitcherService,
  permissionOf,
} from '@admin-template/access';
import { PermissionMatrixComponent } from '@admin-template/access/permission-matrix';
import { StatusChipComponent } from '@admin-template/ui';
import { PERMISSION_MATRIX_LABEL_PROVIDERS } from '../../shared/ui/component-label-providers';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

const ENTRY = detailOf('access-control');

/** 權限控制展示頁（/components/access-control）：守門、*libCan、[libDisabledUnless]、側欄過濾，跟著目前身分即時變化。 */
@Component({
  selector: 'app-access-control-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatSlideToggleModule,
    CanDirective,
    DisabledUnlessDirective,
    PermissionMatrixComponent,
    StatusChipComponent,
    ShowcasePageComponent,
    DemoBlockComponent,
  ],
  providers: [...PERMISSION_MATRIX_LABEL_PROVIDERS],
  templateUrl: './access-control-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './access-control-page.component.scss'],
})
export class AccessControlPageComponent {
  protected readonly entry = ENTRY;
  protected readonly access = inject(AccessService);
  protected readonly switcher = inject(IdentitySwitcherService);
  protected readonly result = signal('（尚未操作）');

  protected readonly currentRoleNames = computed(() => this.access.currentRoles().map((r) => r.name).join('、') || '沒有角色');
  protected readonly grantedList = computed(() => [...this.access.permissions()]);

  protected readonly users = computed(() =>
    this.access.users().map((u) => ({
      ...u,
      roles: this.access.roles().filter((r) => u.roleIds.includes(r.id)).map((r) => r.name).join('、'),
    })),
  );

  /** 每個示範功能一個受保護的網址（需要該功能的「檢視」）。 */
  protected readonly routes = computed(() => [
    ...this.access.features.map((f) => ({
      url: `/access-demo/${f.id}`,
      label: `${f.label}（示範頁）`,
      need: `${f.label}・檢視`,
      allowed: this.access.can(permissionOf(f.id, 'view')),
    })),
    {
      url: '/components/roles',
      label: '角色與權限（頁面樣板）',
      need: '設定・檢視',
      allowed: this.access.can('settings:view'),
    },
  ]);

  protected switchTo(userId: string): void {
    this.access.signIn(userId);
    this.result.set(`已換成 ${this.access.currentUser()?.name}（${this.currentRoleNames()}）`);
  }

  protected onSwitcherToggle(event: MatSlideToggleChange): void {
    this.switcher.setVisible(event.checked);
  }

  protected act(label: string): void {
    this.result.set(`按了「${label}」`);
  }

  protected readonly whenToUse = [
    '依角色決定使用者看得到哪些頁面、能按哪些按鈕。',
    '按鈕預設直接隱藏；使用者預期它在的地方（詳情頁的「核准」）改成停用＋說明需要的角色。',
    '直接輸入沒有權限的網址時，顯示「沒有權限」頁而不是空白或錯誤。',
  ];
  protected readonly avoid = [
    '當成安全防護：純前端只能隱藏畫面，不是安全防護；接後端時伺服器必須再檢查一次。',
    '資料層級的規則（只看自己部門、只改自己建立的）：那是業務規則，要由後端決定。',
  ];

  protected readonly usage = `// 1. 宣告功能、預設角色、使用者（app.config.ts 的 providers）
provideAccess({
  features: [
    { id: 'ticket', label: '工單' },
    { id: 'report', label: '報表', actions: ['view'] },
  ],
  presetRoles: [ // 由高到低
    { id: 'admin', name: '系統管理員', permissions: [...] },
    { id: 'member', name: '成員', permissions: ['ticket:view', 'ticket:create'] },
  ],
  users: [{ id: 'u1', name: '王小明', roleIds: ['member'] }],
  labels: { actions: { view: '檢視', ... }, requiresRole: '需要{role}權限', denied: '沒有權限' },
}),

// 2. 保護路由：沒有權限顯示「沒有權限」頁（網址不變）
{ path: 'reports', loadComponent: ..., canActivate: [accessGuard],
  data: { access: 'report:view' }, runGuardsAndResolvers: 'always' },
{ path: 'forbidden', loadComponent: ... },
// App 根元件的建構式：換身分時重新檢查目前這一頁
rerunGuardsOnAccessChange();

// 3. 隱藏（預設）與停用＋提示
<button *libCan="'ticket:create'">新增工單</button>
<button *libCan="'ticket:delete'; else readOnly">刪除</button>
<button matButton="filled" [libDisabledUnless]="'ticket:approve'" (click)="approve()">核准</button>

// 4. 程式裡判斷（signal：在 computed／template 裡會跟著身分更新）
readonly canExport = computed(() => this.access.can('report', 'view'));`;

  protected readonly api: ApiSection[] = [
    {
      title: 'AccessService',
      rows: [
        { name: 'can(feature, action) / can(check)', type: 'boolean', description: '目前身分有沒有權限；check 可以是「功能:動作」字串、{ feature, action } 或陣列（全部都要有）。讀 signal，在 computed／template 裡會自動更新。' },
        { name: 'currentUser()', type: 'Signal<AccessUser | null>', description: '目前身分；null＝未登入。' },
        { name: 'currentRoles()', type: 'Signal<AccessRole[]>', description: '目前身分的角色（可以多個）。' },
        { name: 'permissions()', type: 'Signal<ReadonlySet<Permission>>', description: '實際權限：所有角色的聯集。' },
        { name: 'hintFor(check)', type: 'string', description: '「需要主管權限」：最低的符合的預設角色。' },
        { name: 'signIn(userId) / signOut()', type: 'void', description: '換身分（示範登入、切換身分小工具用）。' },
        { name: 'roles() / users()', type: 'Signal<…>', description: '所有角色（預設在前）與使用者（含目前的指派）。' },
        { name: 'copyRole / updateRole / deleteRole / assignRoles', type: '…', description: '角色管理，在 RoleManagementService（@admin-template/access/role-management，不進 Initial bundle）；預設角色唯讀，改或刪會丟錯。' },
        { name: 'persisted()', type: 'Signal<boolean>', description: '最近一次儲存是否成功（私密模式等存不了時是 false）。' },
      ],
    },
    {
      title: '路由',
      rows: [
        { name: 'accessGuard', type: 'CanActivateFn', description: '讀路由 data.access；沒有權限導向 forbiddenPath（skipLocationChange，網址列不變），帶 ?need=。' },
        { name: 'accessMatchGuard', type: 'CanMatchFn', description: '同上，比對路由時就檢查；lazy 路由沒有權限就不下載。' },
        { name: 'rerunGuardsOnAccessChange()', type: 'void', description: '在 App 建構式呼叫一次：權限改變且影響目前這一頁時重新導覽。' },
        { name: 'filterByAccess(items, can)', type: 'T[]', description: '留下 access 沒標或有權限的項目（側欄、分頁標籤）。' },
        { name: 'unsavedChangesGuard', type: 'CanDeactivateFn', description: '頁面實作 canLeave()，有未儲存變更時先確認。' },
      ],
    },
    {
      title: '指令',
      rows: [
        { name: '*libCan="check; else tpl"', type: 'AccessCheck', default: '必填', description: '有權限才顯示；沒有時顯示 else（選填）。' },
        { name: '[libDisabledUnless]', type: 'AccessCheck', default: '必填', description: '沒有權限時 aria-disabled、淡化、攔下點擊，滑過或聚焦顯示提示；按鈕仍可聚焦。' },
        { name: 'libDisabledUnlessHint', type: 'string', default: '「需要{role}權限」', description: '自訂提示文字。' },
      ],
    },
    {
      title: '設定與注入',
      rows: [
        { name: 'provideAccess(config)', type: 'EnvironmentProviders', default: '必填', description: 'features、presetRoles（由高到低）、users、defaultUserId、forbiddenPath、labels。' },
        { name: 'ACCESS_REPOSITORY', type: 'AccessRepository', default: 'BrowserStorageAccessRepository', description: '自訂角色、指派與目前身分的存取；預設存在 localStorage 的 app.access，接後端時換掉。' },
        { name: 'IdentitySwitcherService', type: '{ visible, setVisible }', description: '「切換身分」小工具的開關（存在 app.identitySwitcher）。' },
      ],
    },
  ];
}
