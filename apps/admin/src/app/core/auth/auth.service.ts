import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AccessService } from '@admin-template/access';

const AUTH_SESSION_KEY = 'app.auth.session';

/**
 * 示範登入：不驗證，選一個示範帳號就換成那個身分（AccessService.signIn）。
 * 接上真正的身分驗證時換掉這個服務：登入成功後用後端回傳的使用者呼叫 signIn。
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly access = inject(AccessService);

  login(userId: string): void {
    this.access.signIn(userId);
    try {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ user: userId }));
    } catch {
      // 存不了就只在這次開啟期間有效。
    }
  }

  logout(): void {
    this.access.signOut();
    try {
      localStorage.removeItem(AUTH_SESSION_KEY);
    } catch {
      // 同上
    }
    void this.router.navigateByUrl('/login');
  }
}
