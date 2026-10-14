import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { FileUploadLabels, formatFileUploadLabel } from './file-upload-labels';
import { FileUploadItem, FileUploadLayout } from './file-upload.types';
import { fileTypeIcon, formatFileSize, isImageType, splitFileName } from './file-upload-utils';

/**
 * lib-file-upload 清單裡的一個檔案（內部元件，不從 index.ts 匯出）：縮圖或類型圖示、檔名（中間省略）、大小、狀態、
 * 上傳中的進度條與動作（取消、重試、移除；唯讀時檔名是下載連結）。拆開是為了讓每個元件的樣式各自在 8 kB 預算內。
 */
@Component({
  selector: 'lib-file-upload-item',
  imports: [MatButtonModule],
  templateUrl: './file-upload-item.component.html',
  styleUrl: './file-upload-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-status]': 'item().status',
    '[class.fui--grid]': "layout() === 'grid'",
  },
})
export class FileUploadItemComponent {
  readonly item = input.required<FileUploadItem>();
  readonly labels = input.required<FileUploadLabels>();
  readonly layout = input<FileUploadLayout>('list');
  readonly readonly = input(false);
  readonly disabled = input(false);

  readonly preview = output<void>();
  readonly cancel = output<void>();
  readonly retry = output<void>();
  readonly remove = output<void>();

  protected readonly parts = computed(() => splitFileName(this.item().name));
  protected readonly size = computed(() => formatFileSize(this.item().size));
  protected readonly icon = computed(() => fileTypeIcon(this.item()));
  protected readonly percent = computed(() => Math.round(this.item().progress * 100));
  protected readonly busy = computed(() => this.item().status === 'queued' || this.item().status === 'uploading');

  /** 縮圖：上傳完成的縮圖網址 → 上傳完成的網址 → 本機的 object URL；不是圖片時沒有。 */
  protected readonly thumb = computed(() => {
    const item = this.item();
    if (!isImageType(item.type) || item.status === 'rejected') return null;
    return item.result?.thumbnailUrl ?? item.result?.url ?? item.localUrl;
  });
  protected readonly url = computed(() => this.item().result?.url ?? null);

  protected readonly statusText = computed(() => {
    const item = this.item();
    const labels = this.labels();
    switch (item.status) {
      case 'queued':
        return labels.statusQueued;
      case 'uploading':
        return formatFileUploadLabel(labels.statusUploading, { percent: this.percent() });
      case 'done':
        return labels.statusDone;
      default:
        return item.error || labels.statusFailed;
    }
  });

  protected readonly statusIcon = computed(() => {
    switch (this.item().status) {
      case 'done':
        return 'check_circle';
      case 'failed':
        return 'error';
      case 'rejected':
        return 'do_not_disturb_on';
      default:
        return '';
    }
  });

  protected label(template: string): string {
    return formatFileUploadLabel(template, { name: this.item().name, size: this.size() });
  }
}
