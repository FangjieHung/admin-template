import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { EmptyStateComponent } from '../feedback-state/empty-state.component';
import { CHART_AXIS_FONT, ChartBase } from '../chart-core/chart-base';
import { formatChartLabel } from '../chart-core/chart-labels';
import {
  ChartPoint,
  areaPath,
  chartColorOf,
  chartDash,
  chartMarker,
  estimateTextWidth,
  labelStep,
  linePath,
  nearestIndex,
  niceTicks,
  valueExtent,
} from '../chart-core/chart-math';
import { ChartSkeletonComponent } from '../chart-core/chart-skeleton.component';
import { ChartStylesComponent } from '../chart-core/chart-styles.component';
import { ChartToolbarComponent } from '../chart-core/chart-toolbar.component';
import { ChartTooltipComponent } from '../chart-core/chart-tooltip.component';
import { ChartTableComponent } from '../chart-core/chart-table.component';
import { ChartCategory, ChartColor, ChartLegendItem, ChartSeries, ChartTableModel } from '../chart-core/chart.types';

const MARGIN = { top: 10, right: 12, bottom: 26 };
/** 相鄰兩點至少隔幾 px 才把每個資料點都畫出來（太密時只畫滑過／聚焦的那一點）。 */
const MARKER_MIN_GAP = 16;

interface LineMark {
  id: string;
  index: number;
  color: ChartColor;
  dash: string | null;
  line: string;
  area: string;
  points: (ChartPoint | null)[];
}

interface XLabel {
  x: number;
  text: string;
  anchor: 'start' | 'middle' | 'end';
}

/**
 * 折線圖：x 是日期或類別，可以多條線、選填面積。
 *
 * - y 軸自動取「好看的」刻度（1／2／5 × 10ⁿ），預設從 0 開始；格線、軸標、圖例都只用語意 token。
 * - 滑過或用鍵盤聚焦時，顯示最近那個 x 的所有系列數值（提示框）；Tab 進入後用方向鍵移動、Home／End 到兩端、Esc 收起。
 * - 圖例可以點擊切換系列（`[(hiddenSeries)]`）；第 4 條線起是虛線／點線，每條線的資料點形狀不同（色盲時靠線型分辨）。
 * - 依容器寬度重算（ResizeObserver）；減少動態時不播進場動畫。
 * - 「以表格檢視」把同一份資料換成表格；沒有資料時是空狀態，`[loading]` 時是骨架。
 */
@Component({
  selector: 'lib-line-chart',
  imports: [ChartStylesComponent, ChartToolbarComponent, ChartTooltipComponent, ChartTableComponent, ChartSkeletonComponent, EmptyStateComponent],
  templateUrl: './line-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lib-chart lib-line-chart' },
})
export class LineChartComponent extends ChartBase {
  readonly categories = input.required<readonly ChartCategory[]>();
  readonly series = input.required<readonly ChartSeries[]>();
  /** 線下填色（面積圖）。 */
  readonly area = input(false);
  /** 繪圖區高度（px，含 x 軸標）。 */
  readonly height = input(240);
  /** y 軸從 0 開始（數值全是正的時候）。關掉時依資料的最小值。 */
  readonly zeroBaseline = input(true);
  /** 只出整數刻度（件數）。 */
  readonly integer = input(false);
  /** 被圖例關掉的系列 id；可以 `[(hiddenSeries)]`。 */
  readonly hiddenSeries = model<readonly string[]>([]);

  protected readonly isEmpty = computed(
    () => this.categories().length === 0 || this.series().every((s) => s.values.every((v) => v === null)),
  );

  private readonly visible = computed(() => {
    const hidden = new Set(this.hiddenSeries());
    return this.series()
      .map((s, index) => ({ s, index }))
      .filter(({ s }) => !hidden.has(s.id));
  });

  protected readonly layout = computed(() => {
    const width = this.width();
    const height = this.height();
    const categories = this.categories();
    const n = categories.length;
    const visible = this.visible();
    const source = visible.length ? visible.map((v) => v.s.values) : this.series().map((s) => s.values);
    let [lo, hi] = valueExtent(source);
    if (this.zeroBaseline()) {
      lo = Math.min(0, lo);
      hi = Math.max(0, hi);
    }
    const scale = niceTicks(lo, hi, { maxTicks: height < 180 ? 4 : 5, integer: this.integer() });
    const tickTexts = scale.ticks.map((t) => this.formatValue(t));
    const left = Math.ceil(Math.max(...tickTexts.map((t) => estimateTextWidth(t, CHART_AXIS_FONT)), 8)) + 10;
    const plotW = Math.max(40, width - left - MARGIN.right);
    const plotH = Math.max(40, height - MARGIN.top - MARGIN.bottom);
    const top = MARGIN.top;
    const bottom = top + plotH;
    const span = scale.max - scale.min || 1;
    const y = (v: number) => top + plotH * (1 - (v - scale.min) / span);
    const xs = categories.map((_, i) => left + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1)));
    const gap = n <= 1 ? plotW : plotW / (n - 1);
    const baseline = y(Math.max(scale.min, Math.min(0, scale.max)));

    const lines: LineMark[] = visible.map(({ s, index }) => {
      const points = categories.map((_, i) => {
        const v = s.values[i];
        return v === null || v === undefined || !Number.isFinite(v) ? null : { x: xs[i], y: y(v) };
      });
      return {
        id: s.id,
        index,
        color: chartColorOf(index, s.color),
        dash: chartDash(index) || null,
        line: linePath(points),
        area: this.area() ? areaPath(points, baseline) : '',
        points,
      };
    });

    const texts = categories.map((c) => this.formatCategory(c));
    const labelWidth = Math.max(...texts.map((t) => estimateTextWidth(t, CHART_AXIS_FONT)), 0) + 12;
    const step = labelStep(n, plotW, labelWidth);
    const xLabels: XLabel[] = [];
    texts.forEach((text, i) => {
      if (i % step !== 0) return;
      const half = estimateTextWidth(text, CHART_AXIS_FONT) / 2;
      const anchor = xs[i] - half < 0 ? 'start' : xs[i] + half > width ? 'end' : 'middle';
      xLabels.push({ x: xs[i], text, anchor });
    });

    return {
      width,
      height,
      left,
      top,
      bottom,
      right: left + plotW,
      xs,
      gap,
      baseline,
      lines,
      xLabels,
      showMarkers: gap >= MARKER_MIN_GAP,
      yTicks: scale.ticks.map((t, i) => ({ y: y(t), text: tickTexts[i] })),
    };
  });

  protected readonly legendItems = computed<ChartLegendItem[]>(() => {
    const hidden = new Set(this.hiddenSeries());
    return this.series().map((s, index) => ({
      id: s.id,
      label: s.label,
      color: chartColorOf(index, s.color),
      sample: 'line',
      index,
      pressed: !hidden.has(s.id),
    }));
  });

  protected readonly figureSummary = computed(() => {
    if (this.summary()) return this.summary();
    const cats = this.categories();
    return formatChartLabel(this.labels.seriesSummary, {
      type: this.labels.lineChart,
      count: this.series().length,
      names: this.series()
        .map((s) => s.label)
        .join('、'),
      first: cats.length ? this.formatCategoryFull(cats[0]) : '',
      last: cats.length ? this.formatCategoryFull(cats[cats.length - 1]) : '',
    });
  });

  protected readonly table = computed<ChartTableModel>(() => ({
    head: [this.labels.category, ...this.series().map((s) => s.label)],
    rows: this.categories().map((c, i) => ({
      label: this.formatCategoryFull(c),
      cells: this.series().map((s) => this.formatValue(s.values[i])),
    })),
  }));

  /** 提示框：目前指著的 x 與各系列的值。 */
  protected readonly tooltip = computed(() => {
    const i = this.active();
    if (i === null || this.tableView()) return null;
    const layout = this.layout();
    const x = layout.xs[i];
    if (x === undefined) return null;
    return {
      index: i,
      x,
      flip: x > layout.width * 0.6,
      title: this.formatCategoryFull(this.categories()[i]),
      rows: this.visible().map(({ s, index }) => ({
        id: s.id,
        label: s.label,
        color: chartColorOf(index, s.color),
        value: this.formatValue(s.values[i]),
      })),
    };
  });

  protected pointLabel(i: number): string {
    return formatChartLabel(this.labels.pointLabel, {
      x: this.formatCategoryFull(this.categories()[i]),
      values: this.visible()
        .map(({ s }) => `${s.label} ${this.formatValue(s.values[i])}`)
        .join('、'),
    });
  }

  protected marker(index: number, p: ChartPoint, big = false): string {
    const r = big ? 4.5 : 3.25;
    return chartMarker(index, p.x, p.y, r);
  }

  protected toggleSeries(id: string): void {
    const hidden = new Set(this.hiddenSeries());
    if (hidden.has(id)) hidden.delete(id);
    else hidden.add(id);
    this.hiddenSeries.set(this.series().filter((s) => hidden.has(s.id)).map((s) => s.id));
  }

  protected onPointerMove(event: PointerEvent): void {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const layout = this.layout();
    const x = rect.width ? ((event.clientX - rect.left) * layout.width) / rect.width : event.offsetX;
    const i = nearestIndex(layout.xs, x);
    if (i >= 0) this.active.set(i);
  }

  protected onPointerLeave(): void {
    if (!this.keyboardFocus()) this.active.set(null);
  }
}
