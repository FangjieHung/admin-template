import { describe, it, expect, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { CalendarPageComponent } from './calendar-page.component';
import { makeDemoCalendarEvents, makeDemoRoomBookings, makeLockedWeek } from './calendar-demo-data';

describe('CalendarPageComponent（日曆與排程展示頁）', () => {
  afterEach(() => {
    TestBed.inject(OverlayContainer).getContainerElement().innerHTML = '';
    document.body.querySelectorAll('app-calendar-page').forEach((n) => n.remove());
  });

  async function setup() {
    const fixture = TestBed.createComponent(CalendarPageComponent);
    fixture.componentInstance.delayMs = 0;
    const el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    const settle = async () => {
      for (let i = 0; i < 6; i++) {
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise((r) => setTimeout(r, 0));
      }
      fixture.detectChanges();
    };
    await settle();
    return { fixture, el, settle };
  }

  it('四個示範：月曆（資料來源）、會議室排程、儲存失敗、唯讀迷你月曆', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('app-demo-block')).toHaveLength(4);
    expect(el.querySelectorAll('lib-calendar')).toHaveLength(4);
    expect(el.querySelector('[data-demo="main"] [role="grid"]')).not.toBeNull();
    expect(el.querySelector('[data-demo="main"] .cal-ev')).not.toBeNull();
    expect(el.querySelector('[data-demo="main"] [data-range]')?.textContent?.trim()).toMatch(/^\d{4}\/\d+\/\d+ – /);
    expect(el.querySelectorAll('[data-demo="resource"] [data-resource-row]')).toHaveLength(5);
    // 會議室 B 的兩場重疊
    expect(el.querySelectorAll('[data-demo="resource"] .cal-ev.is-conflict')).toHaveLength(2);
    expect(el.querySelector('[data-demo="mini"] .cal-day__dot')).not.toBeNull();
    expect(el.querySelector('[data-demo="mini"] .cal-ev')).toBeNull();
  });

  it('點活動打開右側詳情', async () => {
    const { el, settle } = await setup();
    el.querySelector<HTMLButtonElement>('[data-demo="main"] .cal-ev')!.click();
    await settle();
    expect(el.querySelector('[data-demo="main"] .cal-panel lib-responsive-panel')).not.toBeNull();
  });

  it('儲存失敗：移進鎖定的時段被拒，活動回到原位，錯誤提示寫出原因', async () => {
    const { el, settle } = await setup();
    const brief = () => el.querySelector<HTMLButtonElement>('[data-demo="failing"] button[data-event-id="lk-brief"]:not(.is-ghost)')!;
    const before = brief().closest('.tg__col')!.getAttribute('data-date');
    brief().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
    await settle();
    brief().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
    await settle();
    await settle();
    expect(brief().closest('.tg__col')!.getAttribute('data-date')).not.toBe(before);
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    expect(overlay.textContent).toContain('這個時段已鎖定（系統維護）');
    // 第一次（移到星期四）成功、第二次（星期五下午）失敗後回到星期四
    const days = [...el.querySelectorAll('[data-demo="failing"] .tg__col')].map((c) => c.getAttribute('data-date'));
    expect(brief().closest('.tg__col')!.getAttribute('data-date')).toBe(days[3]);
  });

  it('示範資料固定：同一天產生的內容都一樣，會議室 B 有衝突、星期五下午鎖定', () => {
    const today = new Date(2026, 9, 14);
    expect(makeDemoCalendarEvents(today)).toEqual(makeDemoCalendarEvents(today));
    const rooms = makeDemoRoomBookings(today).filter((e) => e.resourceId === 'room-b');
    expect(rooms).toHaveLength(2);
    const lock = makeLockedWeek(today).find((e) => e.editable === false)!;
    expect([lock.start.getDay(), lock.start.getHours()]).toEqual([5, 13]);
  });
});
