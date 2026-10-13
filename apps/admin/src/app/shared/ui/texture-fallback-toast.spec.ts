import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Injector } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import {
  COLOR_FALLBACK_MESSAGE,
  COLOR_FALLBACK_NOTIFIER,
  TEXTURE_FALLBACK_MESSAGE,
  TEXTURE_FALLBACK_NOTIFIER,
} from '@admin-template/theme-pack';
import { COLOR_FALLBACK_TOAST, TEXTURE_FALLBACK_TOAST } from '../../app.config';
import { notifyTextureFallback } from './texture-fallback-toast';

describe('質地／配色載入失敗的提示（*_FALLBACK_NOTIFIER → ToastService）', () => {
  let overlay: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TEXTURE_FALLBACK_TOAST, COLOR_FALLBACK_TOAST] });
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
  });

  afterEach(() => {
    overlay.innerHTML = '';
  });

  async function toastElement(): Promise<HTMLElement> {
    for (let i = 0; i < 50; i++) {
      TestBed.tick();
      const el = overlay.querySelector('lib-toast');
      if (el) return el as HTMLElement;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('提示沒有出現');
  }

  it('app.config 提供的 notifier 動態載入 ToastService，以警告類型顯示退回訊息', async () => {
    const notify = TestBed.inject(TEXTURE_FALLBACK_NOTIFIER);
    notify('clay');
    const el = await toastElement();
    expect(el.getAttribute('data-type')).toBe('warning');
    expect(el.textContent).toContain(TEXTURE_FALLBACK_MESSAGE);
    // 警告會自動消失，所以沒有關閉鈕。
    expect(el.querySelector('.lib-toast__close')).toBeNull();
  });

  it('ADR 0013：配色的 notifier 同樣以警告類型顯示「配色載入失敗，暫時使用預設配色」', async () => {
    const notify = TestBed.inject(COLOR_FALLBACK_NOTIFIER);
    notify('midnight');
    const el = await toastElement();
    expect(el.getAttribute('data-type')).toBe('warning');
    expect(el.textContent).toContain(COLOR_FALLBACK_MESSAGE);
    expect(COLOR_FALLBACK_MESSAGE).toBe('配色載入失敗，暫時使用預設配色');
  });

  it('notifyTextureFallback 用 app 的 injector 建立服務（不需要頁面層的 provider）', async () => {
    const ref = notifyTextureFallback(TestBed.inject(Injector));
    const el = await toastElement();
    expect(el.textContent).toContain(TEXTURE_FALLBACK_MESSAGE);
    ref.dismiss();
    await ref.afterDismissed;
  });
});
