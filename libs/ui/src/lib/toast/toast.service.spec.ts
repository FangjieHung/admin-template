import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { ToastService, provideToast } from './toast.service';
import { TOAST_DURATIONS, ToastRef } from './toast.types';

// MatSnackBar 在測試環境（沒有 CSS 動畫）用 200ms 的 setTimeout 代替進出場動畫結束事件。
const ANIMATION = 200;

describe('ToastService', () => {
  let toast: ToastService;
  let overlay: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideToast({ close: '關閉' })] });
    toast = TestBed.inject(ToastService);
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
  });

  afterEach(async () => {
    toast.dismiss();
    await vi.advanceTimersByTimeAsync(ANIMATION * 2);
    vi.useRealTimers();
  });

  async function advance(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    TestBed.tick();
  }

  async function open(fn: () => ToastRef): Promise<{ ref: ToastRef; dismissed: () => boolean }> {
    const ref = fn();
    let done = false;
    void ref.afterDismissed.then(() => (done = true));
    await advance(ANIMATION);
    return { ref, dismissed: () => done };
  }

  const toasts = () => overlay.querySelectorAll('lib-toast');

  it('時長：成功、資訊 4 秒，警告 6 秒，錯誤不自動消失', () => {
    expect(TOAST_DURATIONS).toEqual({ success: 4000, info: 4000, warning: 6000, error: null });
  });

  for (const [type, ms] of [
    ['success', 4000],
    ['info', 4000],
    ['warning', 6000],
  ] as const) {
    it(`${type} 在 ${ms}ms 後自動消失，之前不會`, async () => {
      const { dismissed } = await open(() => toast[type]('已儲存變更'));
      expect(toasts()).toHaveLength(1);
      expect(overlay.querySelector('lib-toast')?.getAttribute('data-type')).toBe(type);
      await advance(ms - 1);
      expect(dismissed()).toBe(false);
      await advance(1 + ANIMATION);
      expect(dismissed()).toBe(true);
      expect(toasts()).toHaveLength(0);
    });
  }

  it('錯誤不會自動消失，有「關閉」鈕；按關閉後 actionClicked 為 false', async () => {
    const { ref, dismissed } = await open(() => toast.error('儲存失敗，請再試一次'));
    await advance(10 * 60 * 1000);
    expect(dismissed()).toBe(false);
    const close = overlay.querySelector('.lib-toast__close') as HTMLButtonElement;
    expect(close.getAttribute('aria-label')).toBe('關閉');
    close.click();
    await advance(ANIMATION);
    expect(dismissed()).toBe(true);
    await expect(ref.actionClicked).resolves.toBe(false);
  });

  it('成功、資訊、警告沒有關閉鈕', async () => {
    await open(() => toast.success('已送出'));
    expect(overlay.querySelector('.lib-toast__close')).toBeNull();
  });

  it('動作鈕：按下後 actionClicked 為 true 並關閉提示', async () => {
    const { ref, dismissed } = await open(() => toast.success('已刪除 1 張工單', { action: '復原' }));
    const action = overlay.querySelector('.lib-toast__action') as HTMLButtonElement;
    expect(action.textContent?.trim()).toBe('復原');
    action.click();
    await expect(ref.actionClicked).resolves.toBe(true);
    await advance(ANIMATION);
    expect(dismissed()).toBe(true);
  });

  it('自動消失時 actionClicked 為 false', async () => {
    const { ref } = await open(() => toast.info('已複製連結', { action: '開啟' }));
    await advance(4000 + ANIMATION);
    await expect(ref.actionClicked).resolves.toBe(false);
  });

  it('一次一則：新的提示取代舊的', async () => {
    const first = await open(() => toast.error('第一則'));
    const second = await open(() => toast.success('第二則'));
    await advance(ANIMATION);
    expect(first.dismissed()).toBe(true);
    await expect(first.ref.actionClicked).resolves.toBe(false);
    expect(second.dismissed()).toBe(false);
    expect(toasts()).toHaveLength(1);
    expect(overlay.textContent).toContain('第二則');
    expect(overlay.textContent).not.toContain('第一則');
  });

  it('報讀器：錯誤 assertive，其餘 polite；底部置中', async () => {
    await open(() => toast.error('連線中斷'));
    expect(overlay.querySelector('.mat-mdc-snack-bar-container [aria-live]')?.getAttribute('aria-live')).toBe('assertive');
    await open(() => toast.success('已儲存'));
    await advance(ANIMATION);
    expect(overlay.querySelector('.mat-mdc-snack-bar-container [aria-live]')?.getAttribute('aria-live')).toBe('polite');
    const pane = overlay.querySelector('.cdk-global-overlay-wrapper') as HTMLElement;
    expect(pane.style.justifyContent).toBe('center');
    expect(pane.style.alignItems).toBe('flex-end');
    expect(overlay.querySelector('.mat-mdc-snack-bar-container')?.classList).toContain('lib-toast-panel--success');
  });

  it('滑鼠移入時暫停計時，移開後重新計時', async () => {
    const { dismissed } = await open(() => toast.success('已儲存'));
    const el = overlay.querySelector('lib-toast') as HTMLElement;
    await advance(3000);
    el.dispatchEvent(new MouseEvent('mouseenter'));
    await advance(20000);
    expect(dismissed()).toBe(false);
    el.dispatchEvent(new MouseEvent('mouseleave'));
    await advance(3999);
    expect(dismissed()).toBe(false);
    await advance(1 + ANIMATION);
    expect(dismissed()).toBe(true);
  });

  it('鍵盤聚焦在提示裡時暫停，焦點在提示內移動不算離開', async () => {
    const { dismissed } = await open(() => toast.warning('外觀載入失敗', { action: '重試' }));
    const el = overlay.querySelector('lib-toast') as HTMLElement;
    const action = el.querySelector('button') as HTMLButtonElement;
    action.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await advance(20000);
    expect(dismissed()).toBe(false);
    action.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: el }));
    await advance(20000);
    expect(dismissed()).toBe(false);
    action.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
    await advance(6000 + ANIMATION);
    expect(dismissed()).toBe(true);
  });
});

describe('ToastService（沒有提供文字）', () => {
  it('錯誤提示需要關閉鈕文字，沒提供時丟出明確錯誤', () => {
    TestBed.configureTestingModule({ providers: [ToastService] });
    const toast = TestBed.inject(ToastService);
    expect(() => toast.error('失敗')).toThrow(/provideToast/);
  });
});
