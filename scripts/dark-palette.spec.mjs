// ADR 0012：Graphite、OLED 兩套深色配色的「色票層」檢查（不用開瀏覽器，直接讀 _tokens.scss 的色碼）。
// 1. 文字 4.5:1、欄位邊界與主色（焦點框）3:1：對畫布與每一階表面都要成立（contrast-report.mjs 只量畫面上實際出現的組合）。
// 2. 主色和狀態色分得開：Graphite 的主色是琥珀橘，最容易和「警示」混淆，所以用 CIEDE2000 色差檢查，
//    主色對各狀態圓點、狀態圓點彼此、圖表 4 色彼此都要 ≥ 20（約等於「並排一眼看得出是兩種顏色」；< 10 容易看錯）。
// 3. 深色配色要宣告 color-scheme: dark，並蓋掉 mat.theme() 有元件引用、Midnight 沒蓋的缺口（否則露出 light-dark() 的綠色預設值）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastRatio } from './contrast-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const THEMES = ['graphite', 'oled'];

function tokensOf(id) {
  const src = readFileSync(
    join(ROOT, `libs/theme-pack/src/lib/styles/color-themes/${id}/_tokens.scss`),
    'utf8',
  );
  const raw = Object.fromEntries(
    [...src.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );
  const resolve = (v) => {
    const m = v.match(/^var\((--[\w-]+)\)$/);
    return m ? resolve(raw[m[1]]) : v;
  };
  return { src, get: (name) => resolve(raw[`--${name}`] ?? 'missing') };
}

function hex(h) {
  const m = h.match(/^#([0-9a-f]{6})$/i);
  if (!m) throw new Error(`不是 6 位色碼：${h}`);
  const n = parseInt(m[1], 16);
  return { r: n >> 16, g: (n >> 8) & 255, b: n & 255 };
}

function lab({ r, g, b }) {
  const lin = (u) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [r, g, b].map((c) => lin(c / 255));
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

/** CIEDE2000 色差。 */
function deltaE2000(c1, c2) {
  const rad = Math.PI / 180;
  const [L1, a1, b1] = lab(c1);
  const [L2, a2, b2] = lab(c2);
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const [a1p, a2p] = [a1 * (1 + G), a2 * (1 + G)];
  const [C1p, C2p] = [Math.hypot(a1p, b1), Math.hypot(a2p, b2)];
  const hue = (b, a) => (((Math.atan2(b, a) / rad) % 360) + 360) % 360;
  const [h1p, h2p] = [hue(b1, a1p), hue(b2, a2p)];
  let dh = h2p - h1p;
  if (C1p * C2p === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dL = L2 - L1;
  const dC = C2p - C1p;
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh / 2) * rad);
  const Lb = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hb = h1p + h2p;
  if (C1p * C2p !== 0)
    hb = Math.abs(h1p - h2p) <= 180 ? hb / 2 : hb < 360 ? (hb + 360) / 2 : (hb - 360) / 2;
  const T =
    1 -
    0.17 * Math.cos((hb - 30) * rad) +
    0.24 * Math.cos(2 * hb * rad) +
    0.32 * Math.cos((3 * hb + 6) * rad) -
    0.2 * Math.cos((4 * hb - 63) * rad);
  const dTh = 30 * Math.exp(-(((hb - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTh * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

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
