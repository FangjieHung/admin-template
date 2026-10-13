import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OverlayContainer } from '@angular/cdk/overlay';
import { ToastPageComponent } from './toast-page.component';

describe('ToastPageComponent（提示訊息展示頁）', () => {
  let overlay: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
  });

  afterEach(() => {
    overlay.innerHTML = '';
  });

  async function settle(fixture: { detectChanges(): void }, ms = 300): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
    TestBed.tick();
    fixture.detectChanges();
  }

  it('4 種類型的按鈕各開一則對應類型的提示，錯誤有關閉鈕', async () => {
    const fixture = TestBed.createComponent(ToastPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    for (const type of ['success', 'info', 'warning', 'error']) {
      (el.querySelector(`[data-toast="${type}"]`) as HTMLButtonElement).click();
      await settle(fixture);
      expect(overlay.querySelectorAll('lib-toast')).toHaveLength(1);
      expect(overlay.querySelector('lib-toast')?.getAttribute('data-type')).toBe(type);
      expect(!!overlay.querySelector('.lib-toast__close')).toBe(type === 'error');
    }
  });

  it('刪除後按「復原」把專案放回原位', async () => {
    const fixture = TestBed.createComponent(ToastPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const names = () => Array.from(el.querySelectorAll('.demo-list .demo-list__title')).map((n) => n.textContent?.trim());
    const before = names();
    (el.querySelector('.remove-btn') as HTMLButtonElement).click();
    await settle(fixture);
    expect(names()).toEqual(before.slice(1));
    expect(overlay.textContent).toContain(`已刪除「${before[0]}」`);
    (overlay.querySelector('.lib-toast__action') as HTMLButtonElement).click();
    await settle(fixture, 400);
    expect(names()).toEqual(before);
    expect(el.querySelector('.result')?.textContent).toContain(`已復原「${before[0]}」`);
  });
});
