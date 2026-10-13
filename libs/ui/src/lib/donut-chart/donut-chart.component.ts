import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { EmptyStateComponent } from '../feedback-state/empty-state.component';
import { ChartBase } from '../chart-core/chart-base';
import { formatChartLabel } from '../chart-core/chart-labels';
import { arcPath, chartColorOf, groupSmallSlices, toPercentages } from '../chart-core/chart-math';
import { ChartSkeletonComponent } from '../chart-core/chart-skeleton.component';
import { ChartLegendComponent } from '../chart-core/chart-legend.component';
import { ChartStylesComponent } from '../chart-core/chart-styles.component';
import { ChartToolbarComponent } from '../chart-core/chart-toolbar.component';
import { ChartTableComponent } from '../chart-core/chart-table.component';
import { ChartColor, ChartLegendItem, ChartTableModel, DonutSlice } from '../chart-core/chart.types';

/** 合併出來的「其他」的 id。 */
export const DONUT_OTHER_ID = '__other';
/** 兩段之間的空隙（弧度）。 */
const PAD = 0.014;

interface DonutItem {
  id: string;
  label: string;
  value: number;
  percent: number;
  color: ChartColor;
}

/**
 * 圓環圖：一個總數拆成幾類的占比。
 *
 * - 超過 `maxSlices`（預設 6）類時，保留數值最大的 5 類，其餘併成「其他」（文字是 CHART_LABELS.other）。
 * - 中心顯示總計；滑過、聚焦或選取一類時改顯示那一類的名稱、數值與百分比。
 * - 圖例附百分比（四捨五入後加總剛好 100），點圖例或扇形可選取（`[(selected)]`）；Tab 進入後用方向鍵在扇形間移動，Enter／空白鍵選取。
 * - 扇形的邊框與空隙是 --lib-chart-slice-* 變數（Brutal 加墨框）。
 */
@Component({
  selector: 'lib-donut-chart',
  imports: [ChartStylesComponent, ChartToolbarComponent, ChartLegendComponent, ChartTableComponent, ChartSkeletonComponent, EmptyStateComponent],
  templateUrl: './donut-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lib-chart lib-donut-chart' },
})
export class DonutChartComponent extends ChartBase {
  readonly slices = input.required<readonly DonutSlice[]>();
  /** 最多顯示幾類（含「其他」）。 */
  readonly maxSlices = input(6);
  /** 圓環直徑（px）。 */
  readonly size = input(200);
  /** 中心的標題；不給時是 CHART_LABELS.total。 */
  readonly centerLabel = input('');
  /** 百分比的小數位數。 */
  readonly percentDecimals = input(0);
  /** 選取中的類別 id（可以 `[(selected)]`）；null 是沒有。 */
  readonly selected = model<string | null>(null);

  protected readonly items = computed<DonutItem[]>(() => {
    const grouped = groupSmallSlices(
      this.slices().map((s) => ({ ...s, value: Math.max(0, s.value) })),
      Math.max(2, this.maxSlices()),
      { id: DONUT_OTHER_ID, label: this.labels.other },
    );
    const percents = toPercentages(
      grouped.map((s) => s.value),
      this.percentDecimals(),
    );
    return grouped.map((s, i) => ({
      id: s.id,
      label: s.label,
      value: s.value,
      percent: percents[i],
      color: chartColorOf(i, (s as DonutSlice).color),
    }));
  });

  protected readonly total = computed(() => this.items().reduce((sum, s) => sum + s.value, 0));
  protected readonly isEmpty = computed(() => this.items().length === 0 || this.total() <= 0);

  private readonly percentFormat = computed(
    () =>
      new Intl.NumberFormat(this.i18n.current().intl, {
        style: 'percent',
        minimumFractionDigits: this.percentDecimals(),
        maximumFractionDigits: this.percentDecimals(),
      }),
  );

  protected formatPercent(p: number): string {
    return this.percentFormat().format(p / 100);
  }

  protected readonly arcs = computed(() => {
    const r = this.size() / 2;
    const outer = r - 6;
    const inner = outer * 0.62;
    const total = this.total();
    const items = this.items();
    const pad = items.filter((s) => s.value > 0).length > 1 ? PAD : 0;
    let angle = 0;
    return items.map((s, i) => {
      const sweep = total > 0 ? (s.value / total) * Math.PI * 2 : 0;
      const start = angle + (sweep > pad * 2 ? pad : 0);
      const end = angle + sweep - (sweep > pad * 2 ? pad : 0);
      angle += sweep;
      return {
        index: i,
        id: s.id,
        color: s.color,
        d: arcPath(r, r, outer, inner, start, end),
        big: arcPath(r, r, outer + 5, inner, start, end),
      };
    });
  });

  /** 中心顯示的內容：滑過／聚焦 > 選取 > 總計。 */
  protected readonly center = computed(() => {
    const items = this.items();
    const activeIndex = this.active();
    const item = activeIndex !== null ? items[activeIndex] : items.find((s) => s.id === this.selected());
    if (item) return { label: item.label, value: this.formatValue(item.value), detail: this.formatPercent(item.percent) };
    return { label: this.centerLabel() || this.labels.total, value: this.formatValue(this.total()), detail: '' };
  });

  protected readonly legendItems = computed<ChartLegendItem[]>(() =>
    this.items().map((s) => ({
      id: s.id,
      label: s.label,
      color: s.color,
      sample: 'swatch',
      pressed: s.id === this.selected(),
      detail: `${this.formatValue(s.value)}（${this.formatPercent(s.percent)}）`,
    })),
  );

  protected readonly figureSummary = computed(() => {
    if (this.summary()) return this.summary();
    return formatChartLabel(this.labels.donutSummary, {
      type: this.labels.donutChart,
      count: this.items().length,
      total: `${this.centerLabel() || this.labels.total} ${this.formatValue(this.total())}`,
    });
  });

  protected readonly table = computed<ChartTableModel>(() => ({
    head: [this.labels.category, this.centerLabel() || this.labels.total, this.labels.share],
    rows: this.items().map((s) => ({ label: s.label, cells: [this.formatValue(s.value), this.formatPercent(s.percent)] })),
    foot: { label: this.labels.total, cells: [this.formatValue(this.total()), this.formatPercent(100)] },
  }));

  protected sliceLabel(i: number): string {
    const s = this.items()[i];
    return formatChartLabel(this.labels.pointLabel, {
      x: s.label,
      values: `${this.formatValue(s.value)}（${this.formatPercent(s.percent)}）`,
    });
  }

  protected toggleSelect(id: string): void {
    this.selected.set(this.selected() === id ? null : id);
  }

  protected onSliceKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleSelect(this.items()[index].id);
      return;
    }
    this.onPointKeydown(event, index, this.items().length);
  }

  protected onSliceEnter(index: number): void {
    this.active.set(index);
  }

  protected onSliceLeave(): void {
    if (!this.keyboardFocus()) this.active.set(null);
  }

  protected onLegendHover(id: string | null): void {
    if (this.keyboardFocus()) return;
    const i = id === null ? -1 : this.items().findIndex((s) => s.id === id);
    this.active.set(i >= 0 ? i : null);
  }
}
