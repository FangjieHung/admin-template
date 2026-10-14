import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { DataTableRowFormContext } from './data-table-edit.controller';
import { DataTableEditorHostDirective } from './data-table-editor-host.directive';

/**
 * 手機卡片版的整列編輯表單（內部元件，lazy）：窄螢幕不做儲存格層級的編輯，按卡片的「編輯」在卡片裡展開這一列
 * 可以改的欄位，「儲存」一次送出（即時儲存逐欄呼叫 onCellSave；批次修改記成草稿）。
 */
@Component({
  selector: 'lib-data-table-row-form',
  imports: [MatButtonModule, DataTableEditorHostDirective],
  template: `
    @let ctx = context();
    <form class="dt-row-form" [attr.aria-label]="ctx.title" (submit)="$event.preventDefault(); ctx.save()">
      <p class="dt-row-form__title">{{ ctx.title }}</p>
      @for (field of ctx.fields; track field.key) {
        <div class="dt-row-form__field" [attr.data-field]="field.key">
          @if (!isRelation(field.spec.context)) {
            <label class="dt-row-form__label" [attr.for]="inputId(field.spec.context)">{{ field.label }}</label>
          }
          <ng-container [dtEditorHost]="field.spec" />
        </div>
      }
      <div class="dt-row-form__actions">
        <button matButton type="button" [disabled]="ctx.saving()" (click)="ctx.cancel()" data-action="row-cancel">
          {{ ctx.labels.cancel }}
        </button>
        <button matButton="filled" type="submit" [disabled]="ctx.saving()" data-action="row-save">{{ ctx.labels.save }}</button>
      </div>
    </form>
  `,
  styles: `
    :host {
      display: block;
    }

    .dt-row-form {
      display: grid;
      gap: 0.75rem;
      padding-top: 0.75rem;
      margin-top: 0.5rem;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }

    .dt-row-form__title {
      margin: 0;
      font-weight: 600;
      color: var(--mat-sys-on-surface);
    }

    .dt-row-form__field {
      display: grid;
      gap: 0.25rem;
    }

    .dt-row-form__label {
      font-size: 0.8125rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .dt-row-form__actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableRowFormComponent {
  readonly context = input.required<DataTableRowFormContext>();

  protected isRelation(ctx: unknown): boolean {
    return (ctx as { editor: { type: string } }).editor.type === 'relation';
  }

  protected inputId(ctx: unknown): string | null {
    return (ctx as { inputId: string | null }).inputId;
  }
}
