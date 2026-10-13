import { ChangeDetectionStrategy, Component, input } from '@angular/core';

const BAR_HEIGHTS = [46, 72, 58, 88, 64, 40, 78];

/**
 * 圖表載入中的骨架（內部元件），依圖表形狀：`line`＝格線＋一條趨勢、`bar`＝高低不一的長條、
 * `donut`＝一圈圓環＋圖例的幾行。外框 `aria-busy`，色塊 `aria-hidden`，另有一段只給報讀器的文字。
 */
@Component({
  selector: 'lib-chart-skeleton',
  template: `
    <span class="cs-sr">{{ label() }}</span>
    <div class="cs" [attr.data-shape]="shape()" [style.height.px]="shape() === 'donut' ? null : height()" aria-hidden="true">
      @switch (shape()) {
        @case ('bar') {
          @for (h of bars; track $index) {
            <span class="cs-block cs-bar" [style.height.%]="h"></span>
          }
        }
        @case ('donut') {
          <span class="cs-ring" [style.width.px]="height()" [style.height.px]="height()"></span>
          <span class="cs-lines">
            <span class="cs-block cs-line" style="width: 70%"></span>
            <span class="cs-block cs-line" style="width: 55%"></span>
            <span class="cs-block cs-line" style="width: 62%"></span>
          </span>
        }
        @default {
          <span class="cs-grid">
            @for (i of [0, 1, 2, 3]; track i) {
              <span class="cs-rule"></span>
            }
          </span>
          <span class="cs-block cs-wave"></span>
        }
      }
    </div>
  `,
  styleUrl: './chart-skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-busy': 'true' },
})
export class ChartSkeletonComponent {
  readonly shape = input<'line' | 'bar' | 'donut'>('line');
  /** 繪圖區高度（px）；圓環是直徑。 */
  readonly height = input(240);
  /** 報讀器念的文字（CHART_LABELS.loading）。 */
  readonly label = input('');
  protected readonly bars = BAR_HEIGHTS;
}
