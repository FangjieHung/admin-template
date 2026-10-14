import { ChangeDetectionStrategy, Component, Injector, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { FileUploadLabels, formatFileUploadLabel } from './file-upload-labels';

export interface FileUploadPreviewImage {
  name: string;
  url: string;
}

export interface FileUploadPreviewDialogData {
  labels: FileUploadLabels;
  images: readonly FileUploadPreviewImage[];
  /** 一開始顯示第幾張（0 起算）。 */
  index: number;
}

/**
 * 圖片預覽對話框（lib-file-upload 內部用，不從 index.ts 匯出）：大圖、檔名、第幾張，上一張／下一張（也可以按左右方向鍵），
 * 換張時念出新的檔名。外框是 MatDialog，造型交給質地的對話框 recipe。
 */
@Component({
  selector: 'lib-file-upload-preview-dialog',
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title class="fup-title" aria-live="polite">{{ current().name }}</h2>
    <mat-dialog-content class="fup-content">
      <img class="fup-image" [src]="current().url" [alt]="current().name" />
    </mat-dialog-content>
    <mat-dialog-actions class="fup-actions">
      @if (images.length > 1) {
        <button matIconButton type="button" data-preview="previous" [attr.aria-label]="labels.previewPrevious" (click)="step(-1)">
          <span class="material-symbols-rounded" aria-hidden="true">chevron_left</span>
        </button>
        <span class="fup-counter ui-text-numeric">{{ counter() }}</span>
        <button matIconButton type="button" data-preview="next" [attr.aria-label]="labels.previewNext" (click)="step(1)">
          <span class="material-symbols-rounded" aria-hidden="true">chevron_right</span>
        </button>
      }
      <button matButton type="button" class="fup-close" mat-dialog-close>{{ labels.close }}</button>
    </mat-dialog-actions>
  `,
  styleUrl: './file-upload-preview-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown.arrowleft)': 'step(-1)',
    '(keydown.arrowright)': 'step(1)',
  },
})
export class FileUploadPreviewDialogComponent {
  private readonly data = inject<FileUploadPreviewDialogData>(MAT_DIALOG_DATA);
  protected readonly labels = this.data.labels;
  protected readonly images = this.data.images;
  protected readonly index = signal(Math.min(Math.max(0, this.data.index), this.images.length - 1));
  protected readonly current = computed(() => this.images[this.index()]);
  protected readonly counter = computed(() =>
    formatFileUploadLabel(this.labels.previewCounter, { current: this.index() + 1, total: this.images.length }),
  );

  /** 前後循環（最後一張的下一張回到第一張）。 */
  protected step(delta: number): void {
    const total = this.images.length;
    if (total < 2) return;
    this.index.update((i) => (i + delta + total) % total);
  }
}

/** 開啟圖片預覽；injector 是呼叫端的（同 openConfirmDialog）。 */
export function openFileUploadPreviewDialog(injector: Injector, data: FileUploadPreviewDialogData): void {
  if (data.images.length === 0) return;
  injector.get(MatDialog).open(FileUploadPreviewDialogComponent, {
    data,
    injector,
    width: '56rem',
    maxWidth: 'calc(100vw - 2rem)',
    autoFocus: '.fup-close',
    panelClass: 'lib-file-upload-dialog',
  });
}
