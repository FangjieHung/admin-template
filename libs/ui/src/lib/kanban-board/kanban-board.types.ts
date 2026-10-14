/** 看板的一欄。欄位順序就是陣列順序。 */
export interface KanbanColumn {
  id: string;
  title: string;
  /** WIP 上限：有給時欄頭顯示「張數 / 上限」，超過時欄位進入警告狀態（不擋移動）。 */
  wipLimit?: number;
  /** 欄頭標題下方的一行說明（例：「完成後由申請人確認」）。 */
  hint?: string;
  /** true：欄底出現「新增卡片」。 */
  allowAdd?: boolean;
}

/** 卡片換位置（受控模式：元件不改資料，由使用端依這個事件更新清單；`moveKanbanItem` 可以代勞）。 */
export interface KanbanMoveEvent<T> {
  item: T;
  fromColumnId: string;
  toColumnId: string;
  /** 原本在來源欄的第幾張（從 0 起算）。 */
  fromIndex: number;
  /** 放下後在目標欄的第幾張（從 0 起算；同一欄時是「拿掉原卡片之後」的位置，同 CDK 的 moveItemInArray）。 */
  toIndex: number;
}

/** `canMove` 拒絕的移動：卡片留在原位，原因交給使用端顯示（例如提示訊息）。 */
export interface KanbanMoveRejectedEvent<T> {
  item: T;
  fromColumnId: string;
  toColumnId: string;
  reason: string;
}

/** 欄底「新增卡片」按 Enter 送出（標題已去頭尾空白、不會是空字串）。 */
export interface KanbanAddCardEvent {
  columnId: string;
  title: string;
}

/** 換欄前的檢查：回 `true` 允許；回字串代表拒絕，字串就是原因。只在換欄時呼叫（同欄排序不問）。 */
export type KanbanCanMove<T> = (item: T, fromColumnId: string, toColumnId: string) => true | string;

export type KanbanKey = string | number;

export interface MoveKanbanItemOptions<T> {
  /** 卡片的唯一鍵（同 `[cardKey]`）。 */
  key: (item: T) => KanbanKey;
  /** 卡片在哪一欄（同 `[cardColumn]`）。 */
  column: (item: T) => string;
  /** 回傳換到另一欄之後的卡片（不可變更新，例：`(t, status) => ({ ...t, status })`）。 */
  withColumn: (item: T, columnId: string) => T;
}

/**
 * 依 `moved` 事件產生新的清單（不改原陣列）。各欄的卡片順序就是它們在清單裡的先後；
 * 被移動的卡片插在目標欄第 `toIndex` 張之前，目標欄沒有那麼多張時放在該欄最後一張之後（空欄時放在清單最後）。
 */
export function moveKanbanItem<T>(items: readonly T[], event: KanbanMoveEvent<T>, options: MoveKanbanItemOptions<T>): T[] {
  const movedKey = options.key(event.item);
  const rest = items.filter((item) => options.key(item) !== movedKey);
  if (rest.length === items.length) return [...items];
  const moved =
    event.fromColumnId === event.toColumnId ? event.item : options.withColumn(event.item, event.toColumnId);
  const target = rest.filter((item) => options.column(item) === event.toColumnId);
  const toIndex = Math.max(0, Math.min(event.toIndex, target.length));
  if (toIndex < target.length) {
    const before = rest.indexOf(target[toIndex]);
    return [...rest.slice(0, before), moved, ...rest.slice(before)];
  }
  if (target.length > 0) {
    const after = rest.indexOf(target[target.length - 1]) + 1;
    return [...rest.slice(0, after), moved, ...rest.slice(after)];
  }
  return [...rest, moved];
}
