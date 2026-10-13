import { computed, signal } from '@angular/core';
import { AccessRole, Permission, samePermissions } from '../access.model';

/**
 * 編輯中的角色：名稱與權限的草稿，和最後一次載入（或儲存）的內容比較，算出有沒有未儲存的變更。
 * 權限矩陣只回傳新的權限清單，什麼時候存由頁面決定；這個類別讓「未儲存變更」的判斷集中在一處。
 */
export class RoleDraft {
  private readonly base = signal<{ id: string | null; name: string; permissions: readonly Permission[] }>({
    id: null,
    name: '',
    permissions: [],
  });

  readonly name = signal('');
  readonly permissions = signal<readonly Permission[]>([]);
  readonly roleId = computed(() => this.base().id);

  /** 名稱（忽略前後空白）或權限（不管順序）跟載入時不同。 */
  readonly dirty = computed(() => {
    const base = this.base();
    return this.name().trim() !== base.name || !samePermissions(this.permissions(), base.permissions);
  });

  /** 開始編輯某個角色（或在儲存後以新內容為基準）。 */
  load(role: AccessRole): void {
    this.base.set({ id: role.id, name: role.name, permissions: [...role.permissions] });
    this.name.set(role.name);
    this.permissions.set([...role.permissions]);
  }

  /** 捨棄變更，回到載入時的內容。 */
  reset(): void {
    const base = this.base();
    this.name.set(base.name);
    this.permissions.set([...base.permissions]);
  }

  clear(): void {
    this.base.set({ id: null, name: '', permissions: [] });
    this.name.set('');
    this.permissions.set([]);
  }
}
