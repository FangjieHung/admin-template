export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function diffDays(a: Date, b: Date): number {
  return Math.floor((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000);
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/**
 * 該日期所在週的週日（getDay() === 0）；與 calendar-view 產生月曆格時「補到週日起算」
 * 的既有慣例（`addDays(first, -first.getDay())`）一致，時間軸（3.5）用它決定 14 天範圍的起點。
 */
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  return addDays(s, -s.getDay());
}

export function isoAt(daysFromToday: number, hour: number): string {
  const d = addDays(startOfDay(new Date()), daysFromToday);
  d.setHours(hour);
  return d.toISOString();
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 全站日期格式（1.8）：「YYYY/MM/DD」。不可再顯示「YYYY-MM-DD」或 ISO 字串切片。 */
export function fmtDate(d: Date): string {
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/**
 * 純日期欄位（例如駕照互惠查核的合法使用截止日、優惠券生效／到期日）存的是不含時間的日期
 * 字串（"YYYY-MM-DD" 或帶時間但沒有意義的 ISO），用 fmtDateTime 會多印出一個無意義的
 * 「00:00」讓人誤以為有實際時間點。這裡固定轉成 Date 後只取日期部分（「YYYY/MM/DD」），
 * 不受參考年份影響（純日期欄位一律印完整年份，不像 fmtDateTime 會省略同年年份）。
 */
export function fmtIsoDate(iso: string): string {
  return fmtDate(new Date(iso));
}

/**
 * 全站日期時間格式（1.8）：與參考日期（預設「今天」）同一年只顯示「MM/DD HH:mm」，
 * 跨年才加上年份「YYYY/MM/DD HH:mm」——列表裡大多是近期資料，同年時不必每筆都印年份。
 * `now` 可傳入固定的參考日期，測試才不必依賴執行當下的實際日期；一律用 `new Date(iso)`
 * 轉換再讀本地的 getFullYear/getMonth/getDate/getHours/getMinutes，不能用字串切片
 * （iso 是 UTC，字串切片會露出跟本地時間差 8 小時的錯誤日期／時間）。
 */
export function fmtDateTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === now.getFullYear();
  const datePart = sameYear
    ? `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
    : `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  return `${datePart} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
