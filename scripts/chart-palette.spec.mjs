// ADR 0017：12 套配色的圖表類別色（--app-chart-1…6）的「色票層」檢查，比照 dark-palette.spec.mjs（直接讀 _tokens.scss 的色碼）。
// 1. 每套配色都定義 6 個類別色（不靠 _semantic.scss 的退路）；_semantic.scss 定義全部圖表 token 的預設。
// 2. 類別色對卡片可能的底色 ≥ 3:1（WCAG 1.4.11 非文字）：surface 是一般卡片，background 是 Soft UI 的卡片（與畫布同色）
//    與 Clay／Frosted／Aero 半透明卡片透出來的底，surface-container-low 是 Editorial 的卡片。
// 3. 6 色兩兩 CIEDE2000 ≥ 15（並排一眼看得出是兩種顏色）。
// 4. 前 3 色在紅色盲、綠色盲、藍色盲模擬下兩兩 ΔE ≥ 10：最常用的前 3 個系列不能只靠色相分辨。
//    第 4 色以後由元件補「線型＋點標記＋圖例＋直接標註」（lib-line-chart 第 4–6 條線是虛線、點線、點虛線）。
// 5. 軸文字（--app-chart-axis＝on-surface-variant）與漲跌（positive-fg／danger-fg）是文字，對同一組底色 ≥ 4.5:1。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastRatio } from './contrast-lib.mjs';
import { tokensOf, hex, deltaE2000, simulateCvd, CVD_KINDS } from './palette-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const THEMES = [
  'verdant',
  'midnight',
  'sandstone',
  'azure',
  'cool-grey',
  'candy',
  'mist-ink',
  'glacier-blue',
  'graphite',
  'oled',
  'signal',
  'riso-duo',
];
const CARD_SURFACES = ['surface', 'background', 'surface-container-low'];
const CHART = [1, 2, 3, 4, 5, 6];

describe('圖表 token 的預設（_semantic.scss）', () => {
  const src = readFileSync(join(ROOT, 'libs/theme-pack/src/lib/styles/_semantic.scss'), 'utf8');
  it('定義類別色 1–6、格線、軸文字、漲跌', () => {
    for (const name of [...CHART.map((i) => `chart-${i}`), 'chart-grid', 'chart-axis', 'chart-positive', 'chart-negative']) {
      expect(src, name).toMatch(new RegExp(`--app-${name}:`));
    }
  });
});

describe('palette-lib 的色盲模擬', () => {
  it('灰階不變；紅綠在紅色盲、綠色盲眼中靠得很近', () => {
    expect(simulateCvd(hex('#808080'), 'deutan')).toEqual(hex('#808080'));
    const red = hex('#d0302a');
    const green = hex('#3c8a2e');
    expect(deltaE2000(red, green)).toBeGreaterThan(40);
    expect(deltaE2000(simulateCvd(red, 'deutan'), simulateCvd(green, 'deutan'))).toBeLessThan(20);
  });
});

for (const id of THEMES) {
  describe(`配色 ${id} 的圖表類別色（ADR 0017）`, () => {
    const { src, get } = tokensOf(id);
    const c = (name) => hex(get(name));
    const chart = CHART.map((i) => c(`app-chart-${i}`));
    const surfaces = CARD_SURFACES.map((s) => [s, c(`mat-sys-${s}`)]);

    it('自己定義 6 個類別色', () => {
      for (const i of CHART) expect(src, `chart-${i}`).toMatch(new RegExp(`--app-chart-${i}:`));
    });

    it('類別色對卡片底色 ≥ 3:1', () => {
      chart.forEach((color, i) => {
        for (const [name, bg] of surfaces) {
          expect(contrastRatio(color, bg), `chart-${i + 1} / ${name}`).toBeGreaterThanOrEqual(3);
        }
      });
    });

    it('6 色兩兩 ΔE2000 ≥ 15', () => {
      for (let i = 0; i < chart.length; i++) {
        for (let j = i + 1; j < chart.length; j++) {
          expect(deltaE2000(chart[i], chart[j]), `chart-${i + 1} vs chart-${j + 1}`).toBeGreaterThanOrEqual(15);
        }
      }
    });

    it('前 3 色在三種色盲模擬下兩兩 ΔE2000 ≥ 10', () => {
      for (const kind of CVD_KINDS) {
        for (let i = 0; i < 3; i++) {
          for (let j = i + 1; j < 3; j++) {
            const d = deltaE2000(simulateCvd(chart[i], kind), simulateCvd(chart[j], kind));
            expect(d, `${kind}: chart-${i + 1} vs chart-${j + 1}`).toBeGreaterThanOrEqual(10);
          }
        }
      }
    });

    it('軸文字與漲跌文字對卡片底色 ≥ 4.5:1', () => {
      for (const fg of ['mat-sys-on-surface-variant', 'app-positive-fg', 'app-danger-fg']) {
        for (const [name, bg] of surfaces) {
          expect(contrastRatio(c(fg), bg), `${fg} / ${name}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  });
}
