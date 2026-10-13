import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { COLOR_FALLBACK_NOTIFIER, TEXTURE_FALLBACK_NOTIFIER, ThemeService } from './theme.service';
import { COLOR_THEMES, DEFAULT_THEME, texture } from './theme.token';
import { TEXTURE_FALLBACK_ATTR } from './texture-stylesheet-loader';
import { COLOR_FALLBACK_ATTR } from './color-stylesheet-loader';

// jsdom 不會真的下載樣式表：用 textureLink()／colorLink() 找到 loader 插入的 <link>，手動送出 load／error 事件。
function textureLink(id: string): HTMLLinkElement | null {
  return document.head.querySelector<HTMLLinkElement>(`link[rel="stylesheet"][data-texture-css="${id}"]`);
}

function colorLink(id: string): HTMLLinkElement | null {
  return document.head.querySelector<HTMLLinkElement>(`link[rel="stylesheet"][data-color-css="${id}"]`);
}

function settle(link: HTMLLinkElement | null, type: 'load' | 'error'): void {
  if (!link) {
    throw new Error('找不到 <link>');
  }
  link.dispatchEvent(new Event(type));
}

/** 讓目前所有還在下載的質地／配色 <link> 載入完成。 */
function settleAll(): void {
  document.head
    .querySelectorAll<HTMLLinkElement>('link[data-texture-css], link[data-color-css]')
    .forEach((l) => l.dataset['state'] !== 'loaded' && l.dispatchEvent(new Event('load')));
}

/** 切到某個質地並模擬樣式載入完成（常駐質地不會插入 <link>）。 */
async function switchTo(svc: ThemeService, id: string): Promise<void> {
  const done = svc.setParadigm(id);
  settleAll();
  await done;
}

/** 切到某個配色並模擬樣式載入完成（常駐配色不會插入 <link>）。 */
async function pick(svc: ThemeService, id: string): Promise<void> {
  const done = svc.setTheme(id);
  settleAll();
  await done;
}

const html = () => document.documentElement;
const linkIds = (attr: string) =>
  Array.from(document.head.querySelectorAll<HTMLLinkElement>(`link[rel="stylesheet"][${attr}]`)).map((l) =>
    l.getAttribute(attr),
  );

describe('ThemeService', () => {
  let svc: ThemeService;
  let notifier: ReturnType<typeof vi.fn>;
  let colorNotifier: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    html().removeAttribute('data-theme');
    html().removeAttribute('data-paradigm');
    html().removeAttribute(TEXTURE_FALLBACK_ATTR);
    html().removeAttribute(COLOR_FALLBACK_ATTR);
    notifier = vi.fn();
    colorNotifier = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: TEXTURE_FALLBACK_NOTIFIER, useValue: notifier },
        { provide: COLOR_FALLBACK_NOTIFIER, useValue: colorNotifier },
      ],
    });
    svc = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    document.head
      .querySelectorAll('link[data-texture-css], link[data-texture-prefetch], link[data-color-css], link[data-color-prefetch]')
      .forEach((l) => l.remove());
  });

  it('setTheme 同時改 signal、dataset、localStorage', async () => {
    await pick(svc, 'midnight');
    expect(svc.theme()).toBe('midnight');
    expect(html().dataset['theme']).toBe('midnight');
    expect(localStorage.getItem('app.theme')).toBe('midnight');
  });

  it('setParadigm 同時改 signal、dataset、localStorage', async () => {
    await switchTo(svc, 'grid');
    expect(svc.paradigm()).toBe('grid');
    expect(html().dataset['paradigm']).toBe('grid');
    expect(localStorage.getItem('app.paradigm')).toBe('grid');

    await switchTo(svc, 'material');
    expect(svc.paradigm()).toBe('material');
    expect(html().dataset['paradigm']).toBe('material');
    expect(localStorage.getItem('app.paradigm')).toBe('material');
  });

  it('init 從 localStorage 還原；無值用預設', async () => {
    localStorage.setItem('app.theme', 'midnight');
    const done = svc.init();
    settleAll();
    await done;
    expect(svc.theme()).toBe('midnight');
    expect(svc.paradigm()).toBe('material'); // 無值 → 預設
  });

  it('ADR 0007：切換質地時，目前配色若不相容該質地，改用該質地的預設配色', async () => {
    await pick(svc, 'sandstone');
    await switchTo(svc, 'soft-ui'); // soft-ui 不相容 sandstone
    expect(svc.theme()).toBe('cool-grey'); // soft-ui 的預設配色
    expect(html().dataset['theme']).toBe('cool-grey');
    expect(localStorage.getItem('app.theme')).toBe('cool-grey');
  });

  it('ADR 0007：切換質地時，目前配色若仍相容，維持原本配色不變', async () => {
    await pick(svc, 'midnight');
    await switchTo(svc, 'soft-ui'); // soft-ui 相容 midnight
    expect(svc.theme()).toBe('midnight');
  });

  it('ADR 0007：init 時 localStorage 存的組合不相容，自動校正為該質地的預設配色並持久化', async () => {
    localStorage.setItem('app.paradigm', 'soft-ui');
    localStorage.setItem('app.theme', 'verdant'); // soft-ui 不相容 verdant
    const done = svc.init();
    expect(colorLink('cool-grey')).not.toBeNull(); // 校正後的配色要先下載
    settleAll();
    await done;
    expect(svc.paradigm()).toBe('soft-ui');
    expect(svc.theme()).toBe('cool-grey');
    expect(localStorage.getItem('app.theme')).toBe('cool-grey');
  });

  it.each([
    ['removed-texture', 'verdant'],
    ['xyz', ''],
  ])('init 時 localStorage 存了不認得的質地 %s：退回預設質地、配色校正到相容值，並覆寫殘值', async (paradigm, theme) => {
    localStorage.setItem('app.paradigm', paradigm);
    localStorage.setItem('app.theme', theme);
    await svc.init();
    expect(svc.paradigm()).toBe('material');
    expect(html().dataset['paradigm']).toBe('material');
    expect(localStorage.getItem('app.paradigm')).toBe('material');
    expect(svc.compatibleThemes().map((t) => t.id)).toContain(svc.theme());
    expect(document.head.querySelector('link[data-texture-css]')).toBeNull();
  });

  it('init 時 localStorage 存了不認得的配色：退回預設配色並覆寫殘值', async () => {
    localStorage.setItem('app.theme', 'removed-theme');
    await svc.init();
    expect(svc.theme()).toBe(DEFAULT_THEME);
    expect(localStorage.getItem('app.theme')).toBe(DEFAULT_THEME);
    expect(document.head.querySelector('link[data-color-css]')).toBeNull();
  });

  it('setParadigm 收到不認得的質地 id 時退回預設質地', async () => {
    await switchTo(svc, 'grid');
    await svc.setParadigm('removed-texture');
    expect(svc.paradigm()).toBe('material');
    expect(localStorage.getItem('app.paradigm')).toBe('material');
  });

  it('ADR 0007：init 時已存組合相容，維持原樣', async () => {
    localStorage.setItem('app.paradigm', 'soft-ui');
    localStorage.setItem('app.theme', 'midnight');
    const done = svc.init();
    settleAll();
    await done;
    expect(svc.theme()).toBe('midnight');
  });

  it('ADR 0007：compatibleThemes 只列出目前質地相容的配色，供 settings 頁與外觀浮動面板重用', async () => {
    await switchTo(svc, 'soft-ui');
    const ids = svc.compatibleThemes().map((t) => t.id);
    expect(ids).not.toContain('sandstone');
    expect(ids).not.toContain('verdant');
    expect(ids).toContain('cool-grey');

    await switchTo(svc, 'material');
    expect(svc.compatibleThemes().map((t) => t.id)).toContain('verdant');
  });

  describe('ADR 0010：按需質地', () => {
    it('樣式載入完成前維持舊外觀，載入完成才一次切換 data-paradigm 與配色', async () => {
      await pick(svc, 'sandstone');
      const done = svc.setParadigm('clay');

      expect(svc.pendingParadigm()).toBe('clay');
      expect(svc.paradigm()).toBe('material');
      expect(html().dataset['paradigm']).toBe('material');
      expect(html().dataset['theme']).toBe('sandstone');
      expect(textureLink('clay')?.getAttribute('href')).toBe('texture-clay.css');

      settleAll();
      await done;
      expect(svc.pendingParadigm()).toBeNull();
      expect(html().dataset['paradigm']).toBe('clay');
      expect(html().dataset['theme']).toBe('cool-grey'); // clay 不相容 sandstone
      expect(localStorage.getItem('app.paradigm')).toBe('clay');
    });

    it('新質地套用之後才移除舊質地的 <link>', async () => {
      await switchTo(svc, 'clay');
      const done = svc.setParadigm('grid');
      expect(textureLink('clay')).not.toBeNull(); // 新的還沒載入，舊的不能先拿掉
      settle(textureLink('grid'), 'load');
      await done;
      expect(textureLink('clay')).toBeNull();
      expect(textureLink('grid')).not.toBeNull();

      await switchTo(svc, 'material');
      expect(textureLink('grid')).toBeNull();
    });

    it('載入失敗：退回 Material、校正 localStorage 與 dataset、移除失敗與舊的 <link>，並提示', async () => {
      await switchTo(svc, 'grid');
      await pick(svc, 'candy'); // grid 相容 candy，material 不相容
      const done = svc.setParadigm('clay'); // clay 不相容 candy → 一併下載 clay 的預設配色 cool-grey
      settle(textureLink('clay'), 'error');
      settle(colorLink('cool-grey'), 'load');
      await done;

      expect(svc.paradigm()).toBe('material');
      expect(html().dataset['paradigm']).toBe('material');
      expect(localStorage.getItem('app.paradigm')).toBe('material');
      expect(svc.theme()).toBe(DEFAULT_THEME);
      expect(textureLink('clay')).toBeNull();
      expect(textureLink('grid')).toBeNull();
      expect(linkIds('data-color-css')).toEqual([]); // candy 與為 clay 下載的 cool-grey 都拿掉
      expect(notifier).toHaveBeenCalledWith('clay');
      expect(colorNotifier).not.toHaveBeenCalled();
    });

    it('載入失敗時配色維持切換前的配色（相容 Material 的話），不換成為新質地準備的預設配色', async () => {
      await pick(svc, 'sandstone');
      const done = svc.setParadigm('clay');
      settle(textureLink('clay'), 'error');
      settle(colorLink('cool-grey'), 'load');
      await done;
      expect(svc.paradigm()).toBe('material');
      expect(svc.theme()).toBe('sandstone');
      expect(linkIds('data-color-css')).toEqual(['sandstone']);
    });

    it('連點兩個質地：只套用最後一個，先下載完的那個不留在頁面上', async () => {
      const first = svc.setParadigm('clay');
      const second = svc.setParadigm('grid');
      settle(textureLink('clay'), 'load');
      settle(colorLink('cool-grey'), 'load');
      await first;
      expect(svc.paradigm()).toBe('material');
      expect(textureLink('clay')).toBeNull();
      expect(colorLink('cool-grey')).toBeNull(); // 為 clay 準備的配色也不留

      settle(textureLink('grid'), 'load');
      await second;
      expect(svc.paradigm()).toBe('grid');
      expect(svc.theme()).toBe('verdant'); // grid 相容 verdant：不沿用為 clay 準備的配色
    });

    it('點了別的質地又點回目前的質地：取消進行中的切換', async () => {
      await switchTo(svc, 'grid');
      const pending = svc.setParadigm('clay');
      await svc.setParadigm('grid');
      expect(svc.pendingParadigm()).toBeNull();
      expect(svc.pendingTheme()).toBeNull();
      settleAll();
      await pending;
      expect(svc.paradigm()).toBe('grid');
      expect(textureLink('clay')).toBeNull();
      expect(colorLink('cool-grey')).toBeNull();
    });

    it('init：沒有開機腳本時由 init 載入，樣式載入完成前不完成（app 不渲染）', async () => {
      localStorage.setItem('app.paradigm', 'editorial');
      let finished = false;
      const done = svc.init().then(() => (finished = true));
      await Promise.resolve();
      expect(finished).toBe(false);
      settleAll();
      await done;
      expect(svc.paradigm()).toBe('editorial');
      expect(html().dataset['paradigm']).toBe('editorial');
    });

    it('init：開機腳本已載入好的 <link> 直接沿用，不重複插入', async () => {
      localStorage.setItem('app.paradigm', 'clay');
      localStorage.setItem('app.theme', 'midnight');
      for (const [attr, id, href] of [
        ['textureCss', 'clay', 'texture-clay.css'],
        ['colorCss', 'midnight', 'color-midnight.css'],
      ]) {
        const boot = document.createElement('link');
        boot.rel = 'stylesheet';
        boot.href = href;
        boot.dataset[attr] = id;
        boot.dataset['state'] = 'loaded';
        document.head.appendChild(boot);
      }

      await svc.init();
      expect(document.head.querySelectorAll('link[data-texture-css]')).toHaveLength(1);
      expect(document.head.querySelectorAll('link[data-color-css]')).toHaveLength(1);
      expect(svc.paradigm()).toBe('clay');
      expect(svc.theme()).toBe('midnight');
    });

    it('init：開機腳本載入失敗已退回 Material，第一次渲染後提示', async () => {
      localStorage.setItem('app.paradigm', 'material'); // 開機腳本的 onerror 已校正
      html().setAttribute(TEXTURE_FALLBACK_ATTR, 'clay');

      await svc.init();
      expect(svc.paradigm()).toBe('material');
      expect(html().hasAttribute(TEXTURE_FALLBACK_ATTR)).toBe(false);
      expect(notifier).not.toHaveBeenCalled();

      TestBed.inject(ApplicationRef).tick();
      expect(notifier).toHaveBeenCalledWith('clay');
      expect(colorNotifier).not.toHaveBeenCalled();
    });

    it('init：init 自己載入失敗時退回 Material、覆寫 localStorage，渲染後提示', async () => {
      localStorage.setItem('app.paradigm', 'frosted');
      localStorage.setItem('app.theme', 'candy');
      const done = svc.init();
      settle(textureLink('frosted'), 'error');
      settle(colorLink('candy'), 'load');
      await done;
      expect(svc.paradigm()).toBe('material');
      expect(localStorage.getItem('app.paradigm')).toBe('material');
      expect(svc.theme()).toBe(DEFAULT_THEME); // material 不相容 candy
      expect(colorLink('candy')).toBeNull();

      TestBed.inject(ApplicationRef).tick();
      expect(notifier).toHaveBeenCalledWith('frosted');
    });

    it('prefetchTextures 為每個按需質地放一個 prefetch，不含常駐質地，重複呼叫不重複放', () => {
      svc.prefetchTextures();
      svc.prefetchTextures();
      const ids = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"]')).map(
        (l) => l.dataset['texturePrefetch'],
      );
      expect(ids).toEqual(texture.map((t) => t.id).filter((id) => id !== 'material'));
    });
  });

  describe('ADR 0013：按需配色', () => {
    it('常駐配色（verdant）不插入 <link>，立即套用', async () => {
      await pick(svc, 'midnight');
      await svc.setTheme('verdant');
      expect(svc.theme()).toBe('verdant');
      expect(linkIds('data-color-css')).toEqual([]);
    });

    it('樣式載入完成前維持舊配色，載入完成才切換 data-theme，再移除舊配色的 <link>', async () => {
      await pick(svc, 'midnight');
      const done = svc.setTheme('sandstone');
      expect(svc.pendingTheme()).toBe('sandstone');
      expect(svc.theme()).toBe('midnight');
      expect(html().dataset['theme']).toBe('midnight');
      expect(colorLink('sandstone')?.getAttribute('href')).toBe('color-sandstone.css');
      expect(colorLink('midnight')).not.toBeNull();

      settle(colorLink('sandstone'), 'load');
      await done;
      expect(svc.pendingTheme()).toBeNull();
      expect(html().dataset['theme']).toBe('sandstone');
      expect(localStorage.getItem('app.theme')).toBe('sandstone');
      expect(linkIds('data-color-css')).toEqual(['sandstone']);
    });

    it('載入失敗：退回常駐配色、校正 localStorage 與 dataset、移除失敗與舊的 <link>，並提示', async () => {
      await switchTo(svc, 'grid');
      await pick(svc, 'candy');
      const done = svc.setTheme('oled');
      settle(colorLink('oled'), 'error');
      await done;
      expect(svc.paradigm()).toBe('grid');
      expect(svc.theme()).toBe(DEFAULT_THEME);
      expect(html().dataset['theme']).toBe(DEFAULT_THEME);
      expect(localStorage.getItem('app.theme')).toBe(DEFAULT_THEME);
      expect(linkIds('data-color-css')).toEqual([]);
      expect(colorNotifier).toHaveBeenCalledWith('oled');
      expect(notifier).not.toHaveBeenCalled();
    });

    it('連點兩個配色：只套用最後一個，先下載完的那個不留在頁面上', async () => {
      const first = svc.setTheme('azure');
      const second = svc.setTheme('candy');
      settle(colorLink('azure'), 'load');
      await first;
      expect(svc.theme()).toBe('verdant');
      expect(colorLink('azure')).toBeNull();
      settle(colorLink('candy'), 'load');
      await second;
      expect(svc.theme()).toBe('candy');
    });

    it('質地切換連帶換配色：兩個檔案都下載完才一次套用', async () => {
      await pick(svc, 'sandstone');
      const done = svc.setParadigm('clay'); // clay 不相容 sandstone → cool-grey
      expect(svc.pendingParadigm()).toBe('clay');
      expect(svc.pendingTheme()).toBe('cool-grey');

      settle(textureLink('clay'), 'load');
      await Promise.resolve();
      await Promise.resolve();
      expect(html().dataset['paradigm']).toBe('material'); // 配色還沒到：兩者都不換
      expect(html().dataset['theme']).toBe('sandstone');

      settle(colorLink('cool-grey'), 'load');
      await done;
      expect(html().dataset['paradigm']).toBe('clay');
      expect(html().dataset['theme']).toBe('cool-grey');
      expect(linkIds('data-color-css')).toEqual(['cool-grey']);
    });

    it('質地切換連帶換配色、配色載入失敗：質地照常套用，配色退回常駐配色並提示', async () => {
      await pick(svc, 'sandstone');
      const done = svc.setParadigm('clay');
      settle(textureLink('clay'), 'load');
      settle(colorLink('cool-grey'), 'error');
      await done;
      expect(svc.paradigm()).toBe('clay');
      expect(svc.theme()).toBe(DEFAULT_THEME);
      expect(colorNotifier).toHaveBeenCalledWith('cool-grey');
      expect(notifier).not.toHaveBeenCalled();
    });

    it('配色還在下載時切質地：沿用剛選的配色（相容的話），一次套用', async () => {
      const color = svc.setTheme('midnight');
      const paradigm = svc.setParadigm('grid'); // grid 相容 midnight
      expect(svc.pendingTheme()).toBe('midnight');
      settleAll();
      await Promise.all([color, paradigm]);
      expect(svc.paradigm()).toBe('grid');
      expect(svc.theme()).toBe('midnight');
    });

    it('質地還在下載時選配色：兩者一起套用', async () => {
      const paradigm = svc.setParadigm('grid');
      const color = svc.setTheme('candy');
      expect(svc.pendingParadigm()).toBe('grid');
      expect(svc.pendingTheme()).toBe('candy');
      settleAll();
      await Promise.all([paradigm, color]);
      expect(svc.paradigm()).toBe('grid');
      expect(svc.theme()).toBe('candy');
      expect(linkIds('data-texture-css')).toEqual(['grid']);
      expect(linkIds('data-color-css')).toEqual(['candy']);
    });

    it('init：沒有開機腳本時由 init 載入配色，載入完成前不完成', async () => {
      localStorage.setItem('app.theme', 'oled');
      let finished = false;
      const done = svc.init().then(() => (finished = true));
      await Promise.resolve();
      expect(finished).toBe(false);
      settle(colorLink('oled'), 'load');
      await done;
      expect(svc.theme()).toBe('oled');
    });

    it('init：init 自己載入配色失敗時退回常駐配色、覆寫 localStorage，渲染後提示', async () => {
      localStorage.setItem('app.paradigm', 'grid');
      localStorage.setItem('app.theme', 'graphite');
      const done = svc.init();
      settle(textureLink('grid'), 'load');
      settle(colorLink('graphite'), 'error');
      await done;
      expect(svc.paradigm()).toBe('grid');
      expect(svc.theme()).toBe(DEFAULT_THEME);
      expect(localStorage.getItem('app.theme')).toBe(DEFAULT_THEME);
      expect(colorNotifier).not.toHaveBeenCalled();
      TestBed.inject(ApplicationRef).tick();
      expect(colorNotifier).toHaveBeenCalledWith('graphite');
    });

    it('init：開機腳本的配色載入失敗已退回常駐配色，第一次渲染後提示', async () => {
      localStorage.setItem('app.theme', DEFAULT_THEME); // 開機腳本的 onerror 已校正
      html().setAttribute(COLOR_FALLBACK_ATTR, 'azure');
      await svc.init();
      expect(svc.theme()).toBe(DEFAULT_THEME);
      expect(html().hasAttribute(COLOR_FALLBACK_ATTR)).toBe(false);
      TestBed.inject(ApplicationRef).tick();
      expect(colorNotifier).toHaveBeenCalledWith('azure');
      expect(notifier).not.toHaveBeenCalled();
    });

    it('prefetchColors 為每個按需配色放一個 prefetch，不含常駐配色，重複呼叫不重複放', () => {
      svc.prefetchColors();
      svc.prefetchColors();
      const prefetches = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"]'));
      expect(prefetches.map((l) => l.dataset['colorPrefetch'])).toEqual(
        COLOR_THEMES.map((c) => c.id).filter((id) => id !== DEFAULT_THEME),
      );
      expect(prefetches[0].getAttribute('href')).toBe('color-midnight.css');
    });
  });
});
