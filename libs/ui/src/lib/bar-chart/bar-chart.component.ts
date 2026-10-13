import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { EmptyStateComponent } from '../feedback-state/empty-state.component';
import { CHART_AXIS_FONT, ChartBase } from '../chart-core/chart-base';
import { formatChartLabel } from '../chart-core/chart-labels';
import {
  chartColorOf,
  estimateTextWidth,
  labelStep,
  nearestIndex,
  niceTicks,
  stackValues,
  truncateText,
  valueExtent,
} from '../chart-core/chart-math';
import { ChartSkeletonComponent } from '../chart-core/chart-skeleton.component';
import { ChartStylesComponent } from '../chart-core/chart-styles.component';
import { ChartToolbarComponent } from '../chart-core/chart-toolbar.component';
import { ChartTooltipComponent } from '../chart-core/chart-tooltip.component';
import { ChartTableComponent } from '../chart-core/chart-table.component';
import { ChartCategory, ChartColor, ChartLegendItem, ChartSeries, ChartTableModel } from '../chart-core/chart.types';

/** 直式長條的類別標籤放不下時旋轉的角度與旋轉後的最長長度（px，超過就截斷）。 */
const ROTATE_DEG = 40;
const ROTATED_MAX = 96;
/** 橫式長條每一列的高度（沒指定 height 時用來算總高）。 */
const ROW_HEIGHT = 34;

interface Bar {
  key: string;
  seriesId: string;
  color: ChartColor;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ValueText {
  key: string;
  x: number;
  y: number;
  text: string;
  anchor: 'start' | 'middle' | 'end';
}

interface CategoryText {
  text: string;
  full: string;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  rotate: number;
}

/**
 * 長條圖：直式或橫式；多個系列時分組或堆疊。
 *
 * - 數值軸自動取「好看的」刻度、從 0 開始；格線、軸標只用語意 token，長條圓角與框線是 --lib-chart-* 變數（質地覆寫）。
 * - 類別標籤太長時：橫式截斷並在 `<title>` 放完整文字；直式先旋轉，還是太長就截斷。
 * - 滑過或鍵盤聚焦一個類別時顯示提示框（各系列的值，堆疊時加總計）；Tab 進入後用方向鍵移動。
 * - 選填 `showValues` 直接標註數值（分組時每根、堆疊時標總計）。
 */
@Component({
  selector: 'lib-bar-chart',
  imports: [ChartStylesComponent, ChartToolbarComponent, ChartTooltipComponent, ChartTableComponent, ChartSkeletonComponent, EmptyStateComponent],
  templateUrl: './bar-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lib-chart lib-bar-chart',
    '[class.lib-bar-chart--stacked]': 'stacked()',
  },
})
export class BarChartComponent extends ChartBase {
  readonly categories = input.required<readonly ChartCategory[]>();
  readonly series = input.required<readonly ChartSeries[]>();
  readonly orientation = input<'vertical' | 'horizontal'>('vertical');
  /** 多個系列時堆疊（預設分組並排）。 */
  readonly stacked = input(false);
  /** 直接標註數值。 */
  readonly showValues = input(false);
  /** 繪圖區高度（px）；不給時直式 240、橫式依類別數（每列 34px）。 */
  readonly height = input<number | null>(null);
  readonly integer = input(false);
  /** 被圖例關掉的系列 id；可以 `[(hiddenSeries)]`。 */
  readonly hiddenSeries = model<readonly string[]>([]);

  protected readonly isEmpty = computed(
    () => this.categories().length === 0 || this.series().every((s) => s.values.every((v) => v === null)),
  );

  protected readonly plotHeight = computed(() => {
    const given = this.height();
    if (given) return given;
    return this.orientation() === 'horizontal' ? this.categories().length * ROW_HEIGHT + 34 : 240;
  });

  private readonly visible = computed(() => {
    const hidden = new Set(this.hiddenSeries());
    return this.series()
      .map((s, index) => ({ s, index }))
      .filter(({ s }) => !hidden.has(s.id));
  });

  /**
   * 版面：先在「類別軸（band）× 數值軸（value）」上算，最後依方向換成 x／y。
   * 直式的類別在 x、數值往上長；橫式的類別在 y、數值往右長。
   */
  protected readonly layout = computed(() => {
    const width = this.width();
    const height = this.plotHeight();
    const horizontal = this.orientation() === 'horizontal';
    const stacked = this.stacked();
    const showValues = this.showValues();
    const categories = this.categories();
    const n = Math.max(1, categories.length);
    const visible = this.visible();
    const values = visible.map((v) => v.s.values);
    const [lo, hi] = valueExtent(values, stacked);
    const scale = niceTicks(Math.min(0, lo), Math.max(0, hi), {
      maxTicks: horizontal ? Math.max(3, Math.min(6, Math.floor(width / 90))) : height < 180 ? 4 : 5,
      integer: this.integer(),
    });
    const tickTexts = scale.ticks.map((t) => this.formatValue(t));
    const catTexts = categories.map((c) => this.formatCategory(c));
    const catFull = categories.map((c) => this.formatCategoryFull(c));
    const longest = Math.max(0, ...catTexts.map((t) => estimateTextWidth(t, CHART_AXIS_FONT)));
    const totals = categories.map((_, i) => values.reduce((sum, s) => sum + (s[i] ?? 0), 0));
    const widest = (list: number[]) => Math.max(0, ...list.map((v) => estimateTextWidth(this.formatValue(v), CHART_AXIS_FONT)));

    // 繪圖區（絕對座標）。
    let left: number;
    let right: number;
    let top: number;
    let bottom: number;
    let rotate = false;
    let labelW = 0;
    if (horizontal) {
      labelW = Math.min(Math.ceil(longest), Math.round(width * 0.32), 160);
      left = labelW + 12;
      right = width - Math.max(12, showValues ? widest(stacked ? totals : values.flat().map((v) => v ?? 0)) + 10 : 0);
      top = 4;
      bottom = height - 22;
    } else {
      left = Math.ceil(Math.max(...tickTexts.map((t) => estimateTextWidth(t, CHART_AXIS_FONT)), 8)) + 10;
      right = width - 12;
      rotate = longest + 8 > (right - left) / n;
      top = showValues ? 18 : 10;
      bottom = height - (rotate ? Math.ceil(Math.min(longest, ROTATED_MAX) * Math.sin((ROTATE_DEG * Math.PI) / 180)) + 16 : 22);
    }
    right = Math.max(left + 40, right);
    bottom = Math.max(top + 40, bottom);

    const band = ((horizontal ? bottom - top : right - left) || 1) / n;
    const bandStart = (i: number) => (horizontal ? top : left) + i * band;
    const span = scale.max - scale.min || 1;
    const valuePos = (v: number) =>
      horizontal ? left + ((right - left) * (v - scale.min)) / span : bottom - ((bottom - top) * (v - scale.min)) / span;
    const zero = valuePos(Math.max(scale.min, Math.min(0, scale.max)));
    const rect = (b0: number, size: number, p0: number, p1: number) =>
      horizontal
        ? { x: Math.min(p0, p1), y: b0, w: Math.abs(p1 - p0), h: size }
        : { x: b0, y: Math.min(p0, p1), w: size, h: Math.abs(p1 - p0) };
    /** 數值標註：放在長條的末端外側。 */
    const valueText = (key: string, v: number, center: number): ValueText =>
      horizontal
        ? { key, x: Math.max(zero, valuePos(v)) + 6, y: center, text: this.formatValue(v), anchor: 'start' }
        : { key, x: center, y: Math.min(zero, valuePos(v)) - 6, text: this.formatValue(v), anchor: 'middle' };

    const bars: Bar[] = [];
    const valueTexts: ValueText[] = [];
    const stacks = stacked ? stackValues(values) : null;
    categories.forEach((_, i) => {
      if (stacks) {
        const size = Math.min(band * 0.58, 64);
        const b0 = bandStart(i) + (band - size) / 2;
        visible.forEach(({ s, index }, k) => {
          const sp = stacks[k][i];
          if (sp.end !== sp.start) {
            bars.push({ key: `${s.id}-${i}`, seriesId: s.id, color: chartColorOf(index, s.color), ...rect(b0, size, valuePos(sp.start), valuePos(sp.end)) });
          }
        });
        if (showValues) valueTexts.push(valueText(`t${i}`, totals[i], bandStart(i) + band / 2));
      } else {
        const inner = Math.min(band * 0.72, 56 * Math.max(1, visible.length));
        const size = inner / Math.max(1, visible.length);
        visible.forEach(({ s, index }, k) => {
          const v = s.values[i];
          if (v === null || v === undefined) return;
          const b0 = bandStart(i) + (band - inner) / 2 + k * size;
          bars.push({ key: `${s.id}-${i}`, seriesId: s.id, color: chartColorOf(index, s.color), ...rect(b0 + 1, Math.max(1, size - 2), zero, valuePos(v)) });
          if (showValues) valueTexts.push(valueText(`${s.id}-${i}`, v, b0 + size / 2));
        });
      }
    });

    const step = rotate ? labelStep(n, right - left, 16) : 1;
    const categoryTexts: CategoryText[] = [];
    categories.forEach((_, i) => {
      if (i % step !== 0) return;
      const center = bandStart(i) + band / 2;
      categoryTexts.push(
        horizontal
          ? { text: truncateText(catTexts[i], labelW, CHART_AXIS_FONT), full: catFull[i], x: left - 8, y: center, anchor: 'end', rotate: 0 }
          : {
              text: rotate ? truncateText(catTexts[i], ROTATED_MAX, CHART_AXIS_FONT) : catTexts[i],
              full: catFull[i],
              x: center,
              y: bottom + 16,
              anchor: rotate ? 'end' : 'middle',
              rotate: rotate ? -ROTATE_DEG : 0,
            },
      );
    });

    return {
      horizontal,
      width,
      height,
      top,
      bottom,
      left,
      right,
      zero,
      bars,
      valueTexts,
      categoryTexts,
      bands: categories.map((_, i) =>
        horizontal
          ? { x: left, y: bandStart(i), w: right - left, h: band, center: bandStart(i) + band / 2 }
          : { x: bandStart(i), y: top, w: band, h: bottom - top, center: bandStart(i) + band / 2 },
      ),
      valueTicks: scale.ticks.map((t, i) => ({ pos: valuePos(t), text: tickTexts[i] })),
      /** 提示框的位置：直式跟著類別的 x；橫式放在那一列下面（下半部的列改放上面，免得超出卡片）。 */
      tooltipAt: (i: number) =>
        horizontal
          ? { x: left, y: bandStart(i) + band, above: i >= n / 2 ? height - bandStart(i) + 4 : null }
          : { x: bandStart(i) + band / 2, y: top, above: null as number | null },
    };
  });

  protected readonly legendItems = computed<ChartLegendItem[]>(() => {
    const hidden = new Set(this.hiddenSeries());
    return this.series().map((s, index) => ({
      id: s.id,
      label: s.label,
      color: chartColorOf(index, s.color),
      sample: 'swatch',
      pressed: !hidden.has(s.id),
    }));
  });

  protected readonly figureSummary = computed(() => {
    if (this.summary()) return this.summary();
    const cats = this.categories();
    return formatChartLabel(this.labels.seriesSummary, {
      type: this.labels.barChart,
      count: this.series().length,
      names: this.series()
        .map((s) => s.label)
        .join('、'),
      first: cats.length ? this.formatCategoryFull(cats[0]) : '',
      last: cats.length ? this.formatCategoryFull(cats[cats.length - 1]) : '',
    });
  });

  protected readonly table = computed<ChartTableModel>(() => {
    const series = this.series();
    const withTotal = this.stacked() && series.length > 1;
    return {
      head: [this.labels.category, ...series.map((s) => s.label), ...(withTotal ? [this.labels.total] : [])],
      rows: this.categories().map((c, i) => ({
        label: this.formatCategoryFull(c),
        cells: [
          ...series.map((s) => this.formatValue(s.values[i])),
          ...(withTotal ? [this.formatValue(series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0))] : []),
        ],
      })),
    };
  });

  protected readonly tooltip = computed(() => {
    const i = this.active();
    if (i === null || this.tableView()) return null;
    const layout = this.layout();
    if (!layout.bands[i]) return null;
    const at = layout.tooltipAt(i);
    const rows = this.visible().map(({ s, index }) => ({
      id: s.id,
      label: s.label,
      color: chartColorOf(index, s.color) as ChartColor | null,
      value: this.formatValue(s.values[i]),
    }));
    if (this.stacked() && rows.length > 1) {
      const total = this.visible().reduce((sum, { s }) => sum + (s.values[i] ?? 0), 0);
      rows.push({ id: '__total', label: this.labels.total, color: null, value: this.formatValue(total) });
    }
    return {
      index: i,
      x: at.x,
      y: at.y,
      above: at.above,
      flip: !layout.horizontal && at.x > layout.width * 0.6,
      title: this.formatCategoryFull(this.categories()[i]),
      rows,
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
    const scale = rect.width ? layout.width / rect.width : 1;
    const pos = layout.horizontal ? (event.clientY - rect.top) * scale : (event.clientX - rect.left) * scale;
    const i = nearestIndex(
      layout.bands.map((b) => b.center),
      pos,
    );
    if (i >= 0) this.active.set(i);
  }

  protected onPointerLeave(): void {
    if (!this.keyboardFocus()) this.active.set(null);
  }
}
