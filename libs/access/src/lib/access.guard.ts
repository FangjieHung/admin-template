import { effect, inject, untracked } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRouteSnapshot, CanActivateFn, CanMatchFn, Data, RedirectCommand, Router } from '@angular/router';
import { AccessCheck, toRequirements } from './access.model';
import { AccessService } from './access.service';

/** 路由 `data` 裡放權限要求的鍵：`data: { access: 'report:view' }` 或 `{ access: { feature, action } }`。 */
export const ACCESS_DATA_KEY = 'access';

export function accessOf(data: Data | undefined): AccessCheck | null {
  return (data?.[ACCESS_DATA_KEY] as AccessCheck | undefined) ?? null;
}

/**
 * 沒有權限時：導向「沒有權限」頁，但網址列維持原本的網址（skipLocationChange），
 * 使用者換身分後重新整理或返回都還是原本那一頁。`need` 帶需要的權限，給「沒有權限」頁說明用。
 */
function check(data: Data | undefined) {
  const requirement = accessOf(data);
  if (!requirement) return true;
  const access = inject(AccessService);
  if (access.can(requirement)) return true;
  const need = toRequirements(requirement).map((r) => `${r.feature}:${r.action}`).join(',');
  const target = inject(Router).createUrlTree([access.forbiddenPath], { queryParams: { need } });
  return new RedirectCommand(target, { skipLocationChange: true });
}

/**
 * 進入頁面前檢查：`{ path: 'reports', canActivate: [accessGuard], data: { access: 'report:view' } }`。
 * 沒有權限時顯示「沒有權限」頁（網址不變）。
 */
export const accessGuard: CanActivateFn = (route) => check(route.data);

/**
 * 比對路由時就檢查：`{ path: 'reports', canMatch: [accessMatchGuard], data: { access: 'report:view' } }`。
 * 跟 accessGuard 一樣導向「沒有權限」頁；適合 lazy 路由（沒有權限就不下載那一頁的程式）。
 */
export const accessMatchGuard: CanMatchFn = (route) => check(route.data);

/** 目前畫面上這一串路由（根到最深）宣告的權限要求，全部合在一起。 */
function activeRequirements(router: Router): AccessCheck[] {
  const checks: AccessCheck[] = [];
  let node: ActivatedRouteSnapshot | null = router.routerState.snapshot.root;
  while (node) {
    const check = accessOf(node.routeConfig?.data);
    if (check) checks.push(check);
    node = node.firstChild;
  }
  return checks;
}

/**
 * 身分或角色改變時重新檢查目前這一頁：原本看得到、現在沒有權限 → 變成「沒有權限」頁；
 * 正在「沒有權限」頁、換成有權限的身分 → 回到原本那一頁（網址列一直是原本的網址）。
 * 權限沒有影響到目前這一頁時什麼都不做（不會觸發離開頁面的確認）。在 App 根元件的建構式呼叫一次。
 * 受保護的路由要加 `runGuardsAndResolvers: 'always'`，同一個網址重新導覽時守門才會重跑。
 */
export function rerunGuardsOnAccessChange(): void {
  const access = inject(AccessService);
  const router = inject(Router);
  const location = inject(Location);
  let first = true;
  effect(() => {
    access.permissions();
    if (first) {
      first = false;
      return;
    }
    untracked(() => {
      if (!router.navigated) return;
      const onForbidden = router.url.split(/[?#]/)[0] === access.forbiddenPath;
      const stillAllowed = activeRequirements(router).every((c) => access.can(c));
      if (!onForbidden && stillAllowed) return;
      void router.navigateByUrl(location.path(true) || '/', { onSameUrlNavigation: 'reload', replaceUrl: true });
    });
  });
}
