import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnvironmentInjector } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OverlayContainer } from '@angular/cdk/overlay';
import { HeaderComponent } from '../header/header.component';
import { NotificationCenterService } from '../../core/notifications/notification-center.service';
import { setNotificationPanel } from './notification-panel-host';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('通知面板（鈴鐺打開的 overlay）', () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let center: NotificationCenterService;
  let bell: HTMLButtonElement;
  let overlay: HTMLElement;

  async function settle(ms = 0): Promise<void> {
    fixture.detectChanges();
    await sleep(ms);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const panel = () => overlay.querySelector<HTMLElement>('app-notification-panel');

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
    fixture = TestBed.createComponent(HeaderComponent);
    fixture.componentRef.setInput('defaultTitle', { title: '首頁', breadcrumbs: [] });
    fixture.autoDetectChanges();
    center = TestBed.inject(NotificationCenterService);
    (await center.load()).setAutoPush(false);
    bell = fixture.nativeElement.querySelector('.topbar-bell');
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
    await settle();
  });

  afterEach(() => {
    overlay.innerHTML = '';
  });

  it('打開：面板出現在 overlay（role=dialog、有標題），焦點移進面板；鈴鐺 aria-expanded', async () => {
    setNotificationPanel(true, TestBed.inject(EnvironmentInjector));
    await settle(20);
    expect(center.panelOpen()).toBe(true);
    expect(panel()?.getAttribute('role')).toBe('dialog');
    expect(panel()?.id).toBe('app-notification-panel');
    expect(panel()?.querySelector('h2')?.textContent).toContain('通知');
    expect(document.activeElement).toBe(panel());
    expect(bell.getAttribute('aria-expanded')).toBe('true');
    expect(bell.getAttribute('aria-controls')).toBe('app-notification-panel');
    // 資料來源載入後列出示範通知（示範延遲 350ms）。
    await settle(450);
    expect(panel()?.querySelectorAll('li.lib-notification-item').length).toBeGreaterThan(3);
    expect(panel()?.querySelector('a.np-view-all')?.getAttribute('href')).toBe('/templates/notifications');
  });

  it('Esc 關閉，焦點回到鈴鐺', async () => {
    setNotificationPanel(true, TestBed.inject(EnvironmentInjector));
    await settle(20);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    await settle();
    expect(center.panelOpen()).toBe(false);
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(bell);
  });

  it('關閉鈕關閉面板；再打開沿用同一個 overlay', async () => {
    const injector = TestBed.inject(EnvironmentInjector);
    setNotificationPanel(true, injector);
    await settle(20);
    panel()!.querySelector<HTMLButtonElement>('.np-close')!.click();
    await settle();
    expect(center.panelOpen()).toBe(false);
    expect(document.activeElement).toBe(bell);
    setNotificationPanel(true, injector);
    await settle(20);
    expect(overlay.querySelectorAll('app-notification-panel')).toHaveLength(1);
  });

  it('鈴鐺按鈕經過服務切換（第一次才載入面板）', async () => {
    bell.click();
    await settle(50);
    expect(center.panelOpen()).toBe(true);
    expect(panel()).not.toBeNull();
    bell.click();
    await settle(50);
    expect(center.panelOpen()).toBe(false);
    expect(panel()).toBeNull();
  });
});
