import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccessService, provideAccess } from '@admin-template/access';
import { DEMO_ACCESS_CONFIG } from '../../core/access/demo-access';
import { DetailLayoutPageComponent } from './detail-layout-page.component';

describe('DetailLayoutPageComponent', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // 測試環境沒有 localStorage 時略過
    }
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideAccess(DEMO_ACCESS_CONFIG)] });
  });

  function render() {
    const fixture = TestBed.createComponent(DetailLayoutPageComponent);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('示範工單：標題、狀態、摘要欄（可複製的編號）、概覽 2 欄', () => {
    const { el } = render();
    expect(el.querySelector('[libDetailTitle]')?.textContent).toContain('工單 #TK-2048 印表機無法連線');
    expect(el.querySelector('[libDetailMeta] lib-status-chip')?.textContent).toContain('處理中');
    const aside = el.querySelector('aside.dl-aside') as HTMLElement;
    expect(aside.querySelector('.dsl-copy')?.getAttribute('aria-label')).toBe('複製編號');
    expect(el.querySelector('.dl-main lib-description-list')?.getAttribute('data-columns')).toBe('2');
  });

  it('*libCan：檢視者看不到編輯、指派、關閉工單', () => {
    const { fixture, el } = render();
    const labels = () =>
      Array.from(el.querySelectorAll('[libDetailActions] button')).map((b) => b.textContent?.replace(/\s+/g, ' ').trim());
    expect(labels().some((t) => t?.includes('編輯'))).toBe(true);
    TestBed.inject(AccessService).signIn('u-viewer');
    fixture.detectChanges();
    expect(labels().some((t) => t?.includes('編輯'))).toBe(false);
    expect(labels().some((t) => t?.includes('指派'))).toBe(false);
    expect(labels().some((t) => t?.includes('列印'))).toBe(true);
  });

  it('載入中開關：頁首與摘要換成骨架', () => {
    const { fixture, el } = render();
    (el.querySelector('[data-toggle="loading"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('lib-detail-layout')?.getAttribute('aria-busy')).toBe('true');
    expect(el.querySelector('.dl-skeleton--aside')).not.toBeNull();
  });
});
