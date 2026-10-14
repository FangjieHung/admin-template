import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { firstValueFrom } from 'rxjs';
import type { FileUploadLabels } from './file-upload-labels';

export interface FileUploadCameraDialogData {
  labels: FileUploadLabels;
  /** 「改為選擇檔案」時檔案選擇器的 accept。 */
  accept: string;
}

/** starting：等相機（第一次會跳出權限詢問）；live：即時預覽；captured：拍好、等使用者決定；denied／unavailable：不能用相機。 */
type CameraPhase = 'starting' | 'live' | 'captured' | 'denied' | 'unavailable';

/**
 * 桌機的拍照對話框（lib-file-upload 內部用，不從 index.ts 匯出）：用 getUserMedia 即時預覽，拍攝 → 重拍／使用這張；
 * 有兩個以上的鏡頭時可以切換前後鏡頭。沒有權限或找不到相機時說明原因，並提供「改為選擇檔案」。
 * 關閉時（任何方式）停掉所有相機軌道、釋放拍好的預覽圖。回傳拍好（或改選）的檔案，取消時是 null。
 */
@Component({
  selector: 'lib-file-upload-camera-dialog',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './file-upload-camera-dialog.component.html',
  styleUrl: './file-upload-camera-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileUploadCameraDialogComponent {
  protected readonly data = inject<FileUploadCameraDialogData>(MAT_DIALOG_DATA);
  protected readonly labels = this.data.labels;
  private readonly ref = inject<MatDialogRef<FileUploadCameraDialogComponent, File[] | null>>(MatDialogRef);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly fallbackInput = viewChild<ElementRef<HTMLInputElement>>('fallback');

  protected readonly phase = signal<CameraPhase>('starting');
  protected readonly facing = signal<'environment' | 'user'>('environment');
  protected readonly canSwitch = signal(false);
  protected readonly stillUrl = signal<string | null>(null);

  private stream: MediaStream | null = null;
  private still: Blob | null = null;
  private destroyed = false;
  /** 每次開相機 +1：切換鏡頭時，晚到的舊 getUserMedia 結果直接停掉。 */
  private attempt = 0;

  constructor() {
    afterNextRender(() => void this.start());
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.stopTracks();
      this.clearStill();
    });
  }

  protected async start(): Promise<void> {
    this.stopTracks();
    const attempt = ++this.attempt;
    const media = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
    if (!media?.getUserMedia) {
      this.phase.set('unavailable');
      return;
    }
    this.phase.set('starting');
    try {
      const stream = await media.getUserMedia({
        video: { facingMode: { ideal: this.facing() }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (this.destroyed || attempt !== this.attempt) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      this.phase.set('live');
      const video = this.video()?.nativeElement;
      if (video) {
        video.srcObject = stream;
        try {
          await video.play();
        } catch {
          // 自動播放被擋時，muted＋playsinline 的影片仍會在使用者互動後播放；不影響拍攝。
        }
      }
      const devices = (await media.enumerateDevices?.().catch(() => [])) ?? [];
      this.canSwitch.set(devices.filter((device) => device.kind === 'videoinput').length > 1);
    } catch (error) {
      if (attempt !== this.attempt) return;
      const name = (error as { name?: string } | null)?.name;
      this.phase.set(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
    }
  }

  protected capture(): void {
    const video = this.video()?.nativeElement;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob || this.destroyed) return;
        this.clearStill();
        this.still = blob;
        this.stillUrl.set(URL.createObjectURL(blob));
        this.phase.set('captured');
      },
      'image/jpeg',
      0.92,
    );
  }

  protected retake(): void {
    this.clearStill();
    this.phase.set(this.stream ? 'live' : 'starting');
    if (!this.stream) void this.start();
  }

  protected use(): void {
    if (!this.still) return;
    const file = new File([this.still], `photo-${timestamp(new Date())}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
    this.ref.close([file]);
  }

  protected switchCamera(): void {
    this.facing.update((facing) => (facing === 'environment' ? 'user' : 'environment'));
    void this.start();
  }

  /** 「改為選擇檔案」：在按鈕的點擊裡同步打開檔案選擇器（瀏覽器只允許使用者手勢裡開）。 */
  protected pickInstead(): void {
    this.fallbackInput()?.nativeElement.click();
  }

  protected onFallbackFiles(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    if (files.length) this.ref.close(files);
  }

  private stopTracks(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    const video = this.video()?.nativeElement;
    if (video) video.srcObject = null;
  }

  private clearStill(): void {
    const url = this.stillUrl();
    if (url) URL.revokeObjectURL(url);
    this.stillUrl.set(null);
    this.still = null;
  }
}

function timestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * 開啟拍照對話框；回傳拍好（或改選）的檔案，取消時是 null。injector 是呼叫端的（同 openConfirmDialog），
 * 對話框才看得到頁面 providers 的東西。
 */
export async function openFileUploadCameraDialog(injector: Injector, data: FileUploadCameraDialogData): Promise<File[] | null> {
  const ref = injector.get(MatDialog).open<FileUploadCameraDialogComponent, FileUploadCameraDialogData, File[] | null>(
    FileUploadCameraDialogComponent,
    {
      data,
      injector,
      width: '40rem',
      maxWidth: 'calc(100vw - 2rem)',
      autoFocus: 'dialog',
      panelClass: 'lib-file-upload-dialog',
    },
  );
  // 「關閉」鈕（mat-dialog-close）、Esc、點遮罩回來的都不是陣列。
  const result = await firstValueFrom(ref.afterClosed());
  return Array.isArray(result) ? result : null;
}
