import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormGroupDirective, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AccessService } from '@admin-template/access';
import { ToastService } from '@admin-template/ui';
import { AuthService } from '../../../core/auth/auth.service';
import { UserPreferencesStore } from '../../../core/user-preferences';
import { ZH_TW } from '../../../core/i18n/zh-tw';
import { TOAST_PROVIDERS } from '../../../shared/ui/component-label-providers';
import { TemplateInfo, TemplateInfoComponent } from '../../../shared/ui/template-info.component';
import {
  DEMO_LOCKED_USERNAME,
  DEMO_PASSWORD,
  LOGIN_DEMO_DELAY,
  REMEMBERED_USERNAME_KEY,
  demoSignIn,
  demoUsername,
} from '../login-demo';

type LoginError = 'invalid' | 'locked';

const ERROR_TEXT: Readonly<Record<LoginError, { title: string; detail: string }>> = {
  invalid: { title: '帳號或密碼錯誤', detail: '請確認後再試一次。連續輸入錯誤多次，帳號會暫時鎖定。' },
  locked: { title: '帳號已鎖定', detail: '密碼錯誤次數過多，帳號已暫時鎖定。請 15 分鐘後再試，或聯絡系統管理員。' },
};

const INFO: TemplateInfo = {
  summary: '登入頁樣板：不在殼層裡（沒有側欄與頁首）。示範畫面與流程，沒有真正的身分驗證。',
  components: [
    'Material 欄位（mat-form-field、matInput、mat-error）、mat-checkbox、mat-progress-spinner',
    'lib-toast（忘記密碼的示範提示）',
    'libs/access 的 AccessService（登入成功後切換成對應的示範身分）',
  ],
  replace: [
    'login-demo.ts 的 demoSignIn：換成呼叫後端的登入 API',
    '示範帳號清單與密碼 demo',
    '忘記密碼：換成真正的重設密碼頁',
  ],
  files: [
    'apps/admin/src/app/features/auth/pages/login-page.component.*',
    'apps/admin/src/app/features/auth/login-demo.ts',
    'apps/admin/src/app/core/auth/auth.service.ts',
    'apps/admin/src/app/app.ts（isBarePage：不套殼層的網址）',
  ],
};

/**
 * 登入（頁面樣板，/login）：帳號密碼、顯示／隱藏密碼、記住我、忘記密碼、送出中與錯誤訊息。
 * 示範帳號登入成功就以那個身分進入（AccessService.signIn），側欄與按鈕跟著權限變化。
 */
@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    TemplateInfoComponent,
  ],
  providers: [...TOAST_PROVIDERS],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent {
  protected readonly t = ZH_TW;
  protected readonly info = INFO;
  protected readonly demoPassword = DEMO_PASSWORD;
  protected readonly lockedUsername = DEMO_LOCKED_USERNAME;

  private readonly auth = inject(AuthService);
  private readonly access = inject(AccessService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly delayMs = inject(LOGIN_DEMO_DELAY);
  private readonly prefs = inject(UserPreferencesStore);

  private readonly usernameInput = viewChild.required<ElementRef<HTMLInputElement>>('usernameInput');
  private readonly passwordInput = viewChild.required<ElementRef<HTMLInputElement>>('passwordInput');
  private readonly formDirective = viewChild.required(FormGroupDirective);

  private readonly remembered = readRemembered();

  protected readonly form = inject(NonNullableFormBuilder).group({
    username: [this.remembered ?? '', Validators.required],
    password: ['', Validators.required],
    remember: [this.remembered !== null],
  });

  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<LoginError | null>(null);
  protected readonly errorText = computed(() => {
    const error = this.error();
    return error ? ERROR_TEXT[error] : null;
  });

  /** 示範帳號（每個預設角色一個，另有一位同時有兩個角色）；角色名稱跟著目前的角色設定。 */
  protected readonly accounts = computed(() =>
    this.access.users().map((u) => ({
      username: demoUsername(u),
      name: u.name,
      roles: this.access.roles().filter((r) => u.roleIds.includes(r.id)).map((r) => r.name).join('、') || '沒有角色',
    })),
  );

  /** 點示範帳號：填好帳號與密碼（不直接登入，讓使用者看到送出的流程）。 */
  protected fill(username: string): void {
    this.form.patchValue({ username, password: DEMO_PASSWORD });
    this.error.set(null);
  }

  protected forgotPassword(): void {
    this.toast.info('示範：這裡會寄出重設密碼的連結到你的電子郵件。');
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      (this.form.controls.username.invalid ? this.usernameInput() : this.passwordInput()).nativeElement.focus();
      return;
    }
    this.submitting.set(true);
    const { username, password, remember } = this.form.getRawValue();
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    const result = demoSignIn(username, password, this.access.users());
    this.submitting.set(false);

    if (!result.ok) {
      this.error.set(result.reason);
      // 帳密錯誤：清掉密碼、焦點回密碼欄；鎖定：焦點留在帳號欄。
      if (result.reason === 'invalid') {
        // 清掉密碼，但不要讓「請輸入密碼」立刻變紅（resetForm 會一併清掉「已送出」的狀態）。
        this.formDirective().resetForm({ username, password: '', remember });
        this.passwordInput().nativeElement.focus();
      } else {
        this.usernameInput().nativeElement.focus();
      }
      return;
    }
    writeRemembered(remember ? username.trim() : null);
    this.auth.login(result.userId);
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    // 沒有要回去的頁面時，打開設定頁「偏好」選的預設首頁。
    void this.router.navigateByUrl(returnUrl?.startsWith('/') ? returnUrl : `/${this.prefs.homePage()}`);
  }
}

function readRemembered(): string | null {
  try {
    return localStorage.getItem(REMEMBERED_USERNAME_KEY);
  } catch {
    return null;
  }
}

function writeRemembered(username: string | null): void {
  try {
    if (username) localStorage.setItem(REMEMBERED_USERNAME_KEY, username);
    else localStorage.removeItem(REMEMBERED_USERNAME_KEY);
  } catch {
    // 存不了就不記住。
  }
}
