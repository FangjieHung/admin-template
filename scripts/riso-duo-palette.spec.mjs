// ADR 0015：Riso 雙色（淺色、兩種特別色）的「色票層」檢查，比照 signal-palette.spec.mjs（直接讀 _tokens.scss 的色碼）。
// 1. 文字 4.5:1、欄位邊界與主色（焦點框）3:1：對畫布、每一階表面，以及三塊平網色塊
//    （primary／secondary／tertiary-container）都要成立。
// 2. 兩種墨（主墨 primary＝中藍、第二墨 secondary＝螢光粉）和每個狀態色分得開，狀態圓點彼此分得開，
//    圖表 4 色彼此分得開（CIEDE2000 ≥ 20）——狀態不能被誤讀成「只是另一塊墨」。
// 3. 兩種墨彼此分得開，第二墨和紙張分得開（Riso 質地的網點、疊印、套色錯位都是第二墨）；平網色塊看得出是一層色（ΔE ≥ 10）。
// 4. 淺色配色宣告 color-scheme: light，並蓋掉 mat.theme() 有元件引用的缺口（同 Graphite／OLED／Signal）。
import { describe, it, expect } from 'vitest';
import { contrastRatio } from './contrast-lib.mjs';
import { tokensOf, hex, deltaE2000 } from './palette-lib.mjs';

const SURFACES = [
  'background',
  'surface',
  'surface-container-low',
  'surface-container',
  'surface-container-high',
  'surface-container-highest',
];
const BLOCKS = ['primary-container', 'secondary-container', 'tertiary-container'];
const TONES = ['positive', 'info', 'warning', 'danger'];
const INKS = ['primary', 'secondary'];

describe('雙特別色配色 riso-duo（ADR 0015）', () => {
  const { src, get } = tokensOf('riso-duo');
  const c = (name) => hex(get(name));
  const sys = (name) => c(`mat-sys-${name}`);

  it('宣告 color-scheme: light，並蓋掉 mat.theme() 有元件引用的缺口', () => {
    expect(src).toMatch(/color-scheme:\s*light;/);
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

  it('文字 4.5:1、欄位邊界與主色 3:1（畫布、每一階表面、每一塊平網色塊）', () => {
    for (const bg of [...SURFACES, ...BLOCKS]) {
      for (const fg of ['on-surface', 'on-surface-variant', 'error']) {
        expect(contrastRatio(sys(fg), sys(bg)), `${fg} / ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrastRatio(sys('outline'), sys(bg)), `outline / ${bg}`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(sys('primary'), sys(bg)), `primary / ${bg}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('成對的前景／底色 4.5:1（兩種墨、容器、反轉、側欄、狀態徽章）', () => {
    const pairs = [
      ['mat-sys-on-primary', 'mat-sys-primary'],
      ['mat-sys-on-secondary', 'mat-sys-secondary'],
      ['mat-sys-on-tertiary', 'mat-sys-tertiary'],
      ['mat-sys-on-error', 'mat-sys-error'],
      ...BLOCKS.map((b) => [`mat-sys-on-${b}`, `mat-sys-${b}`]),
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

  it('兩種墨和每個狀態色分得開，狀態圓點彼此分得開', () => {
    for (const ink of INKS) {
      for (const t of TONES) {
        expect(deltaE2000(sys(ink), c(`app-${t}-dot`)), `${ink} vs ${t}-dot`).toBeGreaterThanOrEqual(20);
        expect(deltaE2000(sys(ink), c(`app-${t}-fg`)), `${ink} vs ${t}-fg`).toBeGreaterThanOrEqual(20);
      }
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

  it('兩種墨彼此、第二墨和紙張分得開；平網色塊看得出是一層色', () => {
    expect(deltaE2000(sys('primary'), sys('secondary')), 'primary vs secondary').toBeGreaterThanOrEqual(20);
    for (const paper of ['background', 'surface']) {
      expect(deltaE2000(sys('secondary'), sys(paper)), `secondary vs ${paper}`).toBeGreaterThanOrEqual(20);
      for (const b of BLOCKS) {
        expect(deltaE2000(sys(b), sys(paper)), `${b} vs ${paper}`).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it('圖表 4 色彼此分得開，對表面 ≥ 3:1', () => {
    for (let i = 1; i <= 4; i++) {
      expect(contrastRatio(c(`app-viz-${i}`), sys('surface')), `viz-${i}`).toBeGreaterThanOrEqual(3);
      for (let j = i + 1; j <= 4; j++) {
        expect(deltaE2000(c(`app-viz-${i}`), c(`app-viz-${j}`)), `viz-${i} vs viz-${j}`).toBeGreaterThanOrEqual(20);
      }
    }
  });
});
