/** 圖表類別色的編號：對到 `--app-chart-1` … `--app-chart-6`（配色決定實際顏色）。 */
export type ChartColor = 1 | 2 | 3 | 4 | 5 | 6;

/** x 軸的一個類別：日期（依語言格式化）或文字。 */
export type ChartCategory = string | Date;

/** 折線、長條的一個系列；`values` 的順序對到 `categories`，缺值給 `null`（折線在那裡斷開）。 */
export interface ChartSeries {
  id: string;
  label: string;
  values: readonly (number | null)[];
  /** 不給時依系列順序取 1–6。 */
  color?: ChartColor;
}

/** 圓環的一類。 */
export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  /** 不給時依順序取 1–6（合併後的「其他」排最後）。 */
  color?: ChartColor;
}

/** 「以表格檢視」的內容：第一欄是類別，其餘每欄一個系列。 */
export interface ChartTableModel {
  head: readonly string[];
  rows: readonly { label: string; cells: readonly string[] }[];
  foot?: { label: string; cells: readonly string[] };
}

/** 圖例的一項。 */
export interface ChartLegendItem {
  id: string;
  label: string;
  color: ChartColor;
  /** 圖例樣本畫成「線＋點」（折線）或「色塊」（長條、圓環）。 */
  sample: 'line' | 'swatch';
  /** 只有 `sample: 'line'`：第幾條線（決定虛線樣式與點的形狀）。 */
  index?: number;
  /** 按鈕的狀態：切換系列時是「顯示中」，圓環是「選取中」。 */
  pressed: boolean;
  /** 名稱後面的補充，例：百分比、數值。 */
  detail?: string;
}
