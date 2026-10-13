// 外觀浮動面板（ticket 03）的定位運算，抽成不碰 DOM／localStorage 的純函式，方便直接單元測試
// （component 只負責讀寫 DOM／localStorage，再把數字丟進這裡算）。
//
// 座標模型：按鈕的「原生」位置永遠是 CSS `bottom: 16px; right: 16px;`（EDGE_INSET），
// 也就是 baseTopLeft() 算出來的那個點；使用者拖曳／鍵盤移動的位移量（Offset）是從這個原生位置
// 再位移多少像素（跟 Angular CDK `cdkDragFreeDragPosition` 的語意完全一致，可以直接拿去綁）。
// 用 bottom/right 當基準（不是 top/left）是刻意的：視窗縮放時瀏覽器會自動重新算 bottom/right
// 的錨點，位移量本身不必跟著視窗寬高換算，只要在載入與 resize 時夾回視窗內即可
// （見 clampOffset），這就是「存距離右／下邊界多遠」這個需求要的效果。

export interface Offset {
  readonly x: number;
  readonly y: number;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface Rect {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

export interface PanelAnchor {
  readonly top?: number;
  readonly bottom?: number;
  readonly left?: number;
  readonly right?: number;
  readonly maxHeight: number;
}

export const POSITION_STORAGE_KEY = 'app.appearancePanel.position';
export const EDGE_INSET = 16;
export const FAB_SIZE = 44;
export const KEYBOARD_MOVE_STEP = 16;
const PANEL_GAP = 8;
const PANEL_MIN_HEIGHT = 160;

/** 按鈕原生（未拖曳）矩形的左上角座標。 */
export function baseTopLeft(viewport: Viewport): Offset {
  return {
    x: viewport.width - EDGE_INSET - FAB_SIZE,
    y: viewport.height - EDGE_INSET - FAB_SIZE,
  };
}

/** 把位移量夾回「按鈕完全落在視窗內」的範圍。視窗比按鈕還小這種極端情況夾到 0。 */
export function clampOffset(offset: Offset, viewport: Viewport): Offset {
  const base = baseTopLeft(viewport);
  const maxLeft = Math.max(viewport.width - FAB_SIZE, 0);
  const maxTop = Math.max(viewport.height - FAB_SIZE, 0);
  const left = Math.min(Math.max(base.x + offset.x, 0), maxLeft);
  const top = Math.min(Math.max(base.y + offset.y, 0), maxTop);
  return { x: left - base.x, y: top - base.y };
}

/** 讀 localStorage 存的字串；不是合法的 {x,y} 數字就回傳 null，呼叫端改用預設位置。 */
export function parseStoredOffset(raw: string | null): Offset | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      typeof (parsed as Offset).x === 'number' &&
      typeof (parsed as Offset).y === 'number' &&
      Number.isFinite((parsed as Offset).x) &&
      Number.isFinite((parsed as Offset).y)
    ) {
      return { x: (parsed as Offset).x, y: (parsed as Offset).y };
    }
  } catch {
    // 壞掉的 JSON，當作沒存過。
  }
  return null;
}

export function serializeOffset(offset: Offset): string {
  return JSON.stringify(offset);
}

/**
 * 預設位置：右下角 16px 內縮；`bottomClearance` 是貼底 sticky 列（page-toolbar 的
 * .toolbar-actions、建單頁的 .order-create__footer）目前算出來的高度，讓按鈕往上頂開。
 * 沒有 sticky 列時傳 0，就是單純的右下角。
 */
export function defaultOffset(bottomClearance: number): Offset {
  // 避免 clearance=0 時算出 -0（JS 的 -0 跟 0 用 toEqual 之類的深比對會被視為不同值）。
  return { x: 0, y: bottomClearance === 0 ? 0 : -bottomClearance };
}

/** Alt/Shift+方向鍵移動一步（16px），移動後立刻夾回視窗內；不是方向鍵就回傳 null。 */
export function moveOffsetByKey(offset: Offset, key: string, viewport: Viewport): Offset | null {
  let dx = 0;
  let dy = 0;
  switch (key) {
    case 'ArrowUp':
      dy = -KEYBOARD_MOVE_STEP;
      break;
    case 'ArrowDown':
      dy = KEYBOARD_MOVE_STEP;
      break;
    case 'ArrowLeft':
      dx = -KEYBOARD_MOVE_STEP;
      break;
    case 'ArrowRight':
      dx = KEYBOARD_MOVE_STEP;
      break;
    default:
      return null;
  }
  return clampOffset({ x: offset.x + dx, y: offset.y + dy }, viewport);
}

/**
 * 面板開啟方向：往按鈕周圍「空間比較大」的那一側展開（上/下、左/右各自獨立判斷），
 * 面板整個落在視窗內；面板往上或往左開兩者互不影響，四個角落都適用同一套邏輯。
 * `maxHeight` 只在真正空間不足時才會小於內容自然高度，1280×900 這種正常桌機視窗底下，
 * 兩個方向能用的空間都遠大於面板內容，不會出現內部捲動。
 */
export function computePanelAnchor(triggerRect: Rect, viewport: Viewport): PanelAnchor {
  const spaceBelow = viewport.height - triggerRect.bottom;
  const spaceAbove = triggerRect.top;
  const spaceRight = viewport.width - triggerRect.left;
  const spaceLeft = triggerRect.right;
  const openDown = spaceBelow >= spaceAbove;
  const openRight = spaceRight >= spaceLeft;

  const anchor: { top?: number; bottom?: number; left?: number; right?: number; maxHeight: number } = {
    maxHeight: Math.max(PANEL_MIN_HEIGHT, (openDown ? spaceBelow : spaceAbove) - PANEL_GAP * 2),
  };
  if (openDown) {
    anchor.top = triggerRect.bottom + PANEL_GAP;
  } else {
    anchor.bottom = viewport.height - triggerRect.top + PANEL_GAP;
  }
  if (openRight) {
    anchor.left = triggerRect.left;
  } else {
    anchor.right = viewport.width - triggerRect.right;
  }
  return anchor;
}
