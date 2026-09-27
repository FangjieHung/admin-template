import { InjectionToken } from '@angular/core';
import { Repository } from '@car-rental/domain/repositories';
import { MaintenanceRecord } from '../models';

export {
  VEHICLE_REPO,
  MEMBER_REPO,
  ORDER_REPO,
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
} from '@car-rental/domain/repositories';
export const MAINTENANCE_REPO = new InjectionToken<Repository<MaintenanceRecord>>(
  'MAINTENANCE_REPO',
);
