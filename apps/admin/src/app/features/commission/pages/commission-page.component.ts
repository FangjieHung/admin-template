import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '@car-rental/ui';
import { PayoutStatus } from '../../../core/models';
import { ZH_TW } from '../../../core/i18n/zh-tw';
import { fmtDateTime } from '../../../core/date-utils';
import { TwdPipe } from '../../../shared/pipes/twd.pipe';
import { PartnerStore } from '../../../stores/partner/partner.store';
import { CommissionReportRow, CommissionStore } from '../../../stores/commission/commission.store';
import { ADMIN_DATA_TABLE_LABELS } from '../../../shared/ui/data-table-labels';

@Component({
  selector: 'app-commission-page',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    DataTableComponent,
    DataTableCellDirective,
    TwdPipe,
  ],
  templateUrl: './commission-page.component.html',
  styleUrls: ['../../../app.scss'],
})
export class CommissionPageComponent {
  protected readonly t = ZH_TW;
  readonly partnerStore = inject(PartnerStore);
  private commissionStore = inject(CommissionStore);
  private snackBar = inject(MatSnackBar);
  /** 租期起訖顯示一律用共用日期時間格式，不可再直接印出 ISO 字串。 */
  protected readonly fmt = fmtDateTime;

  readonly labels = ADMIN_DATA_TABLE_LABELS;

  readonly columns: DataTableColumn<CommissionReportRow>[] = [
    { key: 'bookingId', label: this.t.commission.bookingId, primary: true },
    { key: 'vehicleLabel', label: this.t.commission.vehicleLabel, primary: true },
    {
      key: 'period', virtual: true,
      label: this.t.commission.period,
      // 匯出保留原始 ISO 字串（機器可讀），畫面顯示才用共用格式（dtCell 負責）。
      exportValue: (r) => `${r.startTime} ~ ${r.endTime}`,
    },
    // 沒有報價快照的訂單（null）匯出寫「未報價」，不寫成 0。
    {
      key: 'rentalSubtotal',
      label: this.t.commission.rentalSubtotal,
      align: 'end',
      exportValue: (r) => r.rentalSubtotal ?? this.t.commission.unquoted,
    },
    {
      key: 'commission',
      label: this.t.commission.commissionAmount,
      align: 'end',
      exportValue: (r) => r.commission ?? this.t.commission.unquoted,
    },
  ];

  /** CommissionReportRow 無 id 欄位，DataTable 預設 rowId 會丟錯，改用 bookingId 當識別欄位。 */
  readonly rowId = (r: CommissionReportRow) => r.bookingId;

  selectedPartnerId = signal<string | null>(null);
  selectedMonth = signal<string>('');
  private payoutVersion = signal(0);

  readonly report = computed(() => {
    const partnerId = this.selectedPartnerId();
    const month = this.selectedMonth();
    if (!partnerId || !month) return null;
    return this.commissionStore.monthlyReport(partnerId, month);
  });

  readonly payoutStatus = computed<PayoutStatus | null>(() => {
    const partnerId = this.selectedPartnerId();
    const month = this.selectedMonth();
    this.payoutVersion();
    if (!partnerId || !month) return null;
    return this.commissionStore.getPayoutStatus(partnerId, month);
  });

  /** 報表上方的提示：「N 筆訂單沒有報價紀錄，未計入退佣」；全部都有報價時為空字串（不顯示）。 */
  readonly unquotedNotice = computed(() => {
    const count = this.report()?.unquotedCount ?? 0;
    return count > 0 ? this.t.commission.unquotedNotice.replace('{count}', String(count)) : '';
  });

  /** 依目前選定的合作夥伴與月份組出匯出檔名，否則多筆匯出只會拿到 commission-20260805 (1).xlsx 這種無法分辨的檔名。 */
  readonly exportName = computed(() => `commission-${this.selectedPartnerId()}-${this.selectedMonth()}`);

  onExportFailed(e: Error): void {
    console.error('DataTable 匯出失敗', e);
    this.snackBar.open(this.labels.exportFailedText, undefined, { duration: 3000 });
  }

  onPartnerChange(id: string): void {
    this.selectedPartnerId.set(id);
  }

  onMonthChange(month: string): void {
    this.selectedMonth.set(month);
  }

  markPaid(): void {
    const partnerId = this.selectedPartnerId();
    const month = this.selectedMonth();
    if (!partnerId || !month) return;
    this.commissionStore.markPaid(partnerId, month);
    this.payoutVersion.update((v) => v + 1);
  }
}
