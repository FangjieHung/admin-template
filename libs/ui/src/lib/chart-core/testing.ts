import { ChartLabels } from './chart-labels';

/**
 * 圖表元件測試共用的替身（只給 spec 用，不從 index.ts 匯出）。
 * jsdom 沒有版面也沒有 ResizeObserver：FakeResizeObserver 讓測試手動觸發「容器寬度變了」。
 */
export const TEST_CHART_LABELS: ChartLabels = {
  viewAsTable: '以表格檢視',
  noData: '沒有資料',
  loading: '載入中',
  other: '其他',
  total: '總計',
  category: '項目',
  share: '占比',
  legend: '圖例',
  lineChart: '折線圖',
  barChart: '長條圖',
  donutChart: '圓環圖',
  seriesSummary: '{type}，{count} 個系列（{names}），{first} 到 {last}',
  donutSummary: '{type}，{count} 類，{total}',
  pointLabel: '{x}：{values}',
  keyboardHint: '用方向鍵切換資料點',
  comparison: '較{period} {change}',
  better: '表現變好',
  worse: '表現變差',
  sparkline: '{name}的趨勢，{first} 到 {last}',
};

export class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly targets: Element[] = [];

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.targets.push(target);
  }

  unobserve(): void {
    // 測試不需要
  }

  disconnect(): void {
    FakeResizeObserver.instances = FakeResizeObserver.instances.filter((o) => o !== this);
  }

  /** 假裝容器變成 `width` px 寬。 */
  resize(width: number): void {
    const entries = this.targets.map((target) => ({ target, contentRect: { width, height: 0 } }) as unknown as ResizeObserverEntry);
    this.callback(entries, this as unknown as ResizeObserver);
  }

  static resizeAll(width: number): void {
    for (const o of [...FakeResizeObserver.instances]) o.resize(width);
  }
}
