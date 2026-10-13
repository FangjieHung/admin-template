import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { OrdersPageComponent, pickupDateRange } from './orders-page.component';
import { HeaderToolbarSlot } from '../../../layout/header/header-toolbar-slot';
import {
  AUDIT_ENTRY_REPO,
  CANCELLATION_CASE_REPO,
  CHARGE_ADJUSTMENT_REPO,
  CONTRACT_VERSION_REPO,
  CUSTOMER_CREDIT_LEDGER_REPO,
  OPERATOR_RECOVERY_CASE_REPO,
  PAYMENT_REPO,
  REFUND_REPO,
  REMINDER_STATUS_REPO,
  VEHICLE_REPO,
  ORDER_REPO,
  MEMBER_REPO,
  MAINTENANCE_REPO,
  IDENTITY_DOCUMENT_REPO,
  DRIVER_CREDENTIAL_REPO,
} from '../../../core/repositories/tokens';
import { createInMemoryRepo } from '../../../core/repositories/testing';
import { ReminderGateway } from '../../../core/services/reminder.gateway';
import { OcrGateway } from '../../../core/services/ocr.gateway';
import { MockOcrGateway } from '../../../core/services/mock-ocr.gateway';
import { DriverEligibilityGateway } from '../../../core/services/driver-eligibility.gateway';
import { MockDriverEligibilityGateway } from '../../../core/services/mock-driver-eligibility.gateway';
import {
  AuditEntry,
  CancellationCase,
  ChargeAdjustment,
  ContractVersion,
  CustomerCreditLedgerEntry,
  DriverCredential,
  IdentityDocument,
  Vehicle,
  RentalOrder,
  Member,
  MaintenanceRecord,
  OperatorRecoveryCase,
  PaymentRecord,
  RefundRecord,
  ReminderStatus,
} from '../../../core/models';
import { OrderDetailNavigation } from '../../orders/navigation/order-detail-navigation';
import { ZH_TW } from '../../../core/i18n/zh-tw';

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

function makeBooking(partial: Partial<RentalOrder>): RentalOrder {
  return {
    id: partial.id ?? 'b1',
    vehicleId: 'v1',
    memberId: 'c1',
    startTime: new Date(2026, 7, 1, 9).toISOString(),
    endTime: new Date(2026, 7, 3, 9).toISOString(),
    pickupBranchId: '馬公',
    returnBranchId: '馬公',
    status: 'reserved',
    depositRequired: 0,
    ...partial,
  };
}

/**
 * OrdersPageComponent（Task 16）新增了急迫指標所需的 PaymentStore／OperatorRecoveryStore，
 * 後者又轉引出 ContractStore／CancellationStore／CreditStore，DI 圖因此拉得很深——
 * 即使測試不呼叫相關方法，元件建構時仍會整串解析，缺一個 provider 測試就整個炸掉。
 */
function provideOrderDetailRepos(options: {
  refunds?: RefundRecord[];
  operatorRecoveryCases?: OperatorRecoveryCase[];
  payments?: PaymentRecord[];
  contracts?: ContractVersion[];
  identityDocuments?: IdentityDocument[];
  driverCredentials?: DriverCredential[];
} = {}) {
  return [
    // 4.1：待補欄讀會員的證件紀錄（DocumentStore）。
    { provide: IDENTITY_DOCUMENT_REPO, useValue: createInMemoryRepo<IdentityDocument>(options.identityDocuments ?? []) },
    { provide: DRIVER_CREDENTIAL_REPO, useValue: createInMemoryRepo<DriverCredential>(options.driverCredentials ?? []) },
    MockOcrGateway,
    { provide: OcrGateway, useExisting: MockOcrGateway },
    MockDriverEligibilityGateway,
    { provide: DriverEligibilityGateway, useExisting: MockDriverEligibilityGateway },
    { provide: PAYMENT_REPO, useValue: createInMemoryRepo<PaymentRecord>(options.payments ?? []) },
    { provide: REFUND_REPO, useValue: createInMemoryRepo<RefundRecord>(options.refunds ?? []) },
    { provide: CHARGE_ADJUSTMENT_REPO, useValue: createInMemoryRepo<ChargeAdjustment>([]) },
    { provide: CONTRACT_VERSION_REPO, useValue: createInMemoryRepo<ContractVersion>(options.contracts ?? []) },
    { provide: CANCELLATION_CASE_REPO, useValue: createInMemoryRepo<CancellationCase>([]) },
    { provide: CUSTOMER_CREDIT_LEDGER_REPO, useValue: createInMemoryRepo<CustomerCreditLedgerEntry>([]) },
    { provide: AUDIT_ENTRY_REPO, useValue: createInMemoryRepo<AuditEntry>([]) },
    {
      provide: OPERATOR_RECOVERY_CASE_REPO,
      useValue: createInMemoryRepo<OperatorRecoveryCase>(options.operatorRecoveryCases ?? []),
    },
    { provide: REMINDER_STATUS_REPO, useValue: createInMemoryRepo<ReminderStatus>([]) },
    {
      provide: ReminderGateway,
      useValue: { schedule: async () => ({ state: 'scheduled' as const }), cancel: async () => undefined },
    },
  ];
}

describe('OrdersPageComponent filtering', () => {
  let component: OrdersPageComponent;
  let workspaceOpen: ReturnType<typeof vi.fn>;
  let workspaceEdit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    workspaceOpen = vi.fn();
    workspaceEdit = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ...provideOrderDetailRepos(),
        { provide: OrderDetailNavigation, useValue: { open: workspaceOpen, edit: workspaceEdit } },
        {
          provide: VEHICLE_REPO,
          useValue: createInMemoryRepo<Vehicle>([
            makeVehicle({ id: 'v1', plateNumber: 'ABC-123' }),
            makeVehicle({ id: 'v2', plateNumber: 'XYZ-999' }),
          ]),
        },
        {
          provide: MEMBER_REPO,
          useValue: createInMemoryRepo<Member>([
            { id: 'c1', name: '王小明', phone: '0912000111', kind: 'local' },
            { id: 'c2', name: '陳大文', phone: '0922000222', kind: 'local' },
          ]),
        },
        {
          provide: ORDER_REPO,
          useValue: createInMemoryRepo<RentalOrder>([
            makeBooking({ id: 'b1', vehicleId: 'v1', memberId: 'c1', status: 'reserved' }),
            makeBooking({ id: 'b2', vehicleId: 'v2', memberId: 'c2', status: 'in_progress' }),
            makeBooking({ id: 'b3', vehicleId: 'v1', memberId: 'c2', status: 'cancelled' }),
          ]),
        },
        { provide: MAINTENANCE_REPO, useValue: createInMemoryRepo<MaintenanceRecord>([]) },
      ],
    });
    component = TestBed.createComponent(OrdersPageComponent).componentInstance;
  });

  it('沒有任何篩選時顯示全部', () => {
    expect(component.filteredBookings()).toHaveLength(3);
  });

  it('依會員姓名搜尋', () => {
    component.searchQuery.set('王小明');
    expect(component.filteredBookings().map((b) => b.id)).toEqual(['b1']);
  });

  it('依車牌搜尋（不分大小寫）', () => {
    component.searchQuery.set('xyz');
    expect(component.filteredBookings().map((b) => b.id)).toEqual(['b2']);
  });

  // 1.4：搜尋除姓名、車牌外也比對電話；比對前雙方都先去掉空白與連字號。
  it('依電話搜尋（c1 電話為 0912000111）', () => {
    component.searchQuery.set('0912000111');
    expect(component.filteredBookings().map((b) => b.id)).toEqual(['b1']);
  });

  it('搜尋關鍵字帶連字號或空白時，去掉分隔符號後仍比對得到（查詢端正規化）', () => {
    component.searchQuery.set('0912-000 111');
    expect(component.filteredBookings().map((b) => b.id)).toEqual(['b1']);
  });

  it('會員電話本身帶連字號時，去掉分隔符號後仍比對得到（資料端正規化）', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ...provideOrderDetailRepos(),
        { provide: OrderDetailNavigation, useValue: { open: vi.fn(), edit: vi.fn() } },
        { provide: VEHICLE_REPO, useValue: createInMemoryRepo<Vehicle>([makeVehicle({ id: 'v1' })]) },
        {
          provide: MEMBER_REPO,
          useValue: createInMemoryRepo<Member>([
            { id: 'c1', name: '王小明', phone: '0912-345-678', kind: 'local' },
          ]),
        },
        {
          provide: ORDER_REPO,
          useValue: createInMemoryRepo<RentalOrder>([makeBooking({ id: 'b1', memberId: 'c1' })]),
        },
        { provide: MAINTENANCE_REPO, useValue: createInMemoryRepo<MaintenanceRecord>([]) },
      ],
    });
    const hyphenatedComponent = TestBed.createComponent(OrdersPageComponent).componentInstance;

    hyphenatedComponent.searchQuery.set('0912345678');

    expect(hyphenatedComponent.filteredBookings().map((b) => b.id)).toEqual(['b1']);
  });

  it('依電話局部關鍵字搜尋（不必是開頭片段）', () => {
    // '000111' 是 c1 電話 0912000111 中段的子字串，且不包含在 c2 的 0922000222 裡。
    component.searchQuery.set('000111');
    expect(component.filteredBookings().map((b) => b.id)).toEqual(['b1']);
  });

  it('依訂單狀態篩選', () => {
    component.statusFilter.set('cancelled');
    expect(component.filteredBookings().map((b) => b.id)).toEqual(['b3']);
  });

  it('搜尋與篩選可同時套用', () => {
    component.searchQuery.set('陳大文');
    component.statusFilter.set('cancelled');
    expect(component.filteredBookings().map((b) => b.id)).toEqual(['b3']);
  });

  it('clearFilters 只清除篩選，不清除搜尋文字', () => {
    component.searchQuery.set('王小明');
    component.statusFilter.set('reserved');
    component.clearFilters();
    expect(component.statusFilter()).toBeNull();
    expect(component.searchQuery()).toBe('王小明');
  });

  it('openDetail 呼叫 OrderDetailNavigation.open，帶上該筆訂單 id', () => {
    component.openDetail(makeBooking({ id: 'b2', vehicleId: 'v2', memberId: 'c2' }));

    expect(workspaceOpen).toHaveBeenCalledWith('b2');
  });

  it('editOrder 開啟訂單詳情並直接進入編輯（OrderDetailNavigation.edit）', () => {
    component.editOrder(makeBooking({ id: 'b1' }));

    expect(workspaceEdit).toHaveBeenCalledWith('b1');
  });

  it('handoverAction／cancelAction 都開同一個訂單詳情的對應分頁，不直接呼叫 OrderStore', () => {
    const order = makeBooking({ id: 'b1' });

    component.handoverAction(order);
    expect(workspaceOpen).toHaveBeenLastCalledWith('b1', 'handover');

    component.cancelAction(order);
    expect(workspaceOpen).toHaveBeenLastCalledWith('b1', 'cancellation');
  });
});

describe('OrdersPageComponent 急迫指標與排序', () => {
  const NOW = new Date(2026, 7, 10, 12, 0, 0);

  function setup() {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const workspaceOpen = vi.fn();
    const workspaceEdit = vi.fn();
    // ordinary：一般 reserved 訂單，無任何急迫條件。
    const ordinary = makeBooking({ id: 'ordinary', status: 'reserved' });
    // overdueReturn：in_progress 且還車時間已過，屬於逾時未還。
    const overdueReturn = makeBooking({
      id: 'overdue-return',
      status: 'in_progress',
      endTime: new Date(2026, 7, 10, 9).toISOString(),
    });
    // refundPending：cancelled 訂單，有一筆狀態 pending 的退款紀錄。
    const refundPending = makeBooking({ id: 'refund-pending', status: 'cancelled' });
    // recovering：reserved 訂單，有一筆 in_progress 的業者復原案件。
    const recovering = makeBooking({ id: 'recovering', status: 'reserved' });

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ...provideOrderDetailRepos({
          refunds: [
            {
              id: 'r1', bookingId: 'refund-pending', amount: 500, method: 'cash',
              status: 'pending', handledBy: '',
            },
          ],
          operatorRecoveryCases: [
            {
              id: 'orc1', bookingId: 'recovering', reason: 'vehicle_breakdown',
              discoveredAt: '', notifiedAt: '', status: 'in_progress', remedyAttempts: [],
              taxiReimbursements: [], goodwillCompensations: [], createdBy: '', createdAt: '', updatedAt: '',
            },
          ],
        }),
        { provide: OrderDetailNavigation, useValue: { open: workspaceOpen, edit: workspaceEdit } },
        { provide: VEHICLE_REPO, useValue: createInMemoryRepo<Vehicle>([makeVehicle({})]) },
        {
          provide: MEMBER_REPO,
          useValue: createInMemoryRepo<Member>([{ id: 'c1', name: '王小明', phone: '0900000000', kind: 'local' }]),
        },
        {
          provide: ORDER_REPO,
          useValue: createInMemoryRepo<RentalOrder>([ordinary, overdueReturn, refundPending, recovering]),
        },
        { provide: MAINTENANCE_REPO, useValue: createInMemoryRepo<MaintenanceRecord>([]) },
      ],
    });
    const component = TestBed.createComponent(OrdersPageComponent).componentInstance;
    return { component, workspaceOpen };
  }

  it('逾時未還／退款待處理／業者復原處理中都判定為急迫', () => {
    const { component } = setup();
    const orders = component.store.orders();
    const overdue = orders.find((b) => b.id === 'overdue-return')!;
    const refundPending = orders.find((b) => b.id === 'refund-pending')!;
    const recovering = orders.find((b) => b.id === 'recovering')!;
    const ordinary = orders.find((b) => b.id === 'ordinary')!;

    expect(component.isOverdueReturn(overdue)).toBe(true);
    expect(component.hasRefundPending(refundPending)).toBe(true);
    expect(component.hasUrgentOperatorRecovery(recovering)).toBe(true);
    expect(component.isUrgent(overdue)).toBe(true);
    expect(component.isUrgent(refundPending)).toBe(true);
    expect(component.isUrgent(recovering)).toBe(true);
    expect(component.isUrgent(ordinary)).toBe(false);

    vi.useRealTimers();
  });

  it('急迫列排在一般列之前，且維持原始載入順序（穩定排序）', () => {
    const { component } = setup();

    // 載入順序：ordinary, overdue-return, refund-pending, recovering。
    // 急迫的三筆（overdue-return, refund-pending, recovering）應排到 ordinary 之前，
    // 且彼此之間維持原本的相對順序（穩定排序），ordinary 排在最後。
    expect(component.filteredBookings().map((b) => b.id)).toEqual([
      'overdue-return',
      'refund-pending',
      'recovering',
      'ordinary',
    ]);

    vi.useRealTimers();
  });

  it('goUrgent 開同一個訂單詳情的指定分頁', () => {
    const { component, workspaceOpen } = setup();
    const overdue = component.store.orders().find((b) => b.id === 'overdue-return')!;

    component.goUrgent(overdue, 'handover');
    expect(workspaceOpen).toHaveBeenCalledWith('overdue-return', 'handover');

    vi.useRealTimers();
  });
});

/** 1.4：總覽的放大鏡送出後導到 /orders?q=關鍵字，訂單列表要讀這個參數預填搜尋框。 */
describe('OrdersPageComponent 從網址帶入 q 參數預填搜尋', () => {
  function createFixture(q: string | null) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ...provideOrderDetailRepos(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(q ? { q } : {}) },
          },
        },
        { provide: OrderDetailNavigation, useValue: { open: vi.fn(), edit: vi.fn() } },
        {
          provide: VEHICLE_REPO,
          useValue: createInMemoryRepo<Vehicle>([makeVehicle({ id: 'v1', plateNumber: 'ABC-123' })]),
        },
        {
          provide: MEMBER_REPO,
          useValue: createInMemoryRepo<Member>([{ id: 'c1', name: '林美惠', phone: '0900000000', kind: 'local' }]),
        },
        {
          provide: ORDER_REPO,
          useValue: createInMemoryRepo<RentalOrder>([makeBooking({ id: 'b1', memberId: 'c1' })]),
        },
        { provide: MAINTENANCE_REPO, useValue: createInMemoryRepo<MaintenanceRecord>([]) },
      ],
    });
    return TestBed.createComponent(OrdersPageComponent).componentInstance;
  }

  it('網址帶 ?q=林美惠 時，搜尋框預填該關鍵字並套用篩選', () => {
    const component = createFixture('林美惠');

    expect(component.searchQuery()).toBe('林美惠');
    expect(component.filteredBookings().map((b) => b.id)).toEqual(['b1']);
  });

  it('網址沒有 q 參數時，搜尋框維持空白', () => {
    const component = createFixture(null);

    expect(component.searchQuery()).toBe('');
  });

  it('網址帶入的關鍵字與取車日期篩選同時作用（4.4）', () => {
    // makeBooking 預設取車時間 2026/08/01 09:00。
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date(2026, 7, 1, 12));
      const component = createFixture('林美惠');
      component.pickupDateFilter.set('today');
      expect(component.filteredBookings().map((b) => b.id)).toEqual(['b1']);

      vi.setSystemTime(new Date(2026, 7, 2, 12));
      component.pickupDateFilter.set('week');
      component.pickupDateFilter.set('today');
      expect(component.filteredBookings()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

/** 4.1：訂單列表的「待補」欄（數字徽章）與「只看有待補」篩選；規則與訂單詳情的待補卡同一套。 */
describe('OrdersPageComponent 待補欄與篩選', () => {
  function setup() {
    const complete: Member = { id: 'c1', name: '王小明', phone: '0912000111', kind: 'local', email: 'w@x.y' };
    const incomplete: Member = { id: 'c2', name: '陳大文', phone: '0922000222', kind: 'local' };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ...provideOrderDetailRepos({
          contracts: [{ id: 'cv1', bookingId: 'done', version: 1, status: 'signed' } as ContractVersion],
          identityDocuments: [
            {
              id: 'id1', memberId: 'c1', type: 'taiwan_id', documentNumber: 'A1', issuingCountry: 'TW',
              verification: { state: 'verified' }, version: 1, createdAt: '', updatedAt: '',
            },
          ],
          driverCredentials: [
            {
              id: 'dc1', memberId: 'c1', type: 'taiwan_license', documentNumber: 'TL-1', issuingCountry: 'TW',
              originalVehicleClassText: '', standardizedVehicleClass: 'scooter', verification: { state: 'verified' },
              reciprocityStatus: 'pending', version: 1, createdAt: '', updatedAt: '',
            },
          ],
        }),
        { provide: OrderDetailNavigation, useValue: { open: vi.fn(), edit: vi.fn() } },
        { provide: VEHICLE_REPO, useValue: createInMemoryRepo<Vehicle>([makeVehicle({ id: 'v1', plateNumber: 'ABC-123' })]) },
        { provide: MEMBER_REPO, useValue: createInMemoryRepo<Member>([complete, incomplete]) },
        {
          provide: ORDER_REPO,
          useValue: createInMemoryRepo<RentalOrder>([
            // done：Email、合約、證件、駕照都齊，訂金 0、沒有報價——沒有待補。
            makeBooking({ id: 'done', memberId: 'c1', status: 'reserved' }),
            // todo：陳大文沒有 Email、沒有合約與證件紀錄——4 項待補。
            makeBooking({ id: 'todo', memberId: 'c2', status: 'reserved' }),
            // 已取消／已完成的訂單不計待補。
            makeBooking({ id: 'gone', memberId: 'c2', status: 'cancelled' }),
            makeBooking({ id: 'past', memberId: 'c2', status: 'completed' }),
          ]),
        },
        { provide: MAINTENANCE_REPO, useValue: createInMemoryRepo<MaintenanceRecord>([]) },
      ],
    });
    const fixture = TestBed.createComponent(OrdersPageComponent);
    return { fixture, component: fixture.componentInstance };
  }

  function byId(component: OrdersPageComponent, id: string): RentalOrder {
    const order = component.store.orders().find((b) => b.id === id);
    if (!order) throw new Error(`fixture: ${id}`);
    return order;
  }

  it('每筆訂單的待補項數；已取消、已完成的不計', () => {
    const { component } = setup();
    expect(component.incompleteOf(byId(component, 'done'))).toEqual([]);
    expect(component.incompleteOf(byId(component, 'todo')).map((i) => i.kind)).toEqual([
      'missingEmail',
      'contractNotSigned',
      'identityNotVerified',
      'driverNotVerified',
    ]);
    expect(component.incompleteOf(byId(component, 'gone'))).toEqual([]);
    expect(component.incompleteOf(byId(component, 'past'))).toEqual([]);
  });

  it('「只看有待補」：只留有待補的訂單，並與狀態篩選、搜尋同時作用；清除篩選會一起清掉', () => {
    const { component } = setup();
    component.incompleteFilter.set('has');
    expect(component.filteredBookings().map((b) => b.id)).toEqual(['todo']);
    expect(component.activeFilterCount()).toBe(1);

    component.statusFilter.set('cancelled');
    expect(component.filteredBookings()).toEqual([]);
    component.statusFilter.set(null);
    component.searchQuery.set('王小明');
    expect(component.filteredBookings()).toEqual([]);

    component.clearFilters();
    expect(component.incompleteFilter()).toBeNull();
    expect(component.filteredBookings().map((b) => b.id)).toEqual(['done']);
  });

  it('待補欄顯示數字徽章（0 不顯示），提示列出每一項', () => {
    const { fixture, component } = setup();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const badges = Array.from(el.querySelectorAll('.incomplete-badge'));
    expect(badges).toHaveLength(1);
    expect(badges[0].querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe('4');
    expect(badges[0].textContent).toContain(ZH_TW.order.incompleteCount.replace('{count}', '4'));
    expect(component.incompleteSummary(byId(component, 'todo'))).toContain(ZH_TW.orderForm.incomplete.missingEmail);
  });
});

describe('pickupDateRange（4.4：取車日期篩選的區間）', () => {
  // 2026/09/24 是星期四。
  const now = new Date(2026, 8, 24, 15, 30);

  it('今天：當天 00:00 到隔天 00:00', () => {
    expect(pickupDateRange('today', null, now)).toEqual({ from: new Date(2026, 8, 24), to: new Date(2026, 8, 25) });
  });

  it('本週：週日起算 7 天（與總覽月曆、時間軸同一個慣例）', () => {
    expect(pickupDateRange('week', null, now)).toEqual({ from: new Date(2026, 8, 20), to: new Date(2026, 8, 27) });
  });

  it('自訂區間：含起訖兩天整天；還沒選日期時不篩', () => {
    const custom = { start: new Date(2026, 8, 1), end: new Date(2026, 8, 3) };
    expect(pickupDateRange('custom', custom, now)).toEqual({ from: new Date(2026, 8, 1), to: new Date(2026, 8, 4) });
    expect(pickupDateRange('custom', null, now)).toBeNull();
    expect(pickupDateRange(null, custom, now)).toBeNull();
  });
});

/** 頁首工具列登記在 HeaderToolbarSlot、平常由 HeaderComponent 渲染；測試用最小的宿主把它畫出來。 */
@Component({
  imports: [NgTemplateOutlet],
  template: '<ng-container [ngTemplateOutlet]="slot.template()" />',
})
class HeaderToolbarHostComponent {
  readonly slot = inject(HeaderToolbarSlot);
}

describe('OrdersPageComponent 4.4：整列點擊、取車日期篩選、工具列', () => {
  const NOW = new Date(2026, 8, 24, 12, 0); // 星期四

  function setup() {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const open = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ...provideOrderDetailRepos(),
        { provide: OrderDetailNavigation, useValue: { open, edit: vi.fn() } },
        {
          provide: VEHICLE_REPO,
          useValue: createInMemoryRepo<Vehicle>([
            makeVehicle({ id: 'v1', plateNumber: 'ABC-123' }),
            makeVehicle({ id: 'v2', plateNumber: 'XYZ-999' }),
          ]),
        },
        {
          provide: MEMBER_REPO,
          useValue: createInMemoryRepo<Member>([
            { id: 'c1', name: '王小明', phone: '0912000111', kind: 'local' },
            { id: 'c2', name: '陳大文', phone: '0922000222', kind: 'local' },
          ]),
        },
        {
          provide: ORDER_REPO,
          useValue: createInMemoryRepo<RentalOrder>([
            makeBooking({ id: 'today', memberId: 'c1', startTime: new Date(2026, 8, 24, 9).toISOString() }),
            makeBooking({ id: 'sunday', vehicleId: 'v2', memberId: 'c2', startTime: new Date(2026, 8, 20, 10).toISOString() }),
            makeBooking({ id: 'saturday', memberId: 'c2', startTime: new Date(2026, 8, 26, 23, 30).toISOString() }),
            makeBooking({ id: 'next-week', memberId: 'c1', startTime: new Date(2026, 8, 27, 9).toISOString() }),
            makeBooking({
              id: 'early',
              memberId: 'c1',
              status: 'in_progress',
              startTime: new Date(2026, 8, 2, 9).toISOString(),
              endTime: new Date(2026, 9, 2, 9).toISOString(),
            }),
          ]),
        },
        { provide: MAINTENANCE_REPO, useValue: createInMemoryRepo<MaintenanceRecord>([]) },
      ],
    });
    const fixture = TestBed.createComponent(OrdersPageComponent);
    return { fixture, component: fixture.componentInstance, open };
  }

  afterEach(() => vi.useRealTimers());

  const ids = (component: OrdersPageComponent) => component.filteredBookings().map((b) => b.id).sort();

  it('今天／本週：依取車時間篩選', () => {
    const { component } = setup();
    component.pickupDateFilter.set('today');
    expect(ids(component)).toEqual(['today']);
    component.pickupDateFilter.set('week');
    expect(ids(component)).toEqual(['saturday', 'sunday', 'today']);
    expect(component.activeFilterCount()).toBe(1);
  });

  it('自訂區間：選了日期才篩，含迄日整天', () => {
    const { component } = setup();
    component.pickupDateFilter.set('custom');
    expect(ids(component)).toHaveLength(5);
    component.pickupRange.set({ start: new Date(2026, 8, 1), end: new Date(2026, 8, 20) });
    expect(ids(component)).toEqual(['early', 'sunday']);
  });

  it('與狀態篩選、搜尋同時作用；清除篩選不清搜尋', () => {
    const { component } = setup();
    component.pickupDateFilter.set('week');
    component.searchQuery.set('陳大文');
    expect(ids(component)).toEqual(['saturday', 'sunday']);
    component.searchQuery.set('XYZ');
    expect(ids(component)).toEqual(['sunday']);
    component.statusFilter.set('in_progress');
    expect(ids(component)).toEqual([]);

    component.clearFilters();
    expect(component.pickupDateFilter()).toBeNull();
    expect(component.pickupRange()).toBeNull();
    expect(component.searchQuery()).toBe('XYZ');
    expect(ids(component)).toEqual(['sunday']);
  });

  it('整列點擊開訂單詳情；列內按鈕照舊，不會同時觸發整列點擊', () => {
    const { fixture, open } = setup();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const row = Array.from(el.querySelectorAll<HTMLElement>('tbody tr')).find((tr) => tr.textContent?.includes('ABC-123'));
    if (!row) throw new Error('fixture: row missing');

    const plateCell = Array.from(row.querySelectorAll('td')).find((td) => td.textContent?.trim() === 'ABC-123');
    plateCell?.click();
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenLastCalledWith('today');

    (row.querySelector('.handover-action') as HTMLButtonElement).click();
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenLastCalledWith('today', 'handover');
  });

  it('工具列不再有「會員」連結（會員入口移到側欄），保留新增訂單；選「自訂區間」才出現日期區間欄位', () => {
    const { fixture, component } = setup();
    fixture.detectChanges();
    const host = TestBed.createComponent(HeaderToolbarHostComponent);
    host.detectChanges();
    const toolbar = host.nativeElement as HTMLElement;

    expect(toolbar.querySelector('a[href="/orders/members"]')).toBeNull();
    expect(toolbar.querySelector('a[href="/orders/new"]')).not.toBeNull();
    expect(toolbar.querySelector('lib-dual-month-range-picker')).toBeNull();

    component.pickupDateFilter.set('custom');
    host.detectChanges();
    const picker = toolbar.querySelector('lib-dual-month-range-picker');
    expect(picker).not.toBeNull();
    expect(picker?.querySelector('input')?.getAttribute('placeholder')).toBe(ZH_TW.order.pickupRangePlaceholder);
  });
});
