import { Component, Injector, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService, openConfirmDialog } from '@admin-template/ui';
import { AccountSettingsRepository } from '../data/account-settings.repository';

/**
 * 進階：匯出我的資料（示範只跳提示）與危險區的刪除帳號。
 * 刪除要在確認對話框裡輸入帳號的 Email 才按得下去（確認鈕用錯誤色）。
 */
@Component({
  selector: 'app-advanced-section',
  imports: [MatButtonModule, MatProgressSpinnerModule],
  template: `
    <div class="acs-stack">
      <section class="ui-card acs-card p-4 sm:p-6" aria-labelledby="export-title">
        <div class="acs-row">
          <div class="acs-row__text">
            <h2 id="export-title" class="ui-text-subtitle">匯出我的資料</h2>
            <span class="acs-hint">把個人資料、偏好與你建立的項目打包成一個檔案；準備好會寄到你的 Email。</span>
          </div>
          <button matButton="outlined" type="button" [disabled]="exporting()" (click)="exportData()" data-action="export">
            @if (exporting()) {
              <mat-spinner diameter="18" aria-hidden="true" />
            }
            匯出資料
          </button>
        </div>
      </section>

      <section class="ui-card acs-card p-4 sm:p-6 danger-zone" aria-labelledby="danger-title">
        <div class="acs-card__head">
          <!-- 顏色放在 h2 裡面的 span：有些質地的 .ui-text-subtitle recipe 會指定標題顏色。 -->
          <h2 id="danger-title" class="ui-text-subtitle">
            <span class="danger-zone__title">
              <span class="material-symbols-rounded" aria-hidden="true">warning</span>
              危險區
            </span>
          </h2>
          <p class="acs-lede">這裡的動作無法復原，執行前會再確認一次。</p>
        </div>
        <hr class="acs-divider" />
        <div class="acs-row">
          <div class="acs-row__text">
            <span class="acs-row__title">刪除帳號</span>
            <span class="acs-hint">刪除後無法登入，你建立的項目會轉給管理員。示範：不會真的刪除。</span>
          </div>
          <!-- 危險按鈕：.ui-btn--danger（CONTRACT.md），各質地都是錯誤色。 -->
          <button matButton="filled" type="button" class="ui-btn--danger" [disabled]="deleting() || !email()" (click)="deleteAccount()" data-action="delete-account">
            刪除帳號
          </button>
        </div>
      </section>
    </div>
  `,
  styleUrl: './settings-section.scss',
  styles: `
    .danger-zone__title {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--mat-sys-error);

      .material-symbols-rounded {
        font-size: 1.25rem;
      }
    }

    mat-spinner {
      display: inline-block;
      margin-inline-end: 0.5rem;
      vertical-align: middle;
    }
  `,
})
export class AdvancedSectionComponent {
  private readonly repo = inject(AccountSettingsRepository);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);

  protected readonly exporting = signal(false);
  protected readonly deleting = signal(false);
  /** 刪除帳號要輸入的確認字樣：帳號的 Email。 */
  protected readonly email = signal('');

  constructor() {
    void this.repo.profile().then((p) => this.email.set(p.email));
  }

  protected async exportData(): Promise<void> {
    this.exporting.set(true);
    try {
      await this.repo.requestExport();
      this.toast.info('已開始準備匯出檔，完成後會寄到你的 Email（示範）。');
    } finally {
      this.exporting.set(false);
    }
  }

  protected async deleteAccount(): Promise<void> {
    const email = this.email();
    const ok = await openConfirmDialog(
      this.injector,
      {
        title: '刪除帳號？',
        message: `刪除後無法登入，也無法復原；你建立的項目會轉給管理員。確定要刪除，請輸入你的 Email：${email}`,
        confirmLabel: '刪除帳號',
        typeToConfirm: { text: email, label: '你的 Email', hint: '跟上面的 Email 完全相同才能刪除' },
      },
      { width: '420px' },
    );
    if (!ok) return;
    this.deleting.set(true);
    try {
      await this.repo.deleteAccount();
      this.toast.success('已送出刪除帳號（示範：資料不會真的刪除）。');
    } finally {
      this.deleting.set(false);
    }
  }
}
