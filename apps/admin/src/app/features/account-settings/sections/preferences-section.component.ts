import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { SkeletonComponent, ToastService } from '@admin-template/ui';
import {
  DATE_FORMATS,
  DateFormatId,
  HOME_PAGES,
  PAGE_SIZES,
  PageSize,
  formatDateWith,
} from '../data/account-settings.model';
import { AccountSettingsRepository } from '../data/account-settings.repository';
import { FormSnapshot, UnsavedChangesSection } from './settings-form';
import { UnsavedBarComponent } from './unsaved-bar.component';

/** 偏好（明確存檔）：日期格式、每頁預設筆數、開啟時的預設首頁。都是選項，沒有會出錯的欄位。 */
@Component({
  selector: 'app-preferences-section',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatRadioModule, MatSelectModule, SkeletonComponent, UnsavedBarComponent],
  template: `
    @if (loading()) {
      <lib-skeleton variant="card" label="載入偏好設定中" />
    } @else {
      <form id="preferences-form" class="ui-card acs-card p-4 sm:p-6" [formGroup]="form" (ngSubmit)="save()" novalidate aria-labelledby="pref-title">
        <div class="acs-card__head">
          <h2 id="pref-title" class="ui-text-subtitle">偏好</h2>
          <p class="acs-lede">只影響你自己看到的畫面。改完按底部的「儲存」。</p>
        </div>

        <div class="acs-grid">
          <mat-form-field appearance="outline" data-field="dateFormat">
            <mat-label>日期格式</mat-label>
            <mat-select formControlName="dateFormat">
              @for (f of dateFormats; track f.id) {
                <mat-option [value]="f.id">{{ f.label }}（{{ example(f.id) }}）</mat-option>
              }
            </mat-select>
            <mat-hint>今天會顯示成 <span class="ui-text-numeric">{{ example(form.controls.dateFormat.value) }}</span></mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline" data-field="homePage">
            <mat-label>開啟時的預設首頁</mat-label>
            <mat-select formControlName="homePage">
              @for (p of homePages; track p.route) {
                <mat-option [value]="p.route">{{ p.label }}</mat-option>
              }
            </mat-select>
            <mat-hint>登入後先打開這一頁。</mat-hint>
          </mat-form-field>

          <div class="acs-wide pref-choice" data-field="pageSize">
            <span class="pref-choice__label" id="page-size-label">每頁預設筆數</span>
            <mat-radio-group formControlName="pageSize" aria-labelledby="page-size-label" class="pref-choice__options">
              @for (size of pageSizes; track size) {
                <mat-radio-button [value]="size"><span class="ui-text-numeric">{{ size }}</span> 筆</mat-radio-button>
              }
            </mat-radio-group>
            <span class="acs-hint">列表頁第一次打開時每頁顯示幾筆；在列表上改過的會以列表上的為準。</span>
          </div>
        </div>
      </form>

      @if (dirty()) {
        <app-unsaved-bar formId="preferences-form" [saving]="saving()" (discard)="discardChanges()" />
      }
    }
  `,
  styleUrl: './settings-section.scss',
  styles: `
    .pref-choice {
      display: grid;
      gap: 0.25rem;
      padding-top: 0.5rem;
    }

    .pref-choice__label {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.875rem;
    }

    .pref-choice__options {
      display: flex;
      flex-wrap: wrap;
      gap: 0 0.5rem;
    }
  `,
})
export class PreferencesSectionComponent extends UnsavedChangesSection {
  private readonly repo = inject(AccountSettingsRepository);
  private readonly toast = inject(ToastService);

  protected readonly dateFormats = DATE_FORMATS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly homePages = HOME_PAGES;
  private readonly today = new Date();

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    dateFormat: ['ymd-slash' as DateFormatId],
    pageSize: [25 as PageSize],
    homePage: [''],
  });

  private readonly snapshot = new FormSnapshot(this.form, inject(DestroyRef));
  protected readonly dirty = this.snapshot.dirty;

  constructor() {
    super();
    void this.load();
  }

  private async load(): Promise<void> {
    this.form.reset(await this.repo.preferences());
    this.snapshot.commit();
    this.loading.set(false);
  }

  protected example(format: DateFormatId): string {
    return formatDateWith(format, this.today);
  }

  isDirty(): boolean {
    return this.dirty();
  }

  discardChanges(): void {
    this.snapshot.discard();
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      this.form.reset(await this.repo.savePreferences(this.form.getRawValue()));
      this.snapshot.commit();
      this.toast.success('已儲存偏好設定');
    } catch {
      this.toast.error('儲存失敗，請再試一次。');
    } finally {
      this.saving.set(false);
    }
  }
}
