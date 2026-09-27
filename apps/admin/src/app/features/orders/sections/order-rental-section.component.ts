import { Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import {
  DUAL_MONTH_RANGE_PICKER_LABELS,
  DualMonthRangePickerComponent,
  DualMonthRangePickerLabels,
  SelectedDateRange,
} from '@car-rental/ui';
import { RENTAL_BRANCHES, VEHICLE_CATEGORIES, Vehicle, VehicleCategory } from '../../../core/models';
import { ZH_TW } from '../../../core/i18n/zh-tw';
import {
  OrderForm,
  orderFormValue,
  ORDER_FORM_DATA,
  OrderFormContext,
  createOrderFormDerived,
} from '@car-rental/order-form';
import { AvailableVehicleListComponent } from '../../dispatch/available-vehicle-list/available-vehicle-list.component';
import { RENTAL_AVAILABILITY } from '../../dispatch/available-vehicle-list/rental-availability';
import {
  DEFAULT_RENTAL_TIME,
  composeLocal,
  dateFromKey,
  dateKeyOf,
  rentalPeriodOf,
  timeOf,
  timeSlotsWith,
  toDateKey,
} from '../../dispatch/available-vehicle-list/rental-period';

const t = ZH_TW;

const RANGE_PICKER_LABELS: DualMonthRangePickerLabels = {
  field: t.rentalSearch.period,
  placeholder: t.rentalSearch.periodPlaceholder,
  prevMonth: t.rentalSearch.prevMonth,
  nextMonth: t.rentalSearch.nextMonth,
  monthTitle: t.rentalSearch.monthTitle,
};

function sameDay(a: Date | null, b: Date | null): boolean {
  return a === b || (!!a && !!b && a.getTime() === b.getTime());
}

/**
 * 「租期與車輛」表單區塊（2.3）：先選租期，再從這段期間可以租的車裡挑一台。
 * 搜尋列（車型、日期區間、取／還車時間、取／還車據點）選完即時更新下方的可租清單，沒有搜尋鈕。
 * 表單欄位維持 vehicleId／startLocal／endLocal（datetime-local 字串）／pickupBranchId／returnBranchId，
 * 這裡只是換一種方式寫進去，預填、送出、訂單詳情都不受影響。
 * 不依賴 stepper，可直接放進任何容器（建立訂單精靈、訂單詳情的編輯訂單）。
 */
@Component({
  selector: 'app-order-rental-section',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    DualMonthRangePickerComponent,
    AvailableVehicleListComponent,
  ],
  templateUrl: './order-rental-section.component.html',
  styleUrls: ['./order-section.scss', './order-rental-section.component.scss'],
  providers: [
    { provide: DUAL_MONTH_RANGE_PICKER_LABELS, useValue: RANGE_PICKER_LABELS },
    // 月曆（DateAdapter）只有這個元件裡的雙月日期選擇器用到：在這裡提供，不放 app.config 的根層——
    // 根層一 import @angular/material/core，整個 barrel（option、pseudo-checkbox…）就被併進 Initial bundle。
    provideNativeDateAdapter(),
  ],
})
export class OrderRentalSectionComponent {
  protected readonly t = t;
  protected readonly branches = RENTAL_BRANCHES;
  protected readonly categoryOptions = VEHICLE_CATEGORIES.map((value) => ({
    value,
    label: t.vehicle.typeLabels[value] ?? value,
  }));
  protected readonly data = inject(ORDER_FORM_DATA);
  private readonly availability = inject(RENTAL_AVAILABILITY);

  readonly form = input.required<OrderForm>();
  /** 編輯既有訂單時傳入（可租判斷與衝突檢查都排除自己）；新增訂單可省略。 */
  readonly context = input<OrderFormContext>({});

  private readonly value = orderFormValue(this.form);
  protected readonly derived = createOrderFormDerived(this.value, this.data, () => this.context());

  /** 車型篩選：只影響下方清單，不是表單欄位；空字串＝全部。 */
  protected readonly category = signal<VehicleCategory | ''>('');

  protected readonly startLocal = computed(() => this.value().rental.startLocal);
  protected readonly endLocal = computed(() => this.value().rental.endLocal);
  protected readonly pickupBranchId = computed(() => this.value().rental.pickupBranchId);
  protected readonly vehicleId = computed(() => this.value().rental.vehicleId);
  protected readonly editingBookingId = computed(() => this.context().editingBookingId);

  // ---- 日期區間＋取／還車時間 ↔ startLocal／endLocal ----

  /** 還沒選日期前先選好的時間，等選了日期再一起寫進表單。 */
  private readonly pendingStartTime = signal(DEFAULT_RENTAL_TIME);
  private readonly pendingEndTime = signal(DEFAULT_RENTAL_TIME);
  protected readonly startTime = computed(() => timeOf(this.startLocal()) || this.pendingStartTime());
  protected readonly endTime = computed(() => timeOf(this.endLocal()) || this.pendingEndTime());
  protected readonly startTimeOptions = computed(() => timeSlotsWith(this.startTime()));
  protected readonly endTimeOptions = computed(() => timeSlotsWith(this.endTime()));
  /** 給日期選擇器的起訖日：日期沒變就沿用同一個 Date，選擇器才不會在每次變更偵測時被重設。 */
  protected readonly rangeStart = computed(() => dateFromKey(dateKeyOf(this.startLocal())), { equal: sameDay });
  protected readonly rangeEnd = computed(() => dateFromKey(dateKeyOf(this.endLocal())), { equal: sameDay });

  // ---- 原本選的車 ----

  /**
   * 最近一次選定的車（使用者點選、網址帶入或既有訂單的車）。表單的 vehicleId 被清空時仍記得，
   * 用來提示「原本選的 {車牌} 這段期間不能租」，以及租期改回可以租時自動選回。換一份表單時重新開始。
   */
  private readonly wantedVehicleId = linkedSignal<{ form: OrderForm; id: string }, string>({
    source: () => ({ form: this.form(), id: this.vehicleId() }),
    computation: (source, previous) =>
      source.id || (previous && previous.source.form === source.form ? previous.value : ''),
  });

  /** 目前租期的可租判斷（與清單、月曆同一個來源）；租期還沒選齊或還車不晚於取車時為 undefined。 */
  private readonly periodAvailability = computed(() => {
    const period = rentalPeriodOf(this.startLocal(), this.endLocal());
    if (!period) return undefined;
    return this.availability.forPeriod(period.start.toISOString(), period.end.toISOString(), this.editingBookingId());
  });

  /** 原本選的車這段期間不能租時是哪一台；可以租（或還沒有租期）時為 undefined。 */
  protected readonly setAsideVehicle = computed<Vehicle | undefined>(() => {
    const id = this.wantedVehicleId();
    const availability = this.periodAvailability();
    if (!id || !availability || availability.available.some((v) => v.id === id)) return undefined;
    return this.data.vehicles().find((v) => v.id === id);
  });
  protected readonly setAsideText = computed(() => {
    const vehicle = this.setAsideVehicle();
    return vehicle ? t.rentalSearch.originalUnavailable.replace('{plate}', vehicle.plateNumber) : '';
  });

  constructor() {
    // 新增訂單：清單上看得到的選取＝表單裡的車。原本選的車這段期間不能租、或被車型篩選掉時先放下
    // （vehicleId 清空，訂單底線會擋住建立，摘要也不會顯示一台租不到的車）；租期或篩選改回來、又能租時自動選回。
    // 編輯訂單不自動換掉訂單上的車：只提示，儲存時仍由既有的時段衝突檢查把關。
    effect(() => {
      if (this.editingBookingId()) return;
      const wanted = this.wantedVehicleId();
      const availability = this.periodAvailability();
      if (!wanted || !availability) return;
      const category = this.category();
      const visible = availability.available.some((v) => v.id === wanted && (!category || v.category === category));
      const target = visible ? wanted : '';
      const control = this.form().controls.rental.controls.vehicleId;
      if (control.value !== target) control.setValue(target);
    });
  }

  protected onRangeSelected(range: SelectedDateRange): void {
    const rental = this.form().controls.rental;
    rental.patchValue({
      startLocal: composeLocal(toDateKey(range.start), this.startTime()),
      endLocal: composeLocal(toDateKey(range.end), this.endTime()),
    });
    rental.controls.startLocal.markAsDirty();
    rental.controls.endLocal.markAsDirty();
  }

  protected onStartTimeChange(time: string): void {
    this.pendingStartTime.set(time);
    this.applyTime(this.form().controls.rental.controls.startLocal, time);
  }

  protected onEndTimeChange(time: string): void {
    this.pendingEndTime.set(time);
    this.applyTime(this.form().controls.rental.controls.endLocal, time);
  }

  /** 選車：取車據點若還沒手動選過，會由表單連動（connectOrderFormBehaviors）預帶這台車的所在據點。 */
  protected pickVehicle(vehicle: Vehicle): void {
    const control = this.form().controls.rental.controls.vehicleId;
    control.setValue(vehicle.id);
    control.markAsDirty();
    control.markAsTouched();
  }

  /** 已經有日期時才改表單；還沒選日期時只記住，等選了日期再一起寫入。 */
  private applyTime(control: FormControl<string>, time: string): void {
    const date = dateKeyOf(control.value);
    if (!date) return;
    control.setValue(composeLocal(date, time));
    control.markAsDirty();
  }
}
