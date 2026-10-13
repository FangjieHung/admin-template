import { InjectionToken } from '@angular/core';

/**
 * 數字小卡與圖表（lib-stat-card、lib-line-chart、lib-bar-chart、lib-donut-chart）共用的畫面文字。
 * libs/ui 不內建使用者可見字串，由使用端在 `providers` 提供一次。`{name}` 會換成對應的值。
 */
export interface ChartLabels {
  /** 切換成表格的按鈕（按下時是 aria-pressed），例：「以表格檢視」。 */
  viewAsTable: string;
  /** 沒有資料，例：「沒有資料」。 */
  noData: string;
  /** 載入中骨架給報讀器念的字，例：「載入中」。 */
  loading: string;
  /** 圓環圖把小項合併成的那一類，例：「其他」。 */
  other: string;
  /** 圓環圖中心與表格最後一列，例：「總計」。 */
  total: string;
  /** 表格第一欄的欄名，例：「項目」。 */
  category: string;
  /** 圓環表格的百分比欄名，例：「占比」。 */
  share: string;
  /** 圖例群組的無障礙名稱，例：「圖例」。 */
  legend: string;
  /** 圖表種類（摘要的 `{type}`），例：「折線圖」。 */
  lineChart: string;
  /** 例：「長條圖」。 */
  barChart: string;
  /** 例：「圓環圖」。 */
  donutChart: string;
  /** 折線、長條的摘要，例：「{type}，{count} 個系列（{names}），{first} 到 {last}」。 */
  seriesSummary: string;
  /** 圓環的摘要，例：「{type}，{count} 類，{total}」。 */
  donutSummary: string;
  /** 一個 x（類別）的報讀文字，例：「{x}：{values}」；`{values}` 是「系列 值」以頓號串起來。 */
  pointLabel: string;
  /** 聚焦資料點時的操作提示，例：「用方向鍵切換資料點」。 */
  keyboardHint: string;
  /** 數字小卡的比較文字，例：「較{period} {change}」。 */
  comparison: string;
  /** 比較結果是好的（只給報讀器念，畫面上是顏色），例：「表現變好」。 */
  better: string;
  /** 例：「表現變差」。 */
  worse: string;
  /** 迷你趨勢的無障礙名稱，例：「{name}的趨勢，{first} 到 {last}」。 */
  sparkline: string;
}

export const CHART_LABELS = new InjectionToken<ChartLabels>('CHART_LABELS');

const KEYS: readonly (keyof ChartLabels)[] = [
  'viewAsTable',
  'noData',
  'loading',
  'other',
  'total',
  'category',
  'share',
  'legend',
  'lineChart',
  'barChart',
  'donutChart',
  'seriesSummary',
  'donutSummary',
  'pointLabel',
  'keyboardHint',
  'comparison',
  'better',
  'worse',
  'sparkline',
];

/** 開發期設定錯誤（忘了提供文字或少了某一句）時直接丟出明確訊息，不靜默顯示空白。 */
export function assertChartLabels(labels: Partial<ChartLabels> | null): ChartLabels {
  if (!labels) throw new Error('Chart：缺少畫面文字。請在 providers 提供 CHART_LABELS。');
  const missing = KEYS.filter((key) => !labels[key]);
  if (missing.length > 0) {
    throw new Error(`Chart：CHART_LABELS 缺少 ${missing.map((k) => `「${k}」`).join('')}。`);
  }
  return labels as ChartLabels;
}

/** 把 `{name}` 換成對應的值。 */
export function formatChartLabel(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}
