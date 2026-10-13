import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DEFAULT_LOCALES, SkeletonComponent, ToastService } from '@admin-template/ui';
import { DISPLAY_NAME_MAX, JOB_TITLE_MAX, TIME_ZONES } from '../data/account-settings.model';
import { AccountSettingsRepository } from '../data/account-settings.repository';
import { FormSnapshot, UnsavedChangesSection, focusFirstInvalid } from './settings-form';
import { UnsavedBarComponent } from './unsaved-bar.component';

/**
 * 頭像縮寫：取顯示名稱的第一段（空白或括號之前）。中日韓文取最後兩個字（林雅婷 → 雅婷），
 * 其他取前兩個單字的字首（Ada Lovelace → AL）。
 */
export function avatarInitials(name: string): string {
  const words = name.trim().split(/[\s（(]+/).filter(Boolean);
  const first = words[0] ?? '';
  if (/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(first)) return Array.from(first).slice(-2).join('');
  const letters = words.slice(0, 2).map((w) => Array.from(w)[0] ?? '');
  return letters.join('').toUpperCase() || '?';
}

/** 欄位依畫面順序（送出時聚焦第一個錯誤欄位）。 */
const FIELD_ORDER = ['displayName', 'email', 'jobTitle', 'locale', 'timeZone'] as const;

/**
 * 個人資料（明確存檔）：頭像、顯示名稱、Email（預設唯讀，按「變更」才能改）、職稱、語言、時區。
 * 有改動時底部出現「有未儲存的變更」列；切換分組或離開頁面前會先問。
 */
@Component({
  selector: 'app-profile-section',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, SkeletonComponent, UnsavedBarComponent],
  templateUrl: './profile-section.component.html',
  styleUrls: ['./settings-section.scss', './profile-section.component.scss'],
})
export class ProfileSectionComponent extends UnsavedChangesSection {
  private readonly repo = inject(AccountSettingsRepository);
  private readonly toast = inject(ToastService);

  protected readonly locales = DEFAULT_LOCALES;
  protected readonly timeZones = TIME_ZONES;
  protected readonly nameMax = DISPLAY_NAME_MAX;
  protected readonly titleMax = JOB_TITLE_MAX;

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  /** Email 欄位可以編輯（按過「變更」）。 */
  protected readonly editingEmail = signal(false);
  private readonly emailInput = viewChild('emailInput', { read: ElementRef<HTMLInputElement> });

  protected readonly form = inject(NonNullableFormBuilder).group({
    displayName: ['', [Validators.required, Validators.maxLength(DISPLAY_NAME_MAX)]],
    email: ['', [Validators.required, Validators.email]],
    jobTitle: ['', Validators.maxLength(JOB_TITLE_MAX)],
    locale: ['zh-TW', Validators.required],
    timeZone: ['Asia/Taipei', Validators.required],
  });

  private readonly snapshot = new FormSnapshot(this.form, inject(DestroyRef));
  protected readonly dirty = this.snapshot.dirty;
  private readonly nameValue = signal('');
  /** 頭像的縮寫（沒有上傳照片時）。 */
  protected readonly initials = computed(() => avatarInitials(this.nameValue()));

  constructor() {
    super();
    const sub = this.form.controls.displayName.valueChanges.subscribe((v) => this.nameValue.set(v));
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
    void this.load();
  }

  private async load(): Promise<void> {
    const profile = await this.repo.profile();
    this.form.reset(profile);
    this.nameValue.set(profile.displayName);
    this.snapshot.commit();
    this.loading.set(false);
  }

  isDirty(): boolean {
    return this.dirty();
  }

  discardChanges(): void {
    this.snapshot.discard();
    this.nameValue.set(this.form.controls.displayName.value);
    this.editingEmail.set(false);
  }

  /** 「變更」Email：同一個輸入框解除唯讀並聚焦（同步呼叫 focus，iOS 才會叫出鍵盤）。 */
  protected editEmail(): void {
    this.editingEmail.set(true);
    const input = this.emailInput()?.nativeElement;
    if (!input) return;
    input.readOnly = false;
    input.focus();
    input.select();
  }

  protected changeAvatar(): void {
    this.toast.info('示範：這裡接上傳頭像（裁切後存檔）。');
  }

  protected messageOf(key: (typeof FIELD_ORDER)[number]): string {
    const errors = this.form.controls[key].errors;
    if (!errors) return '';
    if (key === 'displayName') return errors['required'] ? '請輸入顯示名稱' : `顯示名稱不能超過 ${DISPLAY_NAME_MAX} 個字`;
    if (key === 'email') return errors['required'] ? '請輸入 Email' : '請輸入正確的 Email（例：name@example.com）';
    if (key === 'jobTitle') return `職稱不能超過 ${JOB_TITLE_MAX} 個字`;
    return '請選擇一個選項';
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      afterNextRender(() => focusFirstInvalid(this.host.nativeElement, this.form, FIELD_ORDER), { injector: this.injector });
      return;
    }
    this.saving.set(true);
    try {
      const saved = await this.repo.saveProfile(this.form.getRawValue());
      this.form.reset(saved);
      this.snapshot.commit();
      this.editingEmail.set(false);
      this.toast.success('已儲存個人資料');
    } catch {
      this.toast.error('儲存失敗，請再試一次。');
    } finally {
      this.saving.set(false);
    }
  }
}
