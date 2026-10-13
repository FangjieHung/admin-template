import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { chartDash, chartMarker } from './chart-math';
import { ChartLegendItem } from './chart.types';

/**
 * 圖表的圖例（內部元件）：每項一個色塊或「線＋點」樣本、名稱、選填的補充（百分比）。
 * - `toggle`：按鈕切換系列顯示（aria-pressed＝顯示中），折線與長條用。
 * - `select`：按鈕選取一類（aria-pressed＝選取中），圓環用。
 * - `static`：只顯示，不能按（只有一個系列時）。
 */
@Component({
  selector: 'lib-chart-legend',
  template: `
    <ul class="lg" [attr.aria-label]="label()">
      @for (item of items(); track item.id) {
        <li class="lg__entry" [attr.data-c]="item.color">
          @if (mode() === 'static') {
            <span class="lg__item">
              <ng-container [ngTemplateOutlet]="body" [ngTemplateOutletContext]="{ $implicit: item }" />
            </span>
          } @else {
            <button
              type="button"
              class="lg__item lg__button"
              [class.lg__item--off]="mode() === 'toggle' && !item.pressed"
              [attr.aria-pressed]="item.pressed"
              [attr.data-legend]="item.id"
              (click)="itemClick.emit(item.id)"
              (mouseenter)="itemHover.emit(item.id)"
              (mouseleave)="itemHover.emit(null)"
            >
              <ng-container [ngTemplateOutlet]="body" [ngTemplateOutletContext]="{ $implicit: item }" />
            </button>
          }
        </li>
      }
    </ul>
    <ng-template #body let-item>
      @if (item.sample === 'line') {
        <svg class="lg__line" viewBox="0 0 24 12" aria-hidden="true">
          <line x1="1" y1="6" x2="23" y2="6" [attr.stroke-dasharray]="dash(item.index ?? 0) || null" />
          <path [attr.d]="marker(item.index ?? 0)" />
        </svg>
      } @else {
        <span class="lg__swatch" aria-hidden="true"></span>
      }
      <span class="lg__label">{{ item.label }}</span>
      @if (item.detail) {
        <span class="lg__detail ui-text-numeric">{{ item.detail }}</span>
      }
    </ng-template>
  `,
  styleUrl: './chart-legend.component.scss',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.lib-chart-legend--column]': 'column()',
    '[class.lib-chart-legend--select]': "mode() === 'select'",
  },
})
export class ChartLegendComponent {
  readonly items = input.required<readonly ChartLegendItem[]>();
  readonly mode = input<'toggle' | 'select' | 'static'>('toggle');
  /** 清單的無障礙名稱（CHART_LABELS.legend）。 */
  readonly label = input('');
  /** 一項一行（圓環旁邊的圖例）。 */
  readonly column = input(false);
  readonly itemClick = output<string>();
  readonly itemHover = output<string | null>();

  protected dash(index: number): string {
    return chartDash(index);
  }

  protected marker(index: number): string {
    return chartMarker(index, 12, 6, 2.75);
  }
}
