import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  TemplateRef,
  computed,
  contentChildren,
  inject,
  input,
} from '@angular/core';
import { PRINT_CLOSING_HOST } from './print-closing';
import { PRINT_DOCUMENT_LABELS, assertPrintDocumentLabels } from './print-document-labels';
import type { PrintSummaryRow, PrintTableColumn } from './print-document.types';

/** 儲存格範本的內容：`let-row`、`let-index="index"`。 */
export interface PrintCellContext<T> {
  $implicit: T;
  index: number;
}

/**
 * 自訂某一欄的儲存格：`<ng-template libPrintCell="amount" [libPrintCellOf]="rows" let-row let-i="index">…</ng-template>`。
 * `[libPrintCellOf]` 只用來讓 `let-row` 有型別（給跟 `[rows]` 同一個陣列）。
 */
@Directive({ selector: 'ng-template[libPrintCell]' })
export class PrintCellDirective<T = unknown> {
  readonly key = input.required<string>({ alias: 'libPrintCell' });
  readonly rowsOf = input<readonly T[] | undefined>(undefined, { alias: 'libPrintCellOf' });
  readonly template = inject<TemplateRef<PrintCellContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(_dir: PrintCellDirective<T>, ctx: unknown): ctx is PrintCellContext<T> {
    return true;
  }
}

/**
 * 單據的明細表（放在 lib-print-document 裡）：欄位定義＋資料列＋小計／稅額／合計列。
 *
 * 列印時表頭每一頁重印、每一列不會被切在兩頁。最後 `keepWithSummary` 列、合計列，以及單據的結尾（備註、簽名欄、頁尾）
 * 放在同一個 `<tbody>` 裡、整組不切開：合計與簽名欄不會單獨落到新的一頁頂端（原因見 print-closing.ts）。
 * 數字欄 `align: 'end'` 靠右、用等寬數字。樣式在 print-document.component.scss；`lib-print-table` 這個 class 也可以掛在
 * 自己寫的 `<table>` 上，用同一組樣式。
 */
@Component({
  selector: 'lib-print-table',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lib-print-table-host' },
  template: `
    <table class="lib-print-table" [attr.aria-label]="label() || null">
      <colgroup>
        @for (col of columns(); track col.key) {
          <col [style.width]="col.width ?? null" />
        }
      </colgroup>
      <thead>
        <tr>
          @for (col of columns(); track col.key) {
            <th scope="col" [attr.data-align]="col.align ?? 'start'">{{ col.label }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of bodyRows(); track $index; let i = $index) {
          <ng-container *ngTemplateOutlet="rowTpl; context: { $implicit: row, index: i }" />
        } @empty {
          @if (!rows().length) {
            <tr>
              <td class="lib-print-table__empty" [attr.colspan]="columns().length || 1">{{ labels.noItems }}</td>
            </tr>
          }
        }
      </tbody>
      @if (tailRows().length || summary().length || ownsClosing()) {
        <tbody class="lib-print-table__tail">
          @for (row of tailRows(); track $index; let i = $index) {
            <ng-container *ngTemplateOutlet="rowTpl; context: { $implicit: row, index: tailStart() + i }" />
          }
          @for (item of summary(); track $index) {
            <tr class="lib-print-table__total" [class.is-emphasis]="item.emphasis">
              <th scope="row" [attr.colspan]="labelSpan()">{{ item.label }}</th>
              <td data-align="end">{{ item.value }}</td>
            </tr>
          }
          @if (ownsClosing() && closingTemplate(); as closing) {
            <tr class="lib-print-table__closing">
              <td [attr.colspan]="columns().length || 1">
                <ng-container *ngTemplateOutlet="closing" />
              </td>
            </tr>
          }
        </tbody>
      }
    </table>

    <ng-template #rowTpl let-row let-i="index">
      <tr class="lib-print-table__row">
        @for (col of columns(); track col.key) {
          <td [attr.data-align]="col.align ?? 'start'">
            @if (cellTemplates().get(col.key); as tpl) {
              <ng-container *ngTemplateOutlet="tpl; context: { $implicit: row, index: i }" />
            } @else {
              {{ text(row, col, i) }}
            }
          </td>
        }
      </tr>
    </ng-template>
  `,
})
export class PrintTableComponent<T = unknown> {
  protected readonly labels = assertPrintDocumentLabels(inject(PRINT_DOCUMENT_LABELS, { optional: true }), 'PrintTable');
  private readonly host = inject(PRINT_CLOSING_HOST, { optional: true });

  readonly columns = input.required<readonly PrintTableColumn<T>[]>();
  readonly rows = input.required<readonly T[]>();
  /** 小計、稅額、合計：標籤跨前面所有欄、值放在最後一欄。 */
  readonly summary = input<readonly PrintSummaryRow[]>([]);
  /**
   * 最後幾列明細要跟合計列（與單據的結尾）印在同一頁；0 表示只有合計與結尾黏在一起（合計可能出現在新一頁的頂端）。
   * 預設 1：這一整組放不下時會整組換到下一頁，前一頁就空著這一整組的高度；多黏一列，前一頁最多多空一列。
   */
  readonly keepWithSummary = input(1);
  /** 表格的無障礙名稱。 */
  readonly label = input('');

  private readonly cells = contentChildren(PrintCellDirective);
  protected readonly cellTemplates = computed(
    () => new Map(this.cells().map((cell) => [cell.key(), cell.template as TemplateRef<PrintCellContext<T>>])),
  );
  protected readonly labelSpan = computed(() => Math.max(1, this.columns().length - 1));

  /** 最後幾列（跟合計放在同一個不切開的區段）從第幾列開始。 */
  protected readonly tailStart = computed(() => Math.max(0, this.rows().length - Math.max(0, this.keepWithSummary())));
  protected readonly bodyRows = computed(() => this.rows().slice(0, this.tailStart()));
  protected readonly tailRows = computed(() => this.rows().slice(this.tailStart()));

  /** 這張表負責畫單據的結尾（備註、簽名欄、頁尾）：單據裡最後一張明細表。 */
  protected readonly ownsClosing = computed(() => this.host?.closingTable() === this);
  protected readonly closingTemplate = computed(() => this.host?.closingTemplate());

  constructor() {
    this.host?.registerTable(this);
    inject(DestroyRef).onDestroy(() => this.host?.unregisterTable(this));
  }

  protected text(row: T, col: PrintTableColumn<T>, index: number): string {
    const value = col.value ? col.value(row, index) : (row as Record<string, unknown>)[col.key];
    return value === null || value === undefined ? '' : String(value);
  }
}
