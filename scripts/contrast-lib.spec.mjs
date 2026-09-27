import { describe, it, expect } from 'vitest';
import {
  parseColor,
  compositeOver,
  effectiveBackground,
  relativeLuminance,
  contrastRatio,
  contrastForTextOnStack,
  passes,
  parseInsetRing,
  fieldBoundaryContrast,
  layerContrast,
  bestFocusIndicator,
  choiceControlContrast,
} from './contrast-lib.mjs';

describe('parseColor', () => {
  it('解析 rgb()', () => {
    expect(parseColor('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });
  it('解析 rgba()', () => {
    expect(parseColor('rgba(255, 0, 0, 0.5)')).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
  });
  it('transparent -> a=0', () => {
    expect(parseColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });
  it('現代語法 rgb(r g b / a)', () => {
    expect(parseColor('rgb(10 20 30 / 0.4)')).toEqual({ r: 10, g: 20, b: 30, a: 0.4 });
  });
});

describe('compositeOver', () => {
  it('全不透明 fg 直接蓋過 bg', () => {
    const out = compositeOver({ r: 10, g: 20, b: 30, a: 1 }, { r: 0, g: 0, b: 0, a: 1 });
    expect(out).toEqual({ r: 10, g: 20, b: 30, a: 1 });
  });
  it('全透明 fg 完全不影響 bg', () => {
    const out = compositeOver({ r: 10, g: 20, b: 30, a: 0 }, { r: 100, g: 100, b: 100, a: 1 });
    expect(out).toEqual({ r: 100, g: 100, b: 100, a: 1 });
  });
  it('50% 白疊在黑上 -> 灰(127.5)', () => {
    const out = compositeOver({ r: 255, g: 255, b: 255, a: 0.5 }, { r: 0, g: 0, b: 0, a: 1 });
    expect(out.r).toBeCloseTo(127.5, 5);
    expect(out.g).toBeCloseTo(127.5, 5);
    expect(out.b).toBeCloseTo(127.5, 5);
  });
});

describe('effectiveBackground', () => {
  it('全透明堆疊 -> 預設白色畫布', () => {
    const out = effectiveBackground([
      { r: 0, g: 0, b: 0, a: 0 },
      { r: 0, g: 0, b: 0, a: 0 },
    ]);
    expect(out).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });
  it('由外而內依序疊加（frosted 情境：底色 + 半透明玻璃層）', () => {
    // html 沒設色(透明) -> body 設不透明底色 -> 卡片是 8% 白色玻璃疊上去
    const out = effectiveBackground([
      { r: 0, g: 0, b: 0, a: 0 }, // html
      { r: 20, g: 30, b: 40, a: 1 }, // body 不透明底色
      { r: 255, g: 255, b: 255, a: 0.08 }, // frosted 卡片的半透明白玻璃
    ]);
    // 手算：0.08*255 + 0.92*20 = 38.8
    expect(out.r).toBeCloseTo(38.8, 5);
    expect(out.g).toBeCloseTo(0.08 * 255 + 0.92 * 30, 5);
    expect(out.b).toBeCloseTo(0.08 * 255 + 0.92 * 40, 5);
    expect(out.a).toBe(1);
  });
});

describe('relativeLuminance / contrastRatio', () => {
  it('黑白對比為 21:1', () => {
    const white = relativeLuminance({ r: 255, g: 255, b: 255 });
    const black = relativeLuminance({ r: 0, g: 0, b: 0 });
    expect(white).toBeCloseTo(1, 5);
    expect(black).toBeCloseTo(0, 5);
    expect(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 })).toBeCloseTo(21, 1);
  });
  it('同色對比為 1:1', () => {
    expect(contrastRatio({ r: 128, g: 64, b: 32 }, { r: 128, g: 64, b: 32 })).toBeCloseTo(1, 5);
  });
  it('順序不影響結果（取較亮者在分子）', () => {
    const a = contrastRatio({ r: 255, g: 255, b: 255 }, { r: 50, g: 50, b: 50 });
    const b = contrastRatio({ r: 50, g: 50, b: 50 }, { r: 255, g: 255, b: 255 });
    expect(a).toBeCloseTo(b, 10);
  });
});

describe('contrastForTextOnStack', () => {
  it('黑字疊在「透明祖先 + 白色底」上 -> 21:1', () => {
    const { ratio, effectiveBg } = contrastForTextOnStack('rgb(0, 0, 0)', [
      'transparent',
      'transparent',
    ]);
    expect(effectiveBg).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(ratio).toBeCloseTo(21, 1);
  });

  it('半透明背景會被正確合成後才拿去算對比（frosted 案例）', () => {
    const { ratio } = contrastForTextOnStack('rgb(255, 255, 255)', [
      'rgb(20, 30, 40)', // 不透明底
      'rgba(255, 255, 255, 0.08)', // frosted 玻璃層
    ]);
    // 合成底色接近深色，白字對比應仍然偏高（非常寬鬆的下界檢查，避免耦合到精確位數）
    expect(ratio).toBeGreaterThan(5);
  });
});

describe('passes', () => {
  it('一般文字門檻 4.5:1', () => {
    expect(passes(4.5, 'normal')).toBe(true);
    expect(passes(4.49, 'normal')).toBe(false);
  });
  it('大字/UI 邊界門檻 3:1', () => {
    expect(passes(3, 'large')).toBe(true);
    expect(passes(2.99, 'ui')).toBe(false);
  });
});

describe('parseInsetRing（欄位細框）', () => {
  it('抓到 spread-only 的 inset 細框，忽略後面的模糊陰影', () => {
    const bs = 'rgb(128, 118, 141) 0px 0px 0px 1px inset, rgba(0, 0, 0, 0.5) 6px 6px 10px 0px inset';
    expect(parseInsetRing(bs)).toEqual({ color: 'rgb(128, 118, 141)', width: 1 });
  });
  it('color(srgb …) 也可以', () => {
    expect(parseInsetRing('color(srgb 0.5 0.5 0.4) 0px 0px 0px 1px inset')).toEqual({ color: 'color(srgb 0.5 0.5 0.4)', width: 1 });
  });
  it('只有模糊的 inset 陰影、或外陰影 → null', () => {
    expect(parseInsetRing('rgba(0, 0, 0, 0.5) 6px 6px 10px 0px inset')).toBeNull();
    expect(parseInsetRing('rgb(0, 0, 0) 0px 0px 0px 1px')).toBeNull();
    expect(parseInsetRing('none')).toBeNull();
  });
});

describe('fieldBoundaryContrast', () => {
  const outer = ['rgb(255, 255, 255)'];
  it('邊框：線色直接對外側底色', () => {
    const r = fieldBoundaryContrast({ method: 'border', fg: 'rgb(0, 0, 0)', fill: 'rgb(255, 255, 255)', outer });
    expect(r.vsOuter).toBeCloseTo(21, 5);
  });
  it('底線：線色疊在填色上（半透明線會混到填色）', () => {
    const r = fieldBoundaryContrast({ method: 'underline', fg: 'rgba(0, 0, 0, 0.5)', fill: 'rgb(0, 0, 0)', outer });
    // 半透明黑疊在黑填色上仍是黑 → 對白底 21:1
    expect(r.vsOuter).toBeCloseTo(21, 5);
    expect(r.vsFill).toBeCloseTo(1, 5);
  });
  it('只有填色（沒有線）：fg = 填色，退化成填色對外側底色', () => {
    const r = fieldBoundaryContrast({ method: 'fill', fg: 'rgb(255, 255, 255)', fill: 'rgb(255, 255, 255)', outer });
    expect(r.vsOuter).toBeCloseTo(1, 5);
  });
});

describe('layerContrast（第四批）', () => {
  it('半透明前景先疊在底色上再比', () => {
    const r = layerContrast('rgba(0, 0, 0, 0.5)', ['rgb(255, 255, 255)']);
    expect(r.fg.r).toBeCloseTo(127.5, 1);
    expect(r.ratio).toBeCloseTo(3.95, 1);
  });
});

describe('bestFocusIndicator（第四批）', () => {
  const field = { fill: 'rgb(240, 240, 240)', outer: ['rgb(255, 255, 255)'], rest: { method: 'underline', fg: 'rgb(118, 118, 118)' } };
  it('多個候選取對外側底色最高者，並算它與靜止邊界的差異', () => {
    const r = bestFocusIndicator([
      { method: 'underline', fg: 'rgb(200, 200, 200)' },
      { method: 'outline', fg: 'rgb(0, 0, 255)' },
    ], field);
    expect(r.method).toBe('outline');
    expect(r.vsOuter).toBeGreaterThan(8);
    expect(r.vsRest).toBeGreaterThan(1);
  });
  it('沒有任何候選 → null', () => {
    expect(bestFocusIndicator([null, { method: 'outline', fg: null }], field)).toBeNull();
  });
  it('底線疊在填色上：填色與外側同色時等同直接比', () => {
    const r = bestFocusIndicator([{ method: 'underline', fg: 'rgb(0, 0, 0)' }], { fill: 'rgb(255, 255, 255)', outer: ['rgb(255, 255, 255)'] });
    expect(r.vsOuter).toBeCloseTo(21, 0);
    expect(r.vsRest).toBeUndefined();
  });
});

describe('choiceControlContrast（第四批）', () => {
  it('外框畫在控制項底色上、勾選底對外側、記號對勾選底', () => {
    const r = choiceControlContrast({ outer: ['rgb(255, 255, 255)'], bg: 'rgb(255, 255, 255)', border: 'rgb(118, 118, 118)', fill: 'rgb(0, 0, 0)', mark: 'rgb(255, 255, 255)' });
    expect(r.border).toBeCloseTo(4.54, 1);
    expect(r.fill).toBeCloseTo(21, 0);
    expect(r.mark).toBeCloseTo(21, 0);
  });
  it('半透明外框疊在控制項底色（而不是外側）上', () => {
    const r = choiceControlContrast({ outer: ['rgb(255, 255, 255)'], bg: 'rgb(0, 0, 0)', border: 'rgba(255, 255, 255, 0)' });
    expect(r.border).toBeCloseTo(21, 0);
  });
  it('只給外框時不算 fill／mark', () => {
    const r = choiceControlContrast({ outer: ['rgb(255, 255, 255)'], border: 'rgb(0, 0, 0)' });
    expect(Object.keys(r)).toEqual(['border']);
  });
});
