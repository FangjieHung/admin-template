import { Component, inject } from '@angular/core';
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
import { Partner } from '../../../core/models';
import { ZH_TW } from '../../../core/i18n/zh-tw';
import { PartnerStore } from '../../../stores/partner/partner.store';
import { confirm } from '../../../shared/dialogs/confirm-dialog.component';
import { HeaderToolbarDirective } from '../../../layout/header/header-toolbar-slot';
import { ADMIN_DATA_TABLE_LABELS } from '../../../shared/ui/data-table-labels';
import { PartnerDialogComponent, PartnerFormResult } from '../dialogs/partner-dialog.component';

@Component({
  selector: 'app-partners-page',
  imports: [
    DataTableComponent,
    DataTableCellDirective,
    MatButtonModule,
    MatTooltipModule,
    PageToolbarComponent,
    HeaderToolbarDirective,
  ],
  templateUrl: './partners-page.component.html',
  styleUrls: ['../../../app.scss'],
})
export class PartnersPageComponent {
  protected readonly t = ZH_TW;
  readonly store = inject(PartnerStore);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  readonly labels = ADMIN_DATA_TABLE_LABELS;

  readonly columns: DataTableColumn<Partner>[] = [
    { key: 'name', label: this.t.partner.name, primary: true },
    { key: 'slug', label: this.t.partner.slug, primary: true },
    // 慣例：Excel 存可計算的數字，% 只用於畫面（dtCell 負責加 %）。
    // discountPercent 沒有 exportValue 是刻意的——預設行為（取 row[key] 原始數字）已經符合這個慣例，
    // 不必再多包一層。coupons 的 value 欄位原本反其道而行（exportValue 內加了 %），已一併修正對齊。
    { key: 'discountPercent', label: this.t.partner.discountPercent, align: 'end' },
    {
      key: 'commission',
      label: this.t.partner.commissionType,
      // 畫面顯示「類型（數值）」，匯出也要帶上數值，否則 Excel 裡「拆帳方式」欄只剩類型、
      // 缺了這個欄位存在的唯一理由：實際費率。
      exportValue: (p) =>
        `${this.t.partner.commissionTypeLabels[p.commission.type]}（${p.commission.value}）`,
    },
    { key: 'actions', virtual: true, label: this.t.common.actions, exportSkip: true },
  ];

  onExportFailed(e: Error): void {
    console.error('DataTable 匯出失敗', e);
    this.snackBar.open(this.labels.exportFailedText, undefined, { duration: 3000 });
  }

  /**
   * 1.8：「退佣方式」欄補單位——百分比類型寫「10%」，固定額類型寫「每車每日 NT$100」，
   * 不能只顯示裸數字（畫面上完全看不出 10 是百分比還是固定金額）。
   */
  protected commissionValueLabel(p: Partner): string {
    return p.commission.type === 'percent'
      ? `${p.commission.value}%`
      : `${this.t.partner.commissionPerVehicleDayPrefix}${formatTwd(p.commission.value)}`;
  }

  async openForm(partner: Partner | null): Promise<void> {
    const ref = this.dialog.open(PartnerDialogComponent, { data: partner, width: '480px' });
    const result: PartnerFormResult | undefined = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    try {
      if (partner) this.store.update(partner.id, result);
      else this.store.create(result);
    } catch (e) {
      this.snackBar.open((e as Error).message, undefined, { duration: 3000 });
    }
  }

  async remove(partner: Partner): Promise<void> {
    if (!(await confirm(this.dialog, this.t.common.deleteConfirm))) return;
    try {
      this.store.remove(partner.id);
    } catch (e) {
      this.snackBar.open((e as Error).message, undefined, { duration: 3000 });
    }
  }

  async copyLink(partner: Partner): Promise<void> {
    const link = this.store.orderLink(partner);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // clipboard API 不可用時仍提示連結內容
    }
    this.snackBar.open(`${this.t.partner.linkCopied}: ${link}`, undefined, { duration: 3000 });
  }
}
