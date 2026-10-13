import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DataTableDemoPageComponent } from './data-table-demo-page.component';
import { makeDemoItems } from './demo-items';

describe('DataTableDemoPageComponent（示範頁）', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // 測試環境沒有 localStorage 時略過
    }
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('假資料固定可重現：312 筆、單號連號', () => {
    const a = makeDemoItems(312, new Date(2026, 9, 13));
    const b = makeDemoItems(312, new Date(2026, 9, 13));
    expect(a).toEqual(b);
    expect(a).toHaveLength(312);
    expect(a[311].code).toBe('W-0312');
  });

  it('預設檢視：每頁 25 筆、分頁文字；頁首的狀態快速篩選寫進同一份條件', async () => {
    const fixture = TestBed.createComponent(DataTableDemoPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('tbody tr')).toHaveLength(25);
    expect(el.querySelector('.dt-pager__range')?.textContent).toContain('第 1–25 筆，共 312 筆');

    const page = fixture.componentInstance;
    page.setQuickStatus('done');
    fixture.detectChanges();
    expect(page.view.filters()).toEqual([{ field: 'status', type: 'multiSelect', values: ['done'] }]);
    expect(page.quickStatus()).toBe('done');
    expect(page.filteredItems().every((r) => r.status === 'done')).toBe(true);
    expect(el.querySelector('.fc-text')?.textContent).toContain('狀態：已完成');
    expect(page.view.modified()).toBe(true);
    page.setQuickStatus(null);
    expect(page.view.filters()).toEqual([]);
  });
});
