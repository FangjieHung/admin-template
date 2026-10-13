import { Component, input } from '@angular/core';

/** 展示頁裡的一塊示範：標題、一句說明、示範區。 */
@Component({
  selector: 'app-demo-block',
  template: `
    <section class="ui-card demo-block p-4 sm:p-6" [class.demo-block--sticky]="stickyContent()" [attr.aria-label]="heading()">
      <h2 class="ui-text-subtitle">{{ heading() }}</h2>
      @if (description()) {
        <p class="demo-block__description">{{ description() }}</p>
      }
      <div class="demo-block__stage">
        <ng-content />
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .demo-block__description {
      margin: 0.25rem 0 0;
      max-width: 68ch;
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface-variant);
    }

    /* 部分質地的 .ui-card 是 overflow: hidden（卡片變成捲動容器），示範裡的 sticky 會失效。示範區塊的內容都有內距、
       不會碰到圓角，直接不裁切（clip 也可以，但會裁掉 Sketch 抖出框外的筆線）。 */
    :host .ui-card.demo-block--sticky {
      overflow: visible;
    }

    .demo-block__stage {
      margin-top: 1rem;
      min-width: 0;
    }
  `,
})
export class DemoBlockComponent {
  readonly heading = input.required<string>();
  readonly description = input('');
  /** 示範內容有 position: sticky（例如詳情頁版型的精簡頁首）時設 true。 */
  readonly stickyContent = input(false);
}
