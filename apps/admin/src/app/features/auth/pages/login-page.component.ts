import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/auth/auth.service';
import { ZH_TW } from '../../../core/i18n/zh-tw';
import { provideHeaderTitle } from '../../../layout/header/header-title';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent {
  protected readonly t = ZH_TW;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    // /login 不在側欄選單裡，由頁面自己設定標題。
    provideHeaderTitle(() => ({ title: this.t.loginPage.title, breadcrumbs: [] }));
  }

  protected enterSystem(): void {
    this.auth.login();
    void this.router.navigateByUrl('/');
  }
}
