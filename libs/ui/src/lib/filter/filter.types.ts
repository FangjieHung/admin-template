/** 下拉／勾選清單的一個選項（lib-filter-select 與進階篩選共用）。 */
export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
}

export type FilterFieldType = 'text' | 'select' | 'multiSelect' | 'dateRange' | 'numberRange';

/** 日期區間的相對選項：存成「今天」而不是某一天，存進檢視後隔天打開仍是當天。 */
export type FilterDatePreset = 'today' | 'week';

interface FilterFieldBase {
  /** 欄位識別，存進條件與檢視；改名會讓舊檢視的這個條件失效（被忽略，不會報錯）。 */
  id: string;
  label: string;
}

/** 可篩選的欄位定義。value 從資料列取出要比對的值（不必是某個屬性，可以是計算值）。 */
export type FilterField<T> =
  | (FilterFieldBase & {
      type: 'text';
      /** 回傳陣列時任一個包含關鍵字就算符合（例如同時比對姓名與車牌）。 */
      value: (row: T) => string | readonly string[] | null | undefined;
      placeholder?: string;
    })
  | (FilterFieldBase & {
      type: 'select' | 'multiSelect';
      options: readonly FilterOption[];
      value: (row: T) => string | null | undefined;
    })
  | (FilterFieldBase & {
      type: 'dateRange';
      /** ISO 字串或 Date；以本地時間的日期比對。 */
      value: (row: T) => string | Date | null | undefined;
      /** 提供哪些相對選項；預設今天、本週。 */
      presets?: readonly FilterDatePreset[];
    })
  | (FilterFieldBase & {
      type: 'numberRange';
      value: (row: T) => number | null | undefined;
      /** 顯示在數值後面，例如「元」。 */
      unit?: string;
    });

/**
 * 一個已套用的條件。可以直接 JSON 化存進檢視（日期一律存 'YYYY-MM-DD' 字串）。
 * 多個條件之間是 AND；同一個欄位最多一個條件。
 */
export type FilterCondition =
  | { field: string; type: 'text'; text: string }
  | { field: string; type: 'select'; value: string }
  | { field: string; type: 'multiSelect'; values: string[] }
  | { field: string; type: 'dateRange'; preset?: FilterDatePreset; from?: string; to?: string }
  | { field: string; type: 'numberRange'; min?: number; max?: number };

/** 進階篩選與條件 chips 的文字。`{x}` 會被代換。 */
export interface FilterLabels {
  /** 開面板的按鈕，例：「篩選」。 */
  trigger: string;
  /** 有條件時的按鈕文字，例：「篩選（{count}）」。 */
  triggerWithCount: string;
  /** 面板標題，例：「新增篩選條件」。 */
  panelTitle: string;
  /** 欄位下拉的名稱，例：「欄位」。 */
  field: string;
  /** 欄位下拉的提示選項，例：「選擇欄位」。 */
  chooseField: string;
  /** 例：「條件」。 */
  condition: string;
  /** 例：「輸入關鍵字」。 */
  textPlaceholder: string;
  /** 單選下拉的提示選項，例：「請選擇」。 */
  selectPlaceholder: string;
  /** 例：「最小」。 */
  min: string;
  /** 例：「最大」。 */
  max: string;
  presetToday: string;
  presetWeek: string;
  /** 例：「自訂區間」。 */
  presetCustom: string;
  apply: string;
  cancel: string;
  close: string;
  /** chips 區的無障礙名稱，例：「已套用的篩選條件」。 */
  chipsLabel: string;
  /** chip 的移除鈕，例：「移除條件：{label}」。 */
  remove: string;
  /** 例：「清除全部」。 */
  clearAll: string;
  /** chip 文字：`{field}` 欄位名、`{value}` 條件內容，例：「{field}：{value}」。 */
  chip: string;
  /** 例：「含「{text}」」。 */
  contains: string;
  /** 例：「{min} 以上」。 */
  atLeast: string;
  /** 例：「{max} 以下」。 */
  atMost: string;
  /** 例：「{min}–{max}」。 */
  between: string;
  /** 多選的分隔，例：「、」。 */
  listSeparator: string;
}
