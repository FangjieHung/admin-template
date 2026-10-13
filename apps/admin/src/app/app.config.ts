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
import { demoSeed, ensureDemoData, storageResetHandler } from './core/repositories/demo-data';
import { ThemeService } from '@car-rental/theme-pack';
// 殼層（Initial bundle）只從 repositories 子路徑取用，不經過 @car-rental/domain 的 barrel：
// barrel 一旦被主 bundle 靜態引入，各頁面用到的 domain 模組（報價、取消、交車檢核…）都會被併進主 bundle。
import {
  LazySeedLocalStorageRepository,
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
import { LIST_TOOLBAR_LABEL_PROVIDERS } from './shared/ui/list-toolbar-labels';

/** 啟動時要確認有示範資料的 repository（app.config 提供的全部本機集合）。 */
const DEMO_DATA_REPOS = [
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
] as const;

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAppInitializer(() => inject(ThemeService).init()),
    // 畫面開始讀資料前，先確認每個集合都有可用的本機資料；缺的或損壞的才動態載入示範資料（見 demo-data.ts）。
    provideAppInitializer(() =>
      ensureDemoData(
        DEMO_DATA_REPOS.map((token) => inject(token)),
        inject(Injector),
      ),
    ),
    {
      provide: VEHICLE_REPO,
      // 舊資料可能還用更名前的 branchId 欄位、值是遷移前的據點類型文字/門市全名，用 normalizeVehicle 統一轉成 branchId。
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.vehicles',
          demoSeed((m) => m.seedVehicles),
          storageResetHandler(inject(Injector)),
          normalizeVehicle,
        ),
    },
    {
      provide: MEMBER_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.members',
          demoSeed((m) => m.seedMembers),
          storageResetHandler(inject(Injector)),
        ),
    },
    {
      provide: ORDER_REPO,
      // 舊資料可能還是遷移前的 schema（pending_payment/confirmed 狀態、paymentMethod／pickupBranchId／returnBranchId 欄位名、
      // 缺 depositRequired）——用 normalizeRentalOrder 統一轉成目前的 RentalOrder 形狀；
      // 小客車的訂金安全預設值需要查車型，所以要能拿到 VEHICLE_REPO。
      useFactory: () => {
        const vehicleRepo = inject(VEHICLE_REPO);
        return new LazySeedLocalStorageRepository(
          'cr.bookings',
          demoSeed((m) => m.seedOrders),
          storageResetHandler(inject(Injector)),
          (item) =>
            normalizeRentalOrder(item, (vehicleId) => vehicleRepo.getById(vehicleId)?.category),
        );
      },
    },
    {
      provide: MAINTENANCE_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.maintenance',
          demoSeed((m) => m.seedMaintenanceRecords),
          storageResetHandler(inject(Injector)),
        ),
    },
    {
      provide: PRICING_PLAN_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.pricingPlans',
          demoSeed((m) => m.seedPricingPlans),
          storageResetHandler(inject(Injector)),
        ),
    },
    {
      provide: SEASON_CALENDAR_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.seasonCalendar',
          demoSeed((m) => m.seedSeasonCalendar),
          storageResetHandler(inject(Injector)),
        ),
    },
    {
      provide: ADDON_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.addOns',
          demoSeed((m) => m.seedAddOns),
          storageResetHandler(inject(Injector)),
        ),
    },
    {
      provide: COUPON_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.coupons',
          demoSeed((m) => m.seedCoupons),
          storageResetHandler(inject(Injector)),
        ),
    },
    {
      provide: PARTNER_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.partners',
          demoSeed((m) => m.seedPartners),
          storageResetHandler(inject(Injector)),
        ),
    },
    {
      provide: PAYOUT_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.payouts',
          demoSeed((m) => m.seedPayouts),
          storageResetHandler(inject(Injector)),
        ),
    },
    // --- Task 7：租務作業工作流 repository ---
    {
      provide: PAYMENT_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.payments',
          demoSeed((m) => m.seedPayments),
          storageResetHandler(inject(Injector)),
        ),
    },
    {
      provide: REFUND_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.refunds',
          demoSeed((m) => m.seedRefunds),
          storageResetHandler(inject(Injector)),
        ),
    },
    {
      provide: CHARGE_ADJUSTMENT_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.chargeAdjustments',
          demoSeed((m) => m.seedChargeAdjustments),
          storageResetHandler(inject(Injector)),
        ),
    },
    {
      provide: IDENTITY_DOCUMENT_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.identityDocuments',
          demoSeed((m) => m.seedIdentityDocuments),
          storageResetHandler(inject(Injector)),
        ),
    },
    {
      provide: DRIVER_CREDENTIAL_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.driverCredentials',
          demoSeed((m) => m.seedDriverCredentials),
          storageResetHandler(inject(Injector)),
        ),
    },
    {
      provide: CONTRACT_VERSION_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.contractVersions',
          demoSeed((m) => m.seedContractVersions),
          storageResetHandler(inject(Injector)),
        ),
    },
    {
      provide: HANDOVER_RECORD_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.handoverRecords',
          demoSeed((m) => m.seedHandoverRecords),
          storageResetHandler(inject(Injector)),
        ),
    },
    {
      provide: CANCELLATION_CASE_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.cancellationCases',
          demoSeed((m) => m.seedCancellationCases),
          storageResetHandler(inject(Injector)),
        ),
    },
    {
      provide: CUSTOMER_CREDIT_LEDGER_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.customerCreditLedger',
          demoSeed((m) => m.seedCustomerCreditLedger),
          storageResetHandler(inject(Injector)),
        ),
    },
    {
      provide: REMINDER_STATUS_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.reminderStatuses',
          demoSeed((m) => m.seedReminderStatuses),
          storageResetHandler(inject(Injector)),
        ),
    },
    {
      provide: OPERATOR_RECOVERY_CASE_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.operatorRecoveryCases',
          demoSeed((m) => m.seedOperatorRecoveryCases),
          storageResetHandler(inject(Injector)),
        ),
    },
    {
      provide: AUDIT_ENTRY_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.auditEntries',
          demoSeed((m) => m.seedAuditEntries),
          storageResetHandler(inject(Injector)),
        ),
    },
    // 4.3：整備待辦（還車後自動列入，「整備完成」結案；不影響車輛狀態與可用數）。
    {
      provide: PREP_TASK_REPO,
      useFactory: () =>
        new LazySeedLocalStorageRepository(
          'cr.prepTasks',
          demoSeed((m) => m.seedPrepTasks),
          storageResetHandler(inject(Injector)),
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
    // 清單頁頁首工具列的文字（libs/ui 不內建字串）。
    ...LIST_TOOLBAR_LABEL_PROVIDERS,
  ],
};
