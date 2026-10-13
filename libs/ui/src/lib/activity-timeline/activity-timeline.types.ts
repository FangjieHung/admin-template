/** 一筆活動的操作者；`null` 代表系統自動產生。 */
export interface ActivityActor {
  name: string;
  /** 圓章上的縮寫；不給時取名字的第一個字。 */
  initials?: string;
}

/** 一個欄位的變更：舊值 → 新值（null 顯示 labels 的 `emptyValue`）。 */
export interface ActivityChange {
  field: string;
  from: string | null;
  to: string | null;
}

/** 一筆活動紀錄。 */
export interface ActivityEntry {
  id: string;
  actor: ActivityActor | null;
  /** 發生時間：Date 或可被 `new Date()` 解讀的字串（ISO 8601）。 */
  at: Date | string;
  /** 種類，對應 `kinds` 對照表的圖示與色調（例：`status`、`comment`、`assign`），元件不認得任何業務種類。 */
  kind: string;
  /** 摘要句，由使用端組好，例：「王宗翰 把狀態從『處理中』改成『已完成』」。 */
  summary: string;
  changes?: readonly ActivityChange[];
  /** 留言內容，以引用區塊呈現。 */
  body?: string;
}

/** 種類的色調，對應 `--app-{tone}-*`（positive 在這裡叫 success）。 */
export type ActivityTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface ActivityKind {
  /** Material Symbols 圖示名稱。 */
  icon: string;
  tone: ActivityTone;
}

/** 種類對照表：`{ status: { icon: 'sync_alt', tone: 'info' }, … }`。 */
export type ActivityKindMap = Readonly<Record<string, ActivityKind>>;

/** 篩選 chip 的一個選項。 */
export interface ActivityFilter {
  id: string;
  label: string;
}

/** 日期分組的種類：今天、昨天、其他日期。 */
export type ActivityDayKind = 'today' | 'yesterday' | 'date';

export interface ActivityDayGroup {
  /** 當地日期 `YYYY-MM-DD`。 */
  key: string;
  kind: ActivityDayKind;
  /** 這一天的第一筆時間（給標題格式化用）。 */
  date: Date;
  entries: readonly ActivityEntry[];
}

const DAY_MS = 86_400_000;

export function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** 兩個時間相差幾個「日曆日」（a 比 b 早就是正數）；用四捨五入吸收日光節約時間的 ±1 小時。 */
export function calendarDaysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

/**
 * 依當地日期把紀錄分組。保持傳入的順序（通常是新到舊），相鄰而且同一天的紀錄放同一組；
 * 元件不重新排序，排序是資料來源的責任。
 */
export function groupActivityByDay(entries: readonly ActivityEntry[], now: Date): ActivityDayGroup[] {
  const groups: { key: string; kind: ActivityDayKind; date: Date; entries: ActivityEntry[] }[] = [];
  for (const entry of entries) {
    const at = toDate(entry.at);
    const key = dayKey(at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.entries.push(entry);
      continue;
    }
    const diff = calendarDaysBetween(at, now);
    const kind: ActivityDayKind = diff === 0 ? 'today' : diff === 1 ? 'yesterday' : 'date';
    groups.push({ key, kind, date: at, entries: [entry] });
  }
  return groups;
}

/**
 * 相對時間：一分鐘內「現在」，一小時內「N 分鐘前」，一天內「N 小時前」，之後依日曆日「昨天」「N 天前」，
 * 30 天以上「N 個月前」。文字由 `Intl.RelativeTimeFormat` 依語言產生（`numeric: 'auto'`）。
 */
export function formatRelativeTime(at: Date, now: Date, rtf: Intl.RelativeTimeFormat): string {
  const seconds = Math.round((at.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.trunc(seconds / 60), 'minute');
  if (abs < DAY_MS / 1000) return rtf.format(Math.trunc(seconds / 3600), 'hour');
  const days = calendarDaysBetween(at, now);
  if (Math.abs(days) < 30) return rtf.format(-days, 'day');
  return rtf.format(-Math.trunc(days / 30), 'month');
}

/** 名字的縮寫：有 initials 用 initials，否則取第一個字（英文轉大寫）。 */
export function actorInitials(actor: ActivityActor): string {
  if (actor.initials) return actor.initials;
  const first = Array.from(actor.name.trim())[0] ?? '';
  return first.toUpperCase();
}
