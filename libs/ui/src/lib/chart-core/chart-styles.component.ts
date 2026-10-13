import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

/**
 * 折線、長條、圓環共用的樣式（內部元件）：不封裝，放在三個元件的模板最前面；Angular 第一次建立它時把樣式加進
 * `<head>`，之後的圖表共用同一份。本身不畫任何東西（display: none）。
 */
@Component({
  selector: 'lib-chart-styles',
  template: '',
  styleUrl: './chart-styles.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartStylesComponent {}
