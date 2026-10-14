import type { TreeCheckState, TreeKey } from './tree.types';

/** 取節點的鍵、取「已知」的子節點（靜態的 children 或已經延遲載入的；還沒載入回 null）。 */
export interface TreeCheckAccess<T> {
  key: (node: T) => TreeKey;
  children: (node: T, key: TreeKey) => readonly T[] | null;
}

/**
 * 依勾選的鍵算出每個「已知」節點的三態。規則：
 * 1. 節點的鍵在清單裡 → 它和所有已知子孫都是「全勾」（勾父節點＝連帶勾子孫；延遲載入、晚一點才載入的子節點也一樣）。
 * 2. 否則，有已知子節點的節點由子節點決定：全部全勾 → 全勾；一個都沒勾 → 未勾；其他 → 半勾。
 * 3. 沒有已知子節點（葉節點，或還沒載入的延遲節點）→ 鍵在清單裡才算勾。
 */
export function computeCheckStates<T>(
  roots: readonly T[],
  access: TreeCheckAccess<T>,
  checked: ReadonlySet<TreeKey>,
): Map<TreeKey, TreeCheckState> {
  const out = new Map<TreeKey, TreeCheckState>();
  const visit = (node: T, inherited: boolean): TreeCheckState => {
    const key = access.key(node);
    const kids = access.children(node, key);
    let state: TreeCheckState;
    if (inherited || checked.has(key)) {
      state = 'checked';
      kids?.forEach((kid) => visit(kid, true));
    } else if (kids && kids.length > 0) {
      let all = true;
      let any = false;
      for (const kid of kids) {
        const s = visit(kid, false);
        if (s !== 'checked') all = false;
        if (s !== 'unchecked') any = true;
      }
      state = all ? 'checked' : any ? 'mixed' : 'unchecked';
    } else {
      state = 'unchecked';
    }
    out.set(key, state);
    return state;
  };
  roots.forEach((root) => visit(root, false));
  return out;
}

/** 依樹的順序（前序）列出所有「全勾」的已知節點鍵：父節點在子節點前面。輸出永遠是正規化過的清單。 */
export function checkedKeysInOrder<T>(
  roots: readonly T[],
  access: TreeCheckAccess<T>,
  states: ReadonlyMap<TreeKey, TreeCheckState>,
): TreeKey[] {
  const out: TreeKey[] = [];
  const visit = (node: T) => {
    const key = access.key(node);
    if (states.get(key) === 'checked') out.push(key);
    access.children(node, key)?.forEach(visit);
  };
  roots.forEach(visit);
  return out;
}

/**
 * 切換一個節點的勾選，回傳新的勾選清單（正規化：所有全勾的已知節點，依樹的順序）。
 * 未勾或半勾 → 全勾（連同所有已知子孫）；全勾 → 未勾（連同所有已知子孫）。祖先依子節點重新計算：
 * 子節點全勾時父節點自動變全勾，取消任何一個子孫時祖先退成半勾或未勾。
 */
export function toggleCheckedKeys<T>(
  roots: readonly T[],
  access: TreeCheckAccess<T>,
  checked: ReadonlySet<TreeKey>,
  target: TreeKey,
): TreeKey[] {
  const before = computeCheckStates(roots, access, checked);
  const next = before.get(target) !== 'checked';
  const after = new Map<TreeKey, TreeCheckState>();
  const visit = (node: T, forced: boolean | null): TreeCheckState => {
    const key = access.key(node);
    const force = key === target ? next : forced;
    const kids = access.children(node, key);
    let state: TreeCheckState;
    if (kids && kids.length > 0) {
      let all = true;
      let any = false;
      for (const kid of kids) {
        const s = visit(kid, force);
        if (s !== 'checked') all = false;
        if (s !== 'unchecked') any = true;
      }
      state = all ? 'checked' : any ? 'mixed' : 'unchecked';
    } else if (force !== null) {
      state = force ? 'checked' : 'unchecked';
    } else {
      state = before.get(key) ?? 'unchecked';
    }
    after.set(key, state);
    return state;
  };
  roots.forEach((root) => visit(root, null));
  return checkedKeysInOrder(roots, access, after);
}
