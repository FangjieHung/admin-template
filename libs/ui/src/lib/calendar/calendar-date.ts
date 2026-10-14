import { CalendarRange, CalendarResourceScale, CalendarView, CalendarWeekday } from './calendar.types';

/**
 * 日曆的日期運算。全部用年月日時分重新組 Date（`new Date(y, m, d, h, min)`），不加減毫秒：
 * 「隔天」永遠是同一個鐘點，遇到日光節約時間（一天 23 或 25 小時）也不會差一小時。不改傳入的 Date。
 */

export const MINUTES_PER_DAY = 24 * 60;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** 加幾天（當地日曆上的天，不是 24 小時），保留時分。 */
export function addDays(date: Date, days: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

/** 加幾分鐘（鐘面上的分鐘）。 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes() + minutes,
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

/** 加幾個月；日子超過那個月的天數時取月底（1/31 加一個月是 2/28 或 2/29）。 */
export function addMonths(date: Date, months: number): Date {
  const first = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(
    first.getFullYear(),
    first.getMonth(),
    Math.min(date.getDate(), lastDay),
    date.getHours(),
    date.getMinutes(),
  );
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** 這一週的第一天 00:00。 */
export function startOfWeek(date: Date, weekStartsOn: CalendarWeekday = 1): Date {
  const back = (date.getDay() - weekStartsOn + 7) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - back);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** 'YYYY-MM-DD'（當地日期），當 key 與 data-date 用。 */
export function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** 'YYYY-MM-DD' → 當地 00:00；格式不對回 null。 */
export function parseDayKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** 兩個日期之間差幾個日曆天（b − a）；用 UTC 日期比，不受一天 23／25 小時影響。 */
export function diffCalendarDays(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

/** 從當天 00:00 起算的鐘面分鐘數（10:30 → 630）。 */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** 某一天的第幾分鐘（1440 是隔天 00:00）。 */
export function atMinutes(day: Date, minutes: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);
}

/** 鐘面上的分鐘差（b − a），跨日時以日曆天補足（每天 1440）。 */
export function diffWallMinutes(a: Date, b: Date): number {
  return diffCalendarDays(a, b) * MINUTES_PER_DAY + minutesOfDay(b) - minutesOfDay(a);
}

/** [aStart, aEnd) 與 [bStart, bEnd) 有沒有重疊（首尾相接不算）。 */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/** 從 `start` 開始連續 `count` 天的 00:00。 */
export function daysFrom(start: Date, count: number): Date[] {
  const first = startOfDay(start);
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}

/** ISO 週次（星期一開始、包含 1/4 的那週是第 1 週）。 */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

/** 月曆格：包含這個月每一天的完整週（4–6 週），每週 7 天。 */
export function monthGrid(anchor: Date, weekStartsOn: CalendarWeekday = 1): Date[][] {
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first, weekStartsOn);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const total = diffCalendarDays(gridStart, last) + 1;
  const weeks = Math.ceil(total / 7);
  return Array.from({ length: weeks }, (_, w) => daysFrom(addDays(gridStart, w * 7), 7));
}

export interface CalendarRangeOptions {
  weekStartsOn: CalendarWeekday;
  /** 週檢視顯示幾天（平板寬度 3 天）；7 天時從一週的第一天開始，其他天數從 anchor 那天開始。 */
  weekDays: number;
  agendaDays: number;
  resourceScale: CalendarResourceScale;
}

/** 某個檢視下看得到的範圍（end 不含）；也是向資料來源要資料的範圍。 */
export function visibleRange(view: CalendarView, anchor: Date, options: CalendarRangeOptions): CalendarRange {
  const day = startOfDay(anchor);
  switch (view) {
    case 'month': {
      const weeks = monthGrid(anchor, options.weekStartsOn);
      return { start: weeks[0][0], end: addDays(weeks[weeks.length - 1][6], 1) };
    }
    case 'week': {
      const start = options.weekDays >= 7 ? startOfWeek(day, options.weekStartsOn) : day;
      return { start, end: addDays(start, options.weekDays) };
    }
    case 'day':
      return { start: day, end: addDays(day, 1) };
    case 'agenda':
      return { start: day, end: addDays(day, options.agendaDays) };
    case 'resource': {
      if (options.resourceScale === 'day') return { start: day, end: addDays(day, 1) };
      if (options.resourceScale === 'week') {
        const start = startOfWeek(day, options.weekStartsOn);
        return { start, end: addDays(start, 7) };
      }
      const start = startOfMonth(day);
      return { start, end: addMonths(start, 1) };
    }
  }
}

/** 往前（-1）或往後（+1）一段之後的 anchor。 */
export function shiftAnchor(view: CalendarView, anchor: Date, direction: 1 | -1, options: CalendarRangeOptions): Date {
  switch (view) {
    case 'month':
      return addMonths(startOfMonth(anchor), direction);
    case 'week':
      return addDays(startOfDay(anchor), direction * (options.weekDays >= 7 ? 7 : options.weekDays));
    case 'day':
      return addDays(startOfDay(anchor), direction);
    case 'agenda':
      return addDays(startOfDay(anchor), direction * options.agendaDays);
    case 'resource':
      if (options.resourceScale === 'day') return addDays(startOfDay(anchor), direction);
      if (options.resourceScale === 'week') return addDays(startOfDay(anchor), direction * 7);
      return addMonths(startOfMonth(anchor), direction);
  }
}
