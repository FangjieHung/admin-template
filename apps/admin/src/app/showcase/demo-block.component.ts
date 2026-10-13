import { Component, input } from '@angular/core';

/** 展示頁裡的一塊示範：標題、一句說明、示範區。 */
@Component({
  selector: 'app-demo-block',
  template: `
    <section class="ui-card demo-block p-4 sm:p-6" [attr.aria-label]="heading()">
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

    .demo-block__stage {
      margin-top: 1rem;
      min-width: 0;
    }
  `,
})
export class DemoBlockComponent {
  readonly heading = input.required<string>();
  readonly description = input('');
}
