import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { CHART_LABELS, assertChartLabels, formatChartLabel } from '../chart-core/chart-labels';
import { ChartColor } from '../chart-core/chart.types';
import { linePath } from '../chart-core/chart-math';

/** 比較的結果。`ratio` 是相對變化（0.125＝+12.5%），比較值是 0 時是 null。 */
export interface StatChange {
  delta: number;
  ratio: number | null;
  direction: 'up' | 'down' | 'flat';
}

/** 跟比較值相比的變化（純函式）。任一個不是有限數就回 null。 */
export function computeStatChange(value: number | null | undefined, previous: number | null | undefined): StatChange | null {
  if (value == null || previous == null || !Number.isFinite(value) || !Number.isFinite(previous)) return null;
  const delta = value - previous;
  const ratio = previous === 0 ? null : delta / Math.abs(previous);
  const direction = Math.abs(delta) < 1e-9 ? 'flat' : delta > 0 ? 'up' : 'down';
  return { delta, ratio, direction };
}

/** 變化是好是壞：上升預設是好；`positiveIsGood` 為 false 時（例：逾期數）反過來。持平是中性。 */
export function statChangeTone(direction: StatChange['direction'], positiveIsGood: boolean): 'positive' | 'negative' | 'neutral' {
  if (direction === 'flat') return 'neutral';
  return (direction === 'up') === positiveIsGood ? 'positive' : 'negative';
}

const SPARK_W = 100;
const SPARK_H = 28;

/**
 * 數字小卡：一個指標的目前數值、跟上一期比的變化（箭頭＋顏色＋文字，例「較上週 +12.5%」），選填迷你趨勢。
 *
 * - 數值可以是格式化好的字串，或數字＋`format`（Intl.NumberFormat 選項，語言跟著 I18nService）。
 * - 變化預設算百分比（`changeMode="delta"` 改成差值＋單位）；`positiveIsGood=false` 時上升顯示成「變差」。
 *   好壞不只靠顏色：箭頭方向、正負號都寫出來，報讀器另外念「表現變好／變差」。
 * - 整張卡可點：寫成 `<a lib-stat-card routerLink="…">` 或 `<button lib-stat-card (click)="…">`，卡片本身就是連結或按鈕。
 * - `[loading]` 時顯示骨架。外框是 `.ui-card`（造型交給質地），大數字是 `.ui-text-display`。
 */
@Component({
  selector: 'lib-stat-card, a[lib-stat-card], button[lib-stat-card]',
  templateUrl: './stat-card.component.html',
  styleUrl: './stat-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ui-card lib-stat-card lib-chart',
    '[class.ui-card--clickable]': 'interactive',
    '[attr.aria-busy]': "loading() ? 'true' : null",
  },
})
export class StatCardComponent {
  /** 指標名稱，例：「未結案」。 */
  readonly label = input.required<string>();
  /** 目前數值：格式化好的字串，或數字（依 `format` 格式化）。 */
  readonly value = input<string | number | null>(null);
  /** 數字的格式（Intl.NumberFormat 選項）。 */
  readonly format = input<Intl.NumberFormatOptions>({ maximumFractionDigits: 1 });
  /** 單位，例：「件」「小時」。 */
  readonly unit = input('');
  /** 比較值（上一期的數值）；不給就不顯示變化。數值是字串時也要給數字的 `numericValue`。 */
  readonly previous = input<number | null>(null);
  /** `value` 是格式化好的字串時，用來算變化的數字。 */
  readonly numericValue = input<number | null>(null);
  /** 比較區間的文字，例：「上週」→「較上週 +12.5%」。 */
  readonly period = input('');
  /** 上升是好事（預設）；逾期數、處理時間這類指標設 false。 */
  readonly positiveIsGood = input(true);
  /** 變化顯示成百分比（預設）或差值。比較值是 0 時一律顯示差值。 */
  readonly changeMode = input<'percent' | 'delta'>('percent');
  /** 迷你趨勢的數值（由舊到新）；少於 2 個就不畫。 */
  readonly sparkline = input<readonly number[]>([]);
  /** 迷你趨勢的顏色（--app-chart-N）。 */
  readonly sparklineColor = input<ChartColor>(1);
  readonly loading = input(false);

  protected readonly labels = assertChartLabels(inject(CHART_LABELS, { optional: true }));
  private readonly i18n = inject(I18nService);
  /** 卡片本身是 `<a>` 或 `<button>`。 */
  protected readonly interactive = /^(A|BUTTON)$/.test((inject(ElementRef).nativeElement as HTMLElement).tagName);

  private readonly numberFormat = computed(() => new Intl.NumberFormat(this.i18n.current().intl, this.format()));

  protected readonly display = computed(() => {
    const v = this.value();
    if (v === null || v === undefined) return '—';
    return typeof v === 'number' ? (Number.isFinite(v) ? this.numberFormat().format(v) : '—') : v;
  });

  private readonly current = computed(() => {
    const v = this.value();
    return typeof v === 'number' ? v : this.numericValue();
  });

  protected readonly change = computed(() => {
    const change = computeStatChange(this.current(), this.previous());
    if (!change) return null;
    const tone = statChangeTone(change.direction, this.positiveIsGood());
    const locale = this.i18n.current().intl;
    const usePercent = this.changeMode() === 'percent' && change.ratio !== null;
    const text = usePercent
      ? new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(change.ratio as number)
      : `${new Intl.NumberFormat(locale, { ...this.format(), signDisplay: 'exceptZero' }).format(change.delta)}${this.unit() ? ` ${this.unit()}` : ''}`;
    return {
      tone,
      direction: change.direction,
      icon: change.direction === 'up' ? 'arrow_upward' : change.direction === 'down' ? 'arrow_downward' : 'remove',
      text: this.period() ? formatChartLabel(this.labels.comparison, { period: this.period(), change: text }) : text,
      verdict: tone === 'positive' ? this.labels.better : tone === 'negative' ? this.labels.worse : '',
    };
  });

  protected readonly spark = computed(() => {
    const values = this.sparkline().filter((v) => Number.isFinite(v));
    if (values.length < 2) return null;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || 1;
    const points = values.map((v, i) => ({
      x: (i * SPARK_W) / (values.length - 1),
      y: 2 + (SPARK_H - 4) * (1 - (v - lo) / span),
    }));
    const fmt = (v: number) => this.numberFormat().format(v);
    return {
      d: linePath(points),
      area: `${linePath(points)}L${SPARK_W} ${SPARK_H}L0 ${SPARK_H}Z`,
      last: points[points.length - 1],
      label: formatChartLabel(this.labels.sparkline, {
        name: this.label(),
        first: fmt(values[0]),
        last: fmt(values[values.length - 1]),
      }),
    };
  });

  protected readonly sparkBox = `0 0 ${SPARK_W} ${SPARK_H}`;
}
