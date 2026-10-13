import { Component, computed, inject } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '@car-rental/ui';
import { branchName } from '../../../core/models';
import { ZH_TW } from '../../../core/i18n/zh-tw';
import { fmtDateTime } from '../../../core/date-utils';
import { ADMIN_DATA_TABLE_LABELS } from '../../../shared/ui/data-table-labels';
import { PrepStore } from '../../../stores/prep/prep.store';
import { VehicleStore } from '../../../stores/vehicle/vehicle.store';

/** 清單的一列：已經換成顯示用的文字（車牌、車款、據點名稱、日期時間）。 */
export interface PrepQueueRow {
  /** 整備待辦的 id（lib-data-table 以它追蹤列）。 */
  id: string;
  plate: string;
  model: string;
  returnedAt: string;
  returnBranchId: string;
  nextPickupAt: string;
  hasNextPickup: boolean;
}

/**
 * 4.3 總覽頁首「待整備」點開的清單：車牌、車款、還車時間、還車據點、該車下一次取車時間，
 * 依下一次取車排序（最急的在上面、沒有下一筆排最後——排序規則在 libs/domain 的 prepQueue）。
 * 每列「整備完成」記錄時間與操作人後，那一列就從清單消失（store 的 signal 即時更新）。
 */
@Component({
  selector: 'app-prep-queue-dialog',
  imports: [MatDialogModule, MatButtonModule, DataTableComponent, DataTableCellDirective],
  templateUrl: './prep-queue-dialog.component.html',
  styleUrls: ['./prep-queue-dialog.component.scss'],
})
export class PrepQueueDialogComponent {
  protected readonly t = ZH_TW;
  private readonly prepStore = inject(PrepStore);
  private readonly vehicleStore = inject(VehicleStore);
  readonly labels = ADMIN_DATA_TABLE_LABELS;

  readonly columns: DataTableColumn<PrepQueueRow>[] = [
    { key: 'plate', label: this.t.prep.columns.plate, primary: true },
    { key: 'model', label: this.t.prep.columns.model },
    { key: 'returnedAt', label: this.t.prep.columns.returnedAt },
    { key: 'returnBranchId', label: this.t.prep.columns.returnBranchId },
    { key: 'nextPickupAt', label: this.t.prep.columns.nextPickupAt, primary: true },
    { key: 'actions', virtual: true, label: this.t.common.actions, primary: true, exportSkip: true },
  ];

  readonly rows = computed<PrepQueueRow[]>(() => {
    const vehicles = new Map(this.vehicleStore.vehicles().map((v) => [v.id, v]));
    return this.prepStore.queue().map(({ task, nextPickup }) => {
      const vehicle = vehicles.get(task.vehicleId);
      return {
        id: task.id,
        plate: vehicle?.plateNumber ?? '—',
        model: vehicle?.model ?? '—',
        returnedAt: fmtDateTime(task.returnedAt),
        returnBranchId: branchName(task.returnBranchId),
        nextPickupAt: nextPickup ? fmtDateTime(nextPickup.startTime) : this.t.prep.noNextPickup,
        hasNextPickup: !!nextPickup,
      };
    });
  });

  completeLabel(row: PrepQueueRow): string {
    return this.t.prep.completeAriaLabel.replace('{plate}', row.plate);
  }

  /** 整備完成：操作人與既有稽核紀錄同一個來源（目前登入的後台使用者，見 handover-panel 的預設操作人）。 */
  complete(row: PrepQueueRow): void {
    this.prepStore.complete(row.id, this.t.layout.adminUser);
  }
}
