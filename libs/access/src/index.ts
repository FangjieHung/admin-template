// 權限層的核心：模型、服務、守門、指令。畫面較重的元件走深路徑，不經過這個 barrel：
// - `@admin-template/access/permission-matrix`：權限矩陣編輯器、RoleDraft（編輯中的角色）
// - `@admin-template/access/identity-switcher`：「切換身分」小工具
export * from './lib/access.model';
export * from './lib/access.repository';
export * from './lib/access.service';
export * from './lib/access.guard';
export * from './lib/access-filter';
export * from './lib/can.directive';
export * from './lib/disabled-unless.directive';
export * from './lib/identity-switcher.service';
export * from './lib/unsaved-changes.guard';
