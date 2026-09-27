import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LazySeedLocalStorageRepository } from '@car-rental/domain/repositories';
import { appConfig } from '../../app.config';
import { ZH_TW_SHELL } from '../i18n/zh-tw-shell';
import { COUPON_REPO, VEHICLE_REPO } from './tokens';
import {
  PAGE_RELOAD,
  STORAGE_RESET_NOTICE_KEY,
  demoSeedModuleLoadCount,
  resetDemoDataStateForTesting,
} from './demo-data';

/** app.config 管理的全部本機集合（23 個）。 */
const COLLECTION_KEYS = [
  'cr.vehicles',
  'cr.members',
  'cr.bookings',
  'cr.maintenance',
  'cr.pricingPlans',
  'cr.seasonCalendar',
  'cr.addOns',
  'cr.coupons',
  'cr.partners',
  'cr.payouts',
  'cr.payments',
  'cr.refunds',
  'cr.chargeAdjustments',
  'cr.identityDocuments',
  'cr.driverCredentials',
  'cr.contractVersions',
  'cr.handoverRecords',
  'cr.cancellationCases',
  'cr.customerCreditLedger',
  'cr.reminderStatuses',
  'cr.operatorRecoveryCases',
  'cr.auditEntries',
  'cr.prepTasks',
];

describe('示範資料（需要時才載入）', () => {
  let snackBarOpen: ReturnType<typeof vi.fn>;
  let reload: ReturnType<typeof vi.fn>;

  async function bootstrap(): Promise<void> {
    snackBarOpen = vi.fn();
    reload = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        ...appConfig.providers,
        { provide: MatSnackBar, useValue: { open: snackBarOpen } },
        { provide: PAGE_RELOAD, useValue: reload },
      ],
    });
    await TestBed.inject(ApplicationInitStatus).donePromise;
  }

  /** 提示是動態載入 snack-bar 後才顯示的，等它跑完。 */
  async function flushNotice(): Promise<void> {
    await vi.waitFor(() => expect(snackBarOpen).toHaveBeenCalled());
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetDemoDataStateForTesting();
  });
  afterEach(() => TestBed.resetTestingModule());

  it('(a) localStorage 全空：啟動後每個集合都有示範資料，且不提示', async () => {
    await bootstrap();
    expect(demoSeedModuleLoadCount()).toBe(1);
    for (const key of COLLECTION_KEYS) expect(localStorage.getItem(key), key).not.toBeNull();
    expect(TestBed.inject(VEHICLE_REPO).getAll().length).toBeGreaterThan(0);
    expect(TestBed.inject(COUPON_REPO).getAll().length).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 0));
    expect(snackBarOpen).not.toHaveBeenCalled();
  });

  it('(b) 全部正常：不載入示範資料模組', async () => {
    for (const key of COLLECTION_KEYS) localStorage.setItem(key, '[]');
    localStorage.setItem('cr.coupons', JSON.stringify([{ id: 'mine', code: 'MINE' }]));
    await bootstrap();
    expect(demoSeedModuleLoadCount()).toBe(0);
    expect(TestBed.inject(COUPON_REPO).getAll()).toEqual([{ id: 'mine', code: 'MINE' }]);
    expect(snackBarOpen).not.toHaveBeenCalled();
  });

  it('(c) 啟動時某集合損壞：只重設該集合並提示一次', async () => {
    for (const key of COLLECTION_KEYS) localStorage.setItem(key, '[]');
    localStorage.setItem('cr.coupons', '{broken');
    localStorage.setItem('cr.partners', '{"not":"array"}');
    await bootstrap();
    expect(demoSeedModuleLoadCount()).toBe(1);
    expect(TestBed.inject(COUPON_REPO).getAll().length).toBeGreaterThan(0);
    expect(localStorage.getItem('cr.vehicles')).toBe('[]');
    await flushNotice();
    expect(snackBarOpen).toHaveBeenCalledTimes(1);
    expect(snackBarOpen).toHaveBeenCalledWith(ZH_TW_SHELL.storageReset, undefined, {
      duration: 4000,
    });
  });

  it('(d) 使用中損壞：只重設一次、資料恢復，重新整理頁面後提示', async () => {
    for (const key of COLLECTION_KEYS) localStorage.setItem(key, '[]');
    await bootstrap();
    const coupons = TestBed.inject(COUPON_REPO);
    if (!(coupons instanceof LazySeedLocalStorageRepository))
      throw new Error('expected LazySeedLocalStorageRepository');

    localStorage.setItem('cr.coupons', '{broken');
    expect(coupons.getAll()).toEqual([]);
    expect(coupons.getAll()).toEqual([]);
    await coupons.whenSettled();

    expect(demoSeedModuleLoadCount()).toBe(1);
    expect(coupons.getAll().length).toBeGreaterThan(0);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(STORAGE_RESET_NOTICE_KEY)).toBe('1');
    expect(snackBarOpen).not.toHaveBeenCalled();

    // 模擬重新整理後的啟動：資料都正常、不再載入示範資料，但顯示上一頁留下的提示。
    TestBed.resetTestingModule();
    resetDemoDataStateForTesting();
    await bootstrap();
    expect(demoSeedModuleLoadCount()).toBe(0);
    await flushNotice();
    expect(snackBarOpen).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(STORAGE_RESET_NOTICE_KEY)).toBeNull();
  });
});
