import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import {
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  PageToolbarComponent,
} from '@car-rental/ui';
import { formatTwd } from '@car-rental/domain';
import { Coupon } from '../../../core/models';
import { ZH_TW } from '../../../core/i18n/zh-tw';
import { fmtIsoDate } from '../../../core/date-utils';
import { CouponStore } from '../../../stores/coupon/coupon.store';
import { confirm } from '../../../shared/dialogs/confirm-dialog.component';
import { HeaderToolbarDirective } from '../../../layout/header/header-toolbar-slot';
import { ADMIN_DATA_TABLE_LABELS } from '../../../shared/ui/data-table-labels';
import { CouponDialogComponent, CouponFormResult } from '../dialogs/coupon-dialog.component';

@Component({
  selector: 'app-coupons-page',
  imports: [
    DataTableComponent,
    DataTableCellDirective,
    MatButtonModule,
    MatTooltipModule,
    PageToolbarComponent,
    HeaderToolbarDirective,
  ],
  templateUrl: './coupons-page.component.html',
  styleUrls: ['../../../app.scss'],
})
export class CouponsPageComponent {
  protected readonly t = ZH_TW;
  readonly store = inject(CouponStore);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  /** 生效／到期日是純日期，用 fmtIsoDate（不印無意義的時間）。 */
  protected readonly fmtIsoDate = fmtIsoDate;

  /** 1.8：固定金額類型的優惠券補上 NT$ 格式；百分比類型維持「10%」。 */
  protected couponValueLabel(c: Coupon): string {
    return c.type === 'percent' ? `${c.value}%` : formatTwd(c.value);
  }

  readonly labels = ADMIN_DATA_TABLE_LABELS;

  readonly columns: DataTableColumn<Coupon>[] = [
    { key: 'code', label: this.t.coupon.code, primary: true },
    {
      key: 'type',
      label: this.t.coupon.type,
      primary: true,
      exportValue: (c) => this.t.coupon.typeLabels[c.type],
    },
    // 慣例：Excel 存可計算的數字，% 只用於畫面（見 partners-page 的 discountPercent/commission 欄同款註解）。
    // 原本這裡對 percent 類型的折扣值加了 `%` 字尾，Excel 收到的是文字而非數字，
    // 財務沒辦法直接拿去做加總或公式運算，因此改回存原始數字，與 partners 對齊。
    {
      key: 'value',
      label: this.t.coupon.value,
      align: 'end',
      exportValue: (c) => c.value,
    },
    {
      key: 'minDays',
      label: this.t.coupon.minDays,
      align: 'end',
      exportValue: (c) => c.minDays ?? '-',
    },
    {
      key: 'applicableCategories',
      label: this.t.coupon.applicableCategories,
      exportValue: (c) =>
        c.applicableCategories?.length
          ? c.applicableCategories.map((k) => this.t.vehicle.typeLabels[k]).join('、')
          : this.t.common.all,
    },
    {
      key: 'period', virtual: true,
      label: `${this.t.coupon.validFrom} - ${this.t.coupon.validTo}`,
      exportValue: (c) => `${c.validFrom} ~ ${c.validTo}`,
    },
    { key: 'actions', virtual: true, label: this.t.common.actions, exportSkip: true },
  ];

  readonly selectedCoupons = signal<readonly Coupon[]>([]);

  onExportFailed(e: Error): void {
    console.error('DataTable 匯出失敗', e);
    this.snackBar.open(this.labels.exportFailedText, undefined, { duration: 3000 });
  }

  async openForm(coupon: Coupon | null): Promise<void> {
    const ref = this.dialog.open(CouponDialogComponent, { data: coupon, width: '480px' });
    const result: CouponFormResult | undefined = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    try {
      if (coupon) this.store.update(coupon.id, result);
      else this.store.create(result);
    } catch (e) {
      this.snackBar.open((e as Error).message, undefined, { duration: 3000 });
    }
  }

  async remove(coupon: Coupon): Promise<void> {
    if (!(await confirm(this.dialog, this.t.common.deleteConfirm))) return;
    try {
      this.store.remove(coupon.id);
    } catch (e) {
      this.snackBar.open((e as Error).message, undefined, { duration: 3000 });
    }
  }

  async removeSelected(coupons: readonly Coupon[]): Promise<void> {
    if (!(await confirm(this.dialog, this.t.common.deleteConfirm))) return;
    for (const coupon of coupons) {
      try {
        this.store.remove(coupon.id);
      } catch (e) {
        this.snackBar.open((e as Error).message, undefined, { duration: 3000 });
      }
    }
    this.selectedCoupons.set([]);
  }
}
