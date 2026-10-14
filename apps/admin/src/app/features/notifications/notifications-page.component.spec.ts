import { describe, it, expect, beforeEach } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NotificationCenterService } from '../../core/notifications/notification-center.service';
import { NotificationsPageComponent } from './notifications-page.component';

@Component({ template: 'ticket' })
class TicketStubComponent {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('NotificationsPageComponent（全部通知樣板）', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  const settle = async (ms = 0) => {
    harness.detectChanges();
    await sleep(ms);
    harness.detectChanges();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'templates/notifications', component: NotificationsPageComponent },
          { path: 'templates/tickets/:id', component: TicketStubComponent },
        ]),
      ],
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/templates/notifications', NotificationsPageComponent);
    el = harness.routeNativeElement as HTMLElement;
    (await TestBed.inject(NotificationCenterService).load()).setAutoPush(false);
    await settle(450);
  });

  it('與鈴鐺共用資料來源：類別篩選、分組標題是 h2 層級，標為已讀時鈴鐺的未讀數跟著變', async () => {
    const center = TestBed.inject(NotificationCenterService);
    expect(el.querySelectorAll('[data-category]')).toHaveLength(4);
    expect(el.querySelector('.nl-group__heading')?.getAttribute('aria-level')).toBe('2');
    const items = el.querySelectorAll('li.lib-notification-item');
    expect(items).toHaveLength(8);
    const before = center.unread();
    const unread = el.querySelector<HTMLElement>('li.is-unread')!;
    unread.querySelector<HTMLButtonElement>('.ni-tool')!.click();
    await settle(450);
    expect(center.unread()).toBe(before - 1);
  });

  it('點有連結的通知：導覽到它的頁面', async () => {
    el.querySelector<HTMLButtonElement>('li[data-notification-id="n-01"] .ni-main')!.click();
    await settle(20);
    expect(TestBed.inject(Router).url).toBe('/templates/tickets/TK-2048');
  });
});
