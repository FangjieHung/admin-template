import { Component, InjectionToken, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogConfig, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { firstValueFrom } from 'rxjs';

/** 確認對話框按鈕的預設文字。libs/ui 不內建使用者可見字串，由使用端提供（或每次在 data 裡給）。 */
export interface ConfirmDialogLabels {
  /** 例：「確認」。 */
  confirm: string;
  /** 例：「取消」。 */
  cancel: string;
}

/** 選填：在 app 或頁面的 `providers` 提供一次，之後呼叫 `openConfirmDialog()` 就不必每次給按鈕文字。 */
export const CONFIRM_DIALOG_LABELS = new InjectionToken<ConfirmDialogLabels>('CONFIRM_DIALOG_LABELS');

export interface ConfirmDialogData {
  /** 要使用者確認的事，寫成完整的一句話，例：「確定刪除「季度報告」？刪除後無法復原。」 */
  message: string;
  /** 選填標題；短訊息通常不需要。 */
  title?: string;
  /** 確認鈕文字，最好是動詞（「刪除」「送出」），比「確認」清楚。預設取 `CONFIRM_DIALOG_LABELS.confirm`。 */
  confirmLabel?: string;
  /** 取消鈕文字。預設取 `CONFIRM_DIALOG_LABELS.cancel`。 */
  cancelLabel?: string;
  /** `danger`：確認鈕用錯誤色（刪除、作廢等不可復原的動作）；`primary`：一般確認。預設 `danger`。 */
  tone?: 'danger' | 'primary';
}

/**
 * 確認對話框：在執行不可復原或影響範圍大的動作前，要使用者再確認一次。
 * 通常不直接使用元件，而是呼叫 `openConfirmDialog(dialog, data)`，它回傳 Promise<boolean>。
 */
@Component({
  selector: 'lib-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  private readonly labels = inject(CONFIRM_DIALOG_LABELS, { optional: true });

  protected readonly confirmLabel = this.data.confirmLabel ?? this.labels?.confirm ?? missingLabel('confirm');
  protected readonly cancelLabel = this.data.cancelLabel ?? this.labels?.cancel ?? missingLabel('cancel');
  protected readonly tone = this.data.tone ?? 'danger';
}

function missingLabel(name: keyof ConfirmDialogLabels): never {
  throw new Error(`ConfirmDialog：缺少「${name}」按鈕文字。請在 data 給 ${name}Label，或提供 CONFIRM_DIALOG_LABELS。`);
}

/** 開啟確認對話框；使用者按確認回 true，按取消、按 Esc 或點遮罩回 false。 */
export async function openConfirmDialog(
  dialog: MatDialog,
  data: ConfirmDialogData,
  config: Omit<MatDialogConfig<ConfirmDialogData>, 'data'> = {},
): Promise<boolean> {
  const ref = dialog.open(ConfirmDialogComponent, { width: '360px', autoFocus: 'dialog', ...config, data });
  return (await firstValueFrom(ref.afterClosed())) === true;
}
