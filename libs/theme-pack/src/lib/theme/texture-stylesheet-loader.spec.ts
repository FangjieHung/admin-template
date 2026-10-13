import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TEXTURE_BOOT_SCRIPT_ID, TextureStylesheetLoader } from './texture-stylesheet-loader';

function link(id: string): HTMLLinkElement | null {
  return document.head.querySelector<HTMLLinkElement>(`link[rel="stylesheet"][data-texture-css="${id}"]`);
}

describe('TextureStylesheetLoader（ADR 0010）', () => {
  let loader: TextureStylesheetLoader;
  const added: Element[] = [];

  function addToHead<T extends Element>(el: T): T {
    document.head.appendChild(el);
    added.push(el);
    return el;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    loader = TestBed.inject(TextureStylesheetLoader);
  });

  afterEach(() => {
    document.head.querySelectorAll('link[data-texture-css], link[data-texture-prefetch]').forEach((l) => l.remove());
    added.splice(0).forEach((el) => el.remove());
  });

  it('常駐質地（material）與不認得的 id 立即完成，不插入 <link>', async () => {
    await loader.ensure('material');
    await loader.ensure('removed-texture');
    expect(document.head.querySelector('link[data-texture-css]')).toBeNull();
  });

  it('按需質地：插入 texture-<id>.css，load 之後才 resolve', async () => {
    let resolved = false;
    const done = loader.ensure('grid').then(() => (resolved = true));
    expect(link('grid')?.getAttribute('href')).toBe('texture-grid.css');
    await Promise.resolve();
    expect(resolved).toBe(false);

    link('grid')?.dispatchEvent(new Event('load'));
    await done;
    expect(resolved).toBe(true);
    expect(link('grid')?.dataset['state']).toBe('loaded');
  });

  it('載入失敗（error）：移除該 <link> 並 reject，下次會重新嘗試', async () => {
    const done = loader.ensure('clay');
    link('clay')?.dispatchEvent(new Event('error'));
    await expect(done).rejects.toThrow('texture-clay.css');
    expect(link('clay')).toBeNull();

    const retry = loader.ensure('clay');
    expect(link('clay')).not.toBeNull();
    link('clay')?.dispatchEvent(new Event('load'));
    await retry;
  });

  it('同一個質地同時要求兩次只插入一個 <link>；已載入的直接完成', async () => {
    const a = loader.ensure('linen');
    const b = loader.ensure('linen');
    expect(document.head.querySelectorAll('link[data-texture-css="linen"]')).toHaveLength(1);
    link('linen')?.dispatchEvent(new Event('load'));
    await Promise.all([a, b]);
    await loader.ensure('linen');
    expect(document.head.querySelectorAll('link[data-texture-css="linen"]')).toHaveLength(1);
  });

  it('沿用開機腳本寫入、還在下載中的 <link>，不重複插入', async () => {
    const boot = addToHead(document.createElement('link'));
    boot.rel = 'stylesheet';
    boot.href = 'texture-aero.css';
    boot.setAttribute('data-texture-css', 'aero');
    const done = loader.ensure('aero');
    expect(document.head.querySelectorAll('link[data-texture-css="aero"]')).toHaveLength(1);
    boot.dispatchEvent(new Event('load'));
    await done;
  });

  it('插入位置：開機腳本之後、主樣式與元件樣式之前（維持舊版單一樣式檔的層疊順序）', () => {
    const script = addToHead(document.createElement('script'));
    script.id = TEXTURE_BOOT_SCRIPT_ID;
    const main = addToHead(document.createElement('link'));
    main.rel = 'stylesheet';
    main.href = 'styles.css';
    const componentStyle = addToHead(document.createElement('style'));

    void loader.ensure('grid');
    void loader.ensure('clay');
    const order = Array.from(document.head.children);
    const at = (el: Element | null) => order.indexOf(el as Element);
    expect(at(link('grid'))).toBe(at(script) + 1);
    expect(at(link('clay'))).toBe(at(link('grid')) + 1);
    expect(at(link('clay'))).toBeLessThan(at(main));
    expect(at(main)).toBeLessThan(at(componentStyle));
  });

  it('沒有開機腳本時排在第一個樣式表之前', () => {
    const style = addToHead(document.createElement('style'));
    void loader.ensure('soft-ui');
    const order = Array.from(document.head.children);
    expect(order.indexOf(link('soft-ui') as Element)).toBeLessThan(order.indexOf(style));
  });

  it('remove 拿掉該質地的 <link>；常駐質地不受影響', async () => {
    const done = loader.ensure('editorial');
    link('editorial')?.dispatchEvent(new Event('load'));
    await done;
    loader.remove('editorial');
    loader.remove('material');
    expect(link('editorial')).toBeNull();
  });

  it('prefetch 只為尚未載入的按需質地放 <link rel="prefetch" as="style">', async () => {
    const done = loader.ensure('grid');
    link('grid')?.dispatchEvent(new Event('load'));
    await done;
    loader.prefetch(['material', 'grid', 'clay', 'clay', 'unknown']);
    const prefetches = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"]'));
    expect(prefetches.map((l) => [l.dataset['texturePrefetch'], l.getAttribute('href'), l.getAttribute('as')])).toEqual([
      ['clay', 'texture-clay.css', 'style'],
    ]);
  });
});
