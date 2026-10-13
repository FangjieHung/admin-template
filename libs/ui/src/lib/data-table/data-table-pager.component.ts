import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { formatLabel, pageCount, pageRange } from './data-table-query';
import { DataTablePagingLabels } from './data-table.types';

/**
 * lib-data-table 的分頁列（[pageable] 時由表格放在底部）：桌機是每頁筆數＋範圍＋第一／上一／下一／最後一頁；
 * 手機卡片版（loadMoreMode）改成「已顯示 n / N 筆」＋「載入更多」。只顯示與發出事件，頁碼狀態在表格上。
 */
@Component({
  selector: 'lib-data-table-pager',
  imports: [MatButtonModule, MatTooltipModule],
  templateUrl: './data-table-pager.component.html',
  styleUrl: './data-table-pager.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTablePagerComponent {
  readonly labels = input.required<DataTablePagingLabels>();
  readonly total = input.required<number>();
  /** 已夾在範圍內的頁碼（從 0 起算）。 */
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly pageSizeOptions = input<readonly number[]>([25, 50, 100]);
  readonly loadMoreMode = input(false);
  /** 載入更多模式下目前顯示的筆數。 */
  readonly shown = input(0);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly loadMore = output<void>();

  protected readonly pageTotal = computed(() => pageCount(this.total(), this.pageSize()));

  protected readonly rangeText = computed(() => {
    const { from, to } = pageRange(this.page(), this.pageSize(), this.total());
    return formatLabel(this.labels().range, { from, to, total: this.total() });
  });

  protected readonly pageOfText = computed(() =>
    formatLabel(this.labels().pageOf, { page: this.page() + 1, pages: this.pageTotal() }),
  );

  protected readonly shownText = computed(() =>
    formatLabel(this.labels().shownOf, { shown: this.shown(), total: this.total() }),
  );

  protected readonly canLoadMore = computed(() => this.shown() < this.total());

  protected pageSizeText(size: number): string {
    return formatLabel(this.labels().pageSizeOption, { size });
  }

  protected go(page: number): void {
    this.pageChange.emit(page);
  }

  protected onSizeChange(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    if (Number.isFinite(size) && size > 0) this.pageSizeChange.emit(size);
  }
}
