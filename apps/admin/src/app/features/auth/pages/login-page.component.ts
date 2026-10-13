import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AccessService } from '@admin-template/access';
import { AuthService } from '../../../core/auth/auth.service';
import { ZH_TW } from '../../../core/i18n/zh-tw';
import { provideHeaderTitle } from '../../../layout/header/header-title';

@Component({
  selector: 'app-login-page',
  standalone: true,
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent {
  protected readonly t = ZH_TW;
  private readonly auth = inject(AuthService);
  private readonly access = inject(AccessService);
  private readonly router = inject(Router);

  /** 每個預設角色一個示範帳號（另有一位同時有兩個角色）；角色名稱跟著目前的角色設定。 */
  protected readonly accounts = computed(() =>
    this.access.users().map((u) => ({
      id: u.id,
      name: u.name,
      roles: this.access.roles().filter((r) => u.roleIds.includes(r.id)).map((r) => r.name).join('、') || '沒有角色',
    })),
  );

  constructor() {
    // /login 不在側欄選單裡，由頁面自己設定標題。
    provideHeaderTitle(() => ({ title: this.t.loginPage.title, breadcrumbs: [] }));
  }

  protected enterAs(userId: string): void {
    this.auth.login(userId);
    void this.router.navigateByUrl('/');
  }
}
