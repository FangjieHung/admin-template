/**
 * 共用日曆與排程（lib-calendar）的資料型別。
 *
 * 時間一律是「使用者電腦的當地時間」的 Date：元件只用年月日時分（`new Date(y, m, d, h, min)`）做加減，
 * 移動一天就是同一個鐘點的隔天，不用「加 24 小時」，所以遇到日光節約時間也不會跑掉一小時。
 */

/** 檢視方式：月、週、日、議程（依日期分組的清單）、資源排程（每一列是一個人、一間會議室或一台設備）。 */
export type CalendarView = 'month' | 'week' | 'day' | 'agenda' | 'resource';

/** 資源排程的時間軸刻度：一天（以小時為欄）、一週或一個月（以天為欄）。 */
export type CalendarResourceScale = 'day' | 'week' | 'month';

/** 一週從星期幾開始：0＝星期日、1＝星期一（預設）…6＝星期六。 */
export type CalendarWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface CalendarEvent<M = unknown> {
  id: string;
  title: string;
  /** 開始時間。 */
  start: Date;
  /**
   * 結束時間（不含）。整天的活動寫成「最後一天的隔天 00:00」：10/15 一天就是 start 10/15 00:00、end 10/16 00:00。
   * end 不晚於 start 時，整天的活動當成一天、有時間的活動當成一個時段長。
   */
  end: Date;
  /** 整天的活動（月檢視排在最前面、週／日檢視放在上方的「整天」列）。 */
  allDay?: boolean;
  /** 屬於哪個資源（CalendarResource 的 id）；資源排程依它分列，衝突也只比對同一個資源。 */
  resourceId?: string | null;
  /** 類別（CalendarCategory 的 id），決定顏色；報讀器也會念出類別名稱。 */
  category?: string;
  /** 狀態文字（例：「已確認」「暫定」），顯示在活動裡、報讀器也念。 */
  status?: string;
  /** false：這一筆不能拖曳移動或調整長度（仍可以點開）。 */
  editable?: boolean;
  /** 使用端自己的資料（例：原本的工單），元件不讀。 */
  meta?: M;
}

/** 資源排程的一列。 */
export interface CalendarResource {
  id: string;
  title: string;
  /** 分組名稱（例：「資訊室」）；同組的資源排在一起，上面有一列組名。 */
  group?: string;
  /** 第二行小字（例：職稱、容納人數）。 */
  subtitle?: string;
}

/**
 * 活動類別與顏色。`color` 給 1–6 時用配色的圖表色 `--app-chart-1…6`（ADR 0017，對卡片底色 ≥ 3:1、彼此分得開）；
 * 也可以直接給語意 token，例：`'var(--app-warning-dot)'`。顏色只畫在活動左緣的色條與淡底，文字一律用 on-surface，
 * 所以任何類別色上的字都 ≥ 4.5:1；類別名稱也會念給報讀器，不只靠顏色。
 */
export interface CalendarCategory {
  id: string;
  label: string;
  color: number | string;
}

/** 一段時間（end 不含）。 */
export interface CalendarRange {
  start: Date;
  end: Date;
}

/**
 * 資料來源：元件依目前看得到的範圍呼叫 `list()`，換頁時會 abort 上一次還沒回來的請求。
 * 接後端時把 `signal` 交給 HttpClient／fetch。
 */
export interface CalendarSource<M = unknown> {
  list(range: CalendarRange, signal: AbortSignal): Promise<readonly CalendarEvent<M>[]>;
}

/** 拖曳或鍵盤造成的變更：整筆移動，或只改長度（拖曳上下／左右邊緣）。 */
export type CalendarChangeKind = 'move' | 'extend';

export interface CalendarEventChange<M = unknown> {
  kind: CalendarChangeKind;
  /** 改好之後的活動（新的時間與資源）。 */
  event: CalendarEvent<M>;
  /** 改之前的活動。 */
  previous: CalendarEvent<M>;
  /** 怎麼改的：拖曳、鍵盤，或按了提示訊息的「復原」。 */
  via: 'pointer' | 'keyboard' | 'undo';
}

/**
 * 儲存一筆變更：成功 resolve；失敗 reject（reject 一個字串時，那句話會出現在錯誤提示裡）。
 * 畫面先改（樂觀更新），失敗時還原；同一筆活動又被改時，上一次的 `signal` 會 abort。
 */
export type CalendarChangeFn<M = unknown> = (change: CalendarEventChange<M>, signal: AbortSignal) => Promise<void>;

/** 在空白處點一下或拖出一段：使用端可以在這段時間新增活動。 */
export interface CalendarSlotSelection {
  start: Date;
  end: Date;
  allDay: boolean;
  resourceId: string | null;
}
