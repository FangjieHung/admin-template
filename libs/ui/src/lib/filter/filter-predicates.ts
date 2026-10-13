import { formatLabel } from '../data-table/data-table-query';
import { FilterCondition, FilterField, FilterLabels } from './filter.types';

// 純函式：條件比對、套用（AND）、chip 文字。元件與日後的伺服器端查詢都以這裡的規則為準。

/** 'YYYY-MM-DD' → 本地時間當天 00:00；格式不對回 null。 */
export function parseLocalDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → 'YYYY-MM-DD'（本地時間）。 */
export function toLocalDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/**
 * 日期條件對應的區間 [from, to)（本地時間）。今天＝今天 00:00 到明天 00:00；
 * 本週＝週日起算 7 天（與 admin 總覽月曆同一個慣例）；自訂＝起日 00:00 到迄日隔天 00:00（含迄日整天）。
 * 只有起日或迄日時另一端不設限。
 */
export function dateConditionRange(
  cond: Extract<FilterCondition, { type: 'dateRange' }>,
  now: Date,
): { from: Date | null; to: Date | null } {
  if (cond.preset === 'today') {
    const from = startOfDay(now);
    return { from, to: addDays(from, 1) };
  }
  if (cond.preset === 'week') {
    const from = addDays(startOfDay(now), -now.getDay());
    return { from, to: addDays(from, 7) };
  }
  const from = cond.from ? parseLocalDate(cond.from) : null;
  const toDay = cond.to ? parseLocalDate(cond.to) : null;
  return { from, to: toDay ? addDays(toDay, 1) : null };
}

/** 條件還沒有填任何內容（不篩）。 */
export function isConditionEmpty(cond: FilterCondition): boolean {
  switch (cond.type) {
    case 'text':
      return cond.text.trim() === '';
    case 'select':
      return cond.value === '';
    case 'multiSelect':
      return cond.values.length === 0;
    case 'dateRange':
      return !cond.preset && !cond.from && !cond.to;
    case 'numberRange':
      return !Number.isFinite(cond.min) && !Number.isFinite(cond.max);
  }
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 單一資料列是否符合單一條件。欄位型別與條件型別不一致時視為不篩（舊檢視的欄位改了型別）。 */
export function matchesCondition<T>(row: T, field: FilterField<T>, cond: FilterCondition, now: Date): boolean {
  if (isConditionEmpty(cond)) return true;
  switch (cond.type) {
    case 'text': {
      if (field.type !== 'text') return true;
      const needle = cond.text.trim().toLowerCase();
      const raw = field.value(row);
      const values = raw === null || raw === undefined ? [] : typeof raw === 'string' ? [raw] : raw;
      return values.some((v) => v.toLowerCase().includes(needle));
    }
    case 'select': {
      if (field.type !== 'select' && field.type !== 'multiSelect') return true;
      return field.value(row) === cond.value;
    }
    case 'multiSelect': {
      if (field.type !== 'select' && field.type !== 'multiSelect') return true;
      const v = field.value(row);
      return v !== null && v !== undefined && cond.values.includes(v);
    }
    case 'dateRange': {
      if (field.type !== 'dateRange') return true;
      const d = toDate(field.value(row));
      if (!d) return false;
      const { from, to } = dateConditionRange(cond, now);
      if (from && d.getTime() < from.getTime()) return false;
      if (to && d.getTime() >= to.getTime()) return false;
      return true;
    }
    case 'numberRange': {
      if (field.type !== 'numberRange') return true;
      const v = field.value(row);
      if (v === null || v === undefined || !Number.isFinite(v)) return false;
      if (Number.isFinite(cond.min) && v < (cond.min as number)) return false;
      if (Number.isFinite(cond.max) && v > (cond.max as number)) return false;
      return true;
    }
  }
}

/** 套用所有條件（AND）。找不到欄位定義的條件（例如舊檢視裡已移除的欄位）直接忽略。 */
export function applyFilters<T>(
  rows: readonly T[],
  fields: readonly FilterField<T>[],
  conditions: readonly FilterCondition[],
  now: Date = new Date(),
): readonly T[] {
  const byId = new Map(fields.map((f) => [f.id, f] as const));
  const active = conditions
    .map((cond) => ({ cond, field: byId.get(cond.field) }))
    .filter((c): c is { cond: FilterCondition; field: FilterField<T> } => !!c.field && !isConditionEmpty(c.cond));
  if (active.length === 0) return rows;
  return rows.filter((row) => active.every(({ cond, field }) => matchesCondition(row, field, cond, now)));
}

/** 同一欄位只留一個條件：已有就取代（位置不變），沒有就接在最後；空條件等於移除。 */
export function upsertCondition(conditions: readonly FilterCondition[], cond: FilterCondition): FilterCondition[] {
  if (isConditionEmpty(cond)) return removeCondition(conditions, cond.field);
  const index = conditions.findIndex((c) => c.field === cond.field);
  if (index === -1) return [...conditions, cond];
  return conditions.map((c, i) => (i === index ? cond : c));
}

export function removeCondition(conditions: readonly FilterCondition[], field: string): FilterCondition[] {
  return conditions.filter((c) => c.field !== field);
}

function formatNumber(n: number): string {
  return n.toLocaleString('zh-TW');
}

function formatDay(value: string): string {
  return value.replace(/-/g, '/');
}

/** chip 上顯示的文字，例：「狀態：待處理、進行中」「到期日：今天」「金額：1,000–5,000 元」。 */
export function describeCondition<T>(cond: FilterCondition, field: FilterField<T>, labels: FilterLabels): string {
  return formatLabel(labels.chip, { field: field.label, value: describeValue(cond, field, labels) });
}

function describeValue<T>(cond: FilterCondition, field: FilterField<T>, labels: FilterLabels): string {
  const optionLabel = (value: string) =>
    (field.type === 'select' || field.type === 'multiSelect'
      ? field.options.find((o) => o.value === value)?.label
      : undefined) ?? value;
  const range = (min: string | null, max: string | null) => {
    if (min !== null && max !== null) return formatLabel(labels.between, { min, max });
    if (min !== null) return formatLabel(labels.atLeast, { min });
    return formatLabel(labels.atMost, { max: max ?? '' });
  };
  switch (cond.type) {
    case 'text':
      return formatLabel(labels.contains, { text: cond.text.trim() });
    case 'select':
      return optionLabel(cond.value);
    case 'multiSelect':
      return cond.values.map(optionLabel).join(labels.listSeparator);
    case 'dateRange': {
      if (cond.preset === 'today') return labels.presetToday;
      if (cond.preset === 'week') return labels.presetWeek;
      const from = cond.from ? formatDay(cond.from) : null;
      const to = cond.to ? formatDay(cond.to) : null;
      if (from && to) return formatLabel(labels.between, { min: from, max: to });
      if (from) return formatLabel(labels.dateFrom, { date: from });
      return formatLabel(labels.dateTo, { date: to ?? '' });
    }
    case 'numberRange': {
      const unit = field.type === 'numberRange' && field.unit ? ` ${field.unit}` : '';
      const min = Number.isFinite(cond.min) ? formatNumber(cond.min as number) : null;
      const max = Number.isFinite(cond.max) ? formatNumber(cond.max as number) : null;
      // 單位：區間接在最後（1,000–5,000 元），單邊接在數字後（1,000 元以上）。
      if (min !== null && max !== null) return `${range(min, max)}${unit}`;
      return range(min !== null ? `${min}${unit}` : null, max !== null ? `${max}${unit}` : null);
    }
  }
}
