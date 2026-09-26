import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AppearancePanelService, APPEARANCE_PANEL_KEY } from './appearance-panel.service';

describe('AppearancePanelService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('預設（localStorage 沒有值）為關閉', () => {
    const svc = TestBed.inject(AppearancePanelService);
    expect(svc.visible()).toBe(false);
  });

  it('setVisible(true) 同時改 signal 與 localStorage', () => {
    const svc = TestBed.inject(AppearancePanelService);
    svc.setVisible(true);
    expect(svc.visible()).toBe(true);
    expect(localStorage.getItem(APPEARANCE_PANEL_KEY)).toBe('1');
  });

  it('setVisible(false) 同時改 signal 與 localStorage', () => {
    localStorage.setItem(APPEARANCE_PANEL_KEY, '1');
    const svc = TestBed.inject(AppearancePanelService);
    expect(svc.visible()).toBe(true);

    svc.setVisible(false);
    expect(svc.visible()).toBe(false);
    expect(localStorage.getItem(APPEARANCE_PANEL_KEY)).toBe('0');
  });

  it('providedIn root：任兩處注入拿到同一顆 signal，狀態自動同步（設定頁與浮動面板共用的前提）', () => {
    const a = TestBed.inject(AppearancePanelService);
    const b = TestBed.inject(AppearancePanelService);
    a.setVisible(true);
    expect(b.visible()).toBe(true);
  });
});
