import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  DUAL_MONTH_RANGE_PICKER_LABELS,
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  DualMonthRangePickerComponent,
  DualMonthRangePickerLabels,
  SelectedDateRange,
} from '@car-rental/ui';
import { OrderStatus, RentalOrder } from '../../../core/models';
import { ZH_TW } from '../../../core/i18n/zh-tw';
import { addDays, fmtDateTime, startOfDay, startOfWeek } from '../../../core/date-utils';
import { OrderStore } from '../../../stores/order/order.store';
import { VehicleStore } from '../../../stores/vehicle/vehicle.store';
import { MemberStore } from '../../../stores/member/member.store';
import { PaymentStore } from '../../../stores/payment/payment.store';
import { OperatorRecoveryStore } from '../../../stores/operator-recovery/operator-recovery.store';
import { StatusChipComponent } from '../../../shared/chips/status-chip.component';
import { ORDER_STATUS_KEY } from '../../../shared/chips/order-status-key';
import { StatusKey } from '@car-rental/theme-pack';
import { PageToolbarComponent } from '../../../shared/ui/page-toolbar.component';
import { HeaderToolbarDirective } from '../../../layout/header/header-toolbar-slot';
import { ADMIN_DATA_TABLE_LABELS } from '../../../shared/ui/data-table-labels';
import {
  FilterOption,
  FilterSelectComponent,
} from '../../../shared/filters/filter-select.component';
import { OrderDetailNavigation } from '../../orders/navigation/order-detail-navigation';
import { OrderDetailSection } from '../../orders/navigation/order-detail-sections';
import { OrderIncompleteItem } from '../../orders/incomplete/order-incomplete';
import { OrderIncompleteService } from '../../orders/incomplete/order-incomplete.service';
import {
  hasRefundPending,
  hasUrgentOperatorRecovery,
  isOverdueReturn,
  isUrgent,
} from '../order-urgency';

/** 4.1：「待補」篩選只有一個選項（只看有待補）；沒選＝全部。 */
export type IncompleteFilter = 'has';

/** 4.4：取車日期篩選。 */
export const PICKUP_DATE_FILTERS = ['today', 'week', 'custom'] as const;
export type PickupDateFilter = (typeof PICKUP_DATE_FILTERS)[number];

/**
 * 取車日期篩選對應的區間 [from, to)（本地時間）：今天；本週＝週日起算 7 天（與總覽月曆、時間軸同一個慣例）；
 * 自訂區間＝起日 00:00 到迄日隔天 00:00（含迄日整天）。自訂區間還沒選日期時為 null（不篩）。
 */
export function pickupDateRange(
  filter: PickupDateFilter | null,
  custom: SelectedDateRange | null,
  now: Date,
): { from: Date; to: Date } | null {
  switch (filter) {
    case 'today': {
      const from = startOfDay(now);
      return { from, to: addDays(from, 1) };
    }
    case 'week': {
      const from = startOfWeek(now);
      return { from, to: addDays(from, 7) };
    }
    case 'custom':
      return custom ? { from: startOfDay(custom.start), to: addDays(startOfDay(custom.end), 1) } : null;
    default:
      return null;
  }
}

const RANGE_PICKER_LABELS: DualMonthRangePickerLabels = {
  field: ZH_TW.order.pickupRange,
  placeholder: ZH_TW.order.pickupRangePlaceholder,
  prevMonth: ZH_TW.rentalSearch.prevMonth,
  nextMonth: ZH_TW.rentalSearch.nextMonth,
  monthTitle: ZH_TW.rentalSearch.monthTitle,
};

/** 1.4：電話比對前先去掉空白與連字號，讓「0912-345-678」與「0912 345 678」都比對得到。 */
function stripPhoneSeparators(value: string): string {
  return value.replace(/[\s-]/g, '');
}

@Component({
  selector: 'app-orders-page',
  imports: [
    DataTableComponent,
    DataTableCellDirective,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    RouterLink,
    StatusChipComponent,
    PageToolbarComponent,
    FilterSelectComponent,
    HeaderToolbarDirective,
    DualMonthRangePickerComponent,
  ],
  templateUrl: './orders-page.component.html',
  styleUrls: ['../../../app.scss', './orders-page.component.scss'],
  providers: [
    { provide: DUAL_MONTH_RANGE_PICKER_LABELS, useValue: RANGE_PICKER_LABELS },
    // 月曆（DateAdapter）只有這個元件裡的雙月日期選擇器用到：在這裡提供，不放 app.config 的根層——
    // 根層一 import @angular/material/core，整個 barrel（option、pseudo-checkbox…）就被併進 Initial bundle。
    provideNativeDateAdapter(),
    // 篩選列在頁首：自訂區間的日期欄位與其他篩選一樣不保留錯誤訊息的空間（見 filter-select）。
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { subscriptSizing: 'dynamic' } },
  ],
})
export class OrdersPageComponent {
  protected readonly t = ZH_TW;
  readonly store = inject(OrderStore);
  readonly memberStore = inject(MemberStore);
  private vehicleStore = inject(VehicleStore);
  private snackBar = inject(MatSnackBar);
  private orderDetail = inject(OrderDetailNavigation);
  private readonly paymentStore = inject(PaymentStore);
  private readonly operatorRecoveryStore = inject(OperatorRecoveryStore);
  private readonly incomplete = inject(OrderIncompleteService);
  private readonly route = inject(ActivatedRoute);
  readonly fmt = fmtDateTime;

  readonly labels = { ...ADMIN_DATA_TABLE_LABELS, batchDelete: this.t.order.cancelOrder };

  readonly columns: DataTableColumn<RentalOrder>[] = [
    {
      key: 'vehicleId',
      label: this.t.order.vehicle,
      primary: true,
      exportValue: (b) => this.plateOf(b.vehicleId),
    },
    {
      key: 'memberId',
      label: this.t.order.member,
      primary: true,
      exportValue: (b) => this.memberStore.nameOf(b.memberId),
    },
    { key: 'startTime', label: this.t.order.startTime, exportValue: (b) => this.fmt(b.startTime) },
    { key: 'endTime', label: this.t.order.endTime, exportValue: (b) => this.fmt(b.endTime) },
    {
      key: 'status',
      label: this.t.order.status,
      primary: true,
      exportValue: (b) => this.t.order.statusLabels[b.status],
    },
    // 4.1：待補項數（數字徽章，0 不顯示）；規則與訂單詳情的待補卡同一套。
    { key: 'incomplete', virtual: true, label: this.t.order.incomplete, exportValue: (b) => this.incompleteOf(b).length },
    { key: 'actions', virtual: true, label: this.t.common.actions, exportSkip: true },
  ];

  onExportFailed(e: Error): void {
    console.error('DataTable 匯出失敗', e);
    this.snackBar.open(this.labels.exportFailedText, undefined, { duration: 3000 });
  }

  // 1.4：總覽的放大鏡送出後導到 /orders?q=關鍵字，這裡預填搜尋框。
  readonly searchQuery = signal(this.route.snapshot.queryParamMap.get('q') ?? '');
  readonly statusFilter = signal<OrderStatus | null>(null);
  readonly incompleteFilter = signal<IncompleteFilter | null>(null);
  readonly pickupDateFilter = signal<PickupDateFilter | null>(null);
  /** 「自訂區間」選的起訖日；選別的篩選時保留，切回自訂區間不用重選。 */
  readonly pickupRange = signal<SelectedDateRange | null>(null);
  readonly selectedBookings = signal<readonly RentalOrder[]>([]);

  readonly statusOptions: FilterOption<OrderStatus>[] = (
    Object.entries(this.t.order.statusLabels) as [OrderStatus, string][]
  ).map(([value, label]) => ({ value, label }));
  readonly incompleteOptions: FilterOption<IncompleteFilter>[] = [{ value: 'has', label: this.t.order.incompleteOnly }];
  readonly pickupDateOptions: FilterOption<PickupDateFilter>[] = PICKUP_DATE_FILTERS.map((value) => ({
    value,
    label: this.t.order.pickupDateLabels[value],
  }));

  readonly activeFilterCount = computed(
    () => [this.statusFilter(), this.pickupDateFilter(), this.incompleteFilter()].filter((f) => f !== null).length,
  );

  /** 每筆訂單的待補項目（已取消、已完成的訂單不計，為空陣列）。 */
  private readonly incompleteByBooking = computed(
    () => new Map(this.store.orders().map((b) => [b.id, this.incomplete.itemsFor(b)] as const)),
  );

  readonly filteredBookings = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    // 1.4：搜尋除姓名、車牌外也比對電話；比對前雙方都先去掉空白與連字號，
    // 「0912-345-678」「0912 345 678」「0912345678」都要比對得到。
    const normalizedPhoneQuery = stripPhoneSeparators(query);
    const status = this.statusFilter();
    const onlyIncomplete = this.incompleteFilter() === 'has';
    const pickupRange = pickupDateRange(this.pickupDateFilter(), this.pickupRange(), new Date());
    const filtered = this.store.orders().filter((b) => {
      if (status && b.status !== status) return false;
      if (pickupRange) {
        const pickupAt = new Date(b.startTime).getTime();
        if (pickupAt < pickupRange.from.getTime() || pickupAt >= pickupRange.to.getTime()) return false;
      }
      if (onlyIncomplete && this.incompleteOf(b).length === 0) return false;
      if (query) {
        const memberName = this.memberStore.nameOf(b.memberId).toLowerCase();
        const plate = this.plateOf(b.vehicleId).toLowerCase();
        const phone = stripPhoneSeparators(this.phoneOf(b.memberId).toLowerCase());
        const matchesPhone = normalizedPhoneQuery.length > 0 && phone.includes(normalizedPhoneQuery);
        if (!memberName.includes(query) && !plate.includes(query) && !matchesPhone) return false;
      }
      return true;
    });
    // 急迫項目（逾時未還／退款待處理／業者復原處理中）排在一般列之前；Array.prototype.sort
    // 是穩定排序，同一急迫層級內仍維持原本（依訂單載入順序）的相對順序。
    return [...filtered].sort((a, b) => Number(this.isUrgent(b)) - Number(this.isUrgent(a)));
  });

  clearFilters(): void {
    this.statusFilter.set(null);
    this.pickupDateFilter.set(null);
    this.pickupRange.set(null);
    this.incompleteFilter.set(null);
  }

  incompleteOf(b: RentalOrder): OrderIncompleteItem[] {
    return this.incompleteByBooking().get(b.id) ?? [];
  }

  /** 待補徽章的提示：列出每一項（「、」隔開）。 */
  incompleteSummary(b: RentalOrder): string {
    return this.incompleteOf(b)
      .map((item) => item.label)
      .join('、');
  }

  incompleteCountLabel(b: RentalOrder): string {
    return this.t.order.incompleteCount.replace('{count}', String(this.incompleteOf(b).length));
  }

  plateOf(vehicleId: string): string {
    return this.vehicleStore.vehicles().find((v) => v.id === vehicleId)?.plateNumber ?? '—';
  }

  private phoneOf(memberId: string): string {
    return this.memberStore.members().find((m) => m.id === memberId)?.phone ?? '';
  }

  statusKeyOf(b: RentalOrder): StatusKey {
    return ORDER_STATUS_KEY[b.status];
  }

  // ---------------------------------------------------------------------
  // 急迫指標：逾時未還、退款待處理、業者復原處理中——每一項在畫面上都要有 icon + 文字 +
  // 動作（不能只靠顏色），點擊一律導向同一個訂單詳情的對應分頁，不在清單裡另做判斷邏輯。
  // 判斷邏輯本身抽到 order-urgency.ts，與訂單詳情標題旁的急迫狀態共用、不重寫。
  // ---------------------------------------------------------------------

  isOverdueReturn(b: RentalOrder): boolean {
    return isOverdueReturn(b);
  }

  hasRefundPending(b: RentalOrder): boolean {
    return hasRefundPending(b, this.paymentStore);
  }

  hasUrgentOperatorRecovery(b: RentalOrder): boolean {
    return hasUrgentOperatorRecovery(b, this.operatorRecoveryStore);
  }

  isUrgent(b: RentalOrder): boolean {
    return isUrgent(b, this.paymentStore, this.operatorRecoveryStore);
  }

  goUrgent(b: RentalOrder, section: OrderDetailSection): void {
    void this.orderDetail.open(b.id, section);
  }

  /** 「辦理取車」「辦理還車」快捷操作一律開同一個訂單詳情的交還車分頁，不再繞過就緒判斷
   *  與稽核紀錄直接呼叫 OrderStore.pickUp()/complete()——那兩個方法本身仍是狀態機把關者，
   *  但完整流程（含就緒判斷、主管覆核、費用試算與稽核）只在 HandoverPanelComponent 裡走一次。 */
  handoverAction(b: RentalOrder): void {
    void this.orderDetail.open(b.id, 'handover');
  }

  /** 「取消訂單」開同一個訂單詳情的取消分頁（含責任歸屬、試算、退款／保留金撥付的完整
   *  流程），不再是清單裡一個 confirm() 就直接呼叫 OrderStore.cancel() 的簡化版本。 */
  cancelAction(b: RentalOrder): void {
    void this.orderDetail.open(b.id, 'cancellation');
  }

  /** 開訂單詳情：整列點擊（4.4）與列內的「訂單詳情」按鈕都走這裡。 */
  openDetail(order: RentalOrder): void {
    void this.orderDetail.open(order.id);
  }

  /** 編輯訂單：開啟訂單詳情並直接進入總覽的編輯狀態。 */
  editOrder(order: RentalOrder): void {
    void this.orderDetail.edit(order.id);
  }
}
