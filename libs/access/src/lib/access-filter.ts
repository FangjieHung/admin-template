import { AccessCheck } from './access.model';

/** 選單項目、卡片、分頁標籤等可以標上權限要求的東西：沒標的一律顯示。 */
export interface AccessGated {
  access?: AccessCheck | null;
}

/**
 * 留下目前身分看得到的項目（例：側欄只列出有「檢視」權限的頁面）。
 * `can` 通常是 `(check) => access.can(check)`；在 computed 裡呼叫，身分改變時清單自動更新。
 */
export function filterByAccess<T extends AccessGated>(items: readonly T[], can: (check: AccessCheck) => boolean): T[] {
  return items.filter((item) => !item.access || can(item.access));
}
