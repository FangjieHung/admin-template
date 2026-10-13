import { InjectionToken } from '@angular/core';
import { AccessRole, Permission } from './access.model';

/**
 * 會變動、需要保存的權限資料：自訂角色、每位使用者的角色、目前的身分。
 * 預設角色與功能清單是 app 宣告的（`AccessConfig`），不存在這裡。
 */
export interface AccessSnapshot {
  customRoles: AccessRole[];
  /** 使用者 id → 角色 id；沒有列出的使用者沿用 `AccessConfig.users` 的預設角色。 */
  assignments: Record<string, string[]>;
  /** 目前身分；null＝已登出。沒有存過時由 `AccessConfig.defaultUserId` 決定。 */
  currentUserId: string | null;
}

/**
 * 權限資料的存取介面。預設存在瀏覽器（`BrowserStorageAccessRepository`）；
 * 接後端時換成自己的實作：`{ provide: ACCESS_REPOSITORY, useClass: HttpAccessRepository }`。
 */
export interface AccessRepository {
  /** 讀不到或內容損壞時回 null（用 app 宣告的預設值）。 */
  load(): AccessSnapshot | null;
  /** 成功存下回 true；存不了（私密模式、空間已滿、被封鎖）回 false，畫面會提示「關閉頁面後會遺失」。 */
  save(snapshot: AccessSnapshot): boolean;
}

export const ACCESS_STORAGE_KEY = 'app.access';

/**
 * 存在 localStorage 的實作。每次讀寫都包 try/catch：私密視窗、被清除或封鎖的網站資料都可能讓
 * localStorage 丟例外或回空值，這時只是不保存，畫面照常運作。
 */
export class BrowserStorageAccessRepository implements AccessRepository {
  constructor(
    private readonly storage: () => Storage | null = () => globalThis.localStorage ?? null,
    private readonly key = ACCESS_STORAGE_KEY,
  ) {}

  load(): AccessSnapshot | null {
    let raw: string | null;
    try {
      raw = this.storage()?.getItem(this.key) ?? null;
    } catch {
      return null;
    }
    if (!raw) return null;
    try {
      return parseSnapshot(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  save(snapshot: AccessSnapshot): boolean {
    try {
      const storage = this.storage();
      if (!storage) return false;
      storage.setItem(this.key, JSON.stringify({ version: 1, ...snapshot }));
      return true;
    } catch {
      return false;
    }
  }
}

/** 只收下形狀正確的部分；其餘丟掉（舊版本或被手改過的內容不讓整頁壞掉）。 */
export function parseSnapshot(value: unknown): AccessSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const customRoles = Array.isArray(v['customRoles'])
    ? (v['customRoles'] as unknown[]).flatMap((r) => {
        if (!r || typeof r !== 'object') return [];
        const role = r as Record<string, unknown>;
        if (typeof role['id'] !== 'string' || typeof role['name'] !== 'string' || !Array.isArray(role['permissions'])) return [];
        const parsed: AccessRole = {
          id: role['id'],
          name: role['name'],
          preset: false,
          permissions: (role['permissions'] as unknown[]).filter((p): p is Permission => typeof p === 'string') as Permission[],
        };
        if (typeof role['copiedFrom'] === 'string') parsed.copiedFrom = role['copiedFrom'];
        return [parsed];
      })
    : [];
  const assignments: Record<string, string[]> = {};
  if (v['assignments'] && typeof v['assignments'] === 'object') {
    for (const [userId, ids] of Object.entries(v['assignments'] as Record<string, unknown>)) {
      if (Array.isArray(ids)) assignments[userId] = ids.filter((id): id is string => typeof id === 'string');
    }
  }
  const currentUserId = typeof v['currentUserId'] === 'string' ? v['currentUserId'] : null;
  return { customRoles, assignments, currentUserId };
}

export const ACCESS_REPOSITORY = new InjectionToken<AccessRepository>('ACCESS_REPOSITORY', {
  providedIn: 'root',
  factory: () => new BrowserStorageAccessRepository(),
});
