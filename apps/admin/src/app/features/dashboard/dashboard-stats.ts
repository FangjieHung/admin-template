import type { ChartSeries, DonutSlice } from '@admin-template/ui';
import { isOverdue, parseDueDate } from '../tickets/data/ticket-format';
import {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  Ticket,
  TicketStatus,
} from '../tickets/data/ticket.model';

/**
 * 儀表板的統計（純函式）：期間、數字小卡、趨勢、分布、待辦。資料來自工單 repository 的 list() 與 resolvedTimes()；
 * 新專案接後端時，通常改成一支統計 API 直接回傳這些數字，頁面不用動。
 */

export type DashboardPeriod = '7d' | '30d' | 'quarter';

export interface PeriodOption {
  id: DashboardPeriod;
  label: string;
  /** 累計型指標（新增數、處理時間）的比較區間：「較{compare}」。 */
  compare: string;
  /** 時點型指標（未結案、逾期）跟期初比：「較{since}」。 */
  since: string;
  /** 數字小卡「新增」的標題。 */
  createdLabel: string;
}

export const DASHBOARD_PERIODS: readonly PeriodOption[] = [
  { id: '7d', label: '7 天', compare: '前 7 天', since: '一週前', createdLabel: '本週新增' },
  { id: '30d', label: '30 天', compare: '前 30 天', since: '一個月前', createdLabel: '近 30 天新增' },
  { id: 'quarter', label: '本季', compare: '上一季同期', since: '季初', createdLabel: '本季新增' },
];

export const DEFAULT_PERIOD: DashboardPeriod = '7d';

export function parsePeriod(value: string | null | undefined): DashboardPeriod {
  return DASHBOARD_PERIODS.some((p) => p.id === value) ? (value as DashboardPeriod) : DEFAULT_PERIOD;
}

/** 還沒結案的狀態（未結案、待辦、逾期都看這三種）。 */
export const OPEN_STATUSES: readonly TicketStatus[] = ['open', 'in-progress', 'waiting'];

const DAY = 86_400_000;

export interface PeriodRange {
  /** 本期：[start, end)；end 是明天 00:00。 */
  start: Date;
  end: Date;
  /** 上一期：跟本期一樣長（7／30 天緊接在前面；本季是上一季的同一段）。 */
  prevStart: Date;
  prevEnd: Date;
  /** 趨勢的分桶（7 天按日、30 天每 3 天、本季按週，最後一桶到今天為止）。 */
  buckets: { start: Date; end: Date }[];
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function periodRange(period: DashboardPeriod, today: Date): PeriodRange {
  const end = addDays(startOfDay(today), 1);
  let start: Date;
  if (period === 'quarter') start = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
  else start = addDays(end, period === '7d' ? -7 : -30);
  const days = Math.round((end.getTime() - start.getTime()) / DAY);
  // 7／30 天比緊接在前面的同樣天數；本季比上一季的同一段（10/1–10/14 比 7/1–7/14）。
  const prevStart = period === 'quarter' ? new Date(start.getFullYear(), start.getMonth() - 3, 1) : addDays(start, -days);
  const prevEnd = period === 'quarter' ? addDays(prevStart, days) : start;
  // 30 天若逐日畫，一天只有 0–2 張，線會呈鋸齒；3 天一格（剛好 10 格）才看得出起伏。7 天逐日、本季按週。
  const step = period === 'quarter' ? 7 : period === '30d' ? 3 : 1;
  const buckets: { start: Date; end: Date }[] = [];
  for (let s = start; s < end; s = addDays(s, step)) {
    const e = addDays(s, step);
    buckets.push({ start: s, end: e < end ? e : end });
  }
  return { start, end, prevStart, prevEnd, buckets };
}

function within(iso: string | undefined, from: Date, to: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t < to.getTime();
}

/** 在某個時間點還沒結案（已建立、還沒有結案時間或結案在那之後）。 */
function openAt(ticket: Ticket, resolved: ReadonlyMap<string, string>, at: Date): boolean {
  if (new Date(ticket.createdAt).getTime() >= at.getTime()) return false;
  const done = resolved.get(ticket.id);
  if (done) return new Date(done).getTime() >= at.getTime();
  return OPEN_STATUSES.includes(ticket.status);
}

/** 在某一天已經逾期：期限在那天之前、而且那時還沒結案。 */
function overdueAt(ticket: Ticket, resolved: ReadonlyMap<string, string>, day: Date): boolean {
  if (!ticket.dueDate || !openAt(ticket, resolved, day)) return false;
  return parseDueDate(ticket.dueDate).getTime() < day.getTime();
}

function averageHours(tickets: readonly Ticket[], resolved: ReadonlyMap<string, string>, from: Date, to: Date): number | null {
  const hours = tickets
    .filter((t) => within(resolved.get(t.id), from, to))
    .map((t) => (new Date(resolved.get(t.id) as string).getTime() - new Date(t.createdAt).getTime()) / 3_600_000);
  if (!hours.length) return null;
  return Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10;
}

export interface DashboardStats {
  open: { value: number; previous: number };
  created: { value: number; previous: number; spark: number[] };
  overdue: { value: number; previous: number };
  avgHours: { value: number | null; previous: number | null };
  trend: { categories: Date[]; series: ChartSeries[] };
  byStatus: DonutSlice[];
  byCategory: { categories: string[]; series: ChartSeries[] };
}

export function computeDashboard(
  tickets: readonly Ticket[],
  resolved: ReadonlyMap<string, string>,
  period: DashboardPeriod,
  today: Date,
): DashboardStats {
  const range = periodRange(period, today);
  const createdIn = (from: Date, to: Date) => tickets.filter((t) => within(t.createdAt, from, to));
  const inPeriod = createdIn(range.start, range.end);
  const createdPerBucket = range.buckets.map((b) => createdIn(b.start, b.end).length);
  const closedPerBucket = range.buckets.map((b) => tickets.filter((t) => within(resolved.get(t.id), b.start, b.end)).length);

  return {
    open: {
      value: tickets.filter((t) => OPEN_STATUSES.includes(t.status)).length,
      previous: tickets.filter((t) => openAt(t, resolved, range.start)).length,
    },
    created: {
      value: inPeriod.length,
      previous: createdIn(range.prevStart, range.prevEnd).length,
      spark: createdPerBucket,
    },
    overdue: {
      value: tickets.filter((t) => isOverdue(t.dueDate, t.status, today)).length,
      previous: tickets.filter((t) => overdueAt(t, resolved, range.start)).length,
    },
    avgHours: {
      value: averageHours(tickets, resolved, range.start, range.end),
      previous: averageHours(tickets, resolved, range.prevStart, range.prevEnd),
    },
    trend: {
      categories: range.buckets.map((b) => b.start),
      series: [
        { id: 'created', label: '新增', values: createdPerBucket },
        { id: 'closed', label: '結案', values: closedPerBucket },
      ],
    },
    byStatus: TICKET_STATUSES.map((s) => ({
      id: s,
      label: TICKET_STATUS_LABELS[s],
      value: inPeriod.filter((t) => t.status === s).length,
    })),
    byCategory: {
      categories: TICKET_CATEGORIES.map((c) => TICKET_CATEGORY_LABELS[c]),
      series: [
        {
          id: 'open',
          label: '未結案',
          values: TICKET_CATEGORIES.map((c) => inPeriod.filter((t) => t.category === c && OPEN_STATUSES.includes(t.status)).length),
        },
        {
          id: 'done',
          label: '已結案',
          values: TICKET_CATEGORIES.map((c) => inPeriod.filter((t) => t.category === c && !OPEN_STATUSES.includes(t.status)).length),
        },
      ],
    },
  };
}

/** 指派給某人、還沒結案的工單：逾期的在前，再依期限（沒有期限的最後）、建立時間排序。 */
export function myTodo(tickets: readonly Ticket[], assigneeId: string | null, today: Date): Ticket[] {
  if (!assigneeId) return [];
  const due = (t: Ticket) => (t.dueDate ? parseDueDate(t.dueDate).getTime() : Number.POSITIVE_INFINITY);
  return tickets
    .filter((t) => t.assigneeId === assigneeId && OPEN_STATUSES.includes(t.status))
    .sort(
      (a, b) =>
        Number(isOverdue(b.dueDate, b.status, today)) - Number(isOverdue(a.dueDate, a.status, today)) ||
        due(a) - due(b) ||
        a.createdAt.localeCompare(b.createdAt),
    );
}

/** 「查看全部」：工單列表的網址參數（負責人＝我、狀態＝未結案），格式同 ticket-list-url.ts 的 `f`。 */
export function myTodoListParams(assigneeId: string): { f: string } {
  return {
    f: JSON.stringify([
      { field: 'assignee', type: 'multiSelect', values: [assigneeId] },
      { field: 'status', type: 'multiSelect', values: [...OPEN_STATUSES] },
    ]),
  };
}
