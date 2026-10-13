import { describe, it, expect, vi } from 'vitest';
import { Component, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { VehicleDetailPageComponent } from './vehicle-detail-page.component';
import { VEHICLE_REPO, ORDER_REPO, MAINTENANCE_REPO } from '../../../core/repositories/tokens';
import { createInMemoryRepo } from '../../../core/repositories/testing';
import { Vehicle, RentalOrder, MaintenanceRecord } from '../../../core/models';
import { ZH_TW } from '../../../core/i18n/zh-tw';
import { HeaderTitleSlot } from '../../../layout/header/header-title';
import { HeaderToolbarSlot } from '../../../layout/header/header-toolbar-slot';
import { VehicleFormDialogComponent, VehicleFormResult } from '../dialogs/vehicle-form-dialog.component';
import {
  MaintenanceRecordDialogComponent,
  RecordFormResult,
} from '../../maintenance/dialogs/maintenance-record-dialog.component';

function makeVehicle(partial: Partial<Vehicle>): Vehicle {
  return {
    id: partial.id ?? 'v1',
    plateNumber: 'ABC-123',
    category: 'scooter',
    model: 'Gogoro',
    brand: 'Gogoro',
    year: 2022,
    status: 'available',
    mileage: 100,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

function makeRecord(partial: Partial<MaintenanceRecord>): MaintenanceRecord {
  return {
    id: partial.id ?? 'r1',
    vehicleId: partial.vehicleId ?? 'v1',
    type: 'oil_change',
    performedAt: new Date().toISOString(),
    mileageAtService: 100,
    cost: 200,
    notes: '',
    ...partial,
  };
}

describe('VehicleDetailPageComponent', () => {
  let dialogOpen: ReturnType<typeof vi.fn>;

  function createComponent(
    routeId: string,
    vehicles: Vehicle[],
    records: MaintenanceRecord[] = [],
  ) {
    dialogOpen = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: { open: dialogOpen } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: routeId }) },
            paramMap: of(convertToParamMap({ id: routeId })),
          },
        },
        { provide: VEHICLE_REPO, useValue: createInMemoryRepo<Vehicle>(vehicles) },
        { provide: ORDER_REPO, useValue: createInMemoryRepo<RentalOrder>([]) },
        { provide: MAINTENANCE_REPO, useValue: createInMemoryRepo<MaintenanceRecord>(records) },
      ],
    });
    return TestBed.createComponent(VehicleDetailPageComponent).componentInstance;
  }

  function createFixture(routeId: string, vehicles: Vehicle[], records: MaintenanceRecord[] = []) {
    dialogOpen = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: { open: dialogOpen } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: routeId }) },
            paramMap: of(convertToParamMap({ id: routeId })),
          },
        },
        { provide: VEHICLE_REPO, useValue: createInMemoryRepo<Vehicle>(vehicles) },
        { provide: ORDER_REPO, useValue: createInMemoryRepo<RentalOrder>([]) },
        { provide: MAINTENANCE_REPO, useValue: createInMemoryRepo<MaintenanceRecord>(records) },
      ],
    });
    return TestBed.createComponent(VehicleDetailPageComponent);
  }

  it('2.1／4.5：頁首標題（HeaderTitleSlot）是車牌，麵包屑是車輛與配件 › 車輛清單；頁面自己不再渲染 h1', () => {
    const fixture = createFixture('v1', [
      makeVehicle({ id: 'v1', model: 'Gogoro 2', plateNumber: 'AAA-111' }),
    ]);
    fixture.detectChanges();

    const slot = TestBed.inject(HeaderTitleSlot);
    expect(slot.entry()?.value).toEqual({
      title: 'AAA-111',
      breadcrumbs: [{ label: ZH_TW.nav.productGroup }, { label: ZH_TW.nav.vehicles, route: '/vehicles' }],
    });
    // 4.5：群組改名後，麵包屑的字面也跟著變（群組沒有自己的頁面，不可點；車輛清單可點回列表）。
    expect(slot.entry()?.value.breadcrumbs).toEqual([
      { label: '車輛與配件' },
      { label: '車輛清單', route: '/vehicles' },
    ]);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('h1')).toHaveLength(0);
  });

  it('找不到車輛時標題退回 em dash', () => {
    const fixture = createFixture('nope', [makeVehicle({ id: 'v1', plateNumber: 'AAA-111' })]);
    fixture.detectChanges();

    expect(TestBed.inject(HeaderTitleSlot).entry()?.value.title).toBe('—');
  });

  it('依路由參數 id 解析出對應的車輛', () => {
    const component = createComponent('v2', [
      makeVehicle({ id: 'v1', plateNumber: 'AAA-111' }),
      makeVehicle({ id: 'v2', plateNumber: 'BBB-222' }),
    ]);

    expect(component.vehicleId()).toBe('v2');
    expect(component.vehicle()?.plateNumber).toBe('BBB-222');
  });

  it('只顯示該車輛的保養紀錄，其他車輛的紀錄不列入', () => {
    const component = createComponent(
      'v1',
      [makeVehicle({ id: 'v1' }), makeVehicle({ id: 'v2' })],
      [makeRecord({ id: 'r1', vehicleId: 'v1' }), makeRecord({ id: 'r2', vehicleId: 'v2' })],
    );

    expect(component.records().map((r) => r.id)).toEqual(['r1']);
  });

  it('欄位定義不含車輛欄（同頁已鎖定單一車輛，無需重複顯示）', () => {
    const component = createComponent('v1', [makeVehicle({ id: 'v1' })]);

    expect(component.columns.some((c) => c.key === 'vehicleId')).toBe(false);
  });

  it('addRecord 開啟保養紀錄對話框並預帶目前車輛 id，儲存後呼叫 store 新增紀錄', async () => {
    const component = createComponent('v1', [makeVehicle({ id: 'v1' })]);
    const result: RecordFormResult = {
      vehicleId: 'v1',
      type: 'tire',
      performedAt: new Date().toISOString(),
      mileageAtService: 300,
      cost: 500,
      notes: '',
    };
    dialogOpen.mockReturnValue({ afterClosed: () => of(result) });

    await component.addRecord();

    expect(dialogOpen).toHaveBeenCalledWith(
      MaintenanceRecordDialogComponent,
      expect.objectContaining({ data: 'v1' }),
    );
    expect(component.maintenanceStore.records()).toHaveLength(1);
    expect(component.records()).toHaveLength(1);
  });

  it('addRecord 取消對話框時不新增紀錄', async () => {
    const component = createComponent('v1', [makeVehicle({ id: 'v1' })]);
    dialogOpen.mockReturnValue({ afterClosed: () => of(undefined) });

    await component.addRecord();

    expect(component.maintenanceStore.records()).toHaveLength(0);
  });
});

/** 頁首工具列登記在 HeaderToolbarSlot、平常由 HeaderComponent 渲染；測試用一個最小的宿主把它畫出來。 */
@Component({
  imports: [NgTemplateOutlet],
  template: '<ng-container [ngTemplateOutlet]="slot.template()" />',
})
class HeaderToolbarHostComponent {
  readonly slot = inject(HeaderToolbarSlot);
}

describe('VehicleDetailPageComponent 4.7 頁首「編輯」', () => {
  const vehicle = makeVehicle({
    id: 'v1',
    plateNumber: 'AAA-111',
    model: 'Gogoro 2',
    mileage: 1000,
    branchId: 'mzg-airport',
  });

  function formResult(partial: Partial<VehicleFormResult> = {}): VehicleFormResult {
    return {
      plateNumber: 'AAA-111',
      category: 'scooter',
      model: 'Gogoro 2',
      brand: 'Gogoro',
      year: 2022,
      mileage: 1000,
      branchId: 'mzg-airport',
      ...partial,
    };
  }

  function setup(options: { vehicles?: Vehicle[]; dialogResult?: VehicleFormResult } = {}) {
    const dialogOpen = vi.fn().mockReturnValue({ afterClosed: () => of(options.dialogResult) });
    const snackBarOpen = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: MatSnackBar, useValue: { open: snackBarOpen } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: 'v1' }) },
            paramMap: of(convertToParamMap({ id: 'v1' })),
          },
        },
        { provide: VEHICLE_REPO, useValue: createInMemoryRepo<Vehicle>(options.vehicles ?? [vehicle]) },
        { provide: ORDER_REPO, useValue: createInMemoryRepo<RentalOrder>([]) },
        { provide: MAINTENANCE_REPO, useValue: createInMemoryRepo<MaintenanceRecord>([]) },
      ],
    });
    const page = TestBed.createComponent(VehicleDetailPageComponent);
    page.detectChanges();
    const host = TestBed.createComponent(HeaderToolbarHostComponent);
    host.detectChanges();
    const editButton = () =>
      (host.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.vehicle-detail__edit');
    return { page, host, editButton, dialogOpen, snackBarOpen };
  }

  it('頁首工具列有外框的「編輯」按鈕，點了開車輛表單 dialog 並帶入這台車', () => {
    const { editButton, dialogOpen } = setup();

    expect(editButton()?.textContent).toContain('編輯');
    expect(editButton()?.classList).toContain('mat-mdc-outlined-button');
    editButton()?.click();

    expect(dialogOpen).toHaveBeenCalledWith(
      VehicleFormDialogComponent,
      expect.objectContaining({ data: expect.objectContaining({ id: 'v1', plateNumber: 'AAA-111' }) }),
    );
  });

  it('存檔後頁面即時更新：頁首車牌、型號、里程、所在據點都換成新值', async () => {
    const { page, dialogOpen } = setup({
      dialogResult: formResult({ plateNumber: 'AAA-999', model: 'Gogoro 3', mileage: 1500, branchId: 'mzg-port' }),
    });

    await page.componentInstance.edit();
    page.detectChanges();

    expect(dialogOpen).toHaveBeenCalledTimes(1);
    expect(page.componentInstance.vehicle()).toEqual(
      expect.objectContaining({ plateNumber: 'AAA-999', model: 'Gogoro 3', mileage: 1500, branchId: 'mzg-port' }),
    );
    expect(TestBed.inject(HeaderTitleSlot).entry()?.value.title).toBe('AAA-999');
    const text = (page.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Gogoro 3');
    expect(text).toContain('1,500');
    expect(text).toContain('馬公港櫃檯');
  });

  it('取消 dialog 不改任何資料', async () => {
    const { page } = setup({ dialogResult: undefined });

    await page.componentInstance.edit();

    expect(page.componentInstance.vehicle()).toEqual(vehicle);
  });

  it('存不進去（車牌與別台重複）時顯示原因，資料不變', async () => {
    const other = makeVehicle({ id: 'v2', plateNumber: 'BBB-222' });
    const { page, snackBarOpen } = setup({
      vehicles: [vehicle, other],
      dialogResult: formResult({ plateNumber: 'BBB-222' }),
    });

    await page.componentInstance.edit();

    expect(snackBarOpen).toHaveBeenCalledWith(ZH_TW.vehicle.plateDuplicate, undefined, { duration: 3000 });
    expect(page.componentInstance.vehicle()?.plateNumber).toBe('AAA-111');
  });

  it('找不到車輛時頁首沒有「編輯」', () => {
    const { editButton } = setup({ vehicles: [] });

    expect(editButton()).toBeNull();
  });
});
