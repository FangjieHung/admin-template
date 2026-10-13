import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

/**
 * 錯誤頁樣板的版面：圖示、代碼、標題、說明、補充內容（投影）與一個主要動作（通常是「回首頁」）。
 * 「找不到頁面」「沒有權限」兩個路由頁都用它；新專案要其他錯誤頁（維護中、伺服器錯誤）照抄一頁換文字。
 */
@Component({
  selector: 'app-error-page',
  imports: [RouterLink, MatButtonModule],
  template: `
    <section class="ui-card error-page p-6 sm:p-10" [attr.aria-labelledby]="headingId()">
      <span class="material-symbols-rounded error-page__icon" aria-hidden="true">{{ icon() }}</span>
      @if (code()) {
        <p class="ui-text-caption ui-text-numeric error-page__code">{{ code() }}</p>
      }
      <h2 class="ui-text-title error-page__title" [id]="headingId()">{{ heading() }}</h2>
      <p class="error-page__message">{{ message() }}</p>
      <div class="error-page__extra">
        <ng-content />
      </div>
      <div class="error-page__actions">
        <a matButton="filled" [routerLink]="actionRoute()">{{ actionLabel() }}</a>
        <ng-content select="[errorPageSecondary]" />
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .error-page {
      display: grid;
      justify-items: center;
      gap: 0.5rem;
      max-width: 40rem;
      margin: 2rem auto 0;
      text-align: center;
    }

    .error-page__icon {
      font-size: 3rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .error-page__code,
    .error-page__title,
    .error-page__message {
      margin: 0;
    }

    .error-page__message {
      max-width: 52ch;
      line-height: 1.7;
      color: var(--mat-sys-on-surface-variant);
    }

    .error-page__extra:empty {
      display: none;
    }

    .error-page__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.75rem;
      margin-top: 1rem;
    }
  `,
})
export class ErrorPageComponent {
  readonly icon = input.required<string>();
  /** 例：「404」「403」；不給就不顯示。 */
  readonly code = input('');
  readonly heading = input.required<string>();
  readonly message = input.required<string>();
  readonly actionLabel = input('回首頁');
  readonly actionRoute = input('/');
  /** 同一頁放兩個錯誤頁（展示頁）時，標題 id 要不同。 */
  readonly headingId = input('error-page-title');
}
