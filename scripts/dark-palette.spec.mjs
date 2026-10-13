// ADR 0012：Graphite、OLED 兩套深色配色的「色票層」檢查（不用開瀏覽器，直接讀 _tokens.scss 的色碼）。
// 1. 文字 4.5:1、欄位邊界與主色（焦點框）3:1：對畫布與每一階表面都要成立（contrast-report.mjs 只量畫面上實際出現的組合）。
// 2. 主色和狀態色分得開：Graphite 的主色是琥珀橘，最容易和「警示」混淆，所以用 CIEDE2000 色差檢查，
//    主色對各狀態圓點、狀態圓點彼此、圖表 4 色彼此都要 ≥ 20（約等於「並排一眼看得出是兩種顏色」；< 10 容易看錯）。
// 3. 深色配色要宣告 color-scheme: dark，並蓋掉 mat.theme() 有元件引用、Midnight 沒蓋的缺口（否則露出 light-dark() 的綠色預設值）。
import { describe, it, expect } from 'vitest';
import { contrastRatio } from './contrast-lib.mjs';
import { tokensOf, hex, deltaE2000 } from './palette-lib.mjs';

const THEMES = ['graphite', 'oled'];

const SURFACES = [
  'background',
  'surface',
  'surface-container',
  'surface-container-high',
  'surface-container-highest',
];
const TONES = ['positive', 'info', 'warning', 'danger'];

describe('deltaE2000', () => {
  it('同色為 0，黑白約 100', () => {
    expect(deltaE2000(hex('#ff9a3c'), hex('#ff9a3c'))).toBe(0);
    expect(deltaE2000(hex('#000000'), hex('#ffffff'))).toBeCloseTo(100, 0);
  });
});

for (const id of THEMES) {
  describe(`深色配色 ${id}（ADR 0012）`, () => {
    const { src, get } = tokensOf(id);
    const c = (name) => hex(get(name));
    const sys = (name) => c(`mat-sys-${name}`);

    it('宣告 color-scheme: dark，並蓋掉 mat.theme() 有元件引用的缺口', () => {
      expect(src).toMatch(/color-scheme:\s*dark;/);
      for (const name of [
        'inverse-primary',
        'on-background',
        'tertiary-container',
        'neutral10',
        'neutral-variant20',
      ]) {
        expect(src, name).toContain(`--mat-sys-${name}:`);
      }
    });

    it('文字 4.5:1、欄位邊界與主色 3:1（畫布與每一階表面）', () => {
      for (const bg of SURFACES) {
        expect(
          contrastRatio(sys('on-surface'), sys(bg)),
          `on-surface / ${bg}`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(sys('on-surface-variant'), sys(bg)),
          `on-surface-variant / ${bg}`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(sys('error'), sys(bg)), `error / ${bg}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(sys('outline'), sys(bg)), `outline / ${bg}`).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(sys('primary'), sys(bg)), `primary / ${bg}`).toBeGreaterThanOrEqual(3);
      }
    });

    it('成對的前景／底色 4.5:1（主色、容器、反轉、側欄、狀態徽章）', () => {
      const pairs = [
        ['mat-sys-on-primary', 'mat-sys-primary'],
        ['mat-sys-on-primary-container', 'mat-sys-primary-container'],
        ['mat-sys-on-secondary-container', 'mat-sys-secondary-container'],
        ['mat-sys-on-error-container', 'mat-sys-error-container'],
        ['mat-sys-inverse-on-surface', 'mat-sys-inverse-surface'],
        ['mat-sys-inverse-primary', 'mat-sys-inverse-surface'],
        ['app-shell-on', 'app-shell-bg'],
        ['app-shell-on-muted', 'app-shell-bg'],
        ...[...TONES, 'neutral'].map((t) => [`app-${t}-fg`, `app-${t}-bg`]),
      ];
      for (const [fg, bg] of pairs) {
        expect(contrastRatio(c(fg), c(bg)), `${fg} / ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('主色和每個狀態色分得開（警示不會被看成主色）', () => {
      for (const t of TONES) {
        expect(
          deltaE2000(sys('primary'), c(`app-${t}-dot`)),
          `primary vs ${t}-dot`,
        ).toBeGreaterThanOrEqual(20);
        expect(
          deltaE2000(sys('primary'), c(`app-${t}-fg`)),
          `primary vs ${t}-fg`,
        ).toBeGreaterThanOrEqual(20);
      }
      for (let i = 0; i < TONES.length; i++) {
        for (let j = i + 1; j < TONES.length; j++) {
          expect(
            deltaE2000(c(`app-${TONES[i]}-dot`), c(`app-${TONES[j]}-dot`)),
            `${TONES[i]} vs ${TONES[j]}`,
          ).toBeGreaterThanOrEqual(20);
        }
      }
    });

    it('圖表 4 色彼此分得開，對表面 ≥ 3:1', () => {
      for (let i = 1; i <= 4; i++) {
        expect(contrastRatio(c(`app-viz-${i}`), sys('surface')), `viz-${i}`).toBeGreaterThanOrEqual(
          3,
        );
        for (let j = i + 1; j <= 4; j++) {
          expect(
            deltaE2000(c(`app-viz-${i}`), c(`app-viz-${j}`)),
            `viz-${i} vs viz-${j}`,
          ).toBeGreaterThanOrEqual(20);
        }
      }
    });
  });
}
