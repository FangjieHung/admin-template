import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TEXTURE_FALLBACK_NOTIFIER, ThemeService } from './theme.service';
import { DEFAULT_THEME, texture } from './theme.token';
import { TEXTURE_FALLBACK_ATTR } from './texture-stylesheet-loader';

// jsdom 不會真的下載樣式表：用 textureLink() 找到 loader 插入的 <link>，手動送出 load／error 事件。
function textureLink(id: string): HTMLLinkElement | null {
  return document.head.querySelector<HTMLLinkElement>(`link[rel="stylesheet"][data-texture-css="${id}"]`);
}

function settle(id: string, type: 'load' | 'error'): void {
  const link = textureLink(id);
  if (!link) {
    throw new Error(`找不到 ${id} 的 <link>`);
  }
  link.dispatchEvent(new Event(type));
}

/** 切到某個質地並模擬樣式載入完成（常駐質地不會插入 <link>）。 */
async function switchTo(svc: ThemeService, id: string): Promise<void> {
  const done = svc.setParadigm(id);
  if (textureLink(id) && textureLink(id)?.dataset['state'] !== 'loaded') {
    settle(id, 'load');
  }
  await done;
}

describe('ThemeService', () => {
  let svc: ThemeService;
  let notifier: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-paradigm');
    document.documentElement.removeAttribute(TEXTURE_FALLBACK_ATTR);
    notifier = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: TEXTURE_FALLBACK_NOTIFIER, useValue: notifier }] });
    svc = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    document.head.querySelectorAll('link[data-texture-css], link[data-texture-prefetch]').forEach((l) => l.remove());
  });

  it('setTheme 同時改 signal、dataset、localStorage', () => {
    svc.setTheme('midnight');
    expect(svc.theme()).toBe('midnight');
    expect(document.documentElement.dataset['theme']).toBe('midnight');
    expect(localStorage.getItem('app.theme')).toBe('midnight');
  });

  it('setParadigm 同時改 signal、dataset、localStorage', async () => {
    await switchTo(svc, 'grid');
    expect(svc.paradigm()).toBe('grid');
    expect(document.documentElement.dataset['paradigm']).toBe('grid');
    expect(localStorage.getItem('app.paradigm')).toBe('grid');

    await switchTo(svc, 'material');
    expect(svc.paradigm()).toBe('material');
    expect(document.documentElement.dataset['paradigm']).toBe('material');
    expect(localStorage.getItem('app.paradigm')).toBe('material');
  });

  it('init 從 localStorage 還原；無值用預設', async () => {
    localStorage.setItem('app.theme', 'midnight');
    await svc.init();
    expect(svc.theme()).toBe('midnight');
    expect(svc.paradigm()).toBe('material'); // 無值 → 預設
  });

  it('ADR 0007：切換質地時，目前配色若不相容該質地，改用該質地的預設配色', async () => {
    svc.setTheme('sandstone');
    await switchTo(svc, 'soft-ui'); // soft-ui 不相容 sandstone
    expect(svc.theme()).toBe('cool-grey'); // soft-ui 的預設配色
    expect(document.documentElement.dataset['theme']).toBe('cool-grey');
    expect(localStorage.getItem('app.theme')).toBe('cool-grey');
  });

  it('ADR 0007：切換質地時，目前配色若仍相容，維持原本配色不變', async () => {
    svc.setTheme('midnight');
    await switchTo(svc, 'soft-ui'); // soft-ui 相容 midnight
    expect(svc.theme()).toBe('midnight');
  });

  it('ADR 0007：init 時 localStorage 存的組合不相容，自動校正為該質地的預設配色並持久化', async () => {
    localStorage.setItem('app.paradigm', 'soft-ui');
    localStorage.setItem('app.theme', 'verdant'); // soft-ui 不相容 verdant
    const done = svc.init();
    settle('soft-ui', 'load');
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
    expect(document.documentElement.dataset['paradigm']).toBe('material');
    expect(localStorage.getItem('app.paradigm')).toBe('material');
    expect(svc.compatibleThemes().map((t) => t.id)).toContain(svc.theme());
    expect(document.head.querySelector('link[data-texture-css]')).toBeNull();
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
    settle('soft-ui', 'load');
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
      svc.setTheme('sandstone');
      const done = svc.setParadigm('clay');

      expect(svc.pendingParadigm()).toBe('clay');
      expect(svc.paradigm()).toBe('material');
      expect(document.documentElement.dataset['paradigm']).toBeUndefined();
      expect(document.documentElement.dataset['theme']).toBe('sandstone');
      expect(textureLink('clay')?.getAttribute('href')).toBe('texture-clay.css');

      settle('clay', 'load');
      await done;
      expect(svc.pendingParadigm()).toBeNull();
      expect(document.documentElement.dataset['paradigm']).toBe('clay');
      expect(document.documentElement.dataset['theme']).toBe('cool-grey'); // clay 不相容 sandstone
      expect(localStorage.getItem('app.paradigm')).toBe('clay');
    });

    it('新質地套用之後才移除舊質地的 <link>', async () => {
      await switchTo(svc, 'clay');
      const done = svc.setParadigm('grid');
      expect(textureLink('clay')).not.toBeNull(); // 新的還沒載入，舊的不能先拿掉
      settle('grid', 'load');
      await done;
      expect(textureLink('clay')).toBeNull();
      expect(textureLink('grid')).not.toBeNull();

      await switchTo(svc, 'material');
      expect(textureLink('grid')).toBeNull();
    });

    it('載入失敗：退回 Material、校正 localStorage 與 dataset、移除失敗與舊的 <link>，並提示', async () => {
      await switchTo(svc, 'grid');
      svc.setTheme('candy'); // grid 相容 candy，material 不相容
      const done = svc.setParadigm('clay');
      settle('clay', 'error');
      await done;

      expect(svc.paradigm()).toBe('material');
      expect(document.documentElement.dataset['paradigm']).toBe('material');
      expect(localStorage.getItem('app.paradigm')).toBe('material');
      expect(svc.theme()).toBe(DEFAULT_THEME);
      expect(textureLink('clay')).toBeNull();
      expect(textureLink('grid')).toBeNull();
      expect(notifier).toHaveBeenCalledWith('clay');
    });

    it('連點兩個質地：只套用最後一個，先下載完的那個不留在頁面上', async () => {
      const first = svc.setParadigm('clay');
      const second = svc.setParadigm('grid');
      settle('clay', 'load');
      await first;
      expect(svc.paradigm()).toBe('material');
      expect(textureLink('clay')).toBeNull();

      settle('grid', 'load');
      await second;
      expect(svc.paradigm()).toBe('grid');
    });

    it('點了別的質地又點回目前的質地：取消進行中的切換', async () => {
      await switchTo(svc, 'grid');
      const pending = svc.setParadigm('clay');
      await svc.setParadigm('grid');
      expect(svc.pendingParadigm()).toBeNull();
      settle('clay', 'load');
      await pending;
      expect(svc.paradigm()).toBe('grid');
      expect(textureLink('clay')).toBeNull();
    });

    it('init：沒有開機腳本時由 init 載入，樣式載入完成前不完成（app 不渲染）', async () => {
      localStorage.setItem('app.paradigm', 'editorial');
      let finished = false;
      const done = svc.init().then(() => (finished = true));
      await Promise.resolve();
      expect(finished).toBe(false);
      settle('editorial', 'load');
      await done;
      expect(svc.paradigm()).toBe('editorial');
      expect(document.documentElement.dataset['paradigm']).toBe('editorial');
    });

    it('init：開機腳本已載入好的 <link> 直接沿用，不重複插入', async () => {
      localStorage.setItem('app.paradigm', 'clay');
      localStorage.setItem('app.theme', 'midnight');
      const boot = document.createElement('link');
      boot.rel = 'stylesheet';
      boot.href = 'texture-clay.css';
      boot.dataset['textureCss'] = 'clay';
      boot.dataset['state'] = 'loaded';
      document.head.appendChild(boot);

      await svc.init();
      expect(document.head.querySelectorAll('link[data-texture-css]')).toHaveLength(1);
      expect(svc.paradigm()).toBe('clay');
      expect(svc.theme()).toBe('midnight');
    });

    it('init：開機腳本載入失敗已退回 Material，第一次渲染後提示', async () => {
      localStorage.setItem('app.paradigm', 'material'); // 開機腳本的 onerror 已校正
      document.documentElement.setAttribute(TEXTURE_FALLBACK_ATTR, 'clay');

      await svc.init();
      expect(svc.paradigm()).toBe('material');
      expect(document.documentElement.hasAttribute(TEXTURE_FALLBACK_ATTR)).toBe(false);
      expect(notifier).not.toHaveBeenCalled();

      TestBed.inject(ApplicationRef).tick();
      expect(notifier).toHaveBeenCalledWith('clay');
    });

    it('init：init 自己載入失敗時退回 Material、覆寫 localStorage，渲染後提示', async () => {
      localStorage.setItem('app.paradigm', 'frosted');
      localStorage.setItem('app.theme', 'candy');
      const done = svc.init();
      settle('frosted', 'error');
      await done;
      expect(svc.paradigm()).toBe('material');
      expect(localStorage.getItem('app.paradigm')).toBe('material');
      expect(svc.theme()).toBe(DEFAULT_THEME); // material 不相容 candy

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
});
