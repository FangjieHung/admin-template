import { InjectionToken } from '@angular/core';
import type { AccessUser } from '@admin-template/access';

/**
 * 示範登入的規則（沒有真正的身分驗證）。新專案把 `demoSignIn` 換成呼叫後端的登入 API，
 * 成功時用後端回傳的使用者呼叫 `AuthService.login`；畫面不用改。
 *
 * - 帳號是示範帳號 id 去掉 `u-`：admin、manager、member、viewer、multi；密碼一律 `demo`。
 * - 帳號輸入 `locked`：示範「帳號已鎖定」。
 * - 其他帳號或密碼錯誤：示範「帳號或密碼錯誤」。
 */
export const DEMO_PASSWORD = 'demo';
export const DEMO_LOCKED_USERNAME = 'locked';

export type DemoSignInResult = { ok: true; userId: string } | { ok: false; reason: 'invalid' | 'locked' };

export function demoUsername(user: AccessUser): string {
  return user.id.replace(/^u-/, '');
}

export function demoSignIn(username: string, password: string, users: readonly AccessUser[]): DemoSignInResult {
  const name = username.trim().toLocaleLowerCase();
  if (name === DEMO_LOCKED_USERNAME) return { ok: false, reason: 'locked' };
  const user = users.find((u) => demoUsername(u) === name);
  if (!user || password !== DEMO_PASSWORD) return { ok: false, reason: 'invalid' };
  return { ok: true, userId: user.id };
}

/** 模擬送出的等待時間（毫秒；測試改成 0）。 */
export const LOGIN_DEMO_DELAY = new InjectionToken<number>('LOGIN_DEMO_DELAY', {
  providedIn: 'root',
  factory: () => 600,
});

/** 「記住我」存的帳號（只存帳號，不存密碼）。 */
export const REMEMBERED_USERNAME_KEY = 'app.login.username';
