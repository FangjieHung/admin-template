#!/usr/bin/env node
// 質地(texture) x 配色(color theme) 相容性對比報告。
//
// 用法：
//   node scripts/contrast-report.mjs [--base-url=http://localhost:5231] [--out=<dir>]
//
// 前置：
//   1. 另開一個終端機跑 `npx nx serve admin --port=5231`（或用 --base-url 指到你自己的埠）。
//   2. `npm install`（本機需要 playwright-core，已加入 devDependencies；不會下載瀏覽器，
//      直接借用系統已安裝的 Google Chrome，走 CDP 連線，繞開「headless Chrome 連不到
//      localhost」的 Bash sandbox 限制 — 因為是長駐 Playwright session 而非一次性 CLI）。
//
// 輸出（預設 .scratch/theme-compat-panel/reports/，可用 --out 覆寫；不寫進 repo 的 dist/）：
//   - contrast-matrix.json   原始量測數據（56 格 x 多組 pair）
//   - contrast-report.md     文字報告（每格數值 + 合格標記 + 不合格清單）
//   - contrast-report.html   56 格矩陣，紅色標示不合格，滑鼠可看每格最差 pair
//   - screenshots/<texture>__<color>.png   56 張代表畫面截圖（screenshot wall）
//
// 量測方法：見 scripts/contrast-lib.mjs 開頭的 alpha compositing 說明。
// 量測畫面：目前固定用 /dashboard（同時涵蓋月曆＋側欄），因為它一頁內就有全部內容區
// pair（頁面底色文字、卡片底色文字、次要文字、狀態徽章/chip、focus 外框、主要按鈕）
// 加上側欄 pair（品牌名稱/副標、選中與未選中選單文字、使用者名稱/狀態、收合箭頭圖示），
// 可在單一畫面把 56 組合跑完；尚未擴充到 orders 列表頁/order-create/dialog 做交叉驗證，
// 這點在報告最後的「已知限制」列出。

import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contrastForTextOnStack,
  THRESHOLD_NORMAL_TEXT,
  THRESHOLD_LARGE_TEXT,
  passes,
} from './contrast-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  }),
);
const BASE_URL = args['base-url'] || 'http://localhost:5231';
const OUT_DIR = args['out']
  ? resolve(args['out'])
  : join(REPO_ROOT, '.scratch/theme-compat-panel/reports');
const SCREENSHOT_DIR = join(OUT_DIR, 'screenshots');
const CHROME_PATH =
  args['chrome-path'] || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const TEXTURES = [
  { id: 'material', label: 'Material' },
  { id: 'linen', label: 'Linen 紙感' },
  { id: 'grid', label: 'Grid 網格' },
  { id: 'soft-ui', label: 'Soft UI 浮雕' },
  { id: 'clay', label: 'Clay 立體軟陶' },
  { id: 'editorial', label: 'Editorial 編輯式極簡' },
  { id: 'frosted', label: 'Frosted 霧光玻璃' },
];

const COLOR_THEMES = [
  { id: 'verdant', label: 'Verdant 綠' },
  { id: 'midnight', label: 'Midnight 深' },
  { id: 'sandstone', label: 'Sandstone 暖沙' },
  { id: 'azure', label: 'Azure 清亮藍' },
  { id: 'cool-grey', label: 'Cool Grey 冷灰' },
  { id: 'candy', label: 'Candy 糖果色' },
  { id: 'mist-ink', label: 'Mist Ink 霧藍墨色' },
  { id: 'glacier-blue', label: 'Glacier Blue 冰霧藍' },
];

// 方便單一組合 smoke-test / 局部重跑：--textures=material,frosted --colors=verdant
function filterByIds(list, csv) {
  if (!csv) return list;
  const ids = new Set(String(csv).split(',').map((s) => s.trim()));
  return list.filter((x) => ids.has(x.id));
}
const ACTIVE_TEXTURES = filterByIds(TEXTURES, args['textures']);
const ACTIVE_COLORS = filterByIds(COLOR_THEMES, args['colors']);

// 每個 pair 的 CSS selector 與判定用門檻種類（normal=4.5:1 / large、ui=3:1）。
// selector 找不到時該 pair 會標記為 skipped，不會讓整個 combo 失敗。
const PAIRS = [
  {
    key: 'primary_on_page_bg',
    label: '主要文字 on 頁面底色',
    selector: '.ui-text-title',
    kind: 'large', // 月曆標題是大字級標題
  },
  {
    key: 'primary_on_card_surface',
    label: '主要文字 on 卡片底色',
    selector: '.ui-card',
    kind: 'normal',
  },
  {
    key: 'secondary_on_surface',
    label: '次要文字(on-surface-variant) on 底色',
    selector: '.calendar-view__muted',
    kind: 'normal',
  },
  {
    key: 'status_badge',
    label: '狀態徽章文字 on 徽章底色',
    selector: '.mat-badge-content',
    kind: 'normal',
  },
  {
    key: 'status_chip_warning',
    label: '狀態 chip(警示) 文字 on chip 底色',
    selector: '.ui-chip--warning',
    kind: 'normal',
  },
  {
    key: 'status_chip_info',
    label: '狀態 chip(資訊) 文字 on chip 底色',
    selector: '.ui-chip--info',
    kind: 'normal',
  },
  {
    key: 'primary_button_label',
    label: '主要按鈕文字 on 按鈕底色',
    selector: '.dashboard-new-order',
    kind: 'normal',
  },
  // 側欄(side-nav) pairs：Soft UI 曾出現側欄底色被畫亮、文字卻維持白色的真實回歸
  // （側欄底色來自質地 recipe，文字色來自配色 token，兩邊各自獨立設定，容易脫鉤）。
  // 7 種質地都要覆蓋到，因此併入主 PAIRS 清單，56 格全跑。
  {
    key: 'sidenav_brand_name',
    label: '側欄品牌名稱 on 側欄底色',
    selector: '.brand-copy .brand-name',
    kind: 'normal',
  },
  {
    key: 'sidenav_brand_subtitle',
    label: '側欄品牌副標 on 側欄底色',
    selector: '.brand-copy p:not(.brand-name)',
    kind: 'normal',
  },
  {
    key: 'sidenav_nav_active_label',
    label: '側欄選單項目(選中) 文字 on 底色',
    // 規格原給 `.nav-link.active span:last-child`：但選單群組按鈕(nav-group-trigger)
    // 也帶 .nav-link class，且未收合時有 3 個 span(icon/label/caret)，
    // span:last-child 在該情境會選到 caret 圖示而非文字 label。改用
    // `> span:not(.material-symbols-rounded)` 精準鎖定純文字 label span
    // （icon 與 caret 皆帶 material-symbols-rounded class），/dashboard 本身是
    // 非群組的一般連結，此差異不影響「選中」這格量到的元素。
    selector: '.nav-link.active > span:not(.material-symbols-rounded)',
    kind: 'normal',
  },
  {
    key: 'sidenav_nav_idle_label',
    label: '側欄選單項目(未選中) 文字 on 底色',
    // 同上原因，改用 `> span:not(.material-symbols-rounded)`；DOM 首個符合的未選中
    // .nav-link 是群組觸發按鈕(如「商品」)，測到的是它的文字 label，而非展開箭頭。
    selector: '.nav-link:not(.active) > span:not(.material-symbols-rounded)',
    kind: 'normal',
  },
  {
    key: 'sidenav_user_name',
    label: '側欄使用者名稱 on 底色',
    selector: '.user-card strong',
    kind: 'normal',
  },
  {
    key: 'sidenav_user_status',
    label: '側欄使用者狀態文字 on 底色',
    selector: '.user-card p',
    kind: 'normal',
  },
  {
    key: 'sidenav_collapse_chevron',
    label: '側欄收合箭頭圖示 on 底色',
    selector: '.collapse-toggle .material-symbols-rounded',
    kind: 'ui', // icon，門檻 3:1
  },
  // ticket: 語意用途變數（batch 1）新增：輸入框邊框對所在底色，3:1（UI 邊界門檻）。
  // 選 filled 文字欄位的 wrapper；找不到（該頁該質地沒有可見的 mat-form-field）就標記 skipped，
  // 不讓整格失敗——已知限制見報告末段。
  {
    key: 'input_border_on_surface',
    label: '輸入框邊框 on 所在底色',
    selector: '.mat-mdc-text-field-wrapper.mdc-text-field--filled',
    kind: 'ui',
    borderPair: true, // 特殊處理：量 border-color 對父層底色，不是 color 對 bgLayers
  },
];

// focus 外框：另外處理（需要先 focus 才量得到）
const FOCUS_TARGET_SELECTOR = '.dashboard-new-order';

async function extractPairData(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const layers = [];
    let node = el;
    // 由內而外先收集，最後 reverse 成「由外而內」給合成函式
    while (node) {
      const ncs = node === el ? cs : getComputedStyle(node);
      layers.push(ncs.backgroundColor);
      node = node.parentElement;
    }
    layers.reverse(); // 由外(html)而內(元素自身)
    return {
      color: cs.color,
      bgLayers: layers,
      // Clay/Soft UI 這類材質常用 background-image 漸層畫按鈕底色而非 background-color，
      // 若元素自身 background-color 是透明，就要另外看這個欄位，否則會誤判成「底色=頁面底色」。
      bgImage: cs.backgroundImage,
      text: (el.textContent || '').trim().slice(0, 40),
    };
  }, selector);
}

// 從 `linear-gradient(...)`／`radial-gradient(...)` 字串裡挑出所有顏色 token
// （rgb()/rgba()/color(srgb ...)），交給 contrast-lib 的 parseColor 各自解析。
const GRADIENT_COLOR_TOKEN =
  /rgba?\([^)]*\)|color\(\s*srgb[^)]*\)/gi;

function extractGradientColorTokens(bgImage) {
  if (!bgImage || bgImage === 'none' || !/gradient/i.test(bgImage)) return [];
  return bgImage.match(GRADIENT_COLOR_TOKEN) ?? [];
}

// 只有「鍵盤造成的 focus」才會觸發 :focus-visible（Material 的 focus ring 靠這個判斷要不要畫）。
// 用 el.focus() 程式化聚焦在 Chrome 的判斷裡通常算 script-focus，:focus-visible 不會為 true
// （見 lessons：量 focus 樣式別用非鍵盤觸發的 focus()）。因此這裡改成真的送 Tab 鍵，
// 從 body 開始一路按到目標元素，讓瀏覽器自己判定這是鍵盤導覽。
const MAX_TAB_HOPS = 40;

async function focusViaKeyboard(page, selector) {
  await page.evaluate(() => document.body.focus());
  for (let i = 0; i < MAX_TAB_HOPS; i++) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate((sel) => {
      const el = document.activeElement;
      return !!(el && el.matches && el.matches(sel));
    }, selector);
    if (hit) return true;
  }
  return false;
}

// ticket: 語意用途變數（batch 1）新增。border-color 對「相鄰底色」（父層合成色，
// 與 extractFocusOutline 的 adjacentBgLayers 邏輯一致：邊框畫在元素邊界，視覺上鄰接的是
// 父層的底色堆疊，不是元素自己的 fill）。
async function extractBorderPairData(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    if (cs.borderStyle === 'none' || parseFloat(cs.borderTopWidth) === 0) return { noBorder: true };
    const layers = [];
    let node = el.parentElement;
    while (node) {
      layers.push(getComputedStyle(node).backgroundColor);
      node = node.parentElement;
    }
    layers.reverse();
    return { borderColor: cs.borderTopColor, bgLayers: layers };
  }, selector);
}

// ticket: 語意用途變數（batch 1）新增。選取文字 --app-selection-fg / --app-selection-bg
// 對比：計畫要求「直接從計算後的變數值算，不需要真的選取」，故直接讀 :root 上兩個
// custom property 的計算值，當成純色 pair 交給既有的 contrastForTextOnStack。
async function extractSelectionColors(page) {
  return page.evaluate(() => {
    // getComputedStyle().getPropertyValue('--x') 對 custom property 只做 var() 代換，
    // 不會像一般屬性一樣正規化成 rgb()（可能拿到 #hex 或色名）。借一個隱藏元素把值指派給
    // 一般顏色屬性（color/background-color），逼瀏覽器正規化，parseColor 才吃得下去。
    const probe = document.createElement('div');
    probe.style.position = 'fixed';
    probe.style.opacity = '0';
    probe.style.pointerEvents = 'none';
    probe.style.color = 'var(--app-selection-fg)';
    probe.style.backgroundColor = 'var(--app-selection-bg)';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const result = { fg: cs.color, bg: cs.backgroundColor };
    probe.remove();
    return result;
  });
}

async function extractFocusOutline(page, selector) {
  const reached = await focusViaKeyboard(page, selector);
  if (!reached) return { notReached: true };
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const focusVisible = el.matches(':focus-visible');
    const cs = getComputedStyle(el);
    // adjacent bg = 元素父層的合成底色（外框畫在元素邊界外、父層底色之上）
    const parent = el.parentElement;
    const layers = [];
    let node = parent;
    while (node) {
      layers.push(getComputedStyle(node).backgroundColor);
      node = node.parentElement;
    }
    layers.reverse();
    let outlineColor = cs.outlineColor;
    let outlineWidth = cs.outlineWidth;
    let outlineStyle = cs.outlineStyle;
    let usedBoxShadow = false;
    const hasRealOutline = outlineStyle !== 'none' && parseFloat(outlineWidth) > 0;
    if (!hasRealOutline) {
      // Material 元件常見改用 box-shadow 畫 focus ring
      const bs = cs.boxShadow;
      const m = bs && bs !== 'none' ? bs.match(/rgba?\([^)]+\)|color\([^)]+\)/) : null;
      if (m) {
        outlineColor = m[0];
        usedBoxShadow = true;
      } else {
        outlineColor = null; // 真的沒有任何可見的 focus 指示
      }
    }
    return {
      focusVisible,
      outlineColor,
      outlineWidth,
      outlineStyle,
      usedBoxShadow,
      adjacentBgLayers: layers,
    };
  }, selector);
}

async function measureCombo(page, texture, color) {
  await page.evaluate(
    ({ p, t }) => {
      localStorage.setItem('cr.paradigm', p);
      localStorage.setItem('cr.theme', t);
    },
    { p: texture.id, t: color.id },
  );
  await page.reload({ waitUntil: 'networkidle', timeout: 20000 });
  // ThemeService.init() 會把不相容的組合校正成預設配色（ADR 0007）；
  // 報告要量「所有」56 格，所以載入後直接蓋回要量的屬性。
  await page.evaluate(
    ({ p, t }) => {
      document.documentElement.dataset['paradigm'] = p;
      document.documentElement.dataset['theme'] = t;
    },
    { p: texture.id, t: color.id },
  );
  await page.waitForTimeout(600); // 讓 texture 的進場動畫/字型穩定

  const results = {};
  for (const pair of PAIRS) {
    if (pair.borderPair) {
      const bd = await extractBorderPairData(page, pair.selector);
      if (!bd) {
        results[pair.key] = { skipped: true, reason: 'selector not found' };
        continue;
      }
      if (bd.noBorder) {
        results[pair.key] = { skipped: true, reason: '該質地此元素目前無邊框（border-style: none 或寬度 0）' };
        continue;
      }
      const { ratio, effectiveBg } = contrastForTextOnStack(bd.borderColor, bd.bgLayers);
      results[pair.key] = {
        label: pair.label,
        kind: pair.kind,
        threshold: THRESHOLD_LARGE_TEXT, // ui 門檻 3:1
        ratio: Number(ratio.toFixed(2)),
        pass: passes(ratio, pair.kind),
        textColor: bd.borderColor,
        effectiveBg,
      };
      continue;
    }
    const data = await extractPairData(page, pair.selector);
    if (!data) {
      results[pair.key] = { skipped: true, reason: 'selector not found' };
      continue;
    }
    const innermostLayer = data.bgLayers[data.bgLayers.length - 1];
    const outerLayers = data.bgLayers.slice(0, -1);
    const gradientTokens = extractGradientColorTokens(data.bgImage);
    const innermostIsTransparent = /^rgba?\(0,\s*0,\s*0,\s*0\)$/.test(innermostLayer.replace(/\s+/g, ' ').trim())
      || innermostLayer === 'transparent';

    let ratio, effectiveBg, note;
    if (innermostIsTransparent && gradientTokens.length > 0) {
      // 元素自身沒有 background-color，但有 background-image 漸層（clay/soft-ui 常見手法）。
      // 用漸層裡每個顏色 stop 個別合成、取「對比最差」的那個 stop 當保守值 — 使用者眼睛掃過整個
      // 按鈕時，任何一個角落文字讀不出來都算不合格，所以用最差 stop 而非平均色。
      const candidates = gradientTokens.map((tok) => {
        const r = contrastForTextOnStack(data.color, [...outerLayers, tok]);
        return { tok, ...r };
      });
      const worstStop = candidates.reduce((a, b) => (b.ratio < a.ratio ? b : a));
      ratio = worstStop.ratio;
      effectiveBg = worstStop.effectiveBg;
      note = `background-image 漸層，取 ${gradientTokens.length} 個色 stop 中對比最差者近似`;
    } else {
      const r = contrastForTextOnStack(data.color, data.bgLayers);
      ratio = r.ratio;
      effectiveBg = r.effectiveBg;
    }

    results[pair.key] = {
      label: pair.label,
      kind: pair.kind,
      threshold: pair.kind === 'normal' ? THRESHOLD_NORMAL_TEXT : THRESHOLD_LARGE_TEXT,
      ratio: Number(ratio.toFixed(2)),
      pass: passes(ratio, pair.kind),
      textColor: data.color,
      effectiveBg,
      sampleText: data.text,
      note,
    };
  }

  const focus = await extractFocusOutline(page, FOCUS_TARGET_SELECTOR);
  if (focus?.notReached) {
    results['focus_outline'] = { skipped: true, reason: `Tab 鍵在 ${MAX_TAB_HOPS} 次內沒有到達目標元素` };
  } else if (focus?.outlineColor) {
    const { ratio, effectiveBg } = contrastForTextOnStack(focus.outlineColor, focus.adjacentBgLayers);
    results['focus_outline'] = {
      label: 'Focus 外框 vs 相鄰底色',
      kind: 'ui',
      threshold: THRESHOLD_LARGE_TEXT,
      ratio: Number(ratio.toFixed(2)),
      pass: passes(ratio, 'ui'),
      textColor: focus.outlineColor,
      effectiveBg,
      note: focus.usedBoxShadow ? 'outline:none，改讀 box-shadow 的顏色近似 focus ring' : undefined,
    };
  } else {
    results['focus_outline'] = {
      skipped: true,
      reason: focus?.focusVisible === false ? ':focus-visible 未觸發' : 'no visible outline/box-shadow on focus',
    };
  }

  // ticket: 語意用途變數（batch 1）新增：選取文字 --app-selection-fg / --app-selection-bg，4.5:1。
  const sel = await extractSelectionColors(page);
  if (sel?.fg && sel?.bg) {
    const { ratio, effectiveBg } = contrastForTextOnStack(sel.fg, [sel.bg]);
    results['selection_text'] = {
      label: '選取文字 --app-selection-fg on --app-selection-bg',
      kind: 'normal',
      threshold: THRESHOLD_NORMAL_TEXT,
      ratio: Number(ratio.toFixed(2)),
      pass: passes(ratio, 'normal'),
      textColor: sel.fg,
      effectiveBg,
      note: '第一批未套用到任何選取樣式，純粹先驗證變數的計算後對比；第二批才會實際套用。',
    };
  } else {
    results['selection_text'] = { skipped: true, reason: '讀不到 --app-selection-fg/-bg 的計算值' };
  }

  // 移開 focus，避免殘留影響下一次截圖
  await page.evaluate(() => document.activeElement && document.activeElement.blur());

  return results;
}

function worstPair(results) {
  let worst = null;
  for (const [key, r] of Object.entries(results)) {
    if (r.skipped) continue;
    if (!worst || r.ratio < worst.ratio) worst = { key, ...r };
  }
  return worst;
}

function cellFails(results) {
  return Object.values(results).some((r) => !r.skipped && !r.pass);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  console.log(`啟動 Chrome（系統 Chrome，走 CDP，非下載版 Chromium）...`);
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const matrix = [];
  let done = 0;
  const total = ACTIVE_TEXTURES.length * ACTIVE_COLORS.length;

  for (const texture of ACTIVE_TEXTURES) {
    for (const color of ACTIVE_COLORS) {
      done += 1;
      process.stdout.write(`[${done}/${total}] ${texture.id} x ${color.id} ... `);
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 20000 });
      const results = await measureCombo(page, texture, color);
      const shotName = `${texture.id}__${color.id}.png`;
      await page.screenshot({ path: join(SCREENSHOT_DIR, shotName) });
      const fails = cellFails(results);
      matrix.push({
        texture: texture.id,
        textureLabel: texture.label,
        color: color.id,
        colorLabel: color.label,
        results,
        worst: worstPair(results),
        fails,
        screenshot: `screenshots/${shotName}`,
      });
      console.log(fails ? 'FAIL' : 'ok');
    }
  }

  await browser.close();

  writeFileSync(join(OUT_DIR, 'contrast-matrix.json'), JSON.stringify(matrix, null, 2));
  writeFileSync(join(OUT_DIR, 'contrast-report.md'), renderMarkdown(matrix));
  writeFileSync(join(OUT_DIR, 'contrast-report.html'), renderHtml(matrix));

  const failing = matrix.filter((m) => m.fails);
  console.log(`\n完成。共 ${matrix.length} 格，${failing.length} 格不合格。`);
  console.log(`報告輸出於：${OUT_DIR}`);
  if (failing.length) {
    console.log('不合格組合：');
    for (const f of failing) {
      console.log(`  - ${f.textureLabel} x ${f.colorLabel}：最差 pair = ${f.worst?.label} (${f.worst?.ratio}:1)`);
    }
  }
}

function renderMarkdown(matrix) {
  const lines = [];
  lines.push('# 質地 x 配色相容性對比報告');
  lines.push('');
  lines.push(`產生時間：${new Date().toISOString()}`);
  lines.push('');
  lines.push('一般文字門檻 4.5:1；大字/狀態徽章/UI 邊界(含 focus 外框) 門檻 3:1。');
  lines.push('');
  lines.push('| 質地 | 配色 | 合格 | 最差 pair | 最差比值 | 各 pair 明細 |');
  lines.push('|---|---|---|---|---|---|');
  for (const m of matrix) {
    const detail = Object.entries(m.results)
      .map(([k, r]) => (r.skipped ? `${k}: 略過` : `${k}=${r.ratio}:1${r.pass ? '' : ' ⚠️'}`))
      .join('; ');
    lines.push(
      `| ${m.textureLabel} | ${m.colorLabel} | ${m.fails ? '❌' : '✅'} | ${m.worst?.label ?? '-'} | ${m.worst?.ratio ?? '-'} | ${detail} |`,
    );
  }
  lines.push('');
  const failing = matrix.filter((m) => m.fails);
  lines.push(`## 不合格組合（共 ${failing.length} / ${matrix.length}）`);
  lines.push('');
  for (const f of failing) {
    lines.push(`- **${f.textureLabel} x ${f.colorLabel}**：最差 pair「${f.worst?.label}」= ${f.worst?.ratio}:1（門檻 ${f.worst?.threshold}:1）`);
  }
  lines.push('');
  lines.push('## 已知限制');
  lines.push('');
  lines.push('- 量測畫面固定為 `/dashboard`（含月曆），尚未擴充到訂單列表、order-create 表單、dialog 做交叉驗證。');
  lines.push('- alpha compositing 只合成純色數值，不模擬 `backdrop-filter: blur()` 的取樣效果；背景若非純色/低頻漸層，合成結果為近似值。');
  lines.push('- focus 外框量測固定用「新增訂單」主要按鈕；若不同質地對 outlined 按鈕/連結有不同 focus 樣式，未逐一覆蓋。');
  lines.push('- `input_border_on_surface`：/dashboard 若該質地當前沒有可見的 `.mat-mdc-text-field-wrapper.mdc-text-field--filled`，該格標記略過，不計入不合格。');
  lines.push('- `selection_text`：第一批 `--app-selection-fg/-bg` 尚未套用到任何實際選取樣式，這裡只驗證變數本身的計算後對比是否達標，供第二批套用前先確認。');
  return lines.join('\n');
}

function renderHtml(matrix) {
  const byTexture = new Map();
  for (const m of matrix) {
    if (!byTexture.has(m.texture)) byTexture.set(m.texture, new Map());
    byTexture.get(m.texture).set(m.color, m);
  }
  const textures = [...new Set(matrix.map((m) => m.texture))];
  const colors = [...new Set(matrix.map((m) => m.color))];
  const textureLabel = (id) => matrix.find((m) => m.texture === id)?.textureLabel ?? id;
  const colorLabel = (id) => matrix.find((m) => m.color === id)?.colorLabel ?? id;

  const rows = textures
    .map((t) => {
      const cells = colors
        .map((c) => {
          const cell = byTexture.get(t).get(c);
          const cls = cell.fails ? 'fail' : 'ok';
          const worst = cell.worst ? `${cell.worst.label}<br>${cell.worst.ratio}:1` : '-';
          return `<td class="${cls}" title="${cell.textureLabel} x ${cell.colorLabel}">
            <div class="ratio">${worst}</div>
            <a href="${cell.screenshot}" target="_blank"><img src="${cell.screenshot}" loading="lazy" /></a>
          </td>`;
        })
        .join('');
      return `<tr><th>${textureLabel(t)}</th>${cells}</tr>`;
    })
    .join('');

  const header = colors.map((c) => `<th>${colorLabel(c)}</th>`).join('');

  return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8" />
<title>質地 x 配色相容性對比矩陣</title>
<style>
  body { font-family: -apple-system, sans-serif; margin: 24px; background: #fafafa; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 6px; text-align: center; vertical-align: top; font-size: 12px; }
  th { background: #eee; position: sticky; top: 0; }
  td.fail { background: #fde2e2; }
  td.ok { background: #eafbea; }
  .ratio { font-weight: 600; margin-bottom: 4px; }
  img { width: 120px; height: auto; border: 1px solid #999; }
  h1 { font-size: 18px; }
</style></head>
<body>
<h1>質地 x 配色相容性對比矩陣（7 x 8 = 56 格）</h1>
<p>紅底 = 至少一組 pair 未達 WCAG 門檻（一般文字 4.5:1 / 大字或 UI 邊界 3:1）。每格顯示最差的 pair 與其比值，點圖可放大截圖。</p>
<table>
<tr><th></th>${header}</tr>
${rows}
</table>
</body></html>`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
