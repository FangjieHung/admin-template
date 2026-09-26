import { describe, it, expect } from 'vitest';
import {
  parseColor,
  compositeOver,
  effectiveBackground,
  relativeLuminance,
  contrastRatio,
  contrastForTextOnStack,
  passes,
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
