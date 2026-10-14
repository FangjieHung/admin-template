import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NotificationCenterService } from '../../core/notifications/notification-center.service';
import { NotificationCenterPageComponent } from './notification-center-page.component';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('NotificationCenterPageComponent（通知中心展示頁）', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  const demo = (id: string) => el.querySelector<HTMLElement>(`[data-demo="${id}"]`)!;
  const action = (id: string) => el.querySelector<HTMLElement>(`[data-demo-action="${id}"]`)!;
  const settle = async (ms = 0) => {
    harness.detectChanges();
    await sleep(ms);
    harness.detectChanges();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: NotificationCenterPageComponent }])],
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/components/notification-center', NotificationCenterPageComponent);
    el = harness.routeNativeElement as HTMLElement;
    (await TestBed.inject(NotificationCenterService).load()).setAutoPush(false);
    await settle(650);
  });

  it('四個示範：頁首鈴鐺、卡片裡的清單、沒有通知、載入失敗', () => {
    for (const id of ['bell', 'list', 'empty', 'error']) expect(demo(id)).not.toBeNull();
    expect(demo('list').querySelectorAll('li.lib-notification-item')).toHaveLength(6);
    expect(demo('list').querySelectorAll('[data-category]')).toHaveLength(4);
    expect(demo('empty').querySelector('lib-empty-state')?.textContent).toContain('沒有通知');
    expect(demo('error').querySelector('lib-error-state')?.textContent).toContain('通知載入失敗');
  });

  it('「送達一則新通知到這張卡片」：新通知出現在卡片清單最上面', async () => {
    action('push-card').click();
    await settle(20);
    const first = demo('list').querySelector('li.lib-notification-item');
    expect(first?.classList).toContain('is-unread');
    expect(first?.textContent).toContain('陳怡君在 TK-2048 提到你');
  });

  it('「現在送達一則新通知」：頁首鈴鐺的未讀數加一；可以關掉定時推播', async () => {
    const center = TestBed.inject(NotificationCenterService);
    const before = center.unread();
    action('push-bell').click();
    await settle(20);
    expect(center.unread()).toBe(before + 1);
    expect(demo('bell').querySelector('[data-demo-state="unread"]')?.textContent).toBe(String(before + 1));
    const toggle = action('auto-push') as HTMLInputElement;
    expect(toggle.checked).toBe(false);
  });

  it('載入失敗：按重試後列出通知；「再失敗一次」又回到錯誤', async () => {
    demo('error').querySelector<HTMLButtonElement>('lib-error-state button')!.click();
    await settle(450);
    expect(demo('error').querySelectorAll('li.lib-notification-item')).toHaveLength(3);
    action('fail-again').click();
    await settle(450);
    expect(demo('error').querySelector('lib-error-state')).not.toBeNull();
  });
});
