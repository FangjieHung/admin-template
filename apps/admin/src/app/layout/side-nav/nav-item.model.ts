export interface NavLeaf {
  route: string;
  label: string;
  icon: string;
  /** 其他也歸屬這個選單項目的路徑前綴，用於頁首標題與側欄的目前位置。 */
  matchPrefixes?: string[];
  /** 選單項目右側的小標（例如「規劃中」）。 */
  badge?: string;
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
