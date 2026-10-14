import { CalendarLabels, formatCalendarLabel } from './calendar-labels';
import { CalendarEvent, CalendarRange, CalendarResourceScale, CalendarView } from './calendar.types';
import { addDays, isSameDay, minutesOfDay } from './calendar-date';
import { CalendarSegment, effectiveEnd, spanDays } from './calendar-layout';

/**
 * 日期與時間的文字。全部由 CalendarLabels 的樣板組成（數字由這裡填），不依賴瀏覽器的語系資料：
 * 同一份文字在每台電腦、每個測試環境都長得一樣，換語言只要換文字。
 */
export class CalendarFormatter {
  constructor(
    readonly labels: CalendarLabels,
    readonly hour12 = false,
  ) {}

  /** 10:05、下午 2:30（hour12）。午夜的結束時間寫 24:00。 */
  time(date: Date, isEnd = false): string {
    let minutes = minutesOfDay(date);
    if (isEnd && minutes === 0) minutes = 24 * 60;
    const h = Math.floor(minutes / 60);
    const mm = String(minutes % 60).padStart(2, '0');
    if (!this.hour12) return `${h}:${mm}`;
    const period = h < 12 || h === 24 ? this.labels.am : this.labels.pm;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${period} ${h12}:${mm}`;
  }

  /** 只有整點的刻度（時間軸、時間格的左欄）：9:00、上午 9 點的寫法一樣用 time()。 */
  hourLabel(hour: number): string {
    return this.time(new Date(2000, 0, 1, hour % 24, 0));
  }

  weekday(date: Date): string {
    return this.labels.weekdays[date.getDay()];
  }

  weekdayShort(date: Date): string {
    return this.labels.weekdaysShort[date.getDay()];
  }

  dateLong(date: Date): string {
    return formatCalendarLabel(this.labels.dateLong, {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      weekday: this.weekday(date),
    });
  }

  dateShort(date: Date, withYear = false): string {
    return formatCalendarLabel(withYear ? this.labels.dateShortYear : this.labels.dateShort, {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    });
  }

  monthTitle(date: Date): string {
    return formatCalendarLabel(this.labels.titleMonth, { year: date.getFullYear(), month: date.getMonth() + 1 });
  }

  /** 期間標題：月「2026 年 10 月」、日「2026 年 10 月 15 日 星期四」、其他「10/12 – 10/18」（跨年才加年份）。 */
  periodTitle(view: CalendarView, anchor: Date, range: CalendarRange, scale: CalendarResourceScale): string {
    if (view === 'month' || (view === 'resource' && scale === 'month')) return this.monthTitle(anchor);
    if (view === 'day' || (view === 'resource' && scale === 'day')) {
      return formatCalendarLabel(this.labels.titleDay, {
        year: anchor.getFullYear(),
        month: anchor.getMonth() + 1,
        day: anchor.getDate(),
        weekday: this.weekday(anchor),
      });
    }
    const last = addDays(range.end, -1);
    const crossYear = range.start.getFullYear() !== last.getFullYear();
    return formatCalendarLabel(this.labels.titleRange, {
      start: this.dateShort(range.start, crossYear),
      end: this.dateShort(last, crossYear),
    });
  }

  /** 時間範圍：「10:00 到 11:00」；整天的活動「整天」；跨日加上日期。 */
  when(event: CalendarEvent): string {
    const end = effectiveEnd(event);
    if (event.allDay) {
      const days = spanDays(event);
      if (days <= 1) return `${this.dateLong(event.start)} ${this.labels.allDay}`;
      return formatCalendarLabel(this.labels.timeRange, {
        start: this.dateLong(event.start),
        end: this.dateLong(addDays(end, -1)),
      });
    }
    if (isSameDay(event.start, end) || (minutesOfDay(end) === 0 && spanDays(event) === 1)) {
      return `${this.dateLong(event.start)} ${formatCalendarLabel(this.labels.timeRange, {
        start: this.time(event.start),
        end: this.time(end, true),
      })}`;
    }
    return formatCalendarLabel(this.labels.timeRange, {
      start: `${this.dateLong(event.start)} ${this.time(event.start)}`,
      end: `${this.dateLong(end)} ${this.time(end, true)}`,
    });
  }

  /** 活動上顯示的短時間：「10:00 – 11:00」（不含日期）；整天回空字串。 */
  shortTime(segment: Pick<CalendarSegment, 'start' | 'end' | 'event' | 'continuesBefore' | 'continuesAfter'>): string {
    if (segment.event.allDay) return '';
    if (segment.continuesBefore && segment.continuesAfter) return this.labels.allDay;
    return `${this.time(segment.start)} – ${this.time(segment.end, true)}`;
  }

  /**
   * 活動的無障礙名稱：「團隊週會，10 月 15 日 星期四 10:00 到 11:00，會議室 A，會議，已確認，時間衝突」。
   * 跨日活動的某一段加上「第 2 天，共 3 天」。
   */
  accessibleName(
    event: CalendarEvent,
    extras: { resource?: string | null; category?: string | null; conflict?: boolean; segment?: CalendarSegment | null },
  ): string {
    const parts = [event.title, this.when(event)];
    if (extras.segment && extras.segment.dayCount > 1) {
      parts.push(formatCalendarLabel(this.labels.multiDay, { day: extras.segment.dayIndex, count: extras.segment.dayCount }));
    }
    if (extras.resource) parts.push(extras.resource);
    if (extras.category) parts.push(extras.category);
    if (event.status) parts.push(event.status);
    if (extras.conflict) parts.push(this.labels.conflict);
    return parts.join('，');
  }
}
