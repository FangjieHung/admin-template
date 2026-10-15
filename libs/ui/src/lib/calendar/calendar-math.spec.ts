import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  addDays,
  addMinutes,
  addMonths,
  dayKey,
  diffCalendarDays,
  isoWeek,
  monthGrid,
  shiftAnchor,
  startOfWeek,
  visibleRange,
} from './calendar-date';
import {
  bucketMonth,
  conflictsWith,
  findConflicts,
  groupAgenda,
  packColumns,
  packLanes,
  segmentOn,
  spanDays,
} from './calendar-layout';
import {
  clampToHours,
  extendEvent,
  isTouchDragActive,
  moveEvent,
  sameSchedule,
  snapTo,
  trackPointerDrag,
} from './calendar-drag';
import { CalendarFormatter } from './calendar-format';
import { assertCalendarLabels } from './calendar-labels';
import { CalendarEvent } from './calendar.types';
import { CALENDAR_TEST_LABELS } from './calendar-testing';

const d = (y: number, m: number, day: number, h = 0, min = 0) => new Date(y, m - 1, day, h, min);
const ev = (id: string, start: Date, end: Date, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({ id, title: id, start, end, ...extra });
const opts = { weekStartsOn: 1 as const, weekDays: 7, agendaDays: 14, resourceScale: 'week' as const };

describe('calendar-date（日期運算）', () => {
  const originalTz = process.env['TZ'];
  afterEach(() => {
    // 指定 undefined 會變成字串 "undefined"（＝UTC），要刪掉才會回到原本的時區。
    if (originalTz === undefined) delete process.env['TZ'];
    else process.env['TZ'] = originalTz;
  });

  it('跨月、跨年加天數，保留鐘點', () => {
    expect(dayKey(addDays(d(2026, 10, 31, 10, 30), 1))).toBe('2026-11-01');
    expect(addDays(d(2026, 10, 31, 10, 30), 1).getHours()).toBe(10);
    expect(dayKey(addDays(d(2026, 12, 31), 1))).toBe('2027-01-01');
    expect(dayKey(addDays(d(2026, 3, 1), -1))).toBe('2026-02-28');
  });

  it('加月份時日子超過月底取月底', () => {
    expect(dayKey(addMonths(d(2026, 1, 31), 1))).toBe('2026-02-28');
    expect(dayKey(addMonths(d(2028, 1, 31), 1))).toBe('2028-02-29');
    expect(dayKey(addMonths(d(2026, 12, 15), 1))).toBe('2027-01-15');
  });

  it('一週從星期一（預設）或星期日開始', () => {
    // 2026/10/14 是星期三
    expect(dayKey(startOfWeek(d(2026, 10, 14)))).toBe('2026-10-12');
    expect(dayKey(startOfWeek(d(2026, 10, 14), 0))).toBe('2026-10-11');
    expect(dayKey(startOfWeek(d(2026, 10, 12)))).toBe('2026-10-12');
    expect(dayKey(startOfWeek(d(2026, 10, 18)))).toBe('2026-10-12');
  });

  it('月曆格是完整的週，跨月份的頭尾補上前後月', () => {
    const weeks = monthGrid(d(2026, 10, 14));
    expect(weeks).toHaveLength(5);
    expect(dayKey(weeks[0][0])).toBe('2026-09-28');
    expect(dayKey(weeks[4][6])).toBe('2026-11-01');
    // 2027/2/1 是星期一、2 月有 28 天：剛好 4 週
    expect(monthGrid(d(2027, 2, 1))).toHaveLength(4);
  });

  it('各檢視的範圍與往前往後', () => {
    expect(visibleRange('week', d(2026, 10, 14), opts).start.getDate()).toBe(12);
    expect(dayKey(visibleRange('week', d(2026, 10, 14), opts).end)).toBe('2026-10-19');
    expect(dayKey(visibleRange('week', d(2026, 10, 14), { ...opts, weekDays: 3 }).end)).toBe('2026-10-17');
    expect(dayKey(visibleRange('resource', d(2026, 10, 14), { ...opts, resourceScale: 'month' }).end)).toBe('2026-11-01');
    expect(dayKey(shiftAnchor('month', d(2026, 1, 31), 1, opts))).toBe('2026-02-01');
    expect(dayKey(shiftAnchor('week', d(2026, 12, 30), 1, opts))).toBe('2027-01-06');
    expect(dayKey(shiftAnchor('week', d(2026, 10, 14), -1, { ...opts, weekDays: 3 }))).toBe('2026-10-11');
  });

  it('ISO 週次', () => {
    expect(isoWeek(d(2026, 1, 1))).toBe(1);
    expect(isoWeek(d(2026, 10, 14))).toBe(42);
    expect(isoWeek(d(2027, 1, 1))).toBe(53);
  });

  it('日光節約時間：隔天仍是同一個鐘點，日數差不會少一天（America/New_York，3/8 只有 23 小時）', () => {
    process.env['TZ'] = 'America/New_York';
    expect(new Date(2026, 6, 1, 12).getTimezoneOffset()).toBe(240);
    // 測試環境不支援執行中換時區時（offset 沒變），只檢查一般情況。
    const hasDst = new Date(2026, 2, 7, 12).getTimezoneOffset() !== new Date(2026, 2, 9, 12).getTimezoneOffset();
    const before = new Date(2026, 2, 7, 10, 0);
    const after = addDays(before, 2);
    expect(after.getHours()).toBe(10);
    expect(after.getDate()).toBe(9);
    expect(after.getTime() - before.getTime()).toBe((hasDst ? 47 : 48) * 3_600_000);
    expect(diffCalendarDays(new Date(2026, 2, 8), new Date(2026, 2, 9))).toBe(1);
    expect(diffCalendarDays(new Date(2026, 2, 1), new Date(2026, 2, 15))).toBe(14);
    const moved = moveEvent(ev('a', new Date(2026, 2, 7, 9), new Date(2026, 2, 7, 10)), { days: 1, minutes: 0 });
    expect([moved.start.getHours(), moved.end.getHours(), moved.start.getDate()]).toEqual([9, 10, 8]);
    expect(addMinutes(new Date(2026, 10, 1, 0, 30), 60).getHours()).toBe(1);
  });
});

describe('calendar-layout（排版）', () => {
  it('跨日活動每天一段，記得第幾天', () => {
    const e = ev('trip', d(2026, 10, 14, 15), d(2026, 10, 16, 11));
    expect(spanDays(e)).toBe(3);
    const mid = segmentOn(e, d(2026, 10, 15))!;
    expect(mid.continuesBefore && mid.continuesAfter).toBe(true);
    expect(mid.dayIndex).toBe(2);
    expect(segmentOn(e, d(2026, 10, 17))).toBeNull();
    // 整天活動 end 是隔天 00:00，那天不算
    const allDay = ev('leave', d(2026, 10, 14), d(2026, 10, 16), { allDay: true });
    expect(spanDays(allDay)).toBe(2);
    expect(segmentOn(allDay, d(2026, 10, 16))).toBeNull();
  });

  it('重疊的活動並排：同一群的欄數相同，右邊空著可以延伸', () => {
    const packed = packColumns([
      { id: 'a', start: d(2026, 10, 14, 9), end: d(2026, 10, 14, 11) },
      { id: 'b', start: d(2026, 10, 14, 9, 30), end: d(2026, 10, 14, 10) },
      { id: 'c', start: d(2026, 10, 14, 10, 30), end: d(2026, 10, 14, 12) },
      { id: 'd', start: d(2026, 10, 14, 13), end: d(2026, 10, 14, 14) },
    ]);
    expect(packed.get('a')).toEqual({ column: 0, columns: 2, span: 1 });
    expect(packed.get('b')).toEqual({ column: 1, columns: 2, span: 1 });
    // c 接在 b 結束之後那一欄
    expect(packed.get('c')).toEqual({ column: 1, columns: 2, span: 1 });
    // d 自成一群，佔滿
    expect(packed.get('d')).toEqual({ column: 0, columns: 1, span: 1 });
  });

  it('三筆重疊：後來的活動放進最先空出來的欄', () => {
    const packed = packColumns([
      { id: 'long', start: d(2026, 10, 14, 9), end: d(2026, 10, 14, 12) },
      { id: 'mid', start: d(2026, 10, 14, 9), end: d(2026, 10, 14, 10) },
      { id: 'late', start: d(2026, 10, 14, 9, 30), end: d(2026, 10, 14, 11) },
      { id: 'tail', start: d(2026, 10, 14, 10), end: d(2026, 10, 14, 10, 30) },
    ]);
    expect(packed.get('long')!.columns).toBe(3);
    expect(packed.get('tail')).toEqual({ column: 1, columns: 3, span: 1 });
  });

  it('資源排程疊列：first-fit，首尾相接放同一條', () => {
    const { lanes, count } = packLanes([
      { id: 'a', start: d(2026, 10, 14, 9), end: d(2026, 10, 14, 10) },
      { id: 'b', start: d(2026, 10, 14, 10), end: d(2026, 10, 14, 11) },
      { id: 'c', start: d(2026, 10, 14, 9, 30), end: d(2026, 10, 14, 10, 30) },
      { id: 'e', start: d(2026, 10, 14, 9, 45), end: d(2026, 10, 14, 10, 15) },
    ]);
    expect([lanes.get('a'), lanes.get('b'), lanes.get('c'), lanes.get('e')]).toEqual([0, 0, 1, 2]);
    expect(count).toBe(3);
    expect(packLanes([]).count).toBe(1);
  });

  it('月檢視超過上限時留一列給「+N 筆」', () => {
    const day = d(2026, 10, 14);
    const events = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ev(id, d(2026, 10, 14, 9 + i), d(2026, 10, 14, 10 + i)));
    const [bucket] = bucketMonth([day], events, 3);
    expect(bucket.visible.map((s) => s.event.id)).toEqual(['a', 'b']);
    expect(bucket.hidden).toBe(3);
    expect(bucket.all).toHaveLength(5);
    const [exact] = bucketMonth([day], events.slice(0, 3), 3);
    expect(exact.hidden).toBe(0);
    // 整天的活動排最前面
    const [mixed] = bucketMonth([day], [...events.slice(0, 2), ev('z', day, d(2026, 10, 15), { allDay: true })], 3);
    expect(mixed.visible[0].event.id).toBe('z');
  });

  it('議程依日期分組，沒有活動的日子跳過，跨日活動每天都出現', () => {
    const groups = groupAgenda(
      [ev('a', d(2026, 10, 14, 9), d(2026, 10, 14, 10)), ev('trip', d(2026, 10, 16, 9), d(2026, 10, 17, 18))],
      { start: d(2026, 10, 14), end: d(2026, 10, 21) },
    );
    expect(groups.map((g) => dayKey(g.date))).toEqual(['2026-10-14', '2026-10-16', '2026-10-17']);
    expect(groups[2].segments[0].continuesBefore).toBe(true);
  });

  it('衝突：只比對同一個資源，首尾相接不算；allowOverlap 時沒有衝突', () => {
    const events = [
      ev('a', d(2026, 10, 14, 9), d(2026, 10, 14, 10), { resourceId: 'room-a' }),
      ev('b', d(2026, 10, 14, 9, 30), d(2026, 10, 14, 11), { resourceId: 'room-a' }),
      ev('c', d(2026, 10, 14, 11), d(2026, 10, 14, 12), { resourceId: 'room-a' }),
      ev('x', d(2026, 10, 14, 9), d(2026, 10, 14, 12), { resourceId: 'room-b' }),
      ev('n', d(2026, 10, 14, 9), d(2026, 10, 14, 12)),
    ];
    expect([...findConflicts(events, false)].sort()).toEqual(['a', 'b']);
    expect(findConflicts(events, true).size).toBe(0);
    const moved = { ...events[2], start: d(2026, 10, 14, 10, 30) };
    expect(conflictsWith(moved, events).map((e) => e.id)).toEqual(['b']);
  });
});

describe('calendar-drag（移動與對齊）', () => {
  const base = ev('a', d(2026, 10, 14, 10), d(2026, 10, 14, 11));

  it('對齊到最近的時段', () => {
    expect(snapTo(37, 30)).toBe(30);
    expect(snapTo(46, 30)).toBe(60);
    expect(snapTo(-14, 15)).toBe(-15);
    expect(snapTo(-7, 15)).toBe(0);
  });

  it('整筆移動保留長度；可以換資源', () => {
    const moved = moveEvent(base, { days: 2, minutes: -30, resourceId: 'room-b' });
    expect([dayKey(moved.start), moved.start.getHours(), moved.start.getMinutes()]).toEqual(['2026-10-16', 9, 30]);
    expect(moved.end.getHours()).toBe(10);
    expect(moved.resourceId).toBe('room-b');
  });

  it('拉結束或開始，最短一個時段；整天的活動最短一天', () => {
    expect(extendEvent(base, { days: 0, minutes: 60 }, 'end', 30).end.getHours()).toBe(12);
    expect(extendEvent(base, { days: 0, minutes: -120 }, 'end', 30).end.getMinutes()).toBe(30);
    expect(extendEvent(base, { days: 0, minutes: -30 }, 'start', 30).start.getMinutes()).toBe(30);
    const allDay = ev('l', d(2026, 10, 14), d(2026, 10, 15), { allDay: true });
    expect(dayKey(extendEvent(allDay, { days: -3, minutes: 0 }, 'end', 30).end)).toBe('2026-10-15');
    expect(dayKey(extendEvent(allDay, { days: 2, minutes: 0 }, 'end', 30).end)).toBe('2026-10-17');
  });

  it('時間格只畫 8–18 點時，移到範圍外會被推回來', () => {
    const late = moveEvent(base, { days: 0, minutes: 8 * 60 });
    const clamped = clampToHours(late, 8 * 60, 18 * 60);
    expect([clamped.start.getHours(), clamped.end.getHours()]).toEqual([17, 18]);
    expect(sameSchedule(clampToHours(base, 8 * 60, 18 * 60), base)).toBe(true);
  });
});

describe('trackPointerDrag（指標與觸控拖曳）', () => {
  const ptr = (type: string, x: number, y: number, pointerType = 'touch', pointerId = 7) => {
    const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperties(e, { pointerType: { value: pointerType }, pointerId: { value: pointerId } });
    return e as PointerEvent;
  };
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it('觸控：按住到時才開始拖（先畫一次預覽），拖曳中擋掉預設動作與長按選單，放開後攔掉 click', async () => {
    const move = vi.fn();
    const end = vi.fn();
    trackPointerDrag(ptr('pointerdown', 100, 100), { move, end }, { touchDelay: 30 });
    window.dispatchEvent(ptr('pointermove', 103, 102));
    expect(move).not.toHaveBeenCalled();
    expect(isTouchDragActive()).toBe(false);
    await wait(60);
    expect(isTouchDragActive()).toBe(true);
    expect(move).toHaveBeenCalledTimes(1);
    expect(move.mock.calls[0].slice(0, 2)).toEqual([3, 2]);
    const m = ptr('pointermove', 100, 160);
    window.dispatchEvent(m);
    expect(move.mock.calls[1].slice(0, 2)).toEqual([0, 60]);
    expect(m.defaultPrevented).toBe(true);
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    window.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    window.dispatchEvent(ptr('pointerup', 100, 160));
    expect(end).toHaveBeenCalledWith(true);
    expect(isTouchDragActive()).toBe(false);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    window.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
  });

  it('觸控：按住之前就滑動＝捲動，放棄這次拖曳；瀏覽器開始捲動（pointercancel）也放棄', async () => {
    const move = vi.fn();
    const end = vi.fn();
    trackPointerDrag(ptr('pointerdown', 100, 100), { move, end }, { touchDelay: 30 });
    const swipe = ptr('pointermove', 100, 130);
    window.dispatchEvent(swipe);
    expect(swipe.defaultPrevented).toBe(false);
    await wait(60);
    window.dispatchEvent(ptr('pointermove', 100, 200));
    window.dispatchEvent(ptr('pointerup', 100, 200));
    expect(move).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
    expect(isTouchDragActive()).toBe(false);

    trackPointerDrag(ptr('pointerdown', 100, 100, 'touch', 8), { move, end }, { touchDelay: 30 });
    window.dispatchEvent(ptr('pointercancel', 100, 100, 'touch', 8));
    await wait(60);
    expect(move).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
  });

  it('觸控：按住放開沒有移動＝不拖（點一下照常打開活動）', async () => {
    const move = vi.fn();
    const end = vi.fn();
    trackPointerDrag(ptr('pointerdown', 100, 100), { move, end }, { touchDelay: 30 });
    window.dispatchEvent(ptr('pointerup', 100, 100));
    await wait(60);
    expect(move).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
  });

  it('滑鼠：移動超過門檻立刻開始拖，不必按住', () => {
    const move = vi.fn();
    const end = vi.fn();
    trackPointerDrag(ptr('pointerdown', 100, 100, 'mouse', 1), { move, end });
    window.dispatchEvent(ptr('pointermove', 102, 101, 'mouse', 1));
    expect(move).not.toHaveBeenCalled();
    window.dispatchEvent(ptr('pointermove', 100, 120, 'mouse', 1));
    expect(move).toHaveBeenCalledTimes(1);
    expect(isTouchDragActive()).toBe(false);
    window.dispatchEvent(ptr('pointerup', 100, 120, 'mouse', 1));
    expect(end).toHaveBeenCalledWith(true);
  });
});

describe('CalendarFormatter 與畫面文字', () => {
  const fmt = new CalendarFormatter(CALENDAR_TEST_LABELS);

  it('期間標題、時間範圍、無障礙名稱', () => {
    expect(fmt.periodTitle('month', d(2026, 10, 14), { start: d(2026, 9, 28), end: d(2026, 11, 2) }, 'week')).toBe('2026 年 10 月');
    expect(fmt.periodTitle('week', d(2026, 10, 14), { start: d(2026, 10, 12), end: d(2026, 10, 19) }, 'week')).toBe('10/12 – 10/18');
    expect(fmt.periodTitle('week', d(2026, 12, 30), { start: d(2026, 12, 28), end: d(2027, 1, 4) }, 'week')).toBe('2026/12/28 – 2027/1/3');
    const meeting = ev('m', d(2026, 10, 15, 10), d(2026, 10, 15, 11), { title: '團隊週會', status: '已確認' });
    expect(fmt.accessibleName(meeting, { resource: '會議室 A', category: '會議' })).toBe(
      '團隊週會，10 月 15 日 星期四 10:00 到 11:00，會議室 A，會議，已確認',
    );
    expect(new CalendarFormatter(CALENDAR_TEST_LABELS, true).time(d(2026, 10, 15, 14, 5))).toBe('下午 2:05');
    expect(new CalendarFormatter(CALENDAR_TEST_LABELS, true).time(d(2026, 10, 15, 0, 0))).toBe('上午 12:00');
    expect(fmt.time(d(2026, 10, 16), true)).toBe('24:00');
  });

  it('缺少畫面文字時丟出明確的錯誤', () => {
    expect(() => assertCalendarLabels(null)).toThrow(/CALENDAR_LABELS/);
    const { today: _today, ...rest } = CALENDAR_TEST_LABELS;
    void _today;
    expect(() => assertCalendarLabels(rest)).toThrow(/「today」/);
    expect(() => assertCalendarLabels({ ...CALENDAR_TEST_LABELS, weekdays: ['一'] })).toThrow(/7 個/);
  });
});
