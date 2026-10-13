import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '@car-rental/ui';
import { PricingPlan } from '../../../core/models';
import { ZH_TW } from '../../../core/i18n/zh-tw';
import { TwdPipe } from '../../../shared/pipes/twd.pipe';
import { PricingStore } from '../../../stores/pricing/pricing.store';
import { confirm } from '../../../shared/dialogs/confirm-dialog.component';
import { PageToolbarComponent } from '../../../shared/ui/page-toolbar.component';
import { HeaderToolbarDirective } from '../../../layout/header/header-toolbar-slot';
import { ADMIN_DATA_TABLE_LABELS } from '../../../shared/ui/data-table-labels';
import {
  PricingPlanDialogComponent,
  PricingPlanFormResult,
} from '../dialogs/pricing-plan-dialog.component';

@Component({
  selector: 'app-pricing-page',
  imports: [
    DataTableComponent,
    DataTableCellDirective,
    MatButtonModule,
    MatTooltipModule,
    PageToolbarComponent,
    HeaderToolbarDirective,
    TwdPipe,
  ],
  templateUrl: './pricing-page.component.html',
  styleUrls: ['../../../app.scss'],
})
export class PricingPageComponent {
  protected readonly t = ZH_TW;
  readonly store = inject(PricingStore);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  readonly labels = ADMIN_DATA_TABLE_LABELS;

  readonly columns: DataTableColumn<PricingPlan>[] = [
    { key: 'name', label: this.t.pricing.name, primary: true },
    {
      key: 'appliesToCategory',
      label: this.t.pricing.appliesToCategory,
      primary: true,
      exportValue: (p) => this.t.vehicle.typeLabels[p.appliesToCategory],
    },
    { key: 'weekday', virtual: true, label: this.t.pricing.weekday, align: 'end', exportValue: (p) => p.dayTypeRates.weekday },
    { key: 'weekend', virtual: true, label: this.t.pricing.weekend, align: 'end', exportValue: (p) => p.dayTypeRates.weekend },
    { key: 'holiday', virtual: true, label: this.t.pricing.holiday, align: 'end', exportValue: (p) => p.dayTypeRates.holiday },
    { key: 'peak', virtual: true, label: this.t.pricing.peak, align: 'end', exportValue: (p) => p.dayTypeRates.peak },
    { key: 'tiers', label: this.t.pricing.tiers, exportValue: (p) => this.tiersSummary(p) },
    { key: 'actions', virtual: true, label: this.t.common.actions, exportSkip: true },
  ];

  onExportFailed(e: Error): void {
    console.error('DataTable 匯出失敗', e);
    this.snackBar.open(this.labels.exportFailedText, undefined, { duration: 3000 });
  }

  async openForm(plan: PricingPlan | null): Promise<void> {
    const ref = this.dialog.open(PricingPlanDialogComponent, { data: plan, width: '480px' });
    const result: PricingPlanFormResult | undefined = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    try {
      if (plan) this.store.updatePlan(plan.id, result);
      else this.store.createPlan(result);
    } catch (e) {
      this.snackBar.open((e as Error).message, undefined, { duration: 3000 });
    }
  }

  async remove(plan: PricingPlan): Promise<void> {
    if (!(await confirm(this.dialog, this.t.common.deleteConfirm))) return;
    try {
      this.store.removePlan(plan.id);
    } catch (e) {
      this.snackBar.open((e as Error).message, undefined, { duration: 3000 });
    }
  }

  tiersSummary(plan: PricingPlan): string {
    if (plan.tiers.length === 0) return this.t.common.empty;
    return plan.tiers.map((tier) => `滿${tier.minDays}天 -${tier.discountPercent}%`).join('、');
  }
}
