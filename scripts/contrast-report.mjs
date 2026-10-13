#!/usr/bin/env node
// 質地(texture) x 配色(color theme) 相容性對比報告。
//
// 用法：
//   node scripts/contrast-report.mjs [--base-url=http://localhost:5231] [--out=<dir>]
//
// 前置：
//   1. 另開一個終端機跑 `npx nx serve admin --port=5231`，或對 production build 開一個靜態伺服器
//      （例如 `npx nx build admin --output-path=<dir>` 後對 <dir>/browser 起 SPA 伺服器），用 --base-url 指過去。
//   2. `npm install`（本機需要 playwright-core，已加入 devDependencies；不會下載瀏覽器，
//      直接借用系統已安裝的 Google Chrome，走 CDP 連線，繞開「headless Chrome 連不到
//      localhost」的 Bash sandbox 限制 — 因為是長駐 Playwright session 而非一次性 CLI）。
//
// 輸出（預設 .scratch/theme-compat-panel/reports/，可用 --out 覆寫；不寫進 repo 的 dist/）：
//   - contrast-matrix.json   原始量測數據（64 格 x 多組 pair）
//   - contrast-report.md     文字報告（每格數值 + 合格標記 + 不合格清單）
//   - contrast-report.html   64 格矩陣，紅色標示不合格，滑鼠可看每格最差 pair
//   - screenshots/<texture>__<color>.png   64 張代表畫面截圖（screenshot wall）
//
// 量測方法：見 scripts/contrast-lib.mjs 開頭的 alpha compositing 說明。
// 量測畫面：展示 app 的「Material 元件總覽」（/components/material）。它是質地的測試台，一頁內就有
// 全部內容區 pair（頁首標題、卡片底色文字、次要文字、徽章、狀態 chip、focus 外框、主要按鈕）加上
// 側欄 pair（品牌名稱/副標、選中與未選中選單文字、使用者名稱/狀態、收合箭頭圖示），
// 可在單一畫面把 64 組合（8 質地 × 8 配色）跑完。
// 例外：輸入欄位邊界（input_border_on_surface）另外量 Material 元件總覽的所有欄位、資料表頁（展開搜尋膠囊）、
// 總覽頁開出的對話框（FIELD_PAGES）；欄位狀態（field_hover_border／field_focus_indicator／field_error_border）
// 與原生勾選框、單選鈕（check_*）也在那些畫面量，見 measureStatePairs。

import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contrastForTextOnStack,
  parseColor,
  effectiveBackground,
  contrastRatio,
  THRESHOLD_NORMAL_TEXT,
  THRESHOLD_LARGE_TEXT,
  passes,
  parseInsetRing,
  fieldBoundaryContrast,
  layerContrast,
  bestFocusIndicator,
  choiceControlContrast,
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
  { id: 'aero', label: 'Aero 雲霧玻璃' },
  { id: 'ledger', label: 'Ledger 帳冊' },
  { id: 'cockpit', label: 'Cockpit 儀表艙' },
  { id: 'brutal', label: 'Brutal 新粗野' },
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
  { id: 'graphite', label: 'Graphite 石墨橘' },
  { id: 'oled', label: 'OLED 純黑' },
  { id: 'signal', label: 'Signal 訊號色' },
  { id: 'riso-duo', label: 'Riso 雙色' },
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
    selector: '.topbar-heading h1',
    kind: 'large', // 頁首大標題
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
    selector: '.demo-block__description',
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
    selector: '[data-contrast-target="primary-button"]',
    kind: 'normal',
  },
  // 側欄(side-nav) pairs：Soft UI 曾出現側欄底色被畫亮、文字卻維持白色的真實回歸
  // （側欄底色來自質地 recipe，文字色來自配色 token，兩邊各自獨立設定，容易脫鉤）。
  // 每種質地都要覆蓋到，因此併入主 PAIRS 清單，所有格子全跑。
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
    // （icon 與 caret 皆帶 material-symbols-rounded class）。/components/material 時亮起的是「總覽」
    // 群組按鈕，量到的是它的文字 label。
    selector: '.nav-link.active > span:not(.material-symbols-rounded)',
    kind: 'normal',
  },
  {
    key: 'sidenav_nav_idle_label',
    label: '側欄選單項目(未選中) 文字 on 底色',
    // 同上原因，改用 `> span:not(.material-symbols-rounded)`；DOM 首個符合的未選中
    // .nav-link 是群組觸發按鈕(如「資料呈現」)，測到的是它的文字 label，而非展開箭頭。
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
  // ticket: 語意用途變數（batch 1）新增、batch 2 修正、batch 3（欄位邊界）擴充：輸入欄位的可見邊界
  // 對欄位外側底色，3:1（UI 邊界門檻）。量 FIELD_PAGES 三個畫面上「所有可見、非停用、非 focus」的欄位，
  // 取最低值。每個欄位取「真的構成邊界的那條線」，依序判斷：
  //   1. outlined 欄位 → notched outline 的邊框色；
  //   2. wrapper 自己的 border（grid／editorial／frosted）；
  //   3. wrapper 的 spread-only inset 細框（soft-ui／clay、page-toolbar 搜尋膠囊）；
  //   4. MDC 底線（.mdc-line-ripple::before 的 border-bottom，material／linen）——線疊在填色上；
  //   5. 都沒有 → 欄位填色對外側底色（改前 material／linen／clay／soft-ui 的狀況）。
  {
    key: 'input_border_on_surface',
    label: '輸入框邊界（底線／邊框／細框）on 欄位外側底色',
    kind: 'ui',
    page: 'fields',
  },
  // ticket: 語意用途變數 batch 4（原生勾選框與狀態對比）。全部是 UI 門檻 3:1，量法沿用「取真正構成邊界的那條線」。
  // 欄位三種狀態：
  {
    key: 'field_hover_border',
    label: '欄位滑過時的邊界 on 欄位外側底色',
    kind: 'ui',
    page: 'states',
  },
  {
    key: 'field_focus_indicator',
    label: '欄位鍵盤焦點指示（主色底線／outline／焦點邊框）on 欄位外側底色',
    kind: 'ui',
    page: 'states',
  },
  {
    key: 'field_error_border',
    label: '欄位錯誤狀態的邊界 on 欄位外側底色',
    kind: 'ui',
    page: 'states',
  },
  // 原生勾選框／單選鈕（libs/ui data-table 的列選取、Material 元件總覽的原生 input）：
  {
    key: 'check_unchecked_border',
    label: '勾選框／單選鈕未勾選外框 on 外側底色',
    kind: 'ui',
    page: 'states',
  },
  {
    key: 'check_checked_fill',
    label: '勾選框／單選鈕勾選底 on 外側底色',
    kind: 'ui',
    page: 'states',
  },
  {
    key: 'check_mark',
    label: '勾號／橫線／圓點 on 勾選底',
    kind: 'ui',
    page: 'states',
  },
  {
    key: 'check_focus_ring',
    label: '勾選框鍵盤焦點框 on 外側底色',
    kind: 'ui',
    page: 'states',
  },
];

// 欄位邊界量測的畫面：Material 元件總覽（outline／fill 各種狀態的欄位）、資料表頁（展開搜尋膠囊）、
// 總覽頁開出的對話框（有一個必填欄位）。
const FIELD_PAGES = [
  { key: 'create', path: '/components/material', root: 'body' },
  {
    key: 'list',
    path: '/components/data-table',
    root: 'body',
    setup: async (page) => {
      // 展開搜尋膠囊後輸入一個字再移開焦點：有內容時 blur 不會收合，才量得到靜止狀態的膠囊邊界。
      await page.click('.search__toggle');
      await page.fill('.search__input', 'A');
      await page.evaluate(() => document.activeElement?.blur());
      await page.waitForTimeout(300);
    },
  },
  {
    key: 'dialog',
    path: '/components/material',
    root: '.mat-mdc-dialog-surface',
    setup: async (page) => {
      await page.locator('[data-contrast-target="open-dialog"]').first().click();
      await page.waitForSelector('.mat-mdc-dialog-surface');
      await page.waitForTimeout(600);
    },
  },
];

// focus 外框：另外處理（需要先 focus 才量得到）
const FOCUS_TARGET_SELECTOR = '[data-contrast-target="primary-button"]';

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

// ticket: 語意用途變數 batch 3（欄位邊界）：列出 root 內每個可見欄位的邊界線色、填色與外側底色堆疊。
// inset 細框在 node 端用 parseInsetRing 解析（回傳原始 box-shadow 字串）。
async function extractFieldBoundaries(page, rootSel) {
  return page.evaluate((rootSel) => {
    const root = document.querySelector(rootSel) || document.body;
    const layersOf = (node) => { const l = []; while (node) { l.push(getComputedStyle(node).backgroundColor); node = node.parentElement; } return l.reverse(); };
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(el).visibility !== 'hidden'; };
    const out = [];
    for (const w of root.querySelectorAll('.mat-mdc-text-field-wrapper')) {
      if (!visible(w) || w.classList.contains('mdc-text-field--disabled')) continue;
      const ff = w.closest('.mat-mdc-form-field');
      if (ff?.classList.contains('mat-focused')) continue; // 只量靜止狀態
      const cs = getComputedStyle(w);
      const label = (ff?.querySelector('mat-label')?.textContent || '').trim().slice(0, 20);
      const rec = { label, fill: cs.backgroundColor, outer: layersOf(w.parentElement), boxShadow: cs.boxShadow };
      if (w.classList.contains('mdc-text-field--outlined')) {
        const n = ff.querySelector('.mdc-notched-outline__leading');
        rec.outlinedFg = n ? getComputedStyle(n).borderTopColor : null;
      }
      if (cs.borderTopStyle !== 'none' && parseFloat(cs.borderTopWidth) > 0) rec.borderFg = cs.borderTopColor;
      const rip = w.querySelector('.mdc-line-ripple');
      const rb = rip && getComputedStyle(rip, '::before');
      if (rb && rb.borderBottomStyle !== 'none' && parseFloat(rb.borderBottomWidth) > 0) rec.underlineFg = rb.borderBottomColor;
      out.push(rec);
    }
    for (const s of root.querySelectorAll('.search')) {
      if (!visible(s) || s.matches(':focus-within')) continue;
      const cs = getComputedStyle(s);
      const rec = { label: 'page-toolbar .search', fill: cs.backgroundColor, outer: layersOf(s.parentElement), boxShadow: cs.boxShadow };
      if (cs.borderTopStyle !== 'none' && parseFloat(cs.borderTopWidth) > 0) rec.borderFg = cs.borderTopColor;
      out.push(rec);
    }
    return out;
  }, rootSel);
}

function boundaryOf(rec) {
  if (rec.outlinedFg) return { method: 'outlined', fg: rec.outlinedFg };
  if (rec.borderFg) return { method: 'border', fg: rec.borderFg };
  const ring = parseInsetRing(rec.boxShadow);
  if (ring) return { method: 'ring', fg: ring.color };
  if (rec.underlineFg) return { method: 'underline', fg: rec.underlineFg };
  return { method: 'fill', fg: rec.fill };
}

// 前景可能半透明（邊框 color-mix、填色 80%、側欄選取底 28%）：先把前景疊到底色堆疊上，
// 再跟底色本身比。contrastForTextOnStack 會丟掉前景 alpha，這裡不能用它。
function contrastOfLayer(fgStr, layersOuterToInner) {
  const bg = effectiveBackground(layersOuterToInner.map(parseColor));
  const fg = effectiveBackground([...layersOuterToInner, fgStr].map(parseColor));
  return { ratio: contrastRatio(fg, bg), effectiveBg: bg, fgRgb: fg };
}

// ticket: 語意用途變數（batch 1）新增選取文字對比；不需要真的拖曳選取。
async function extractSelectionColors(page) {
  return page.evaluate(() => {
    // batch 2 起 ::selection 真的有套用（component.scss，soft-ui 另有覆寫），直接讀元素的
    // getComputedStyle(el, '::selection')，而不是只讀變數——這樣質地層的覆寫也會被量到。
    // 內容區：頁面大標；側欄：品牌名稱。底色 = 選取底疊在該元素的底色堆疊上。
    function read(sel) {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el, '::selection');
      const layers = [];
      let n = el;
      while (n) { layers.push(getComputedStyle(n).backgroundColor); n = n.parentElement; }
      layers.reverse();
      return { fg: cs.color, bg: cs.backgroundColor, layers };
    }
    return { content: read('.ui-text-title'), sidenav: read('.brand-copy .brand-name') };
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

// ADR 0010／0013：主樣式只有常駐質地（Material）與常駐配色（Verdant），其他質地與配色是按需載入的
// texture-<id>.css／color-<id>.css。重新整理時 index.html 的開機腳本會依 localStorage 載入它們；但 ThemeService.init()
// 會把不相容的組合校正成預設配色、並移除沒套用的配色 <link>，所以這裡再確認一次兩個 <link> 都已載入完成（沒有就自己
// 插入並等 load），才改 dataset 開始量，否則會量到沒有質地或配色樣式的畫面。插入位置跟 ThemeService 一樣：
// 質地排在開機腳本後面、配色排在質地後面，都在主樣式之前。
async function applyCombo(page, paradigm, theme) {
  await page.evaluate(
    async ({ p, t }) => {
      const ensure = async (attr, id, href, anchorAttrs) => {
        let link = document.querySelector(`link[rel="stylesheet"][${attr}="${id}"]`);
        if (link && link.sheet) return;
        link?.remove();
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.setAttribute(attr, id);
        const loaded = new Promise((resolve, reject) => {
          link.addEventListener('load', resolve, { once: true });
          link.addEventListener('error', () => reject(new Error(`無法載入 ${href}`)), { once: true });
        });
        let anchor = null;
        for (const a of anchorAttrs) {
          const found = document.querySelectorAll(`link[rel="stylesheet"][${a}]`);
          if (found.length > 0) {
            anchor = found[found.length - 1];
            break;
          }
        }
        anchor = anchor ?? document.getElementById('app-texture-boot');
        if (anchor) anchor.after(link);
        else document.head.prepend(link);
        await loaded;
      };
      if (p !== 'material') await ensure('data-texture-css', p, `texture-${p}.css`, ['data-texture-css']);
      if (t !== 'verdant') await ensure('data-color-css', t, `color-${t}.css`, ['data-color-css', 'data-texture-css']);
      document.documentElement.dataset['paradigm'] = p;
      document.documentElement.dataset['theme'] = t;
    },
    { p: paradigm, t: theme },
  );
}

async function measureCombo(page, texture, color) {
  await page.evaluate(
    ({ p, t }) => {
      localStorage.setItem('app.paradigm', p);
      localStorage.setItem('app.theme', t);
    },
    { p: texture.id, t: color.id },
  );
  await page.reload({ waitUntil: 'networkidle', timeout: 20000 });
  // ThemeService.init() 會把不相容的組合校正成預設配色（ADR 0007）；
  // 報告要量「所有」格子（含不相容的組合），所以載入後直接蓋回要量的屬性。
  await applyCombo(page, texture.id, color.id);
  await page.waitForTimeout(600); // 讓 texture 的進場動畫/字型穩定

  const results = {};
  for (const pair of PAIRS) {
    if (pair.page) continue; // 其他頁面的 pair 在 focus／selection 量完後另外處理
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

  // 選取文字（batch 1 新增、batch 2 改讀實際的 ::selection），4.5:1。
  const sel = await extractSelectionColors(page);
  for (const [key, label, d] of [
    ['selection_text', '選取文字（內容區大標的 ::selection）', sel?.content],
    ['selection_text_sidenav', '側欄內選取文字（品牌名稱的 ::selection）', sel?.sidenav],
  ]) {
    if (!d || !d.fg || !d.bg) {
      results[key] = { skipped: true, reason: '讀不到 ::selection 的計算值' };
      continue;
    }
    const selBg = effectiveBackground([...d.layers, d.bg].map(parseColor));
    const ratio = contrastRatio(parseColor(d.fg), selBg);
    results[key] = {
      label,
      kind: 'normal',
      threshold: THRESHOLD_NORMAL_TEXT,
      ratio: Number(ratio.toFixed(2)),
      pass: passes(ratio, 'normal'),
      textColor: d.fg,
      effectiveBg: selBg,
      note: `::selection background ${d.bg} 疊在元素底色堆疊上`,
    };
  }

  // 移開 focus，避免殘留影響下一次截圖
  await page.evaluate(() => document.activeElement && document.activeElement.blur());

  return results;
}

// 欄位邊界（batch 3 起量 FIELD_PAGES 三個畫面）。在儀表板截圖之後才呼叫，截圖牆維持儀表板畫面。
async function measureOtherPages(page, texture, color, results) {
  const pair = PAIRS.find((p) => p.page === 'fields');
  if (!pair) return results;
  const perPage = [];
  let worst = null;
  for (const fp of FIELD_PAGES) {
    await page.goto(`${BASE_URL}${fp.path}`, { waitUntil: 'networkidle', timeout: 20000 });
    await applyCombo(page, texture.id, color.id);
    await page.waitForTimeout(600);
    if (fp.setup) await fp.setup(page);
    await page.mouse.move(1, 899); // 避免 hover 狀態
    const recs = await extractFieldBoundaries(page, fp.root);
    let pageWorst = null;
    const methods = new Set();
    for (const rec of recs) {
      const b = boundaryOf(rec);
      methods.add(b.method);
      const r = fieldBoundaryContrast({ method: b.method, fg: b.fg, fill: rec.fill, outer: rec.outer });
      const item = { page: fp.key, label: rec.label, method: b.method, fg: b.fg, ratio: r.vsOuter, vsFill: r.vsFill, effectiveBg: r.outerBg, compositedFg: r.lineRgb };
      if (!pageWorst || item.ratio < pageWorst.ratio) pageWorst = item;
    }
    perPage.push({ page: fp.key, count: recs.length, methods: [...methods], min: pageWorst ? Number(pageWorst.ratio.toFixed(2)) : null });
    if (pageWorst && (!worst || pageWorst.ratio < worst.ratio)) worst = pageWorst;
  }
  if (!worst) {
    results[pair.key] = { skipped: true, reason: 'FIELD_PAGES 上找不到可見欄位' };
    return results;
  }
  results[pair.key] = {
    label: pair.label,
    kind: pair.kind,
    threshold: THRESHOLD_LARGE_TEXT, // ui 門檻 3:1
    ratio: Number(worst.ratio.toFixed(2)),
    pass: passes(worst.ratio, pair.kind),
    textColor: worst.fg,
    compositedFg: worst.compositedFg,
    effectiveBg: worst.effectiveBg,
    perPage,
    note: `最低：${worst.page}「${worst.label}」（${worst.method}）；` + perPage.map((p) => `${p.page} ${p.count} 欄 ${p.methods.join('/')} 最低 ${p.min}`).join('；'),
  };
  return results;
}

// ---- 第四批：欄位狀態（滑過／鍵盤焦點／錯誤）與原生勾選框、單選鈕 ----
// 量法沿用 batch 3「取真正構成邊界的那條線」：滑過、錯誤用 boundaryOf（outlined → 邊框 → inset 細框 → 底線 → 填色）；
// 焦點用 bestFocusIndicator（outline、MDC 主色底線 ::after、以及和靜止時不同的邊框／細框／outlined 外框，取對比最高者）。
// 轉場一律凍結，量的是終點狀態；焦點一律真的送 Tab。

const FREEZE_CSS = '*,*::before,*::after{transition:none!important;animation:none!important}';

// 在頁面內安裝量測小工具（每次換頁後呼叫）。
async function installProbe(page) {
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.evaluate(() => {
    const layersOf = (node) => { const l = []; while (node) { l.push(getComputedStyle(node).backgroundColor); node = node.parentElement; } return l.reverse(); };
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(el).visibility !== 'hidden'; };
    const outlineOf = (el) => { if (!el) return null; const cs = getComputedStyle(el); return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? cs.outlineColor : null; };
    window.__crProbe = {
      // 幫 root 內每個可見、非停用欄位（MDC wrapper 與 page-toolbar 搜尋膠囊）編號，回傳個數。
      tag(rootSel) {
        const root = document.querySelector(rootSel) || document.body;
        let n = 0;
        for (const el of root.querySelectorAll('.mat-mdc-text-field-wrapper, .search')) {
          if (!visible(el) || el.classList.contains('mdc-text-field--disabled')) continue;
          el.dataset.crField = String(n++);
        }
        return n;
      },
      field(i) {
        const w = document.querySelector(`[data-cr-field="${i}"]`);
        if (!w) return null;
        const cs = getComputedStyle(w);
        const isSearch = w.classList.contains('search');
        const ff = isSearch ? null : w.closest('.mat-mdc-form-field');
        const rec = {
          label: isSearch ? 'page-toolbar .search' : (ff?.querySelector('mat-label')?.textContent || '').trim().slice(0, 20),
          fill: cs.backgroundColor, outer: layersOf(w.parentElement), boxShadow: cs.boxShadow,
          focused: isSearch ? w.matches(':focus-within') : !!ff?.classList.contains('mat-focused'),
          invalid: w.classList.contains('mdc-text-field--invalid'),
          borderWidth: cs.borderTopWidth,
          outlines: [outlineOf(w), outlineOf(ff), outlineOf(document.activeElement && w.contains(document.activeElement) ? document.activeElement : null)].filter(Boolean),
        };
        if (w.classList.contains('mdc-text-field--outlined')) {
          const n = ff.querySelector('.mdc-notched-outline__leading');
          if (n) { rec.outlinedFg = getComputedStyle(n).borderTopColor; rec.outlinedWidth = getComputedStyle(n).borderTopWidth; }
        }
        if (cs.borderTopStyle !== 'none' && parseFloat(cs.borderTopWidth) > 0) rec.borderFg = cs.borderTopColor;
        const rip = w.querySelector('.mdc-line-ripple');
        const rb = rip && getComputedStyle(rip, '::before');
        if (rb && rb.borderBottomStyle !== 'none' && parseFloat(rb.borderBottomWidth) > 0) rec.underlineFg = rb.borderBottomColor;
        const ra = rip && getComputedStyle(rip, '::after');
        if (ra && ra.borderBottomStyle !== 'none' && parseFloat(ra.borderBottomWidth) > 0 && parseFloat(ra.opacity) > 0 && !/scaleX\(0\)|matrix\(0,/.test(ra.transform)) rec.underlineActiveFg = ra.borderBottomColor;
        return rec;
      },
      center(i) { const r = document.querySelector(`[data-cr-field="${i}"]`).getBoundingClientRect(); return { x: r.x + Math.min(r.width / 2, 60), y: r.y + r.height / 2 }; },
      fieldOfActive() { const a = document.activeElement; const w = a && a.closest('[data-cr-field]'); return w ? Number(w.dataset.crField) : -1; },
      controls(sel) {
        return [...document.querySelectorAll(sel)].filter(visible).map((el) => {
          const cs = getComputedStyle(el);
          const b = getComputedStyle(el, '::before');
          return {
            type: el.type, checked: el.checked, indeterminate: !!el.indeterminate, disabled: el.disabled,
            appearance: cs.appearance, border: cs.borderTopColor, bg: cs.backgroundColor,
            markBg: b.backgroundColor, markBorder: parseFloat(b.borderRightWidth) > 0 ? b.borderRightColor : null,
            outer: layersOf(el.parentElement), outline: outlineOf(el), focusVisible: el.matches(':focus-visible'),
          };
        });
      },
    };
  });
}

async function tabTo(page, predicate, arg, max = 90) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(predicate, arg)) return true;
  }
  return false;
}

const TRANSPARENT = /^rgba\(0,\s*0,\s*0,\s*0\)$|^transparent$/;

function focusCandidates(rec, rest) {
  const c = rec.outlines.map((fg) => ({ method: 'outline', fg }));
  if (rec.underlineActiveFg) c.push({ method: 'underline', fg: rec.underlineActiveFg });
  if (rec.outlinedFg && (!rest || rec.outlinedFg !== rest.outlinedFg || rec.outlinedWidth !== rest.outlinedWidth)) c.push({ method: 'outlined', fg: rec.outlinedFg });
  if (rec.borderFg && (!rest || rec.borderFg !== rest.borderFg || rec.borderWidth !== rest.borderWidth)) c.push({ method: 'border', fg: rec.borderFg });
  const ring = parseInsetRing(rec.boxShadow);
  if (ring && (!rest || rec.boxShadow !== rest.boxShadow)) c.push({ method: 'ring', fg: ring.color });
  return c;
}

async function measureStatePairs(page, texture, color, results) {
  const keys = PAIRS.filter((p) => p.page === 'states').map((p) => p.key);
  if (!keys.length) return results;
  const items = Object.fromEntries(keys.map((k) => [k, []]));
  const setCombo = async () => {
    await applyCombo(page, texture.id, color.id);
    await page.waitForTimeout(400);
  };
  const hoverAll = async (pageKey, n) => {
    for (let i = 0; i < n; i++) {
      const rest = await page.evaluate((i) => window.__crProbe.field(i), i);
      if (!rest || rest.focused) continue;
      const pt = await page.evaluate((i) => window.__crProbe.center(i), i);
      await page.mouse.move(pt.x, pt.y);
      await page.waitForTimeout(40);
      const rec = await page.evaluate((i) => window.__crProbe.field(i), i);
      const b = boundaryOf(rec);
      const r = fieldBoundaryContrast({ method: b.method, fg: b.fg, fill: rec.fill, outer: rec.outer });
      items.field_hover_border.push({ page: pageKey, label: rec.label, method: b.method, fg: b.fg, ratio: r.vsOuter, effectiveBg: r.outerBg, compositedFg: r.lineRgb });
    }
    await page.mouse.move(1, 899);
  };
  const focusField = async (pageKey, i, restRec) => {
    const rec = await page.evaluate((i) => window.__crProbe.field(i), i);
    const best = bestFocusIndicator(focusCandidates(rec, restRec), { fill: rec.fill, outer: rec.outer, rest: boundaryOf(restRec) });
    if (best) items.field_focus_indicator.push({ page: pageKey, label: rec.label, method: best.method, fg: best.fg, ratio: best.vsOuter, vsRest: best.vsRest, effectiveBg: best.outerBg, compositedFg: best.lineRgb });
    else items.field_focus_indicator.push({ page: pageKey, label: rec.label, method: 'none', fg: null, ratio: 1, vsRest: 1 });
  };
  const measureChecks = async (pageKey, sel) => {
    const list = await page.evaluate((s) => window.__crProbe.controls(s), sel);
    for (const c of list) {
      if (c.appearance !== 'none' || c.disabled) continue; // 原生外觀讀不到計算樣式；停用不受 3:1 約束
      const on = c.checked || (c.type === 'checkbox' && c.indeterminate);
      if (!on) {
        const r = choiceControlContrast({ outer: c.outer, bg: c.bg, border: c.border });
        items.check_unchecked_border.push({ page: pageKey, label: `${c.type} 未勾選`, fg: c.border, ratio: r.border });
      } else {
        const mark = c.markBg && !TRANSPARENT.test(c.markBg) ? c.markBg : c.markBorder;
        const r = choiceControlContrast({ outer: c.outer, fill: c.bg, mark });
        const state = c.indeterminate ? '半選' : '勾選';
        items.check_checked_fill.push({ page: pageKey, label: `${c.type} ${state}`, fg: c.bg, ratio: r.fill });
        if (mark) items.check_mark.push({ page: pageKey, label: `${c.type} ${state}記號`, fg: mark, ratio: r.mark });
      }
    }
  };

  // 1. Material 元件總覽：欄位滑過、第一個欄位鍵盤焦點；原生勾選框與單選鈕（_choice-controls.scss）。
  await page.goto(`${BASE_URL}/components/material`, { waitUntil: 'networkidle', timeout: 20000 });
  await setCombo();
  await installProbe(page);
  let n = await page.evaluate(() => window.__crProbe.tag('body'));
  await hoverAll('create', n);
  {
    const rest0 = await page.evaluate(() => window.__crProbe.field(0));
    await page.evaluate(() => document.body.focus());
    const ok = await tabTo(page, () => window.__crProbe.fieldOfActive() === 0);
    if (ok) await focusField('create', 0, rest0);
    await page.evaluate(() => document.activeElement?.blur());
  }
  if (await page.locator('.ov-native input').count()) {
    await page.mouse.move(1, 899);
    await measureChecks('create', '.ov-native input:not(:disabled):not(:checked)');
    await measureChecks('create', '.ov-native input:not(:disabled):checked');
  }

  // 2. 資料表頁：搜尋膠囊滑過；data-table 勾選框（未勾選 → 勾第一列，表頭變半選）；勾選框鍵盤焦點框。
  await page.goto(`${BASE_URL}/components/data-table`, { waitUntil: 'networkidle', timeout: 20000 });
  await setCombo();
  await installProbe(page);
  await page.click('.search__toggle');
  await page.fill('.search__input', 'A');
  await page.evaluate(() => document.activeElement?.blur());
  n = await page.evaluate(() => window.__crProbe.tag('body'));
  await hoverAll('list', n);
  await measureChecks('list', '.dt-selection-checkbox');
  if (await page.locator('tbody .dt-selection-checkbox').count()) {
    await page.locator('tbody .dt-selection-checkbox').first().click();
    await page.waitForTimeout(150); // zoneless：等表頭的 [indeterminate] 綁定更新
    await page.evaluate(() => document.activeElement?.blur());
    await page.mouse.move(1, 899);
    await measureChecks('list', '.dt-selection-checkbox:checked, .dt-selection-checkbox:indeterminate');
    await page.evaluate(() => document.body.focus());
    const ok = await tabTo(page, () => !!document.activeElement?.matches('.dt-selection-checkbox'));
    if (ok) {
      const [c] = await page.evaluate(() => window.__crProbe.controls('.dt-selection-checkbox:focus'));
      if (c?.outline) {
        const r = layerContrast(c.outline, c.outer);
        items.check_focus_ring.push({ page: 'list', label: `checkbox focus（:focus-visible=${c.focusVisible}）`, fg: c.outline, ratio: r.ratio });
      } else {
        items.check_focus_ring.push({ page: 'list', label: 'checkbox focus：沒有 outline', fg: null, ratio: 1 });
      }
    }
  }

  // 3. 總覽頁的對話框：欄位滑過、Tab 到下一欄的焦點、必填欄位清空後離開的錯誤狀態。
  await page.goto(`${BASE_URL}/components/material`, { waitUntil: 'networkidle', timeout: 20000 });
  await setCombo();
  await installProbe(page);
  await page.locator('[data-contrast-target="open-dialog"]').first().click();
  await page.waitForSelector('.mat-mdc-dialog-surface');
  await page.waitForTimeout(300);
  n = await page.evaluate(() => window.__crProbe.tag('.mat-mdc-dialog-surface'));
  const rests = [];
  for (let i = 0; i < n; i++) rests.push(await page.evaluate((i) => window.__crProbe.field(i), i));
  await hoverAll('dialog', n);
  {
    const start = await page.evaluate(() => window.__crProbe.fieldOfActive());
    const ok = await tabTo(page, (s) => { const k = window.__crProbe.fieldOfActive(); return k >= 0 && k !== s; }, start, 10);
    if (ok) {
      const k = await page.evaluate(() => window.__crProbe.fieldOfActive());
      await focusField('dialog', k, rests[k]?.focused ? { ...rests[k], outlines: [] } : rests[k]);
    }
  }
  {
    const input = page.locator('.mat-mdc-dialog-surface [data-cr-field="0"] input').first();
    if (await input.count()) {
      await input.click();
      await page.keyboard.type('X');
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Tab');
      await page.mouse.move(1, 899);
      await page.waitForTimeout(100);
      const rec = await page.evaluate(() => window.__crProbe.field(0));
      if (rec?.invalid) {
        const b = boundaryOf(rec);
        const r = fieldBoundaryContrast({ method: b.method, fg: b.fg, fill: rec.fill, outer: rec.outer });
        items.field_error_border.push({ page: 'dialog', label: rec.label, method: b.method, fg: b.fg, ratio: r.vsOuter, effectiveBg: r.outerBg, compositedFg: r.lineRgb });
      }
    }
  }
  await page.keyboard.press('Escape');

  for (const key of keys) {
    const pair = PAIRS.find((p) => p.key === key);
    const list = items[key];
    if (!list.length) {
      results[key] = { skipped: true, reason: '畫面上找不到可量的狀態（原生外觀或流程沒走到）' };
      continue;
    }
    const worst = list.reduce((a, b) => (b.ratio < a.ratio ? b : a));
    const extra = key === 'field_focus_indicator'
      ? `；焦點指示對靜止邊界的差異：${list.map((x) => `${x.page}「${x.label}」${x.method} ${x.vsRest ? x.vsRest.toFixed(2) : '-'}`).join('、')}`
      : '';
    results[key] = {
      label: pair.label,
      kind: pair.kind,
      threshold: THRESHOLD_LARGE_TEXT, // ui 門檻 3:1
      ratio: Number(worst.ratio.toFixed(2)),
      pass: passes(worst.ratio, pair.kind),
      textColor: worst.fg,
      compositedFg: worst.compositedFg,
      effectiveBg: worst.effectiveBg,
      samples: list.length,
      vsRest: key === 'field_focus_indicator' ? Number(Math.min(...list.map((x) => x.vsRest ?? 99)).toFixed(2)) : undefined,
      note: `最低：${worst.page}「${worst.label}」${worst.method ? `（${worst.method}）` : ''}；共 ${list.length} 個樣本` + extra,
    };
  }
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
      await page.goto(`${BASE_URL}/components/material`, { waitUntil: 'networkidle', timeout: 20000 });
      const results = await measureCombo(page, texture, color);
      const shotName = `${texture.id}__${color.id}.png`;
      await page.screenshot({ path: join(SCREENSHOT_DIR, shotName) });
      await measureOtherPages(page, texture, color, results);
      await measureStatePairs(page, texture, color, results);
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
  lines.push('- 一般 pair 的量測畫面固定為 `/components/material`（Material 元件總覽），每個 selector 量第一個符合的元素。');
  lines.push('- alpha compositing 只合成純色數值，不模擬 `backdrop-filter: blur()` 的取樣效果；背景若非純色/低頻漸層，合成結果為近似值。');
  lines.push('- focus 外框量測固定用總覽頁的 Filled 主要按鈕；若不同質地對 outlined 按鈕/連結有不同 focus 樣式，未逐一覆蓋。');
  lines.push('- `input_border_on_surface`：量 Material 元件總覽、資料表頁（展開搜尋）、總覽頁對話框上所有可見、非停用、非 focus 的欄位，取最低值；每欄依序取 outlined 外框 → wrapper 邊框 → inset 細框 → Material 底線（疊在填色上）→ 填色，對欄位外側底色（見 note）。滑過／焦點／錯誤另見下一條。');
  lines.push('- 第四批的狀態 pair：`field_hover_border`（總覽頁、資料表頁、對話框每個欄位逐一滑過）、`field_focus_indicator`（真的送 Tab：總覽頁第一個欄位、對話框 Tab 到下一欄；outline、MDC 主色底線與「和靜止時不同」的邊框／細框／outlined 外框中取對比最高者，另記錄它對靜止邊界的比值，不設門檻）、`field_error_border`（對話框必填欄位輸入後清空、Tab 離開）、`check_*`（data-table 勾選框與總覽頁的原生勾選框／單選鈕：未勾選外框、勾選／半選底、記號對勾選底、Tab 到勾選框的焦點框）。轉場凍結、量終點狀態；原生外觀（appearance 不是 none）的控制項略過。');
  lines.push('- `selection_text`／`selection_text_sidenav`：直接用計算後的變數值合成，不實際拖曳選取文字。');
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
<h1>質地 x 配色相容性對比矩陣（${byTexture.size} x ${matrix.length / Math.max(byTexture.size, 1)} = ${matrix.length} 格）</h1>
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
