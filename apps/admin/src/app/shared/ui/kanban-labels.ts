import { Provider } from '@angular/core';
import { KANBAN_LABELS, KanbanLabels } from '@admin-template/ui';

/**
 * 看板（lib-kanban-board）的畫面文字。用到它的頁面在自己的 `providers` 加上這組；
 * 不放 app.config 根層，理由同 component-label-providers.ts。
 *
 * 文字直接寫在這裡、不放 core/i18n/zh-tw.ts：那份字典被殼層 import，整份在 Initial bundle 裡，
 * 這幾句只有用到看板的頁面（lazy chunk）需要。
 */
export const ZH_TW_KANBAN: KanbanLabels = {
  card: '卡片',
  cardPosition: '{column}，第 {position} 張，共 {total} 張',
  keyboardHint: '按 Alt 加左右方向鍵換欄、Alt 加上下方向鍵調整順序，或用「移動」選單',
  moveMenu: '移動「{title}」',
  moveTo: '移到「{column}」',
  moveUp: '上移',
  moveDown: '下移',
  announceMoved: '已將「{title}」移到「{column}」第 {position} 張',
  count: '{count} 張卡片',
  wipCount: '{count} / {limit}',
  wipCountLabel: '{count} 張卡片，上限 {limit} 張',
  wipExceeded: '超過上限 {over} 張',
  emptyColumn: '沒有卡片',
  addCard: '新增卡片',
  addCardInput: '新增到「{column}」的卡片標題',
  addCardHint: 'Enter 新增，Esc 取消',
};

export const KANBAN_LABEL_PROVIDERS: Provider[] = [{ provide: KANBAN_LABELS, useValue: ZH_TW_KANBAN }];
