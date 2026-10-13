// ADR 0010／0013：按需質地與按需配色的登錄散在四處（theme.token.ts 的 `texture`／`COLOR_THEMES`、admin project.json
// 的 styles、admin index.html 開機腳本的 id 清單、texture/<id>/_index.scss／color-themes/<id>/_index.scss）。
// TS 與 JSON／HTML 之間沒有編譯期連結，少登一處 build 照樣綠、畫面卻沒有質地或配色樣式，所以在這裡逐一比對，
// 並實際執行開機腳本。
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const TOKEN = read('libs/theme-pack/src/lib/theme/theme.token.ts');
const INDEX_HTML = read('apps/admin/src/index.html');
const PROJECT = JSON.parse(read('apps/admin/project.json'));
const ADMIN_STYLES = read('apps/admin/src/styles.scss');
const TEXTURE_DIR = 'libs/theme-pack/src/lib/styles/texture';
const COLOR_DIR = 'libs/theme-pack/src/lib/styles/color-themes';
const COMBOS = read('libs/theme-pack/src/lib/styles/_combos.scss');

function idsOf(source, constName) {
  const block = source.match(new RegExp(`export const ${constName}[^=]*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!block) throw new Error(`theme.token.ts 找不到 ${constName}`);
  return [...block[1].matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
}

const DEFAULT_PARADIGM = TOKEN.match(/export const DEFAULT_PARADIGM = '([^']+)'/)[1];
const DEFAULT_THEME = TOKEN.match(/export const DEFAULT_THEME = '([^']+)'/)[1];
function residentOf(constName) {
  const block = TOKEN.match(new RegExp(`export const ${constName}[^=]*=\\s*\\[([^\\]]*)\\]`))[1];
  return block
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => ({ DEFAULT_PARADIGM, DEFAULT_THEME })[s] ?? s.replace(/'/g, ''));
}
const RESIDENT = residentOf('RESIDENT_TEXTURE_IDS');
const RESIDENT_COLORS = residentOf('RESIDENT_COLOR_THEME_IDS');
const TEXTURES = idsOf(TOKEN, 'texture');
const COLOR_THEMES = idsOf(TOKEN, 'COLOR_THEMES');
const ON_DEMAND = TEXTURES.filter((id) => !RESIDENT.includes(id));
const ON_DEMAND_COLORS = COLOR_THEMES.filter((id) => !RESIDENT_COLORS.includes(id));
const STYLE_BUNDLES = PROJECT.targets.build.options.styles.filter((s) => typeof s === 'object');

const bootMatch = INDEX_HTML.match(/<script id="app-texture-boot">([\s\S]*?)<\/script>/);
const BOOT = bootMatch?.[1] ?? '';

function arrayInBoot(name) {
  const m = BOOT.match(new RegExp(`var ${name} = \\[([^\\]]*)\\]`));
  if (!m) throw new Error(`開機腳本找不到 ${name}`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

/** 在假的 document／localStorage 上執行開機腳本，回傳它做了什麼。 */
function runBoot(stored, { storageThrows = false } = {}) {
  const attrs = { 'data-paradigm': 'material', 'data-theme': 'verdant' };
  const writes = [];
  const store = { ...stored };
  const localStorage = {
    getItem: (k) => {
      if (storageThrows) throw new Error('blocked');
      return k in store ? store[k] : null;
    },
    setItem: (k, v) => {
      if (storageThrows) throw new Error('blocked');
      store[k] = String(v);
    },
  };
  const document = {
    documentElement: { setAttribute: (k, v) => (attrs[k] = String(v)) },
    write: (html) => writes.push(html),
  };
  const window = {};
  vm.runInNewContext(BOOT, { window, document, localStorage });
  return { attrs, writes, store, window };
}

describe('按需質地登錄一致（ADR 0010）', () => {
  it('常駐質地只有預設質地，且它在質地清單內', () => {
    expect(RESIDENT).toEqual([DEFAULT_PARADIGM]);
    expect(TEXTURES).toContain(DEFAULT_PARADIGM);
  });

  it('每個按需質地在 admin project.json 都有 texture-<id> 的 inject:false 樣式入口，且入口檔存在', () => {
    const bundles = STYLE_BUNDLES.filter((b) => b.bundleName.startsWith('texture-'));
    expect(bundles.map((b) => b.bundleName).sort()).toEqual(ON_DEMAND.map((id) => `texture-${id}`).sort());
    for (const b of bundles) {
      const id = b.bundleName.replace(/^texture-/, '');
      expect(b.inject).toBe(false);
      expect(b.input).toBe(`${TEXTURE_DIR}/${id}/_index.scss`);
      expect(existsSync(join(ROOT, b.input))).toBe(true);
    }
  });

  it('texture/ 底下每個質地資料夾都登錄在 theme.token.ts（沒有遺落、沒有多出）', () => {
    const dirs = readdirSync(join(ROOT, TEXTURE_DIR), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    expect(dirs.sort()).toEqual([...TEXTURES].sort());
  });

  it('按需質地用到的 Google Fonts 字型，必須由它自己的 _fonts.scss 載入（不能靠別的質地順便載入）', () => {
    // 拆檔前所有質地的字型 CSS 都在主樣式裡，Soft UI／Aero 的 DM Sans 其實是跟著 Clay 載入的。
    const familiesOf = (id) => {
      const p = join(ROOT, TEXTURE_DIR, id, '_fonts.scss');
      if (!existsSync(p)) return [];
      return [...readFileSync(p, 'utf8').matchAll(/family=([^:&']+)/g)].map((m) => m[1].replace(/\+/g, ' '));
    };
    const textureOnlyFamilies = new Set(TEXTURES.flatMap(familiesOf));
    for (const id of ON_DEMAND) {
      const css = ['_tokens.scss', 'recipes.scss']
        .map((f) => join(ROOT, TEXTURE_DIR, id, f))
        .filter(existsSync)
        .map((p) => readFileSync(p, 'utf8'))
        .join('\n');
      const used = [...css.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((f) => textureOnlyFamilies.has(f));
      const own = familiesOf(id);
      for (const family of new Set(used)) {
        expect(own, `${id} 用到 ${family}`).toContain(family);
      }
      if (own.length > 0) {
        expect(readFileSync(join(ROOT, TEXTURE_DIR, id, '_index.scss'), 'utf8')).toMatch(/^@forward 'fonts';/m);
      }
    }
  });

  it('admin 主樣式只 @use 常駐質地，不含任何按需質地', () => {
    for (const id of ON_DEMAND) {
      expect(ADMIN_STYLES).not.toMatch(new RegExp(`texture/${id}\\b`));
    }
    expect(ADMIN_STYLES).toContain(`texture/${DEFAULT_PARADIGM}'`);
  });

  it('開機腳本的質地與配色清單與 theme.token.ts 一致', () => {
    expect(arrayInBoot('onDemandTextures')).toEqual(ON_DEMAND);
    expect(arrayInBoot('colorThemes')).toEqual(COLOR_THEMES);
    expect(arrayInBoot('onDemandColors')).toEqual(ON_DEMAND_COLORS);
  });

  it('開機腳本在 <base> 之後、第一個 <link rel="stylesheet"> 之前', () => {
    // 註解與開機腳本自己的字串裡也有 <link rel="stylesheet">，先去掉再找真正的第一個樣式表。
    const head = INDEX_HTML.slice(0, INDEX_HTML.indexOf('</head>'))
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(BOOT, '');
    const base = head.indexOf('<base ');
    const boot = head.indexOf('<script id="app-texture-boot">');
    const firstSheet = head.search(/<link[^>]*rel="stylesheet"/);
    expect(base).toBeGreaterThan(-1);
    expect(boot).toBeGreaterThan(base);
    expect(firstSheet === -1 || boot < firstSheet).toBe(true);
    expect(INDEX_HTML).toMatch(/<html[^>]*data-paradigm="material"/);
  });
});

describe('按需配色登錄一致（ADR 0013）', () => {
  it('常駐配色只有預設配色，且它是常駐質地的預設配色（兩者載入失敗時的退路一定有樣式）', () => {
    expect(RESIDENT_COLORS).toEqual([DEFAULT_THEME]);
    expect(COLOR_THEMES).toContain(DEFAULT_THEME);
    const materialDefault = TOKEN.match(new RegExp(`\\n  ${DEFAULT_PARADIGM}: \\{[\\s\\S]*?defaultThemeId: '([^']+)'`))?.[1];
    expect(materialDefault).toBe(DEFAULT_THEME);
  });

  it('每個按需配色在 admin project.json 都有 color-<id> 的 inject:false 樣式入口，且入口檔存在', () => {
    const bundles = STYLE_BUNDLES.filter((b) => b.bundleName.startsWith('color-'));
    expect(bundles.map((b) => b.bundleName).sort()).toEqual(ON_DEMAND_COLORS.map((id) => `color-${id}`).sort());
    for (const b of bundles) {
      const id = b.bundleName.replace(/^color-/, '');
      expect(b.inject).toBe(false);
      expect(b.input).toBe(`${COLOR_DIR}/${id}/_index.scss`);
      expect(existsSync(join(ROOT, b.input))).toBe(true);
    }
    // 只有這兩種按需入口；不會有別的 inject:false 樣式混進來而沒人檢查。
    expect(STYLE_BUNDLES).toHaveLength(ON_DEMAND.length + ON_DEMAND_COLORS.length);
  });

  it('color-themes/ 底下每個配色資料夾都登錄在 theme.token.ts（沒有遺落、沒有多出），且都有 _index.scss', () => {
    const dirs = readdirSync(join(ROOT, COLOR_DIR), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    expect(dirs.sort()).toEqual([...COLOR_THEMES].sort());
    // 配色沒有 registry 了：常駐配色由 styles.scss 直接 @use，按需配色由 project.json 的入口編譯。
    expect(existsSync(join(ROOT, COLOR_DIR, '_registry.scss'))).toBe(false);
  });

  it.each(COLOR_THEMES)('color-themes/%s/_index.scss：輸出自己的 token 與自己那組組合規則', (id) => {
    const index = read(`${COLOR_DIR}/${id}/_index.scss`);
    expect(index).toMatch(/^@forward 'tokens';/m);
    expect(index).toContain(`@include combos.for-color('${id}');`);
  });

  it('_combos.scss 的每條組合規則都放在它自己那個配色的分支裡（才會跟著那個配色的檔案輸出）', () => {
    const code = COMBOS.replace(/\/\/.*$/gm, '');
    let branch = null;
    let count = 0;
    for (const line of code.split('\n')) {
      const ifMatch = line.match(/@(?:else )?if \$id == '([^']+)'/);
      if (ifMatch) branch = ifMatch[1];
      for (const m of line.matchAll(/data-theme='([^']+)'/g)) {
        count++;
        expect(m[1], line.trim()).toBe(branch);
      }
    }
    expect(count).toBeGreaterThan(0);
    // 不在 mixin 裡的規則會直接輸出到每個 @use 它的檔案（主樣式與每個 color-<id>.css），不允許。
    expect(code.replace(/@mixin for-color[\s\S]*$/, '')).not.toMatch(/\{/);
  });

  it('admin 主樣式只 @use 常駐配色，不含任何按需配色', () => {
    for (const id of ON_DEMAND_COLORS) {
      expect(ADMIN_STYLES).not.toMatch(new RegExp(`color-themes/${id}\\b`));
    }
    expect(ADMIN_STYLES).toContain(`color-themes/${DEFAULT_THEME}'`);
    expect(ADMIN_STYLES).not.toContain('color-themes/registry');
  });
});

describe('開機腳本行為（ADR 0010）', () => {
  it('存的是按需質地：設好 data-paradigm／data-theme，並由解析器寫入會擋渲染的 <link>', () => {
    const { attrs, writes } = runBoot({ 'app.paradigm': 'clay', 'app.theme': 'verdant' });
    expect(attrs['data-paradigm']).toBe('clay');
    expect(attrs['data-theme']).toBe('verdant');
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatch(/^<link rel="stylesheet" href="texture-clay\.css" data-texture-css="clay"[^>]*>$/);
    expect(writes[0]).toContain('onerror="__appTextureFailed(this)"');
  });

  it('ADR 0013：存的是按需質地＋按需配色：一次寫入兩個 <link>，質地在前、配色在後（同時下載、都擋渲染）', () => {
    const { attrs, writes } = runBoot({ 'app.paradigm': 'clay', 'app.theme': 'midnight' });
    expect(attrs['data-paradigm']).toBe('clay');
    expect(attrs['data-theme']).toBe('midnight');
    expect(writes).toHaveLength(1);
    const links = writes[0].match(/<link [^>]*>/g);
    expect(links).toHaveLength(2);
    expect(links[0]).toMatch(/^<link rel="stylesheet" href="texture-clay\.css" data-texture-css="clay"/);
    expect(links[1]).toMatch(/^<link rel="stylesheet" href="color-midnight\.css" data-color-css="midnight"/);
    expect(links[1]).toContain('onerror="__appColorFailed(this)"');
  });

  it('ADR 0013：常駐質地＋按需配色：只寫入配色的 <link>', () => {
    const { attrs, writes } = runBoot({ 'app.paradigm': 'material', 'app.theme': 'oled' });
    expect(attrs['data-paradigm']).toBe('material');
    expect(attrs['data-theme']).toBe('oled');
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatch(/^<link rel="stylesheet" href="color-oled\.css" data-color-css="oled"[^>]*>$/);
  });

  it.each([
    ['verdant', '常駐配色'],
    ['removed-theme', '不認得的 id'],
    ["midnight' onload='alert(1)", '注入字串'],
  ])('app.theme = %s（%s）：不寫入配色的 <link>', (theme) => {
    const { writes } = runBoot({ 'app.paradigm': 'material', 'app.theme': theme });
    expect(writes).toEqual([]);
  });

  it('ADR 0013：配色 <link> 載入失敗：退回 verdant、校正 localStorage、留下 data-color-fallback、移除 <link>', () => {
    const { attrs, store, window } = runBoot({ 'app.paradigm': 'grid', 'app.theme': 'candy' });
    let removed = false;
    window.__appColorFailed({ getAttribute: () => 'candy', remove: () => (removed = true) });
    expect(attrs['data-theme']).toBe('verdant');
    expect(attrs['data-color-fallback']).toBe('candy');
    expect(attrs['data-paradigm']).toBe('grid');
    expect(store['app.theme']).toBe('verdant');
    expect(removed).toBe(true);
  });

  it.each([
    ['material', 'material'],
    ['removed-texture', '不認得的 id'],
    [null, '沒存過'],
    ['clay" onload="alert(1)', '注入字串'],
  ])('app.paradigm = %s（%s）：維持 material，不寫入任何 <link>', (paradigm) => {
    const { attrs, writes } = runBoot(paradigm === null ? {} : { 'app.paradigm': paradigm });
    expect(attrs['data-paradigm']).toBe('material');
    expect(writes).toEqual([]);
  });

  it('不認得的配色 id 不寫進 data-theme（維持 index.html 的預設，留給 ThemeService.init() 校正）', () => {
    const { attrs } = runBoot({ 'app.paradigm': 'grid', 'app.theme': 'removed-theme' });
    expect(attrs['data-theme']).toBe('verdant');
  });

  it('localStorage 無法使用時不丟錯，維持 material', () => {
    const { attrs, writes } = runBoot({}, { storageThrows: true });
    expect(attrs['data-paradigm']).toBe('material');
    expect(writes).toEqual([]);
  });

  it('<link> 載入失敗：退回 material、校正 localStorage、留下 data-texture-fallback、移除 <link>', () => {
    const { attrs, store, window } = runBoot({ 'app.paradigm': 'editorial' });
    let removed = false;
    window.__appTextureFailed({ getAttribute: () => 'editorial', remove: () => (removed = true) });
    expect(attrs['data-paradigm']).toBe('material');
    expect(attrs['data-texture-fallback']).toBe('editorial');
    expect(store['app.paradigm']).toBe('material');
    expect(removed).toBe(true);
  });
});
