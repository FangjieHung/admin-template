import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ColorStylesheetLoader } from './color-stylesheet-loader';
import { TEXTURE_BOOT_SCRIPT_ID, TextureStylesheetLoader } from './texture-stylesheet-loader';

function link(id: string): HTMLLinkElement | null {
  return document.head.querySelector<HTMLLinkElement>(`link[rel="stylesheet"][data-color-css="${id}"]`);
}

function textureLink(id: string): HTMLLinkElement | null {
  return document.head.querySelector<HTMLLinkElement>(`link[rel="stylesheet"][data-texture-css="${id}"]`);
}

describe('ColorStylesheetLoader（ADR 0013）', () => {
  let loader: ColorStylesheetLoader;
  let textures: TextureStylesheetLoader;
  const added: Element[] = [];

  function addToHead<T extends Element>(el: T): T {
    document.head.appendChild(el);
    added.push(el);
    return el;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    loader = TestBed.inject(ColorStylesheetLoader);
    textures = TestBed.inject(TextureStylesheetLoader);
  });

  afterEach(() => {
    document.head
      .querySelectorAll('link[data-color-css], link[data-color-prefetch], link[data-texture-css]')
      .forEach((l) => l.remove());
    added.splice(0).forEach((el) => el.remove());
  });

  it('常駐配色（verdant）與不認得的 id 立即完成，不插入 <link>', async () => {
    await loader.ensure('verdant');
    await loader.ensure('removed-theme');
    expect(document.head.querySelector('link[data-color-css]')).toBeNull();
  });

  it('按需配色：插入 color-<id>.css，load 之後才 resolve；失敗時移除並 reject', async () => {
    let resolved = false;
    const done = loader.ensure('midnight').then(() => (resolved = true));
    expect(link('midnight')?.getAttribute('href')).toBe('color-midnight.css');
    await Promise.resolve();
    expect(resolved).toBe(false);
    link('midnight')?.dispatchEvent(new Event('load'));
    await done;
    expect(link('midnight')?.dataset['state']).toBe('loaded');

    const failed = loader.ensure('oled');
    link('oled')?.dispatchEvent(new Event('error'));
    await expect(failed).rejects.toThrow('color-oled.css');
    expect(link('oled')).toBeNull();
  });

  it('插入位置：質地 <link> 之後、主樣式之前；之後才插入的質地仍排在配色前面（層疊順序：質地 → 配色 → 主樣式）', () => {
    const script = addToHead(document.createElement('script'));
    script.id = TEXTURE_BOOT_SCRIPT_ID;
    const main = addToHead(document.createElement('link'));
    main.rel = 'stylesheet';
    main.href = 'styles.css';

    void loader.ensure('azure'); // 還沒有質地 <link>：接在開機腳本後面
    void textures.ensure('grid'); // 質地接在開機腳本後面，排到配色前面
    void loader.ensure('candy'); // 接在上一個配色後面
    const order = Array.from(document.head.children);
    const at = (el: Element | null) => order.indexOf(el as Element);
    expect(at(textureLink('grid'))).toBe(at(script) + 1);
    expect(at(link('azure'))).toBe(at(textureLink('grid')) + 1);
    expect(at(link('candy'))).toBe(at(link('azure')) + 1);
    expect(at(link('candy'))).toBeLessThan(at(main));
  });

  it('沒有配色 <link> 時接在最後一個質地 <link> 後面', () => {
    const script = addToHead(document.createElement('script'));
    script.id = TEXTURE_BOOT_SCRIPT_ID;
    void textures.ensure('clay');
    void textures.ensure('grid');
    void loader.ensure('graphite');
    const order = Array.from(document.head.children);
    expect(order.indexOf(link('graphite') as Element)).toBe(order.indexOf(textureLink('grid') as Element) + 1);
  });

  it('retainOnly 只留下指定的配色；下載中被移除的 <link> 會 reject（等待的切換不會卡住）', async () => {
    const a = loader.ensure('sandstone');
    link('sandstone')?.dispatchEvent(new Event('load'));
    await a;
    const inFlight = loader.ensure('mist-ink');
    loader.retainOnly('sandstone');
    await expect(inFlight).rejects.toThrow('已取消');
    expect(Array.from(document.head.querySelectorAll('link[data-color-css]')).map((l) => l.getAttribute('data-color-css'))).toEqual([
      'sandstone',
    ]);
    loader.retainOnly('verdant');
    expect(document.head.querySelector('link[data-color-css]')).toBeNull();
  });

  it('prefetch 只為尚未載入的按需配色放 <link rel="prefetch" as="style">', () => {
    void loader.ensure('azure');
    loader.prefetch(['verdant', 'azure', 'candy', 'candy', 'unknown']);
    const prefetches = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"]'));
    expect(prefetches.map((l) => [l.dataset['colorPrefetch'], l.getAttribute('href'), l.getAttribute('as')])).toEqual([
      ['candy', 'color-candy.css', 'style'],
    ]);
  });
});
