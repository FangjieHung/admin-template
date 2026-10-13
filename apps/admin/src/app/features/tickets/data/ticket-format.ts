import { fmtDate, fmtDateTime } from '../../../core/date-utils';
import { TicketStatus } from './ticket.model';

/** 'YYYY-MM-DD' → 本地時間當天 00:00（不用 new Date(字串)：那會當成 UTC，在負時區差一天）。 */
export function parseDueDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 期限顯示成「YYYY/MM/DD」；沒有期限回空字串。 */
export function formatDueDate(value: string | null): string {
  return value ? fmtDate(parseDueDate(value)) : '';
}

/** 建立時間：同一年「MM/DD HH:mm」，跨年加年份。 */
export function formatCreatedAt(iso: string, now = new Date()): string {
  return fmtDateTime(iso, now);
}

/** 已過期限、而且還沒完成或關閉。 */
export function isOverdue(dueDate: string | null, status: TicketStatus, today = new Date()): boolean {
  if (!dueDate || status === 'resolved' || status === 'closed') return false;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return parseDueDate(dueDate).getTime() < start.getTime();
}
