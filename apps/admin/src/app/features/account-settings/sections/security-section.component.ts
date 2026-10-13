import { Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { SkeletonComponent, ToastService, openConfirmDialog } from '@admin-template/ui';
import { AccountSession, WrongPasswordError } from '../data/account-settings.model';
import { AccountSettingsRepository } from '../data/account-settings.repository';
import {
  PASSWORD_STRENGTH_LABELS,
  checkPasswordRules,
  matchesNewPasswordValidator,
  passwordRulesValidator,
  passwordStrength,
} from './password-rules';
import { FormSnapshot, UnsavedChangesSection, focusFirstInvalid } from './settings-form';
import { UnsavedBarComponent } from './unsaved-bar.component';

const FIELD_ORDER = ['current', 'next', 'confirm'] as const;

/**
 * 安全性：一頁示範兩種儲存方式。
 * - 變更密碼：明確存檔（底部「有未儲存的變更」列、未存離開會先問）；規則清單即時打勾、強度提示。
 * - 兩步驟驗證：即時儲存，失敗時還原開關。
 * - 登入中的裝置：「登出這台」先用確認對話框問。
 */
@Component({
  selector: 'app-security-section',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    SkeletonComponent,
    UnsavedBarComponent,
  ],
  templateUrl: './security-section.component.html',
  styleUrls: ['./settings-section.scss', './security-section.component.scss'],
})
export class SecuritySectionComponent extends UnsavedChangesSection {
  private readonly repo = inject(AccountSettingsRepository);
  private readonly toast = inject(ToastService);
  private readonly simulateError = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((q) => q.get('demo') === 'fail')),
    { initialValue: false },
  );

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly twoFactor = signal(false);
  protected readonly twoFactorPending = signal(false);
  protected readonly sessions = signal<AccountSession[]>([]);
  protected readonly signingOut = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    current: ['', Validators.required],
    next: ['', [Validators.required, passwordRulesValidator]],
    confirm: ['', [Validators.required, matchesNewPasswordValidator]],
  });

  private readonly snapshot = new FormSnapshot(this.form, inject(DestroyRef));
  protected readonly dirty = this.snapshot.dirty;

  private readonly currentValue = signal('');
  private readonly nextValue = signal('');
  protected readonly rules = computed(() => checkPasswordRules(this.nextValue(), this.currentValue()));
  protected readonly strength = computed(() => passwordStrength(this.nextValue()));
  protected readonly strengthLabels = PASSWORD_STRENGTH_LABELS;

  private readonly timeFormat = new Intl.RelativeTimeFormat('zh-TW', { numeric: 'auto' });

  constructor() {
    super();
    const { current, next, confirm } = this.form.controls;
    const subs = [
      current.valueChanges.subscribe((v) => {
        this.currentValue.set(v);
        // 「跟目前的密碼不同」要重新檢查新密碼。
        next.updateValueAndValidity({ emitEvent: false });
      }),
      next.valueChanges.subscribe((v) => {
        this.nextValue.set(v);
        confirm.updateValueAndValidity({ emitEvent: false });
      }),
    ];
    inject(DestroyRef).onDestroy(() => subs.forEach((s) => s.unsubscribe()));
    void this.load();
  }

  private async load(): Promise<void> {
    const settings = await this.repo.security();
    this.twoFactor.set(settings.twoFactor);
    this.sessions.set(settings.sessions);
    this.loading.set(false);
  }

  isDirty(): boolean {
    return this.dirty();
  }

  discardChanges(): void {
    this.snapshot.discard();
  }

  protected messageOf(key: (typeof FIELD_ORDER)[number]): string {
    const errors = this.form.controls[key].errors;
    if (!errors) return '';
    if (errors['required']) return key === 'current' ? '請輸入目前的密碼' : key === 'next' ? '請輸入新密碼' : '請再輸入一次新密碼';
    if (errors['wrongPassword']) return '目前的密碼不正確';
    if (errors['passwordRules']) return '新密碼還不符合下方的規則';
    if (errors['mismatch']) return '兩次輸入的新密碼不一樣';
    return '內容不正確';
  }

  // ---- 變更密碼（明確存檔） ----

  async save(): Promise<void> {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      afterNextRender(() => focusFirstInvalid(this.host.nativeElement, this.form, FIELD_ORDER), { injector: this.injector });
      return;
    }
    this.saving.set(true);
    const { current, next } = this.form.getRawValue();
    try {
      await this.repo.changePassword(current, next);
      this.form.reset();
      this.snapshot.commit();
      this.toast.success('已變更密碼。其他裝置下次操作時需要重新登入。');
    } catch (error) {
      if (error instanceof WrongPasswordError) {
        this.form.controls.current.setErrors({ wrongPassword: true });
        afterNextRender(() => focusFirstInvalid(this.host.nativeElement, this.form, FIELD_ORDER), { injector: this.injector });
      } else {
        this.toast.error('密碼變更失敗，請再試一次。');
      }
    } finally {
      this.saving.set(false);
    }
  }

  // ---- 兩步驟驗證（即時儲存） ----

  protected async setTwoFactor(change: MatSlideToggleChange): Promise<void> {
    const enabled = change.checked;
    this.twoFactor.set(enabled);
    this.twoFactorPending.set(true);
    try {
      await this.repo.setTwoFactor(enabled, { simulateError: this.simulateError() });
      this.toast.success(enabled ? '已更新：兩步驟驗證已開啟' : '已更新：兩步驟驗證已關閉');
    } catch {
      this.twoFactor.set(!enabled);
      this.toast.error('無法更新兩步驟驗證，已還原。請再試一次。');
    } finally {
      this.twoFactorPending.set(false);
    }
  }

  // ---- 登入中的裝置 ----

  protected lastActive(session: AccountSession): string {
    if (session.current) return '使用中';
    const hours = Math.round((Date.now() - new Date(session.lastActiveAt).getTime()) / 3_600_000);
    return hours < 24 ? this.timeFormat.format(-hours, 'hour') : this.timeFormat.format(-Math.round(hours / 24), 'day');
  }

  protected async signOut(session: AccountSession): Promise<void> {
    const ok = await openConfirmDialog(this.injector, {
      title: '登出這台裝置？',
      message: `「${session.device}」（${session.location}）會立即登出，下次使用要重新登入。`,
      confirmLabel: '登出',
      tone: 'primary',
    });
    if (!ok) return;
    this.signingOut.set(session.id);
    try {
      this.sessions.set(await this.repo.signOutSession(session.id));
      this.toast.success(`已登出「${session.device}」`);
    } catch {
      this.toast.error('登出失敗，請再試一次。');
    } finally {
      this.signingOut.set(null);
    }
  }
}
