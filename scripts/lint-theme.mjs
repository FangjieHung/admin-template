import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const PALETTE = /var\(\s*--_?(primary|accent|neutral|sage|teal|cream)-\d/;
const EXTS = ['.ts', '.scss', '.html'];

// ---- ticket: 語意用途變數（batch 1）新增規則 ----

const RGB_FN = /\brgba?\(/;
const OUTLINE_RAW_PRIMARY = /outline\s*:[^;]*var\(\s*--mat-sys-primary\s*\)/;
const ZINDEX_BIG = /z-index\s*:\s*(-?\d+)/;
// transition 宣告（含多行值）裡寫死的時長／延遲：非 0 的數字接 ms 或 s。`0s`／`0ms` 允許（不是時長刻度）。
const TRANSITION_START = /(^|[\s{;])transition(-duration|-delay)?\s*:/;
const HARD_TIME = /(?<![\w.-])(?!0+(?:\.0+)?m?s\b)\d*\.?\d+m?s\b/;

// rgba(／rgb( 允許清單：逐條列出「檔案 → 允許的行內容片段 → 為什麼允許」。
// 不在這份清單裡的 rgb(/rgba( 一律視為寫死色，擋。
const RGB_ALLOWLIST = [
  // 第二批（2026-09-27）清空：_semantic.scss 的 --app-scrim 改成 color-mix(inverse-surface)、
  // material 質地的 --app-shadow-tint 改吃配色、side-nav 7 處半透明白改用 --app-shell-*。
  // 真的需要新增例外時，逐條列在這裡：{ file, match, why }。
];

export function collectThemedAppRoots(appsDir = 'apps') {
  const roots = [];
  if (!existsSync(appsDir)) return roots;
  for (const name of readdirSync(appsDir)) {
    const src = join(appsDir, name, 'src');
    const styles = join(src, 'styles.scss');
    if (existsSync(styles) && readFileSync(styles, 'utf8').includes('theme-pack')) {
      roots.push(src);
    }
  }
  return roots;
}

export function isAllowed(path) {
  return path.includes('/color-themes/')
    || path.includes('/quill-content-style/')
    || basename(path) === '_tokens.scss';
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXTS.some(e => p.endsWith(e))) out.push(p);
  }
}

// rgb()/rgba() 是否命中允許清單中「這個檔案 × 這一行」的條目。
function isRgbAllowed(path, line) {
  return RGB_ALLOWLIST.some((entry) => path.endsWith(entry.file) && entry.match.test(line));
}

export function runLint(scanRoots) {
  const files = [];
  for (const r of scanRoots) {
    try {
      const st = statSync(r);
      if (st.isDirectory()) walk(r, files);
      else if (EXTS.some(e => r.endsWith(e))) files.push(r);
    } catch { /* root 不存在略過 */ }
  }
  const violations = [];
  for (const f of files) {
    const skipHexPalette = isAllowed(f);
    const isScssOrCss = f.endsWith('.scss');
    // 變數定義檔（_semantic.scss、各質地／配色 _tokens.scss）可以寫時長數值，其餘元件 scss 不行。
    const checkMotion = isScssOrCss && basename(f) !== '_semantic.scss' && basename(f) !== '_tokens.scss';
    let inTransition = false;
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return; // 註解不算

      if (checkMotion) {
        if (TRANSITION_START.test(line)) inTransition = true;
        if (inTransition) {
          const code = line.replace(/\/\/.*$/, '');
          if (HARD_TIME.test(code)) {
            violations.push(`${f}:${i + 1}: [transition 寫死時長，改用 --app-motion-fast/-base/-slow] ${trimmed}`);
          }
          if (code.includes(';') || code.includes('}')) inTransition = false;
        }
      }

      if (!skipHexPalette && (HEX.test(line) || PALETTE.test(line))) {
        violations.push(`${f}:${i + 1}: ${line.trim()}`);
      }
      if (isScssOrCss && RGB_FN.test(line) && !isRgbAllowed(f, line)) {
        violations.push(`${f}:${i + 1}: [寫死 rgb()/rgba()，不在允許清單] ${line.trim()}`);
      }
      if (isScssOrCss && OUTLINE_RAW_PRIMARY.test(line)) {
        violations.push(`${f}:${i + 1}: [焦點框顏色要用 --app-focus-ring，不要直接接 --mat-sys-primary] ${line.trim()}`);
      }
      if (isScssOrCss && basename(f) !== '_semantic.scss') {
        const m = line.match(ZINDEX_BIG);
        if (m && Math.abs(Number(m[1])) >= 10) {
          violations.push(`${f}:${i + 1}: [z-index 寫死大數字，改用 --app-z-* 或說明為何需要獨立數值] ${line.trim()}`);
        }
      }
    });
  }
  return violations;
}

// 直接執行時：掃 libs/theme-pack + 所有有套主題的 app（或 CLI 指定的路徑）
if (import.meta.url === `file://${process.argv[1]}`) {
  const cliRoots = process.argv.slice(2);
  const scanRoots = cliRoots.length
    ? cliRoots
    : ['libs/theme-pack/src', ...collectThemedAppRoots('apps')];
  const violations = runLint(scanRoots);
  if (violations.length) {
    console.log('lint:theme 發現寫死色/底層色（請改綁 --mat-sys-* 或 --app-*）：');
    for (const v of violations) console.log('  ' + v);
    process.exit(1);
  }
  console.log('lint:theme 通過：無寫死色。');
}
