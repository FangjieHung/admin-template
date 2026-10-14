import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { DataTableEditChromeContext } from './data-table-edit.controller';
import { formatLabel } from './data-table-query';

/**
 * 表格內直接編輯的外框（內部元件，lazy）：報讀器通知（已儲存、儲存失敗、貼上結果）與批次修改的「已修改 N 格」列。
 *
 * 編輯中儲存格的樣式（目前格子的框線、鉛筆提示、已修改標記、錯誤格、開關、儲存中）也放在這個元件的樣式表裡、
 * 不封裝（ViewEncapsulation.None，選擇器都從 `lib-data-table .dt-editable` 開始）：跟著控制器一起 lazy 載入，
 * 沒有編輯的表格不必下載這些 CSS。外觀變數見 CONTRACT.md「--dt-*」。
 */
@Component({
  selector: 'lib-data-table-edit-chrome',
  imports: [MatButtonModule],
  template: `
    @let ctx = context();
    <span class="dt-edit-live" aria-live="polite">{{ ctx.announcement() }}</span>
    @if (showBar()) {
      <div class="ui-card dt-batch-bar" role="region" [attr.aria-label]="ctx.labels().barLabel" data-dt-batch-bar>
        <p class="dt-batch-bar__text">
          <span class="material-symbols-rounded dt-batch-bar__icon" aria-hidden="true">edit_note</span>
          <span data-dt-dirty-count>{{ dirtyText() }}</span>
          @if (ctx.errorCount() > 0) {
            <span class="dt-batch-bar__sep" aria-hidden="true">·</span>
            <span class="dt-batch-bar__errors" data-dt-error-count>
              <span class="material-symbols-rounded" aria-hidden="true">error</span>{{ errorText() }}
            </span>
          }
        </p>
        <div class="dt-batch-bar__actions">
          @if (ctx.errorCount() > 0) {
            <button matButton type="button" data-action="next-error" (click)="ctx.nextError()">
              <span class="material-symbols-rounded" aria-hidden="true">arrow_downward</span>{{ ctx.labels().nextError }}
            </button>
          }
          <button matButton type="button" data-action="discard" [disabled]="ctx.saving()" (click)="ctx.discard()">
            {{ ctx.labels().discard }}
          </button>
          <button
            matButton="filled"
            type="button"
            data-action="save-all"
            [disabled]="ctx.saving()"
            [attr.aria-disabled]="ctx.errorCount() > 0 ? 'true' : null"
            (click)="ctx.saveAll()"
          >
            @if (ctx.saving()) {
              <span class="dt-spinner" aria-hidden="true"></span>
            }
            {{ ctx.labels().saveAll }}
          </button>
        </div>
      </div>
    }
  `,
  styleUrl: './data-table-edit-chrome.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dt-edit-chrome', '[class.dt-edit-chrome--bar]': 'showBar()' },
})
export class DataTableEditChromeComponent {
  readonly context = input.required<DataTableEditChromeContext>();

  protected readonly showBar = computed(() => {
    const ctx = this.context();
    return ctx.mode() === 'batch' && (ctx.dirtyCount() > 0 || ctx.saving());
  });
  protected readonly dirtyText = computed(() =>
    formatLabel(this.context().labels().dirtyCount, { count: this.context().dirtyCount() }),
  );
  protected readonly errorText = computed(() =>
    formatLabel(this.context().labels().errorCount, { count: this.context().errorCount() }),
  );
}
