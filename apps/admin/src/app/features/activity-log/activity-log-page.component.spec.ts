import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { groupActivityByDay } from '@admin-template/ui';
import { ACTIVITY_DEMO_LATENCY, ACTIVITY_PAGE_SIZE, ActivityLogPageComponent } from './activity-log-page.component';
import { DEMO_ACTIVITY_KINDS, filterDemoActivity, makeDemoActivity } from './activity-log-demo-data';

describe('活動紀錄示範資料', () => {
  it('固定種子：同一個「現在」每次一樣；id 不重複；新到舊', () => {
    const now = new Date(2026, 9, 14, 10, 0);
    const a = makeDemoActivity(now);
    expect(a).toHaveLength(40);
    expect(a).toEqual(makeDemoActivity(now));
    expect(new Set(a.map((e) => e.id)).size).toBe(40);
    const times = a.map((e) => new Date(e.at).getTime());
    expect([...times].sort((x, y) => y - x)).toEqual(times);
  });

  it('不論現在幾點（含剛過午夜），一定有今天與昨天兩組', () => {
    for (const now of [new Date(2026, 9, 14, 0, 1), new Date(2026, 9, 14, 12, 0), new Date(2026, 9, 14, 23, 59)]) {
      const kinds = groupActivityByDay(makeDemoActivity(now), now).map((g) => g.kind);
      expect(kinds.slice(0, 2)).toEqual(['today', 'yesterday']);
    }
  });

  it('涵蓋系統紀錄、留言、超過 3 筆的變更；每個 kind 都在對照表裡', () => {
    const all = makeDemoActivity(new Date(2026, 9, 14, 10, 0));
    expect(all.some((e) => e.actor === null)).toBe(true);
    expect(all.some((e) => !!e.body)).toBe(true);
    expect(all.some((e) => (e.changes?.length ?? 0) > 3)).toBe(true);
    expect(all.every((e) => e.kind in DEMO_ACTIVITY_KINDS)).toBe(true);
    expect(filterDemoActivity(all, 'comments').every((e) => e.kind === 'comment')).toBe(true);
    expect(filterDemoActivity(all, 'system').every((e) => e.actor === null)).toBe(true);
  });
});

describe('ActivityLogPageComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('先顯示第一頁，載入更多延遲後再多一頁', async () => {
    const fixture = TestBed.createComponent(ActivityLogPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const timeline = el.querySelector('[data-demo="timeline"]') as HTMLElement;
    expect(timeline.querySelectorAll('li.tl-item')).toHaveLength(ACTIVITY_PAGE_SIZE);
    expect(timeline.querySelectorAll('[role="heading"]')[0].textContent?.trim()).toBe('今天');

    (timeline.querySelector('.tl-more button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect((timeline.querySelector('.tl-more button') as HTMLButtonElement).disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(ACTIVITY_DEMO_LATENCY);
    fixture.detectChanges();
    expect(timeline.querySelectorAll('li.tl-item')).toHaveLength(ACTIVITY_PAGE_SIZE * 2);
    fixture.destroy();
  });

  it('空狀態兩種：沒有紀錄、篩選後沒有', () => {
    const fixture = TestBed.createComponent(ActivityLogPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-demo="empty"] lib-empty-state')?.textContent).toContain('還沒有活動紀錄');
    expect(el.querySelector('[data-demo="empty-filtered"] lib-empty-state')?.textContent).toContain('沒有符合篩選條件的紀錄');
    fixture.destroy();
  });
});
