import { Component, computed, input } from '@angular/core';
import { StatusKey, toneOf } from '@admin-template/theme-pack';

/**
 * 狀態標籤：一顆圓點＋文字。顏色不由呼叫端指定，而是依「狀態語意」（`StatusKey`，例如 approved、pending、
 * error）對到 5 種色調（positive／info／neutral／warning／danger），色調的實際顏色與造型由配色與質地決定
 * （theme-pack 的 `.ui-chip--<tone>`，見 CONTRACT.md）。業務狀態請在使用端對應成 StatusKey，不要新增色調。
 */
@Component({
  selector: 'lib-status-chip',
  template: `<span class="ui-chip" [class]="'ui-chip--' + tone()"><span class="ui-chip__dot"></span>{{ label() }}</span>`,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class StatusChipComponent {
  /** 狀態語意；決定色調。 */
  readonly status = input.required<StatusKey>();
  /** 顯示文字。 */
  readonly label = input.required<string>();
  protected readonly tone = computed(() => toneOf(this.status()));
}
