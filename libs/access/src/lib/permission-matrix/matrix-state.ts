import { AccessAction, AccessFeature, Permission, actionsOf, permissionOf } from '../access.model';

/**
 * 權限矩陣的狀態與批次切換（純函式）。放在深路徑 `@admin-template/access/permission-matrix`：
 * 只有編輯角色的頁面用得到，不進 Initial bundle。
 */
export type ToggleState = 'all' | 'some' | 'none';

function stateOf(granted: ReadonlySet<string>, cells: readonly Permission[]): ToggleState {
  const on = cells.filter((p) => granted.has(p)).length;
  if (!cells.length || on === 0) return 'none';
  return on === cells.length ? 'all' : 'some';
}

function setCells(permissions: readonly Permission[], cells: readonly Permission[], on: boolean): Permission[] {
  const next = new Set(permissions);
  for (const p of cells) {
    if (on) next.add(p);
    else next.delete(p);
  }
  return [...next];
}

export function rowCells(feature: AccessFeature): Permission[] {
  return actionsOf(feature).map((a) => permissionOf(feature.id, a));
}

export function columnCells(features: readonly AccessFeature[], action: AccessAction): Permission[] {
  return features.filter((f) => actionsOf(f).includes(action)).map((f) => permissionOf(f.id, action));
}

export function rowState(permissions: readonly Permission[], feature: AccessFeature): ToggleState {
  return stateOf(new Set(permissions), rowCells(feature));
}

export function columnState(permissions: readonly Permission[], features: readonly AccessFeature[], action: AccessAction): ToggleState {
  return stateOf(new Set(permissions), columnCells(features, action));
}

export function togglePermission(permissions: readonly Permission[], permission: Permission, on: boolean): Permission[] {
  return setCells(permissions, [permission], on);
}

/** 整列（一個功能的所有動作）：還沒全勾就全勾，已全勾就全取消。 */
export function toggleRow(permissions: readonly Permission[], feature: AccessFeature): Permission[] {
  return setCells(permissions, rowCells(feature), rowState(permissions, feature) !== 'all');
}

/** 整欄（所有功能的同一個動作）：還沒全勾就全勾，已全勾就全取消。 */
export function toggleColumn(permissions: readonly Permission[], features: readonly AccessFeature[], action: AccessAction): Permission[] {
  return setCells(permissions, columnCells(features, action), columnState(permissions, features, action) !== 'all');
}

/** 兩份權限內容是否相同（不管順序）。 */
export function samePermissions(a: readonly Permission[], b: readonly Permission[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((p) => set.has(p));
}
