import { CalendarEvent } from './calendar.types';
import { MINUTES_PER_DAY, addDays, addMinutes, atMinutes, diffWallMinutes, isSameDay, minutesOfDay, startOfDay } from './calendar-date';
import { effectiveEnd } from './calendar-layout';

/**
 * 拖曳與鍵盤移動的運算。移動量一律是「幾天＋幾分鐘」的鐘面時間（不是毫秒），所以移到隔天還是同一個鐘點。
 */

/** 一次移動：幾天、幾分鐘，以及要不要換資源（undefined＝不換）。 */
export interface CalendarDelta {
  days: number;
  minutes: number;
  resourceId?: string | null;
}

/** 拉哪一邊：開始（上緣／左緣）或結束（下緣／右緣）。 */
export type CalendarEdge = 'start' | 'end';

/** 對齊到最近的格子（四捨五入）。 */
export function snapTo(value: number, step: number): number {
  if (step <= 0) return value;
  const snapped = Math.round(value / step) * step;
  return snapped === 0 ? 0 : snapped;
}

function shift(date: Date, delta: Pick<CalendarDelta, 'days' | 'minutes'>): Date {
  return addMinutes(addDays(date, delta.days), delta.minutes);
}

/** 整筆移動：開始與結束一起移，長度不變。 */
export function moveEvent(event: CalendarEvent, delta: CalendarDelta): CalendarEvent {
  const end = effectiveEnd(event);
  return {
    ...event,
    start: shift(event.start, delta),
    end: shift(end, delta),
    ...(delta.resourceId !== undefined ? { resourceId: delta.resourceId } : {}),
  };
}

/**
 * 只改一邊：拉結束或拉開始；長度至少 `minMinutes`（整天的活動至少一天），拉過頭時停在最短長度。
 */
export function extendEvent(event: CalendarEvent, delta: CalendarDelta, edge: CalendarEdge, minMinutes: number): CalendarEvent {
  const end = effectiveEnd(event);
  const min = event.allDay ? MINUTES_PER_DAY : minMinutes;
  if (edge === 'end') {
    let next = shift(end, delta);
    if (diffWallMinutes(event.start, next) < min) next = addMinutes(event.start, min);
    return { ...event, end: next };
  }
  let next = shift(event.start, delta);
  if (diffWallMinutes(next, end) < min) next = addMinutes(end, -min);
  return { ...event, start: next };
}

/**
 * 週／日檢視只畫 dayStart–dayEnd：單日、有時間的活動被移到範圍外時推回來（長度不變；比範圍長就貼齊開始）。
 * 跨日或整天的活動不動。
 */
export function clampToHours(event: CalendarEvent, dayStartMinutes: number, dayEndMinutes: number): CalendarEvent {
  const end = effectiveEnd(event);
  if (event.allDay) return event;
  const sameDay = isSameDay(event.start, end) || (minutesOfDay(end) === 0 && isSameDay(event.start, addDays(end, -1)));
  if (!sameDay) return event;
  const day = startOfDay(event.start);
  const length = diffWallMinutes(event.start, end);
  const startMin = minutesOfDay(event.start);
  let next = Math.max(dayStartMinutes, Math.min(startMin, dayEndMinutes - length));
  if (length >= dayEndMinutes - dayStartMinutes) next = dayStartMinutes;
  if (next === startMin) return event;
  return { ...event, start: atMinutes(day, next), end: atMinutes(day, next + length) };
}

/** 兩筆活動的時間與資源是不是一樣（拖了又放回原處就不送出變更）。 */
export function sameSchedule(a: CalendarEvent, b: CalendarEvent): boolean {
  return (
    a.start.getTime() === b.start.getTime() &&
    effectiveEnd(a).getTime() === effectiveEnd(b).getTime() &&
    (a.resourceId ?? null) === (b.resourceId ?? null)
  );
}

// ---- 指標拖曳 ----

export interface PointerDragHandlers {
  /** 開始拖曳後每次移動：相對按下時的位移（px）與目前的指標事件。觸控長按到時也會呼叫一次（位移是按住時的小晃動）。 */
  move(dx: number, dy: number, event: PointerEvent): void;
  /** 放開（`committed`）或取消（Esc、pointercancel）；還沒開始拖就放開時不會呼叫，交給原生的 click。 */
  end(committed: boolean): void;
}

export interface PointerDragOptions {
  /** 滑鼠、觸控筆：移動幾 px 才開始拖（避免手抖把點一下變成拖曳）。預設 DRAG_THRESHOLD。 */
  threshold?: number;
  /** 觸控：按住幾毫秒才開始拖。預設 TOUCH_DRAG_DELAY。 */
  touchDelay?: number;
  /** 觸控：按住期間手指移動超過幾 px 就當成在捲動，放棄這次拖曳。預設 TOUCH_SLOP。 */
  touchSlop?: number;
}

/** 開始拖曳前要移動幾 px（滑鼠、觸控筆）。 */
export const DRAG_THRESHOLD = 4;
/** 觸控要按住多久才開始拖（ms）：比點一下長、比系統的長按選單短；在這之前滑動就是一般的捲動。 */
export const TOUCH_DRAG_DELAY = 450;
/** 觸控按住期間容許的晃動（px）。 */
export const TOUCH_SLOP = 10;

let touchDragsActive = 0;

/**
 * 觸控拖曳進行中（長按之後）。活動上的 touchmove 依這個 preventDefault，拖曳時頁面不會跟著捲動
 * （pointermove 不能阻止捲動，只有非 passive 的 touchmove 可以）。
 */
export function isTouchDragActive(): boolean {
  return touchDragsActive > 0;
}

/**
 * 從 pointerdown 開始追蹤一次拖曳。監聽掛在 window 上（指標移出元素也收得到），Esc 取消。
 * - 滑鼠、觸控筆：移動超過 `threshold` 就開始拖。
 * - 觸控：按住 `touchDelay` 毫秒才開始拖（先畫出預覽，表示「拿起來了」）；在這之前移動超過 `touchSlop`
 *   或瀏覽器開始捲動（pointercancel）就放棄，讓手指照常捲動頁面。按住期間擋掉長按選單。
 * 真的拖過之後，放開時瀏覽器緊接著送出的 click 會被攔掉，不會把活動打開。回傳「中止」函式。
 */
export function trackPointerDrag(down: PointerEvent, handlers: PointerDragHandlers, options: PointerDragOptions = {}): () => void {
  const view = (down.target as Node | null)?.ownerDocument?.defaultView ?? window;
  const doc = view.document;
  const startX = down.clientX;
  const startY = down.clientY;
  const pointerId = down.pointerId;
  const touch = down.pointerType === 'touch';
  const threshold = options.threshold ?? DRAG_THRESHOLD;
  const slop = options.touchSlop ?? TOUCH_SLOP;
  let active = false;
  let done = false;
  let last: PointerEvent = down;
  let timer: number | null = null;

  const activate = () => {
    active = true;
    if (touch) touchDragsActive++;
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    last = e;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!active) {
      if (touch) {
        // 還在等長按：手指移開就是在捲動。
        if (Math.hypot(dx, dy) >= slop) finish(false);
        return;
      }
      if (Math.hypot(dx, dy) < threshold) return;
      activate();
    }
    e.preventDefault();
    handlers.move(dx, dy, e);
  };
  const swallowClick = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };
  const blockMenu = (e: Event) => e.preventDefault();
  const finish = (committed: boolean) => {
    if (done) return;
    done = true;
    if (timer !== null) view.clearTimeout(timer);
    view.removeEventListener('pointermove', onMove);
    view.removeEventListener('pointerup', onUp);
    view.removeEventListener('pointercancel', onCancel);
    view.removeEventListener('contextmenu', blockMenu, true);
    doc.removeEventListener('keydown', onKey, true);
    if (active) {
      if (touch) touchDragsActive--;
      view.addEventListener('click', swallowClick, { capture: true, once: true });
      view.setTimeout(() => view.removeEventListener('click', swallowClick, { capture: true }), 0);
      handlers.end(committed);
    }
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId === pointerId) finish(true);
  };
  const onCancel = (e: PointerEvent) => {
    if (e.pointerId === pointerId) finish(false);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (active) {
      e.preventDefault();
      e.stopPropagation();
    }
    finish(false);
  };

  view.addEventListener('pointermove', onMove);
  view.addEventListener('pointerup', onUp);
  view.addEventListener('pointercancel', onCancel);
  doc.addEventListener('keydown', onKey, true);
  if (touch) {
    view.addEventListener('contextmenu', blockMenu, true);
    timer = view.setTimeout(() => {
      timer = null;
      if (done) return;
      activate();
      handlers.move(last.clientX - startX, last.clientY - startY, last);
    }, options.touchDelay ?? TOUCH_DRAG_DELAY);
  }
  return () => finish(false);
}
