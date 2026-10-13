import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '@car-rental/ui';
import { RENTAL_BRANCHES, Vehicle, VehicleStatus, VehicleCategory, branchName } from '../../../core/models';
import { ZH_TW } from '../../../core/i18n/zh-tw';
import { fmtDateTime } from '../../../core/date-utils';
import { MileagePipe } from '../../../shared/pipes/mileage.pipe';
import { VehicleStore } from '../../../stores/vehicle/vehicle.store';
import { MaintenanceStore } from '../../../stores/maintenance/maintenance.store';
import { StatusChipComponent } from '../../../shared/chips/status-chip.component';
import { StatusKey } from '@car-rental/theme-pack';
import { confirm } from '../../../shared/dialogs/confirm-dialog.component';
import { PageToolbarComponent } from '../../../shared/ui/page-toolbar.component';
import { HeaderToolbarDirective } from '../../../layout/header/header-toolbar-slot';
import { ADMIN_DATA_TABLE_LABELS } from '../../../shared/ui/data-table-labels';
import {
  FilterOption,
  FilterSelectComponent,
} from '../../../shared/filters/filter-select.component';
import {
  VehicleFormDialogComponent,
  VehicleFormResult,
} from '../dialogs/vehicle-form-dialog.component';
import {
  MaintenanceRecordDialogComponent,
  RecordFormResult,
} from '../../maintenance/dialogs/maintenance-record-dialog.component';
import { firstValueFrom } from 'rxjs';

/** 3.6：車輛清單「據點」篩選裡「未設定」那個選項的 sentinel 值——不是真實的據點 id。 */
export const LOCATION_FILTER_UNSET = '__unset__';

const STATUS_KEY: Record<VehicleStatus, StatusKey> = {
  available: 'active',
  rented: 'processing',
  maintenance: 'inactive',
  reserved: 'warning',
};

@Component({
  selector: 'app-vehicles-page',
  imports: [
    DataTableComponent,
    DataTableCellDirective,
    MatButtonModule,
    MatTooltipModule,
    StatusChipComponent,
    PageToolbarComponent,
    FilterSelectComponent,
    HeaderToolbarDirective,
    MileagePipe,
  ],
  templateUrl: './vehicles-page.component.html',
  styleUrls: ['../../../app.scss'],
})
export class VehiclesPageComponent {
  protected readonly t = ZH_TW;
  readonly store = inject(VehicleStore);
  readonly maintenanceStore = inject(MaintenanceStore);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  readonly labels = ADMIN_DATA_TABLE_LABELS;
  readonly fmt = fmtDateTime;
  readonly branchName = branchName;

  readonly columns: DataTableColumn<Vehicle>[] = [
    { key: 'plateNumber', label: this.t.vehicle.plateNumber, primary: true },
    {
      key: 'category',
      label: this.t.vehicle.type,
      exportValue: (v) => this.t.vehicle.typeLabels[v.category],
    },
    { key: 'model', label: this.t.vehicle.model },
    {
      key: 'branchId',
      label: this.t.vehicle.branch,
      exportValue: (v) => branchName(v.branchId),
    },
    {
      key: 'status',
      label: this.t.vehicle.status,
      primary: true,
      exportValue: (v) => this.t.vehicle.statusLabels[v.status],
    },
    { key: 'mileage', label: this.t.vehicle.mileage, align: 'end' },
    { key: 'actions', virtual: true, label: this.t.common.actions, exportSkip: true },
  ];

  readonly searchQuery = signal('');
  readonly typeFilter = signal<VehicleCategory | null>(null);
  readonly statusFilter = signal<VehicleStatus | null>(null);
  readonly locationFilter = signal<string | null>(null);
  readonly selectedVehicles = signal<readonly Vehicle[]>([]);
  // 1.4：總覽「待保養 N」帶 ?maintenance=due 進來，只顯示有保養警示（逾期或即將到期）的車。
  readonly maintenanceOnlyFilter = signal(this.route.snapshot.queryParamMap.get('maintenance') === 'due');

  readonly typeOptions: FilterOption<VehicleCategory>[] = (
    Object.entries(this.t.vehicle.typeLabels) as [VehicleCategory, string][]
  ).map(([value, label]) => ({ value, label }));

  readonly statusOptions: FilterOption<VehicleStatus>[] = (
    Object.entries(this.t.vehicle.statusLabels) as [VehicleStatus, string][]
  ).map(([value, label]) => ({ value, label }));

  // 3.6：「據點」篩選＝全部（FilterSelectComponent 內建）／各據點／未設定（LOCATION_FILTER_UNSET）。
  readonly locationOptions: FilterOption<string>[] = [
    ...RENTAL_BRANCHES.map((b) => ({ value: b.id, label: b.name })),
    { value: LOCATION_FILTER_UNSET, label: this.t.vehicle.locationFilterUnset },
  ];

  readonly activeFilterCount = computed(() => {
    return (
      (this.typeFilter() ? 1 : 0) + (this.statusFilter() ? 1 : 0) + (this.locationFilter() ? 1 : 0)
    );
  });

  readonly filteredVehicles = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const type = this.typeFilter();
    const status = this.statusFilter();
    const branchId = this.locationFilter();
    const maintenanceOnly = this.maintenanceOnlyFilter();
    return this.store.vehicles().filter((v) => {
      if (type && v.category !== type) return false;
      if (status && v.status !== status) return false;
      if (branchId === LOCATION_FILTER_UNSET && v.branchId) return false;
      if (branchId && branchId !== LOCATION_FILTER_UNSET && v.branchId !== branchId) return false;
      if (maintenanceOnly && !this.hasOverdueAlert(v) && !this.hasUpcomingAlert(v)) return false;
      if (
        query &&
        !v.plateNumber.toLowerCase().includes(query) &&
        !v.model.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  });

  /** 逾期提醒的車輛釘選最前，即將到期次之，其餘維持原順序（sort 為 spec-stable） */
  readonly displayVehicles = computed(() => {
    const rank = (v: Vehicle) => (this.hasOverdueAlert(v) ? 2 : this.hasUpcomingAlert(v) ? 1 : 0);
    return [...this.filteredVehicles()].sort((a, b) => rank(b) - rank(a));
  });

  private alertsFor(vehicleId: string) {
    return this.maintenanceStore.alerts().filter((a) => a.vehicleId === vehicleId);
  }

  hasOverdueAlert(v: Vehicle): boolean {
    return this.alertsFor(v.id).some((a) => a.status === 'overdue');
  }

  hasUpcomingAlert(v: Vehicle): boolean {
    return this.alertsFor(v.id).some((a) => a.status === 'upcoming');
  }

  readonly rowClassOf = (v: Vehicle): string =>
    this.hasOverdueAlert(v) ? 'dt-row--danger' : this.hasUpcomingAlert(v) ? 'dt-row--warning' : '';

  onRowClick(v: Vehicle): void {
    this.router.navigate(this.vehicleDetailLink(v.id));
  }

  clearFilters(): void {
    this.typeFilter.set(null);
    this.statusFilter.set(null);
    this.locationFilter.set(null);
  }

  /** 移除「只看待保養」篩選標籤；同時把網址上的 maintenance 參數清掉，避免重新整理又跳回來。 */
  clearMaintenanceOnlyFilter(): void {
    this.maintenanceOnlyFilter.set(false);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { maintenance: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  statusKeyOf(v: Vehicle): StatusKey {
    return STATUS_KEY[v.status];
  }

  onExportFailed(e: Error): void {
    console.error('DataTable 匯出失敗', e);
    this.snackBar.open(this.labels.exportFailedText, undefined, { duration: 3000 });
  }

  async openForm(vehicle: Vehicle | null): Promise<void> {
    const ref = this.dialog.open(VehicleFormDialogComponent, { data: vehicle, width: '400px' });
    const result: VehicleFormResult | undefined = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    try {
      if (vehicle) this.store.update(vehicle.id, result);
      else this.store.create(result);
    } catch (e) {
      this.snackBar.open((e as Error).message, undefined, { duration: 3000 });
    }
  }

  async remove(vehicle: Vehicle): Promise<void> {
    if (!(await confirm(this.dialog, this.t.common.deleteConfirm))) return;
    try {
      this.store.remove(vehicle.id);
    } catch (e) {
      this.snackBar.open((e as Error).message, undefined, { duration: 3000 });
    }
  }

  async removeSelected(vehicles: readonly Vehicle[]): Promise<void> {
    if (!(await confirm(this.dialog, this.t.common.deleteConfirm))) return;
    for (const vehicle of vehicles) {
      try {
        this.store.remove(vehicle.id);
      } catch (e) {
        this.snackBar.open((e as Error).message, undefined, { duration: 3000 });
      }
    }
    this.selectedVehicles.set([]);
  }

  plateOf(id: string): string {
    return this.store.vehicles().find((v) => v.id === id)?.plateNumber ?? '—';
  }

  vehicleDetailLink(vehicleId: string): string[] {
    return ['/vehicles', vehicleId];
  }

  send(v: Vehicle): void {
    try {
      this.maintenanceStore.sendToMaintenance(v.id);
    } catch (e) {
      this.snackBar.open((e as Error).message, undefined, { duration: 3000 });
    }
  }

  async completeFix(v: Vehicle): Promise<void> {
    const ref = this.dialog.open(MaintenanceRecordDialogComponent, { data: v.id, width: '420px' });
    const result: RecordFormResult | undefined = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    try {
      this.maintenanceStore.completeMaintenance(v.id, result);
    } catch (e) {
      this.snackBar.open((e as Error).message, undefined, { duration: 3000 });
    }
  }
}
