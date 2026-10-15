import { InjectionToken } from '@angular/core';

/**
 * 看板（lib-kanban-board）的畫面文字。libs/ui 不內建使用者可見字串，由使用端在 `providers` 提供一次。
 * 帶參數的句子用 `{name}` 佔位（同其他 libs/ui 元件）：`{title}` 換成卡片標題、`{column}` 換成欄位名稱、
 * `{position}` 換成第幾張（從 1 起算）、`{total}`／`{count}` 換成張數、`{limit}` 換成 WIP 上限、`{over}` 換成超出幾張、
 * `{group}` 換成分組（泳道）名稱。
 */
export interface KanbanLabels {
  /** 卡片的角色描述（`aria-roledescription`），例：「卡片」。 */
  card: string;
  /** 卡片聚焦時念的位置，例：「{column}，第 {position} 張，共 {total} 張」。 */
  cardPosition: string;
  /** 卡片聚焦時念的操作提示，例：「按 Alt 加左右方向鍵換欄、Alt 加上下方向鍵調整順序，或用「移動」選單」。 */
  keyboardHint: string;
  /** 每張卡片「移動到…」選單按鈕的無障礙名稱，例：「移動「{title}」」。 */
  moveMenu: string;
  /** 選單項目：移到另一欄（放在該欄最後），例：「移到「{column}」」。 */
  moveTo: string;
  /** 選單項目，例：「上移」。 */
  moveUp: string;
  /** 選單項目，例：「下移」。 */
  moveDown: string;
  /** 移動完成後報讀器念的字，例：「已將「{title}」移到「{column}」第 {position} 張」。 */
  announceMoved: string;
  /** 欄頭張數（沒有上限時）給報讀器念的字，例：「{count} 張卡片」。畫面上只顯示數字。 */
  count: string;
  /** 有上限時欄頭顯示的張數，例：「{count} / {limit}」。 */
  wipCount: string;
  /** 有上限時欄頭張數給報讀器念的字，例：「{count} 張卡片，上限 {limit} 張」。 */
  wipCountLabel: string;
  /** 超過上限時欄頭的警告（附圖示，不只靠顏色），例：「超過上限 {over} 張」。 */
  wipExceeded: string;
  /** 沒有卡片的欄位，例：「沒有卡片」。 */
  emptyColumn: string;
  /** 欄底的新增按鈕，例：「新增卡片」。 */
  addCard: string;
  /** 新增卡片輸入框的無障礙名稱，例：「新增到「{column}」的卡片標題」。 */
  addCardInput: string;
  /** 新增卡片輸入框下方的提示，例：「Enter 新增，Esc 取消」。 */
  addCardHint: string;
  /** 分組模式：卡片聚焦時念的位置，例：「{group}，{column}，第 {position} 張，共 {total} 張」。 */
  groupCardPosition: string;
  /** 分組模式：卡片聚焦時念的操作提示，例：「…Alt 加上下方向鍵調整順序，到頭尾時換到上一組或下一組…」。 */
  groupKeyboardHint: string;
  /** 分組模式：移動完成後念的字，例：「已將「{title}」移到「{group}」的「{column}」第 {position} 張」。 */
  announceMovedGroup: string;
  /** 分組模式：「移動」選單裡開出分組清單的項目，例：「換到其他分組」。 */
  moveToGroupMenu: string;
  /** 分組模式：分組清單的項目（放在該格最後），例：「換到「{group}」」。 */
  moveToGroup: string;
  /** 窄版（看板寬度小於 600px，一次顯示一欄）上方欄位切換的無障礙名稱，例：「切換顯示的欄位」。 */
  columnSwitcher: string;
}

export const KANBAN_LABELS = new InjectionToken<KanbanLabels>('KANBAN_LABELS');

const KEYS: readonly (keyof KanbanLabels)[] = [
  'card',
  'cardPosition',
  'keyboardHint',
  'moveMenu',
  'moveTo',
  'moveUp',
  'moveDown',
  'announceMoved',
  'count',
  'wipCount',
  'wipCountLabel',
  'wipExceeded',
  'emptyColumn',
  'addCard',
  'addCardInput',
  'addCardHint',
  'groupCardPosition',
  'groupKeyboardHint',
  'announceMovedGroup',
  'moveToGroupMenu',
  'moveToGroup',
  'columnSwitcher',
];

/** 開發期設定錯誤（忘了提供文字或少了某一句）時直接丟出明確訊息，不靜默顯示空白。 */
export function assertKanbanLabels(labels: Partial<KanbanLabels> | null): KanbanLabels {
  if (!labels) throw new Error('KanbanBoard：缺少畫面文字。請在 providers 提供 KANBAN_LABELS。');
  const missing = KEYS.filter((key) => !labels[key]);
  if (missing.length > 0) {
    throw new Error(`KanbanBoard：KANBAN_LABELS 缺少 ${missing.map((k) => `「${k}」`).join('')}。`);
  }
  return labels as KanbanLabels;
}

/** 把 `{name}` 換成對應的值。 */
export function formatKanbanLabel(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}
