import { CanDeactivateFn } from '@angular/router';

/** 有未儲存變更的頁面實作這個介面：回 true 才離開（通常是「沒有變更」或使用者在確認對話框選了捨棄）。 */
export interface HasUnsavedChanges {
  canLeave(): boolean | Promise<boolean>;
}

/**
 * 離開頁面前問一次：`{ path: 'roles', loadComponent: …, canDeactivate: [unsavedChangesGuard] }`。
 * 重新整理或關閉分頁另外要在頁面上監聽 `beforeunload`（瀏覽器只允許顯示它自己的提示）。
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  component?.canLeave ? component.canLeave() : true;
