import {
  ApplicationConfig,
  inject,
  Injector,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import {
  VEHICLE_REPO,
  MEMBER_REPO,
  ORDER_REPO,
  MAINTENANCE_REPO,
  PRICING_PLAN_REPO,
  SEASON_CALENDAR_REPO,
  ADDON_REPO,
  COUPON_REPO,
  PARTNER_REPO,
  PAYOUT_REPO,
  PAYMENT_REPO,
  REFUND_REPO,
  CHARGE_ADJUSTMENT_REPO,
  IDENTITY_DOCUMENT_REPO,
  DRIVER_CREDENTIAL_REPO,
  CONTRACT_VERSION_REPO,
  HANDOVER_RECORD_REPO,
  CANCELLATION_CASE_REPO,
  CUSTOMER_CREDIT_LEDGER_REPO,
  REMINDER_STATUS_REPO,
  OPERATOR_RECOVERY_CASE_REPO,
  AUDIT_ENTRY_REPO,
  PREP_TASK_REPO,
} from './core/repositories/tokens';
import {
  seedVehicles,
  seedMembers,
  seedOrders,
  seedMaintenanceRecords,
  seedPricingPlans,
  seedSeasonCalendar,
  seedAddOns,
  seedCoupons,
  seedPartners,
  seedPayouts,
  seedPayments,
  seedRefunds,
  seedChargeAdjustments,
  seedIdentityDocuments,
  seedDriverCredentials,
  seedContractVersions,
  seedHandoverRecords,
  seedCancellationCases,
  seedCustomerCreditLedger,
  seedReminderStatuses,
  seedOperatorRecoveryCases,
  seedAuditEntries,
  seedPrepTasks,
} from './core/repositories/seed-data';
import { ZH_TW_SHELL } from './core/i18n/zh-tw-shell';
import { ThemeService } from '@car-rental/theme-pack';
// 殼層（Initial bundle）只從 repositories 子路徑取用，不經過 @car-rental/domain 的 barrel：
// barrel 一旦被主 bundle 靜態引入，各頁面用到的 domain 模組（報價、取消、交車檢核…）都會被併進主 bundle。
import {
  LocalStorageRepository,
  normalizeRentalOrder,
  normalizeVehicle,
} from '@car-rental/domain/repositories';
import { DocumentAssetGateway } from './core/services/document-asset.gateway';
import { SIGNATURE_ASSET_STORE } from '@car-rental/contract-signing';
import { IndexedDbDocumentAssetGateway } from './core/services/indexed-db-document-asset.gateway';
import { OcrGateway } from './core/services/ocr.gateway';
import { MockOcrGateway } from './core/services/mock-ocr.gateway';
import { DriverEligibilityGateway } from './core/services/driver-eligibility.gateway';
import { MockDriverEligibilityGateway } from './core/services/mock-driver-eligibility.gateway';
import { ReminderGateway } from './core/services/reminder.gateway';
import { MockReminderGateway } from './core/services/mock-reminder.gateway';

/**
 * 本機資料格式異常、重設為示範資料時的提示。MatSnackBar（連同它的 overlay 元件）只在真的要顯示時才載入：
 * 這個提示極少出現，不值得讓每次開站的 Initial bundle 都帶著它（各頁面自己用到 snack-bar 時也共用同一個 chunk）。
 */
function notifyStorageReset(injector: Injector): () => void {
  return () =>
    void import('@angular/material/snack-bar').then(({ MatSnackBar }) =>
      injector
        .get(MatSnackBar)
        .open(ZH_TW_SHELL.storageReset, undefined, { duration: 4000 }),
    );
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAppInitializer(() => inject(ThemeService).init()),
    {
      provide: VEHICLE_REPO,
      // 舊資料可能還用更名前的 branchId 欄位、值是遷移前的據點類型文字/門市全名，用 normalizeVehicle 統一轉成 branchId。
      useFactory: () =>
        new LocalStorageRepository(
          'cr.vehicles',
          seedVehicles,
          notifyStorageReset(inject(Injector)),
          normalizeVehicle,
        ),
    },
    {
      provide: MEMBER_REPO,
      useFactory: () =>
        new LocalStorageRepository(
          'cr.members',
          seedMembers,
          notifyStorageReset(inject(Injector)),
        ),
    },
    {
      provide: ORDER_REPO,
      // 舊資料可能還是遷移前的 schema（pending_payment/confirmed 狀態、paymentMethod／pickupBranchId／returnBranchId 欄位名、
      // 缺 depositRequired）——用 normalizeRentalOrder 統一轉成目前的 RentalOrder 形狀；
      // 小客車的訂金安全預設值需要查車型，所以要能拿到 VEHICLE_REPO。
      useFactory: () => {
        const vehicleRepo = inject(VEHICLE_REPO);
        return new LocalStorageRepository(
          'cr.bookings',
          seedOrders,
          notifyStorageReset(inject(Injector)),
          (item) => normalizeRentalOrder(item, (vehicleId) => vehicleRepo.getById(vehicleId)?.category),
        );
      },
    },
    {
      provide: MAINTENANCE_REPO,
      useFactory: () =>
        new LocalStorageRepository(
          'cr.maintenance',
          seedMaintenanceRecords,
          notifyStorageReset(inject(Injector)),
        ),
    },
    {
      provide: PRICING_PLAN_REPO,
      useFactory: () =>
        new LocalStorageRepository(
          'cr.pricingPlans',
          seedPricingPlans,
          notifyStorageReset(inject(Injector)),
        ),
    },
    {
      provide: SEASON_CALENDAR_REPO,
      useFactory: () =>
        new LocalStorageRepository(
          'cr.seasonCalendar',
          seedSeasonCalendar,
          notifyStorageReset(inject(Injector)),
        ),
    },
    {
      provide: ADDON_REPO,
      useFactory: () =>
        new LocalStorageRepository('cr.addOns', seedAddOns, notifyStorageReset(inject(Injector))),
    },
    {
      provide: COUPON_REPO,
      useFactory: () =>
        new LocalStorageRepository('cr.coupons', seedCoupons, notifyStorageReset(inject(Injector))),
    },
    {
      provide: PARTNER_REPO,
      useFactory: () =>
        new LocalStorageRepository('cr.partners', seedPartners, notifyStorageReset(inject(Injector))),
    },
    {
      provide: PAYOUT_REPO,
      useFactory: () =>
        new LocalStorageRepository('cr.payouts', seedPayouts, notifyStorageReset(inject(Injector))),
    },
    // --- Task 7：租務作業工作流 repository ---
    {
      provide: PAYMENT_REPO,
      useFactory: () =>
        new LocalStorageRepository('cr.payments', seedPayments, notifyStorageReset(inject(Injector))),
    },
    {
      provide: REFUND_REPO,
      useFactory: () =>
        new LocalStorageRepository('cr.refunds', seedRefunds, notifyStorageReset(inject(Injector))),
    },
    {
      provide: CHARGE_ADJUSTMENT_REPO,
      useFactory: () =>
        new LocalStorageRepository(
          'cr.chargeAdjustments',
          seedChargeAdjustments,
          notifyStorageReset(inject(Injector)),
        ),
    },
    {
      provide: IDENTITY_DOCUMENT_REPO,
      useFactory: () =>
        new LocalStorageRepository(
          'cr.identityDocuments',
          seedIdentityDocuments,
          notifyStorageReset(inject(Injector)),
        ),
    },
    {
      provide: DRIVER_CREDENTIAL_REPO,
      useFactory: () =>
        new LocalStorageRepository(
          'cr.driverCredentials',
          seedDriverCredentials,
          notifyStorageReset(inject(Injector)),
        ),
    },
    {
      provide: CONTRACT_VERSION_REPO,
      useFactory: () =>
        new LocalStorageRepository(
          'cr.contractVersions',
          seedContractVersions,
          notifyStorageReset(inject(Injector)),
        ),
    },
    {
      provide: HANDOVER_RECORD_REPO,
      useFactory: () =>
        new LocalStorageRepository(
          'cr.handoverRecords',
          seedHandoverRecords,
          notifyStorageReset(inject(Injector)),
        ),
    },
    {
      provide: CANCELLATION_CASE_REPO,
      useFactory: () =>
        new LocalStorageRepository(
          'cr.cancellationCases',
          seedCancellationCases,
          notifyStorageReset(inject(Injector)),
        ),
    },
    {
      provide: CUSTOMER_CREDIT_LEDGER_REPO,
      useFactory: () =>
        new LocalStorageRepository(
          'cr.customerCreditLedger',
          seedCustomerCreditLedger,
          notifyStorageReset(inject(Injector)),
        ),
    },
    {
      provide: REMINDER_STATUS_REPO,
      useFactory: () =>
        new LocalStorageRepository(
          'cr.reminderStatuses',
          seedReminderStatuses,
          notifyStorageReset(inject(Injector)),
        ),
    },
    {
      provide: OPERATOR_RECOVERY_CASE_REPO,
      useFactory: () =>
        new LocalStorageRepository(
          'cr.operatorRecoveryCases',
          seedOperatorRecoveryCases,
          notifyStorageReset(inject(Injector)),
        ),
    },
    {
      provide: AUDIT_ENTRY_REPO,
      useFactory: () =>
        new LocalStorageRepository(
          'cr.auditEntries',
          seedAuditEntries,
          notifyStorageReset(inject(Injector)),
        ),
    },
    // 4.3：整備待辦（還車後自動列入，「整備完成」結案；不影響車輛狀態與可用數）。
    {
      provide: PREP_TASK_REPO,
      useFactory: () =>
        new LocalStorageRepository(
          'cr.prepTasks',
          seedPrepTasks,
          notifyStorageReset(inject(Injector)),
        ),
    },
    // --- Task 7：外部服務 adapter（開發期一律使用安全的本機模擬實作） ---
    IndexedDbDocumentAssetGateway,
    { provide: DocumentAssetGateway, useExisting: IndexedDbDocumentAssetGateway },
    // 共用簽署 lib（@car-rental/contract-signing）的簽名儲存沿用同一個文件資產 gateway。
    { provide: SIGNATURE_ASSET_STORE, useExisting: DocumentAssetGateway },
    MockOcrGateway,
    { provide: OcrGateway, useExisting: MockOcrGateway },
    MockDriverEligibilityGateway,
    { provide: DriverEligibilityGateway, useExisting: MockDriverEligibilityGateway },
    MockReminderGateway,
    { provide: ReminderGateway, useExisting: MockReminderGateway },
  ],
};
