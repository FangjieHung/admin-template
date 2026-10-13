import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ChartColor } from './chart.types';

export interface ChartTooltipRow {
  id: string;
  label: string;
  /** null：不畫色塊（例：堆疊的總計）。 */
  color: ChartColor | null;
  value: string;
}

/**
 * 滑過或鍵盤聚焦資料點時的提示框（內部元件）：標題＋每個系列一列。位置由圖表算好（相對於繪圖區的 px）；
 * 只給眼睛看（aria-hidden），報讀器念資料點自己的 aria-label。樣式在 chart-styles.scss。
 */
@Component({
  selector: 'lib-chart-tooltip',
  template: `
    <p class="lib-chart__tooltip-title">{{ title() }}</p>
    @for (row of rows(); track row.id) {
      <div class="lib-chart__tooltip-row" [attr.data-c]="row.color">
        @if (row.color) {
          <span class="lib-chart__tooltip-swatch"></span>
        }
        <span class="lib-chart__tooltip-name">{{ row.label }}</span>
        <span class="lib-chart__tooltip-value ui-text-numeric">{{ row.value }}</span>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lib-chart__tooltip',
    'data-chart-tooltip': '',
    'aria-hidden': 'true',
    '[style.left.px]': 'left()',
    '[style.right.px]': 'right()',
    '[style.top.px]': 'top()',
    '[style.bottom.px]': 'bottom()',
  },
})
export class ChartTooltipComponent {
  readonly title = input.required<string>();
  readonly rows = input.required<readonly ChartTooltipRow[]>();
  readonly left = input<number | null>(null);
  readonly right = input<number | null>(null);
  readonly top = input<number | null>(null);
  readonly bottom = input<number | null>(null);
}
