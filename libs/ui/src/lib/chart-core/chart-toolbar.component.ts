import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ChartLegendComponent } from './chart-legend.component';
import { ChartLegendItem } from './chart.types';

/**
 * 圖表上方的一列（內部元件）：圖例（可以沒有）＋「以表格檢視」切換鈕（`.ui-nav-pill`，按下時 aria-pressed）。
 * 樣式在 chart-styles.scss。
 */
@Component({
  selector: 'lib-chart-toolbar',
  imports: [ChartLegendComponent],
  template: `
    @if (items().length) {
      <lib-chart-legend [items]="items()" [mode]="mode()" [label]="legendLabel()" (itemClick)="itemClick.emit($event)" />
    }
    <button
      type="button"
      class="ui-nav-pill lib-chart__toggle"
      data-chart-toggle
      [class.is-active]="tableView()"
      [attr.aria-pressed]="tableView()"
      (click)="toggle.emit()"
    >
      <span class="material-symbols-rounded" aria-hidden="true">table</span>{{ toggleLabel() }}
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lib-chart__bar' },
})
export class ChartToolbarComponent {
  /** 圖例；空陣列就不顯示圖例。 */
  readonly items = input<readonly ChartLegendItem[]>([]);
  readonly mode = input<'toggle' | 'select' | 'static'>('toggle');
  readonly legendLabel = input('');
  readonly toggleLabel = input.required<string>();
  readonly tableView = input(false);
  readonly itemClick = output<string>();
  readonly toggle = output<void>();
}
