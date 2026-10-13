import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ChartTableModel } from './chart.types';

/** 「以表格檢視」的表格（內部元件）：第一欄是類別（列標題），其餘欄是數值、靠右。 */
@Component({
  selector: 'lib-chart-table',
  template: `
    <div class="ct-scroll">
      <table class="ct">
        @if (caption()) {
          <caption class="ct-caption">{{ caption() }}</caption>
        }
        <thead>
          <tr>
            @for (head of model().head; track $index) {
              <th scope="col" [class.ct-num]="$index > 0">{{ head }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of model().rows; track $index) {
            <tr>
              <th scope="row">{{ row.label }}</th>
              @for (cell of row.cells; track $index) {
                <td class="ct-num ui-text-numeric">{{ cell }}</td>
              }
            </tr>
          }
        </tbody>
        @if (model().foot; as foot) {
          <tfoot>
            <tr>
              <th scope="row">{{ foot.label }}</th>
              @for (cell of foot.cells; track $index) {
                <td class="ct-num ui-text-numeric">{{ cell }}</td>
              }
            </tr>
          </tfoot>
        }
      </table>
    </div>
  `,
  styleUrl: './chart-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartTableComponent {
  readonly model = input.required<ChartTableModel>();
  /** 表格標題（報讀器會先念）；圖表摘要通常就夠了。 */
  readonly caption = input('');
}
