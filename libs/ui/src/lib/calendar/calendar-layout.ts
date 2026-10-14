import { CalendarEvent, CalendarRange } from './calendar.types';
import { addDays, daysFrom, diffCalendarDays, overlaps, startOfDay } from './calendar-date';

/**
 * 日曆的排版運算（純函式，不碰 DOM）：週／日檢視的並排、資源排程的疊列、月檢視的「+N 筆」、議程分組、衝突。
 */

/** 活動實際的結束時間：end 不晚於 start 時，整天的活動算一天、有時間的活動算 `minMinutes` 分鐘。 */
export function effectiveEnd(event: Pick<CalendarEvent, 'start' | 'end' | 'allDay'>, minMinutes = 30): Date {
  if (event.end.getTime() > event.start.getTime()) return event.end;
  return event.allDay ? addDays(startOfDay(event.start), 1) : new Date(event.start.getTime() + minMinutes * 60_000);
}

/** 活動在某一天的片段（跨日的活動每天一段）。 */
export interface CalendarSegment {
  event: CalendarEvent;
  /** 這一段的開始與結束（裁在當天內）。 */
  start: Date;
  end: Date;
  /** 前一天就開始了／隔天還沒結束。 */
  continuesBefore: boolean;
  continuesAfter: boolean;
  /** 第幾天（從 1 起算）與總天數；單日活動是 1／1。 */
  dayIndex: number;
  dayCount: number;
}

/** 活動跨了幾個日曆天（結束在 00:00 的那天不算）。 */
export function spanDays(event: CalendarEvent): number {
  const end = effectiveEnd(event);
  const lastMoment = new Date(end.getTime() - 1);
  return Math.max(1, diffCalendarDays(event.start, lastMoment) + 1);
}

/** 活動在 `day` 這一天的片段；當天沒有就回 null。 */
export function segmentOn(event: CalendarEvent, day: Date): CalendarSegment | null {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const end = effectiveEnd(event);
  if (!overlaps(event.start, end, dayStart, dayEnd)) return null;
  const start = event.start.getTime() > dayStart.getTime() ? event.start : dayStart;
  const segEnd = end.getTime() < dayEnd.getTime() ? end : dayEnd;
  return {
    event,
    start,
    end: segEnd,
    continuesBefore: event.start.getTime() < dayStart.getTime(),
    continuesAfter: end.getTime() > dayEnd.getTime(),
    dayIndex: diffCalendarDays(event.start, dayStart) + 1,
    dayCount: spanDays(event),
  };
}

/** 排序：整天與跨日的在前，再依開始時間、長的在前、標題。 */
export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  const aLong = a.allDay || spanDays(a) > 1 ? 0 : 1;
  const bLong = b.allDay || spanDays(b) > 1 ? 0 : 1;
  return (
    aLong - bLong ||
    a.start.getTime() - b.start.getTime() ||
    effectiveEnd(b).getTime() - effectiveEnd(a).getTime() ||
    a.title.localeCompare(b.title) ||
    a.id.localeCompare(b.id)
  );
}

/** 和 `range` 有交集的活動（依 compareEvents 排序）。 */
export function eventsInRange(events: readonly CalendarEvent[], range: CalendarRange): CalendarEvent[] {
  return events.filter((e) => overlaps(e.start, effectiveEnd(e), range.start, range.end)).sort(compareEvents);
}

// ---- 週／日檢視：同一天重疊的活動並排 ----

export interface PackedColumn {
  /** 第幾欄（0 起算）。 */
  column: number;
  /** 這一群重疊的活動共分幾欄。 */
  columns: number;
  /** 往右延伸幾欄（右邊沒有跟它重疊的活動時可以佔滿，至少 1）。 */
  span: number;
}

interface Interval {
  id: string;
  start: number;
  end: number;
}

/**
 * 並排：先把「互相有重疊（可遞移）」的活動分成一群，每群內依開始時間放進第一個空的欄；
 * 群內的欄數就是寬度的分母，右邊相鄰的欄在它的時段內都沒人時往右延伸。
 */
export function packColumns(items: readonly { id: string; start: Date; end: Date }[]): Map<string, PackedColumn> {
  const sorted: Interval[] = items
    .map((i) => ({ id: i.id, start: i.start.getTime(), end: Math.max(i.end.getTime(), i.start.getTime() + 1) }))
    .sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id));
  const result = new Map<string, PackedColumn>();
  let cluster: Interval[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (!cluster.length) return;
    const columnEnds: number[] = [];
    const placed: { item: Interval; column: number }[] = [];
    for (const item of cluster) {
      let column = columnEnds.findIndex((end) => end <= item.start);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(item.end);
      } else {
        columnEnds[column] = item.end;
      }
      placed.push({ item, column });
    }
    const columns = columnEnds.length;
    for (const { item, column } of placed) {
      let span = 1;
      for (let next = column + 1; next < columns; next++) {
        const blocked = placed.some((p) => p.column === next && p.item.start < item.end && item.start < p.item.end);
        if (blocked) break;
        span++;
      }
      result.set(item.id, { column, columns, span });
    }
    cluster = [];
  };

  for (const item of sorted) {
    if (item.start >= clusterEnd) {
      flush();
      clusterEnd = item.end;
    } else {
      clusterEnd = Math.max(clusterEnd, item.end);
    }
    cluster.push(item);
  }
  flush();
  return result;
}

// ---- 資源排程：同一列重疊的活動疊成好幾條 ----

/** 第一個放得下的條（first-fit）：依開始時間排，放進最後一筆已結束的那條，都沒有就開新的一條。 */
export function packLanes(items: readonly { id: string; start: Date; end: Date }[]): { lanes: Map<string, number>; count: number } {
  const sorted = [...items].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime() || a.id.localeCompare(b.id),
  );
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();
  for (const item of sorted) {
    let lane = laneEnds.findIndex((end) => end <= item.start.getTime());
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end.getTime());
    } else {
      laneEnds[lane] = item.end.getTime();
    }
    lanes.set(item.id, lane);
  }
  return { lanes, count: Math.max(1, laneEnds.length) };
}

// ---- 月檢視：每天最多 N 筆，其餘收成「+N 筆」 ----

export interface MonthDayBucket {
  date: Date;
  /** 顯示的片段。 */
  visible: CalendarSegment[];
  /** 收起來的筆數（「+N 筆」）。 */
  hidden: number;
  /** 這一天全部的片段（浮動清單用）。 */
  all: CalendarSegment[];
}

/**
 * 每天的片段依 compareEvents 排序；超過 `max` 筆時只顯示 `max − 1` 筆，留一列給「+N 筆」，格子高度固定。
 * `max` 是 0 時全部收起來（迷你月曆只畫圓點）。
 */
export function bucketMonth(days: readonly Date[], events: readonly CalendarEvent[], max: number): MonthDayBucket[] {
  const sorted = [...events].sort(compareEvents);
  return days.map((date) => {
    const all = sorted.map((e) => segmentOn(e, date)).filter((s): s is CalendarSegment => s !== null);
    if (all.length <= max) return { date, visible: all, hidden: 0, all };
    const shown = Math.max(0, max - 1);
    return { date, visible: all.slice(0, shown), hidden: all.length - shown, all };
  });
}

// ---- 議程：依日期分組，跳過沒有活動的日子 ----

export interface AgendaDay {
  date: Date;
  segments: CalendarSegment[];
}

export function groupAgenda(events: readonly CalendarEvent[], range: CalendarRange): AgendaDay[] {
  const count = Math.max(0, diffCalendarDays(range.start, range.end));
  const inRange = eventsInRange(events, range);
  return daysFrom(range.start, count)
    .map((date) => ({
      date,
      segments: inRange.map((e) => segmentOn(e, date)).filter((s): s is CalendarSegment => s !== null),
    }))
    .filter((d) => d.segments.length > 0);
}

// ---- 衝突：同一個資源時間重疊 ----

/** 同一個資源（resourceId 相同、不是空的）時間重疊的活動 id。`allowOverlap` 時回傳空集合。 */
export function findConflicts(events: readonly CalendarEvent[], allowOverlap: boolean): Set<string> {
  const conflicts = new Set<string>();
  if (allowOverlap) return conflicts;
  const byResource = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    if (!event.resourceId) continue;
    const list = byResource.get(event.resourceId) ?? [];
    list.push(event);
    byResource.set(event.resourceId, list);
  }
  for (const list of byResource.values()) {
    const sorted = [...list].sort((a, b) => a.start.getTime() - b.start.getTime());
    // 掃描線：記住目前為止結束得最晚的活動，下一筆在它結束前開始就是衝突。
    let latest: CalendarEvent | null = null;
    for (const event of sorted) {
      if (latest && event.start.getTime() < effectiveEnd(latest).getTime()) {
        conflicts.add(event.id);
        conflicts.add(latest.id);
      }
      if (!latest || effectiveEnd(event).getTime() > effectiveEnd(latest).getTime()) latest = event;
    }
  }
  return conflicts;
}

/** 放到新的時間與資源後，會跟哪些活動衝突（拖曳時的預覽）。 */
export function conflictsWith(
  candidate: CalendarEvent,
  events: readonly CalendarEvent[],
): CalendarEvent[] {
  if (!candidate.resourceId) return [];
  const end = effectiveEnd(candidate);
  return events.filter(
    (e) => e.id !== candidate.id && e.resourceId === candidate.resourceId && overlaps(candidate.start, end, e.start, effectiveEnd(e)),
  );
}
