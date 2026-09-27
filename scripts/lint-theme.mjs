import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const PALETTE = /var\(\s*--_?(primary|accent|neutral|sage|teal|cream)-\d/;
const EXTS = ['.ts', '.scss', '.html'];

// ---- ticket: 語意用途變數（batch 1）新增規則 ----

const RGB_FN = /\brgba?\(/;
const OUTLINE_RAW_PRIMARY = /outline\s*:[^;]*var\(\s*--mat-sys-primary\s*\)/;
const ZINDEX_BIG = /z-index\s*:\s*(-?\d+)/;

// rgba(／rgb( 允許清單：逐條列出「檔案 → 允許的行內容片段 → 為什麼允許」。
// 不在這份清單裡的 rgb(/rgba( 一律視為寫死色，擋。
const RGB_ALLOWLIST = [
  // _semantic.scss：語意變數的「預設值」本身就是要收編既有寫死色的地方，
  // 這裡的 rgb()/rgba() 是唯一合法出處（第 1 層 :root 預設）。
  { file: '_semantic.scss', match: /--app-scrim:\s*rgba\(0,\s*0,\s*0,\s*0\.32\)/, why: '--app-scrim 第 1 層預設值＝Material 對話框背板現值' },
  // material 質地：陰影色調的「色」本身（--app-shadow-tint），透明度改用 color-mix 表達，
  // 這裡的 rgb() 是唯一的顏色來源，不是又一處寫死的 rgba(35,34,32,N)。
  { file: 'material/_tokens.scss', match: /--app-shadow-tint:\s*rgb\(35 34 32\)/, why: '--app-shadow-tint 質地層現值，取代原本 4 處 rgba(35,34,32,N)' },
  // side-nav 深色側欄 7 處半透明白：第二批（會改變畫面）才收編成 --app-shell-*，
  // 第一批範圍是「畫面不變」，先列進允許清單，第二批移除。
  { file: 'side-nav.component.scss', match: /rgba\(255,\s*255,\s*255,\s*0\.24\)/, why: '捲軸／hairline，第二批移除（改 --app-shell-scrollbar／--app-shell-hairline）' },
  { file: 'side-nav.component.scss', match: /rgba\(255,\s*255,\s*255,\s*0\.12\)/, why: 'hover 底色，第二批移除（改 --app-shell-hover）' },
  { file: 'side-nav.component.scss', match: /rgba\(255,\s*255,\s*255,\s*0\.16\)/, why: '左邊框，第二批移除（改 --app-shell-hairline）' },
  { file: 'side-nav.component.scss', match: /rgba\(255,\s*255,\s*255,\s*0\.08\)/, why: '淡底，第二批移除（改 --app-shell-subtle）' },
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
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return; // 註解不算

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
