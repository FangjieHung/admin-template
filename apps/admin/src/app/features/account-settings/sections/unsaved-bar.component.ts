import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * 「有未儲存的變更」列：放在分組的最後面，sticky 貼在捲動容器底部。
 * 「儲存」是 `form` 屬性指向分組表單的送出鈕（列不必放在 <form> 裡面，表單驗證與 Enter 送出照常運作）。
 * 外層（到捲動容器為止）不能是 `overflow: hidden`，所以列不要放進 `.ui-card` 裡。
 */
@Component({
  selector: 'app-unsaved-bar',
  imports: [MatButtonModule, MatProgressSpinnerModule],
  template: `
    <div class="ui-card unsaved-bar" role="region" aria-label="未儲存的變更" data-unsaved-bar>
      <p class="unsaved-bar__text" role="status">
        <span class="material-symbols-rounded" aria-hidden="true">edit_note</span>
        {{ message() }}
      </p>
      <div class="unsaved-bar__actions">
        <button matButton type="button" [disabled]="saving()" (click)="discard.emit()" data-action="discard">捨棄</button>
        <button matButton="filled" type="submit" [attr.form]="formId()" [disabled]="saving()" data-action="save">
          @if (saving()) {
            <mat-spinner diameter="18" aria-hidden="true" />
            儲存中…
          } @else {
            儲存
          }
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      position: sticky;
      bottom: 0.75rem;
      z-index: var(--app-z-sticky);
      display: block;
      margin-top: 1rem;
    }

    .unsaved-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 0.5rem 1rem;
      padding: 0.75rem 1rem;
    }

    .unsaved-bar__text {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0 auto 0 0;
      color: var(--mat-sys-on-surface);
      font-size: 0.875rem;
      font-weight: 600;

      .material-symbols-rounded {
        font-size: 1.25rem;
        color: var(--mat-sys-primary);
      }
    }

    .unsaved-bar__actions {
      display: flex;
      gap: 0.5rem;
    }

    mat-spinner {
      display: inline-block;
      margin-inline-end: 0.5rem;
      vertical-align: middle;
    }
  `,
})
export class UnsavedBarComponent {
  /** 分組表單的 id：「儲存」用 `form` 屬性送出它。 */
  readonly formId = input.required<string>();
  readonly saving = input(false);
  readonly message = input('有未儲存的變更');
  readonly discard = output<void>();
}
