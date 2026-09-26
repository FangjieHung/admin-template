import { describe, expect, it } from 'vitest';
import {
  EDGE_INSET,
  FAB_SIZE,
  baseTopLeft,
  clampOffset,
  computePanelAnchor,
  defaultOffset,
  moveOffsetByKey,
  parseStoredOffset,
  serializeOffset,
} from './floating-appearance-panel.position';

const VP_1280 = { width: 1280, height: 900 };
const VP_390 = { width: 390, height: 667 };

describe('floating-appearance-panel.position', () => {
  describe('baseTopLeft', () => {
    it('是右下角內縮 16px 的位置', () => {
      expect(baseTopLeft(VP_1280)).toEqual({ x: 1280 - EDGE_INSET - FAB_SIZE, y: 900 - EDGE_INSET - FAB_SIZE });
    });
  });

  describe('defaultOffset', () => {
    it('沒有 sticky 列時（clearance=0）就是原生右下角，位移量是 {0,0}', () => {
      expect(defaultOffset(0)).toEqual({ x: 0, y: 0 });
    });

    it('有 sticky 列時往上頂開對應高度', () => {
      expect(defaultOffset(88)).toEqual({ x: 0, y: -88 });
    });
  });

  describe('clampOffset', () => {
    it('位移量落在視窗內時原封不動', () => {
      const offset = { x: -100, y: -50 };
      expect(clampOffset(offset, VP_1280)).toEqual(offset);
    });

    it('拖到視窗左側外面會被夾回貼齊左邊界（x=0）', () => {
      const clamped = clampOffset({ x: -100000, y: 0 }, VP_1280);
      const base = baseTopLeft(VP_1280);
      expect(base.x + clamped.x).toBe(0);
    });

    it('拖到視窗上方外面會被夾回貼齊上邊界（y=0）', () => {
      const clamped = clampOffset({ x: 0, y: -100000 }, VP_1280);
      const base = baseTopLeft(VP_1280);
      expect(base.y + clamped.y).toBe(0);
    });

    it('拖到視窗右／下側外面（正位移）一樣夾回邊界內', () => {
      const clamped = clampOffset({ x: 100000, y: 100000 }, VP_1280);
      const base = baseTopLeft(VP_1280);
      expect(base.x + clamped.x).toBe(VP_1280.width - FAB_SIZE);
      expect(base.y + clamped.y).toBe(VP_1280.height - FAB_SIZE);
    });

    it('視窗縮小（1280→390）後，原本合法的位移量可能需要被夾回', () => {
      // 在 1280 寬的視窗把按鈕拖到最左邊（x 貼齊 0）
      const draggedAt1280 = clampOffset({ x: -100000, y: 0 }, VP_1280);
      // 換到 390 寬的視窗，同一個位移量套用後仍必須落在 [0, width-FAB_SIZE] 內
      const reclamped = clampOffset(draggedAt1280, VP_390);
      const base390 = baseTopLeft(VP_390);
      const left = base390.x + reclamped.x;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left).toBeLessThanOrEqual(VP_390.width - FAB_SIZE);
    });

    it('視窗比按鈕還小的極端情況也不會回傳負的可用範圍', () => {
      const tiny = { width: 20, height: 20 };
      const clamped = clampOffset({ x: 0, y: 0 }, tiny);
      const base = baseTopLeft(tiny);
      expect(base.x + clamped.x).toBe(0);
      expect(base.y + clamped.y).toBe(0);
    });
  });

  describe('parseStoredOffset', () => {
    it('合法的 {x,y} JSON 字串解析成功', () => {
      expect(parseStoredOffset('{"x":10,"y":-20}')).toEqual({ x: 10, y: -20 });
    });

    it('null／空字串回傳 null', () => {
      expect(parseStoredOffset(null)).toBeNull();
      expect(parseStoredOffset('')).toBeNull();
    });

    it('壞掉的 JSON 回傳 null，不丟例外', () => {
      expect(parseStoredOffset('{not json')).toBeNull();
    });

    it('缺欄位／型別錯誤回傳 null', () => {
      expect(parseStoredOffset('{"x":10}')).toBeNull();
      expect(parseStoredOffset('{"x":"10","y":20}')).toBeNull();
      expect(parseStoredOffset('null')).toBeNull();
      expect(parseStoredOffset('42')).toBeNull();
    });

    it('NaN／Infinity 視為不合法', () => {
      expect(parseStoredOffset('{"x":NaN,"y":1}')).toBeNull(); // JSON.parse 本身就會丟例外
      expect(parseStoredOffset(JSON.stringify({ x: Infinity, y: 1 }))).toBeNull();
    });

    it('跟 serializeOffset 互為反函式', () => {
      const offset = { x: 12.5, y: -33 };
      expect(parseStoredOffset(serializeOffset(offset))).toEqual(offset);
    });
  });

  describe('moveOffsetByKey', () => {
    it('四個方向鍵各自移動 16px', () => {
      const origin = { x: 0, y: 0 };
      expect(moveOffsetByKey(origin, 'ArrowUp', VP_1280)).toEqual({ x: 0, y: -16 });
      expect(moveOffsetByKey(origin, 'ArrowDown', VP_1280)).toEqual({ x: 0, y: 16 });
      expect(moveOffsetByKey(origin, 'ArrowLeft', VP_1280)).toEqual({ x: -16, y: 0 });
      expect(moveOffsetByKey(origin, 'ArrowRight', VP_1280)).toEqual({ x: 16, y: 0 });
    });

    it('不是方向鍵回傳 null', () => {
      expect(moveOffsetByKey({ x: 0, y: 0 }, 'Enter', VP_1280)).toBeNull();
      expect(moveOffsetByKey({ x: 0, y: 0 }, 'a', VP_1280)).toBeNull();
    });

    it('已經貼齊邊界時繼續按同方向不會移出視窗', () => {
      const atLeftEdge = clampOffset({ x: -100000, y: 0 }, VP_1280);
      const moved = moveOffsetByKey(atLeftEdge, 'ArrowLeft', VP_1280);
      const base = baseTopLeft(VP_1280);
      expect(base.x + (moved?.x ?? 0)).toBe(0);
    });
  });

  describe('computePanelAnchor', () => {
    it('按鈕在右下角時，面板往上、往左展開', () => {
      const triggerRect = { top: 840, bottom: 884, left: 1220, right: 1264 };
      const anchor = computePanelAnchor(triggerRect, VP_1280);
      expect(anchor.bottom).toBeDefined();
      expect(anchor.top).toBeUndefined();
      expect(anchor.right).toBeDefined();
      expect(anchor.left).toBeUndefined();
    });

    it('按鈕在左上角時，面板往下、往右展開', () => {
      const triggerRect = { top: 16, bottom: 60, left: 16, right: 60 };
      const anchor = computePanelAnchor(triggerRect, VP_1280);
      expect(anchor.top).toBeDefined();
      expect(anchor.bottom).toBeUndefined();
      expect(anchor.left).toBeDefined();
      expect(anchor.right).toBeUndefined();
    });

    it('按鈕在右上角：往下（空間較大）、往左展開', () => {
      const triggerRect = { top: 16, bottom: 60, left: 1220, right: 1264 };
      const anchor = computePanelAnchor(triggerRect, VP_1280);
      expect(anchor.top).toBeDefined();
      expect(anchor.right).toBeDefined();
    });

    it('按鈕在左下角：往上、往右展開', () => {
      const triggerRect = { top: 840, bottom: 884, left: 16, right: 60 };
      const anchor = computePanelAnchor(triggerRect, VP_1280);
      expect(anchor.bottom).toBeDefined();
      expect(anchor.left).toBeDefined();
    });

    it('矮視窗（390×667）空間不足時，maxHeight 明顯小於寬鬆視窗的情況', () => {
      const triggerRect = { top: 600, bottom: 644, left: 330, right: 374 };
      const anchorTight = computePanelAnchor(triggerRect, VP_390);
      const anchorRoomy = computePanelAnchor({ top: 16, bottom: 60, left: 16, right: 60 }, VP_1280);
      expect(anchorTight.maxHeight).toBeLessThan(anchorRoomy.maxHeight);
    });

    it('maxHeight 永遠有下限，不會算出負值或過小的值', () => {
      const triggerRect = { top: 330, bottom: 374, left: 173, right: 217 };
      const anchor = computePanelAnchor(triggerRect, VP_390);
      expect(anchor.maxHeight).toBeGreaterThanOrEqual(160);
    });
  });
});
