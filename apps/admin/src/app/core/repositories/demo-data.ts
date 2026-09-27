import { InjectionToken, Injector } from '@angular/core';
import {
  LazySeedLocalStorageRepository,
  Repository,
  StorageResetEvent,
} from '@car-rental/domain/repositories';
import { ZH_TW_SHELL } from '../i18n/zh-tw-shell';

/**
 * 示範資料（約 16 kB）只在真的需要時才載入：啟動時某個集合沒有資料或內容損壞，或使用途中才發現損壞。
 * 資料都正常的日常開站完全不會下載這個 chunk，Initial bundle 也不帶它。
 */
type SeedModule = typeof import('./seed-data');

let seedModule: Promise<SeedModule> | null = null;
/** 這個頁面生命週期內實際發出幾次示範資料模組的載入（診斷與測試用）。 */
let seedModuleLoads = 0;

function loadSeedModule(): Promise<SeedModule> {
  if (!seedModule) {
    seedModuleLoads++;
    seedModule = import('./seed-data').catch((error: unknown) => {
      // 載入失敗（例如離線）時別把失敗的 promise 快取起來，下次再試。
      seedModule = null;
      throw error;
    });
  }
  return seedModule;
}

export function demoSeedModuleLoadCount(): number {
  return seedModuleLoads;
}

/** 某個集合的示範資料：`pick` 從示範資料模組挑出對應的種子函式。 */
export function demoSeed<T>(pick: (m: SeedModule) => () => T[]): () => Promise<T[]> {
  return () => loadSeedModule().then((m) => pick(m)());
}

/** 使用途中重設後要重新整理頁面，讓各 store 重讀；提示改在重整後顯示（存在 sessionStorage，不動 localStorage）。 */
export const STORAGE_RESET_NOTICE_KEY = 'cr.storageResetNotice';

/** 重新整理頁面；測試時換成替身。 */
export const PAGE_RELOAD = new InjectionToken<() => void>('PAGE_RELOAD', {
  providedIn: 'root',
  factory: () => () => location.reload(),
});

/**
 * 本機資料格式異常、重設為示範資料時的提示。MatSnackBar（連同它的 overlay 元件）只在真的要顯示時才載入：
 * 這個提示極少出現，不值得讓每次開站的 Initial bundle 都帶著它（各頁面自己用到 snack-bar 時也共用同一個 chunk）。
 */
export function showStorageResetNotice(injector: Injector): Promise<void> {
  return import('@angular/material/snack-bar').then(({ MatSnackBar }) => {
    injector.get(MatSnackBar).open(ZH_TW_SHELL.storageReset, undefined, { duration: 4000 });
  });
}

let reloadScheduled = false;

/**
 * repository 在使用途中重設後的處理：畫面已經用空清單或舊資料渲染過，而各 store 只在建立時讀一次，
 * 所以（內容損壞時）先記下「要提示」，再重新整理頁面，讓所有頁面一次換成重設後的資料；
 * 重整後由啟動流程（{@link ensureDemoData}）顯示提示。多個集合同時重設也只重整一次。
 */
export function storageResetHandler(injector: Injector): (event: StorageResetEvent) => void {
  return (event) => {
    if (event.corrupt) {
      try {
        sessionStorage.setItem(STORAGE_RESET_NOTICE_KEY, '1');
      } catch {
        // sessionStorage 不能用時就不提示，資料仍然會恢復。
      }
    }
    if (reloadScheduled) return;
    reloadScheduled = true;
    injector.get(PAGE_RELOAD)();
  };
}

function consumeResetNotice(): boolean {
  try {
    const pending = sessionStorage.getItem(STORAGE_RESET_NOTICE_KEY) !== null;
    sessionStorage.removeItem(STORAGE_RESET_NOTICE_KEY);
    return pending;
  } catch {
    return false;
  }
}

/**
 * 啟動時（app initializer）確認每個集合都有可用的資料：缺資料或損壞的才載入示範資料寫回，
 * 都正常就不載入。等畫面開始讀取時資料已就緒，所以各頁面的同步讀取不必改。
 * 有集合因損壞而重設（或上一頁在使用途中重設過）時顯示一則提示。
 */
export async function ensureDemoData(
  repos: readonly Repository<{ id: string }>[],
  injector: Injector,
): Promise<void> {
  const results = await Promise.all(
    repos
      .filter(
        (repo): repo is LazySeedLocalStorageRepository<{ id: string }> =>
          repo instanceof LazySeedLocalStorageRepository,
      )
      .map((repo) => repo.ensureReady().catch(() => 'ok' as const)),
  );
  if (consumeResetNotice() || results.includes('reset')) void showStorageResetNotice(injector);
}

/** 測試用：重設模組層級的快取狀態。 */
export function resetDemoDataStateForTesting(): void {
  seedModule = null;
  seedModuleLoads = 0;
  reloadScheduled = false;
}
