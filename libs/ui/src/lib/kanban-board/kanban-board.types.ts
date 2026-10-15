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

/** 分組（泳道）：`[groupBy]` 回傳的值對到 `id`。順序就是畫面由上到下的順序。 */
export interface KanbanGroup {
  id: string;
  title: string;
}

/** 分組模式下，移動前後的分組（`[groupBy]` 沒給時不會有）。 */
export interface KanbanGroupChange {
  fromGroupId: string;
  toGroupId: string;
}

/**
 * 卡片換位置（受控模式：元件不改資料，由使用端依這個事件更新清單；`moveKanbanItem` 可以代勞）。
 * 分組模式下另外帶 `fromGroupId`／`toGroupId`：兩者不同就是跨道（例：改負責人），索引是在「欄 × 分組」那一格裡的位置。
 */
export interface KanbanMoveEvent<T> extends Partial<KanbanGroupChange> {
  item: T;
  fromColumnId: string;
  toColumnId: string;
  /** 原本在來源格的第幾張（從 0 起算）。 */
  fromIndex: number;
  /** 放下後在目標格的第幾張（從 0 起算；同一格時是「拿掉原卡片之後」的位置，同 CDK 的 moveItemInArray）。 */
  toIndex: number;
}

/** `canMove` 拒絕的移動：卡片留在原位，原因交給使用端顯示（例如提示訊息）。分組模式下另外帶前後的分組。 */
export interface KanbanMoveRejectedEvent<T> extends Partial<KanbanGroupChange> {
  item: T;
  fromColumnId: string;
  toColumnId: string;
  reason: string;
}

/** 欄底「新增卡片」按 Enter 送出（標題已去頭尾空白、不會是空字串）。分組模式下新增列在每一格底下，另外帶 `groupId`。 */
export interface KanbanAddCardEvent {
  columnId: string;
  title: string;
  groupId?: string;
}

/**
 * 移動前的檢查：回 `true` 允許；回字串代表拒絕，字串就是原因。換欄時呼叫（同欄排序不問）；
 * 分組模式下換道也會呼叫，第四個參數帶前後的分組（沒有分組時是 undefined）。
 */
export type KanbanCanMove<T> = (
  item: T,
  fromColumnId: string,
  toColumnId: string,
  groups?: KanbanGroupChange,
) => true | string;

export type KanbanKey = string | number;

export interface MoveKanbanItemOptions<T> {
  /** 卡片的唯一鍵（同 `[cardKey]`）。 */
  key: (item: T) => KanbanKey;
  /** 卡片在哪一欄（同 `[cardColumn]`）。 */
  column: (item: T) => string;
  /** 回傳換到另一欄之後的卡片（不可變更新，例：`(t, status) => ({ ...t, status })`）。 */
  withColumn: (item: T, columnId: string) => T;
  /** 分組模式：卡片在哪一組（同 `[groupBy]`）。事件帶 `toGroupId` 時，位置改成在「欄 × 分組」那一格裡算。 */
  group?: (item: T) => string;
  /** 分組模式：回傳換到另一組之後的卡片（例：`(t, owner) => ({ ...t, owner })`）。 */
  withGroup?: (item: T, groupId: string) => T;
}

/**
 * 依 `moved` 事件產生新的清單（不改原陣列）。各欄的卡片順序就是它們在清單裡的先後；
 * 被移動的卡片插在目標欄第 `toIndex` 張之前，目標欄沒有那麼多張時放在該欄最後一張之後（空欄時放在清單最後）。
 * 分組模式（事件帶 `toGroupId` 且給了 `group`）：「目標欄」改成目標欄裡屬於目標分組的那幾張，換組時用 `withGroup` 更新卡片。
 */
export function moveKanbanItem<T>(items: readonly T[], event: KanbanMoveEvent<T>, options: MoveKanbanItemOptions<T>): T[] {
  const movedKey = options.key(event.item);
  const rest = items.filter((item) => options.key(item) !== movedKey);
  if (rest.length === items.length) return [...items];
  let moved =
    event.fromColumnId === event.toColumnId ? event.item : options.withColumn(event.item, event.toColumnId);
  const groupOf = event.toGroupId === undefined ? undefined : options.group;
  if (options.withGroup && event.toGroupId !== undefined && event.fromGroupId !== event.toGroupId) {
    moved = options.withGroup(moved, event.toGroupId);
  }
  const target = rest.filter(
    (item) => options.column(item) === event.toColumnId && (!groupOf || groupOf(item) === event.toGroupId),
  );
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
