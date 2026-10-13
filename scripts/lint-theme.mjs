import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const PALETTE = /var\(\s*--_?(primary|accent|neutral|sage|teal|cream)-\d/;
const EXTS = ['.ts', '.scss', '.html'];

// ---- ticket: 語意用途變數（batch 1）新增規則 ----

const RGB_FN = /\brgba?\(/;
const OUTLINE_RAW_PRIMARY = /outline\s*:[^;]*var\(\s*--mat-sys-primary\s*\)/;
const ZINDEX_BIG = /z-index\s*:\s*(-?\d+)/;
// transition／animation 宣告（含多行值）裡寫死的時長／延遲：非 0 的數字接 ms 或 s。`0s`／`0ms` 允許（不是時長刻度）。
// animation 於 2026-09-28 納入：進場動畫用 --app-motion-fast/-base/-slow，無限循環的裝飾動畫用 --app-motion-loop。
const TRANSITION_START = /(^|[\s{;])(transition|animation)(-duration|-delay)?\s*:/;
// 負的延遲（`-2s`，讓循環動畫錯開起跑）也算寫死；`-` 前面必須不是識別字字元，避免誤判 `slide-2s` 這類名稱。
const HARD_TIME = /(?<![\w.-])-?(?!0+(?:\.0+)?m?s\b)\d*\.?\d+m?s\b/;

// ---- batch 3（欄位邊界）----
// 選擇器是輸入欄位時，邊框／底線／外框顏色只能用這幾種用途變數：
// --app-field-border（靜止）、--mat-sys-on-surface（hover 加深）、--mat-sys-error（錯誤）、--app-disabled-*（停用）、
// --app-focus-ring／--mat-sys-primary（focus）。只檢查 var() 的名稱，不判斷是哪個狀態（粗略但不會誤擋既有寫法）。
// 典型誤用是 --mat-sys-outline-variant 髮絲線（對底色不到 3:1，第三批前 editorial／frosted 就是這樣）。
const FIELD_SELECTOR = /(^|[\s,>+~(])(input|textarea|select)\b|\.mat-mdc-form-field\b|\.mat-mdc-text-field-wrapper\b|\.mdc-text-field\b/;
const FIELD_BORDER_DECL = /^\s*(border(-top|-right|-bottom|-left)?(-color)?|--mat-form-field-[\w-]*(outline-color|active-indicator-color))\s*:\s*([^;]*)/;
const FIELD_BORDER_OK = /^var\(\s*--(app-field-border|mat-sys-on-surface|mat-sys-error|app-disabled-[\w-]+|app-focus-ring|mat-sys-primary)\s*\)$/;

// 值裡的顏色部分若是 var(--x)，必須是允許的用途變數；0／none／寬度等不含 var() 的值不管（寫死色另有規則擋）。
export function badFieldBorderValue(value) {
  const vars = value.match(/var\(\s*--[\w-]+\s*(,[^)]*)?\)/g) || [];
  return vars.find((v) => !FIELD_BORDER_OK.test(v.replace(/\s*,[^)]*\)/, ')'))) || null;
}

// ---- batch 4（原生勾選框、單選鈕）----
// 選擇器是勾選框／單選鈕（原生 [type=checkbox|radio]、mat-checkbox、mat-radio）時，顏色相關宣告不得寫死顏色：
// 值裡只能有 var(--x)（fallback 也要符合）、color-mix()/calc()/min()/max()、長度數字、線條／陰影關鍵字、
// transparent／currentColor 與高對比模式的系統色（CanvasText 等）。hex 由既有規則擋；這條多擋 rgb()/hsl()/oklch()
// 之類的色彩函式與具名色（white、black、red…），因為 appearance: none 之後瀏覽器不再幫忙配色，寫死就不會跟配色走。
// 另外 --mat-checkbox-*color／--mat-radio-*color（MDC token）只能指向 --app-*／--mat-sys-*，不分選擇器；
// accent-color 也只能用變數（第四批前原生控制項靠它上色）。
const CHOICE_SELECTOR = /\[type=['"]?(checkbox|radio)\b|\.mat-mdc-checkbox\b|\.mat-mdc-radio-button\b|\.mdc-checkbox\b|\.mdc-radio\b/;
const CHOICE_COLOR_DECL = /^\s*(background(-color)?|color|border(-top|-right|-bottom|-left)?(-color)?|outline(-color)?|box-shadow|fill|stroke|accent-color)\s*:\s*([^;{]*)/;
const MDC_CHOICE_TOKEN_DECL = /^\s*(--mat-(checkbox|radio)-[\w-]*color)\s*:\s*([^;]*)/;
const ACCENT_DECL = /^\s*accent-color\s*:\s*([^;]*)/;
const COLOR_FN = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const CHOICE_OK_WORDS = new Set([
  'none', 'solid', 'dashed', 'dotted', 'double', 'inset', 'transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'revert',
  'auto', 'color-mix', 'in', 'srgb', 'calc', 'min', 'max',
  // forced-colors 的系統色：跟著使用者的高對比設定走，不算寫死
  'canvas', 'canvastext', 'highlight', 'highlighttext', 'graytext', 'buttontext', 'buttonface', 'buttonborder', 'field', 'fieldtext', 'linktext', 'accentcolor', 'accentcolortext',
]);

// 回傳值裡第一個「寫死的顏色」片段；全部是變數／關鍵字就回傳 null。
export function hardcodedChoiceColor(value) {
  const fn = value.match(COLOR_FN);
  if (fn) return fn[0];
  // 拿掉 var(--x) 本身（保留 fallback 讓它也被檢查），再拿掉數字與單位
  const rest = value
    .replace(/var\(\s*--[\w-]+\s*,?/g, ' ')
    .replace(/#[0-9a-fA-F]{3,8}\b/g, (m) => ` ${m.replace('#', 'HEX_')} `)
    .replace(/-?\d*\.?\d+(px|rem|em|%|deg|ms|s)?\b/g, ' ');
  const words = rest.match(/[A-Za-z_][\w-]*/g) || [];
  return words.find((w) => !CHOICE_OK_WORDS.has(w.toLowerCase())) || null;
}

// MDC 勾選框／單選鈕 token 只能指向用途變數或系統 token。
export function badChoiceTokenValue(value) {
  return /^var\(\s*--(app|mat-sys)-[\w-]+\s*\)$/.test(value.trim()) ? null : value.trim();
}

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
    // 選擇器堆疊（粗略的大括號追蹤）：判斷目前宣告是否落在「輸入欄位」選擇器底下。
    const selStack = [];
    let pendingSel = '';
    const checkFieldBorder = isScssOrCss && basename(f) !== '_semantic.scss' && basename(f) !== '_tokens.scss';
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return; // 註解不算

      if (checkFieldBorder) {
        const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
        // 宣告在遇到 `;` 或 `}` 時才判斷（單行規則 `x { a: b; }` 與跨行的值都算得到），選擇器堆疊是當下的。
        const checkDecl = (decl) => {
          const text = decl.trim();
          if (!text.includes(':')) return;
          const at = `${f}:${i + 1}:`;
          const inField = selStack.some((x) => FIELD_SELECTOR.test(x));
          const m = inField && text.match(FIELD_BORDER_DECL);
          if (m) {
            const bad = badFieldBorderValue(m[5]);
            if (bad) violations.push(`${at} [欄位邊界顏色要用 --app-field-border（錯誤 --mat-sys-error、停用 --app-disabled-*），不要用 ${bad}] ${trimmed}`);
          }
          const inChoice = selStack.some((x) => CHOICE_SELECTOR.test(x));
          const cm = inChoice && text.match(CHOICE_COLOR_DECL);
          if (cm) {
            const bad = hardcodedChoiceColor(cm[6]);
            if (bad) violations.push(`${at} [勾選框／單選鈕的顏色要用 --app-*／--mat-sys-* 變數，不要寫死 ${bad}] ${trimmed}`);
          }
          const tm = text.match(MDC_CHOICE_TOKEN_DECL);
          if (tm && badChoiceTokenValue(tm[3])) {
            violations.push(`${at} [mat-checkbox／mat-radio 的顏色 token 只能指向 --app-*／--mat-sys-*] ${trimmed}`);
          }
          const am = !inChoice && text.match(ACCENT_DECL);
          if (am && hardcodedChoiceColor(am[1])) {
            violations.push(`${at} [accent-color 要用變數] ${trimmed}`);
          }
        };
        for (const ch of code) {
          if (ch === '{') { selStack.push(pendingSel.trim()); pendingSel = ''; }
          else if (ch === '}') { checkDecl(pendingSel); selStack.pop(); pendingSel = ''; }
          else if (ch === ';') { checkDecl(pendingSel); pendingSel = ''; }
          else pendingSel += ch;
        }
        pendingSel += ' ';
      }

      if (checkMotion) {
        if (TRANSITION_START.test(line)) inTransition = true;
        if (inTransition) {
          const code = line.replace(/\/\/.*$/, '');
          if (HARD_TIME.test(code)) {
            violations.push(`${f}:${i + 1}: [transition／animation 寫死時長，改用 --app-motion-fast/-base/-slow（循環動畫用 --app-motion-loop）] ${trimmed}`);
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

/**
 * 有自己元件樣式的共用 lib：`libs/<name>/src` 底下有 .scss 或元件 .ts 的都算（theme-pack 另外列）。
 * 用掃描而不是寫死清單：新專案刪掉或新增 lib 時不必回來改這支腳本。
 */
export function collectSharedUiLibs(libsDir = 'libs') {
  const roots = [];
  if (!existsSync(libsDir)) return roots;
  for (const name of readdirSync(libsDir).sort()) {
    if (name === 'theme-pack') continue;
    const src = join(libsDir, name, 'src');
    if (existsSync(src)) roots.push(src);
  }
  return roots;
}

// 預設掃描範圍：theme-pack、所有有套主題的 app，加上 app 會載入、有自己元件樣式的共用 lib（目前是 libs/ui）。
export const SHARED_UI_LIBS = collectSharedUiLibs('libs');
const DEFAULT_ROOTS = ['libs/theme-pack/src', ...SHARED_UI_LIBS, ...collectThemedAppRoots('apps')];

// 直接執行時：掃預設範圍（或 CLI 指定的路徑）
if (import.meta.url === `file://${process.argv[1]}`) {
  const cliRoots = process.argv.slice(2);
  const scanRoots = cliRoots.length
    ? cliRoots
    : DEFAULT_ROOTS;
  const violations = runLint(scanRoots);
  if (violations.length) {
    console.log('lint:theme 發現寫死色/底層色（請改綁 --mat-sys-* 或 --app-*）：');
    for (const v of violations) console.log('  ' + v);
    process.exit(1);
  }
  console.log('lint:theme 通過：無寫死色。');
}
