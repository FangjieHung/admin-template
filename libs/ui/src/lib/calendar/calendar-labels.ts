import { InjectionToken } from '@angular/core';

/**
 * 共用日曆（lib-calendar）的畫面文字。libs/ui 不內建使用者可見字串，由使用端在 `providers` 提供一次。
 * 大括號會被代換：`{year}`、`{month}`（1–12）、`{day}`、`{weekday}`、`{start}`、`{end}`、`{title}`、`{when}`、`{count}`、`{date}`、`{week}`、`{view}`。
 * 日期與時間由這些樣板組出來（數字由元件填），所以換一種語言只要換這一份文字。
 */
export interface CalendarLabels {
  /** 檢視切換鈕的群組名稱，例：「檢視方式」。 */
  viewSwitcher: string;
  viewMonth: string;
  viewWeek: string;
  viewDay: string;
  viewAgenda: string;
  viewResource: string;
  /** 資源排程的刻度切換群組名稱，例：「時間軸刻度」。 */
  scaleSwitcher: string;
  scaleDay: string;
  scaleWeek: string;
  scaleMonth: string;
  /** 回到今天，例：「今天」。 */
  today: string;
  /** 往前一段（上個月、上一週…），例：「往前」。 */
  previous: string;
  /** 往後一段，例：「往後」。 */
  next: string;
  /** 期間標題按鈕的無障礙說明（按下選月份），例：「選擇月份」。 */
  pickMonth: string;
  /** 月份選擇器的年份，例：「{year} 年」。 */
  yearTitle: string;
  /** 月份選擇器的月份按鈕，例：「{month} 月」。 */
  monthName: string;
  /** 月份選擇器的上一年／下一年，例：「上一年」「下一年」。 */
  previousYear: string;
  nextYear: string;
  /** 月檢視的期間標題，例：「{year} 年 {month} 月」。 */
  titleMonth: string;
  /** 日檢視的期間標題，例：「{year} 年 {month} 月 {day} 日 {weekday}」。 */
  titleDay: string;
  /** 週檢視、議程、資源排程的期間標題，例：「{start} – {end}」。 */
  titleRange: string;
  /** 短日期，例：「{month}/{day}」。 */
  dateShort: string;
  /** 跨年時的短日期，例：「{year}/{month}/{day}」。 */
  dateShortYear: string;
  /** 完整日期（活動的無障礙名稱、議程的日期標題），例：「{month} 月 {day} 日 {weekday}」。 */
  dateLong: string;
  /** 星期名稱，從星期日開始的 7 個，例：「星期日」…「星期六」。 */
  weekdays: readonly string[];
  /** 星期的短名稱，從星期日開始的 7 個，例：「日」「一」…「六」。 */
  weekdaysShort: readonly string[];
  /** 12 小時制的上午／下午（`hour12` 開啟時），例：「上午」「下午」。 */
  am: string;
  pm: string;
  /** 時間範圍，例：「{start} 到 {end}」。 */
  timeRange: string;
  /** 整天的活動，例：「整天」。 */
  allDay: string;
  /** 跨好幾天的活動在某一天的說明，例：「第 {day} 天，共 {count} 天」。 */
  multiDay: string;
  /** 月檢視「還有幾筆」按鈕，例：「+{count} 筆」。 */
  more: string;
  /** 「還有幾筆」按鈕的無障礙名稱，例：「{date}還有 {count} 筆活動」。 */
  moreLabel: string;
  /** 一天全部活動的浮動清單標題，例：「{date}」（可加字，如「{date}的活動」）。 */
  dayEvents: string;
  /** 關閉浮動清單，例：「關閉」。 */
  close: string;
  /** 月曆格子的無障礙名稱，例：「{date}，{count} 筆活動」。 */
  dayCell: string;
  /** 加在今天的格子／欄位名稱後面，例：「今天」。 */
  todayMark: string;
  /** 週次（`showWeekNumbers`），例：「第 {week} 週」。 */
  weekNumber: string;
  /** 週次欄的欄名，例：「週次」。 */
  weekColumn: string;
  /** 資源欄的欄名，例：「資源」。 */
  resourceColumn: string;
  /** 資源篩選的名稱，例：「顯示資源」。 */
  resourceFilter: string;
  /** 資源篩選的「全部」，例：「全部資源」。 */
  allResources: string;
  /** 同一個資源時間重疊（`allowOverlap=false`），例：「時間衝突」。 */
  conflict: string;
  /** 可以拖曳的活動的操作說明（aria-description），例：「Alt 加方向鍵移動，Alt 加 Shift 加方向鍵調整長度」。 */
  keyboardHint: string;
  /** 載入中（覆蓋層的無障礙名稱），例：「載入中」。 */
  loading: string;
  /** 載入失敗，例：「行事曆載入失敗」。 */
  error: string;
  /** 重試，例：「重試」。 */
  retry: string;
  /** 議程沒有活動，例：「這段期間沒有活動」。 */
  empty: string;
  /** 移動成功（提示訊息與報讀器），例：「已把「{title}」移到 {when}」。 */
  moved: string;
  /** 調整長度成功，例：「已把「{title}」改成 {when}」。 */
  extended: string;
  /** 儲存失敗、已還原，例：「「{title}」沒有儲存，已還原」。 */
  saveFailed: string;
  /** 儲存失敗、已還原，並說明原因（onEventChange reject 一個字串時），例：「「{title}」沒有儲存，已還原：{reason}」。 */
  saveFailedReason: string;
  /** 提示訊息的動作鈕，例：「復原」。 */
  undo: string;
  /** 換了檢視或期間（念給報讀器），例：「{view}，{title}」。 */
  viewChanged: string;
}

export const CALENDAR_LABELS = new InjectionToken<CalendarLabels>('CALENDAR_LABELS');

const KEYS: readonly (keyof CalendarLabels)[] = [
  'viewSwitcher',
  'viewMonth',
  'viewWeek',
  'viewDay',
  'viewAgenda',
  'viewResource',
  'scaleSwitcher',
  'scaleDay',
  'scaleWeek',
  'scaleMonth',
  'today',
  'previous',
  'next',
  'pickMonth',
  'yearTitle',
  'monthName',
  'previousYear',
  'nextYear',
  'titleMonth',
  'titleDay',
  'titleRange',
  'dateShort',
  'dateShortYear',
  'dateLong',
  'weekdays',
  'weekdaysShort',
  'am',
  'pm',
  'timeRange',
  'allDay',
  'multiDay',
  'more',
  'moreLabel',
  'dayEvents',
  'close',
  'dayCell',
  'todayMark',
  'weekNumber',
  'weekColumn',
  'resourceColumn',
  'resourceFilter',
  'allResources',
  'conflict',
  'keyboardHint',
  'loading',
  'error',
  'retry',
  'empty',
  'moved',
  'extended',
  'saveFailed',
  'saveFailedReason',
  'undo',
  'viewChanged',
];

/** 開發期設定錯誤（忘了提供文字或少了某一句）時直接丟出明確訊息，不靜默顯示空白。 */
export function assertCalendarLabels(labels: Partial<CalendarLabels> | null): CalendarLabels {
  if (!labels) throw new Error('Calendar：缺少畫面文字。請在 providers 提供 CALENDAR_LABELS。');
  const missing = KEYS.filter((key) => !labels[key]);
  if (missing.length > 0) {
    throw new Error(`Calendar：CALENDAR_LABELS 缺少 ${missing.map((k) => `「${k}」`).join('')}。`);
  }
  for (const key of ['weekdays', 'weekdaysShort'] as const) {
    if (labels[key]?.length !== 7) {
      throw new Error(`Calendar：CALENDAR_LABELS 的「${key}」要有 7 個（從星期日開始）。`);
    }
  }
  return labels as CalendarLabels;
}

/** 把 `{name}` 換成對應的值。 */
export function formatCalendarLabel(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}
