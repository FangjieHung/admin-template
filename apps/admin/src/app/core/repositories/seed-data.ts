export {
  seedVehicles,
  seedMembers,
  seedOrders,
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
} from '@car-rental/domain/repositories';

import { MaintenanceRecord } from '../models';
import { isoAt } from '../date-utils';

export function seedMaintenanceRecords(): MaintenanceRecord[] {
  return [
    // v2 里程 12100，門檻 12000 → overdue（里程）
    {
      id: 'm1',
      vehicleId: 'v2',
      type: 'oil_change',
      performedAt: isoAt(-40, 9),
      mileageAtService: 9000,
      nextDueMileage: 12000,
      cost: 350,
      notes: '',
    },
    // v3 里程 30500，門檻 30700 → upcoming（30700-300=30400 ≤ 30500）
    {
      id: 'm2',
      vehicleId: 'v3',
      type: 'oil_change',
      performedAt: isoAt(-30, 9),
      mileageAtService: 27700,
      nextDueMileage: 30700,
      cost: 1200,
      notes: '',
    },
    // v6 日期規則：5 天後到期 → upcoming（7 天內）
    {
      id: 'm3',
      vehicleId: 'v6',
      type: 'inspection',
      performedAt: isoAt(-175, 9),
      mileageAtService: 14000,
      nextDueDate: isoAt(5, 9),
      cost: 2500,
      notes: '半年定檢',
    },
    {
      id: 'm4',
      vehicleId: 'v4',
      type: 'brake',
      performedAt: isoAt(-2, 9),
      mileageAtService: 45200,
      nextDueMileage: 55000,
      cost: 1800,
      notes: '前煞車皮更換，維修中',
    },
  ];
}
