// ADR 0010：按需質地的登錄散在四處（theme.token.ts 的 `texture`、admin project.json 的 styles、
// admin index.html 開機腳本的 id 清單、texture/<id>/_index.scss）。TS 與 JSON／HTML 之間沒有編譯期連結，
// 少登一處 build 照樣綠、畫面卻沒有質地樣式，所以在這裡逐一比對，並實際執行開機腳本。
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

function idsOf(source, constName) {
  const block = source.match(new RegExp(`export const ${constName}[^=]*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!block) throw new Error(`theme.token.ts 找不到 ${constName}`);
  return [...block[1].matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
}

const DEFAULT_PARADIGM = TOKEN.match(/export const DEFAULT_PARADIGM = '([^']+)'/)[1];
const residentBlock = TOKEN.match(/export const RESIDENT_TEXTURE_IDS[^=]*=\s*\[([^\]]*)\]/)[1];
const RESIDENT = residentBlock
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => (s === 'DEFAULT_PARADIGM' ? DEFAULT_PARADIGM : s.replace(/'/g, '')));
const TEXTURES = idsOf(TOKEN, 'texture');
const COLOR_THEMES = idsOf(TOKEN, 'COLOR_THEMES');
const ON_DEMAND = TEXTURES.filter((id) => !RESIDENT.includes(id));

const bootMatch = INDEX_HTML.match(/<script id="cr-texture-boot">([\s\S]*?)<\/script>/);
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
    const styles = PROJECT.targets.build.options.styles;
    const bundles = styles.filter((s) => typeof s === 'object');
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
  });

  it('開機腳本在 <base> 之後、第一個 <link rel="stylesheet"> 之前', () => {
    // 註解與開機腳本自己的字串裡也有 <link rel="stylesheet">，先去掉再找真正的第一個樣式表。
    const head = INDEX_HTML.slice(0, INDEX_HTML.indexOf('</head>'))
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(BOOT, '');
    const base = head.indexOf('<base ');
    const boot = head.indexOf('<script id="cr-texture-boot">');
    const firstSheet = head.search(/<link[^>]*rel="stylesheet"/);
    expect(base).toBeGreaterThan(-1);
    expect(boot).toBeGreaterThan(base);
    expect(firstSheet === -1 || boot < firstSheet).toBe(true);
    expect(INDEX_HTML).toMatch(/<html[^>]*data-paradigm="material"/);
  });
});

describe('開機腳本行為（ADR 0010）', () => {
  it('存的是按需質地：設好 data-paradigm／data-theme，並由解析器寫入會擋渲染的 <link>', () => {
    const { attrs, writes } = runBoot({ 'cr.paradigm': 'clay', 'cr.theme': 'midnight' });
    expect(attrs['data-paradigm']).toBe('clay');
    expect(attrs['data-theme']).toBe('midnight');
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatch(/^<link rel="stylesheet" href="texture-clay\.css" data-texture-css="clay"/);
    expect(writes[0]).toContain('onerror="__crTextureFailed(this)"');
  });

  it.each([
    ['material', 'material'],
    ['removed-texture', '不認得的 id'],
    [null, '沒存過'],
    ['clay" onload="alert(1)', '注入字串'],
  ])('cr.paradigm = %s（%s）：維持 material，不寫入任何 <link>', (paradigm) => {
    const { attrs, writes } = runBoot(paradigm === null ? {} : { 'cr.paradigm': paradigm });
    expect(attrs['data-paradigm']).toBe('material');
    expect(writes).toEqual([]);
  });

  it('不認得的配色 id 不寫進 data-theme（維持 index.html 的預設，留給 ThemeService.init() 校正）', () => {
    const { attrs } = runBoot({ 'cr.paradigm': 'grid', 'cr.theme': 'removed-theme' });
    expect(attrs['data-theme']).toBe('verdant');
  });

  it('localStorage 無法使用時不丟錯，維持 material', () => {
    const { attrs, writes } = runBoot({}, { storageThrows: true });
    expect(attrs['data-paradigm']).toBe('material');
    expect(writes).toEqual([]);
  });

  it('<link> 載入失敗：退回 material、校正 localStorage、留下 data-texture-fallback、移除 <link>', () => {
    const { attrs, store, window } = runBoot({ 'cr.paradigm': 'editorial' });
    let removed = false;
    window.__crTextureFailed({ getAttribute: () => 'editorial', remove: () => (removed = true) });
    expect(attrs['data-paradigm']).toBe('material');
    expect(attrs['data-texture-fallback']).toBe('editorial');
    expect(store['cr.paradigm']).toBe('material');
    expect(removed).toBe(true);
  });
});
