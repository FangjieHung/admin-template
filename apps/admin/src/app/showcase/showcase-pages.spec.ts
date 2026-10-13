import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SHOWCASE_ENTRIES } from './showcase-registry';
import { PLANNED_ITEMS, SHOWCASE_DETAILS, detailOf } from './showcase-catalog';

describe('展示目錄', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // 測試環境沒有 localStorage 時略過
    }
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('id 不重複，每一筆都有說明與原始碼位置', () => {
    const ids = SHOWCASE_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of SHOWCASE_ENTRIES) {
      expect(detailOf(entry.id).summary.length).toBeGreaterThan(10);
      expect(detailOf(entry.id).source).toMatch(/^libs\//);
    }
    expect(Object.keys(SHOWCASE_DETAILS).sort()).toEqual([...ids].sort());
    expect(PLANNED_ITEMS.some((p) => p.kind === '頁面樣板')).toBe(true);
  });

  for (const entry of SHOWCASE_ENTRIES) {
    it(`${entry.title}（/components/${entry.id}）可以渲染，並有用途說明與示範區塊`, async () => {
      const component = await entry.load();
      const fixture = TestBed.createComponent(component);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('#showcase-summary')?.textContent).toContain(detailOf(entry.id).summary);
      expect(el.querySelectorAll('app-demo-block').length).toBeGreaterThan(0);
      expect(el.querySelectorAll('h1')).toHaveLength(0);
    });
  }
});
