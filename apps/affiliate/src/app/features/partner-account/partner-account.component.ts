import { Component, computed, inject, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DataTableCellDirective, DataTableColumn, DataTableComponent, DataTableLabels } from '@car-rental/ui';
import { CommissionLine, PartnerAccountStore } from '../../stores/partner-account.store';

@Component({
  selector: 'app-partner-account',
  imports: [SlicePipe, DataTableComponent, DataTableCellDirective],
  templateUrl: './partner-account.component.html',
  styleUrl: './partner-account.component.scss',
})
export class PartnerAccountComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(PartnerAccountStore);

  readonly slug = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('slug') ?? '')),
    { initialValue: '' },
  );

  readonly account = computed(() => {
    const slug = this.slug();
    if (!slug) return null;
    return this.store.getAccount(slug);
  });

  readonly tableLabels: DataTableLabels = {
    exportExcel: '匯出 Excel',
    selectAll: '全選',
    deselectAll: '取消全選',
    selectRow: '選取資料列',
    batchDelete: '刪除已選資料',
    selectedCount: '已選 {count} 筆',
    exportSelected: '只匯出已勾選的資料',
    expandRow: '展開詳細資料',
    collapseRow: '收合詳細資料',
    exportFailedText: '匯出失敗，請確認網路連線後再試一次',
  };

  /** 對帳報表依 slug 篩選，檔名要能辨識是哪個合作夥伴，否則多次匯出只會拿到 commission-20260805 (1).xlsx 這種無法分辨的檔名。 */
  readonly exportName = computed(() => `commission-${this.slug()}`);

  /**
   * affiliate 沒有 Material snackbar，改用 signal 驅動的 inline 錯誤訊息。
   * 沒有這條線就是 commit 9bf7801 在 admin 全站消除掉的靜默失敗：chunk 載入失敗時
   * 使用者按下「匯出 Excel」什麼事都不會發生，而這裡是面向客戶而非內部員工的頁面。
   */
  readonly exportError = signal<string | null>(null);

  onExportFailed(e: Error): void {
    console.error('DataTable 匯出失敗', e);
    this.exportError.set(this.tableLabels.exportFailedText);
  }

  readonly commissionColumns: DataTableColumn<CommissionLine>[] = [
    { key: 'bookingId', virtual: true, label: '訂單編號', primary: true, exportValue: (l) => l.booking.id },
    {
      key: 'period',
      virtual: true,
      label: '租期',
      exportValue: (l) => `${l.booking.startTime.slice(0, 10)} ~ ${l.booking.endTime.slice(0, 10)}`,
    },
    { key: 'days', label: '天數', align: 'end' },
    {
      key: 'rentalSubtotal',
      virtual: true,
      label: '租金小計',
      align: 'end',
      exportValue: (l) => l.booking.priceBreakdown?.rentalSubtotal ?? '',
    },
    { key: 'commission', label: '退佣', primary: true, align: 'end' },
  ];

  /** CommissionLine 沒有 id 欄位，改用 booking.id 當識別欄位。 */
  readonly commissionRowId = (l: CommissionLine) => l.booking.id;
}
