import { AccessCheck, filterByAccess } from '@admin-template/access';

export interface NavLeaf {
  route: string;
  label: string;
  icon: string;
  /** 其他也歸屬這個選單項目的路徑前綴，用於頁首標題與側欄的目前位置。 */
  matchPrefixes?: string[];
  /** 選單項目右側的小標（例如「規劃中」）。 */
  badge?: string;
  /** 需要的權限；目前身分沒有時不列出（libs/access）。 */
  access?: AccessCheck;
}

export interface NavGroup {
  label: string;
  icon: string;
  children: NavLeaf[];
}

export type NavEntry = NavLeaf | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
}

/** 只留下目前身分看得到的項目；群組的子項目都被濾掉時，整個群組也不顯示。 */
export function filterNav(entries: readonly NavEntry[], can: (check: AccessCheck) => boolean): NavEntry[] {
  return entries.flatMap((entry): NavEntry[] => {
    if (!isNavGroup(entry)) return filterByAccess([entry], can);
    const children = filterByAccess(entry.children, can);
    return children.length ? [{ ...entry, children }] : [];
  });
}
