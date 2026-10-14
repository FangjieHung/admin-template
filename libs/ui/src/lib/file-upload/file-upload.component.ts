import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DoCheck,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  model,
  numberAttribute,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AbstractControl, ControlValueAccessor, FormGroupDirective, NgControl, NgForm, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';
import { FILE_UPLOAD_LABELS, assertFileUploadLabels, formatFileUploadLabel } from './file-upload-labels';
import { UploadAdapter, UploadedFile, isUploadAbortError, isUploadError } from './upload-adapter';
import {
  FileRejectReason,
  FileRejection,
  FileUploadCameraMode,
  FileUploadItem,
  FileUploadLayout,
} from './file-upload.types';
import { acceptsImages, downscaleImage, formatFileSize, isImageType, matchesAccept } from './file-upload-utils';
import { FileUploadItemComponent } from './file-upload-item.component';
import { openFileUploadCameraDialog } from './file-upload-camera-dialog.component';
import { openFileUploadPreviewDialog } from './file-upload-preview-dialog.component';

let nextId = 0;

/**
 * 附件上傳：拖放、選擇檔案、貼上圖片、拍照，逐一上傳並顯示進度；表單的值只有「已上傳完成」的檔案參照（`UploadedFile[]`）。
 *
 * - 加入檔案：整個拖放區可以點（Enter／Space 也可以）、拖放檔案進來、聚焦時貼上剪貼簿裡的圖片。
 *   `accept`、`maxSize`、`maxFiles` 不符的檔案留在清單上顯示原因（類型、太大、太多），不影響其他檔案。
 * - 拍照（`camera`）：觸控裝置直接開系統相機（`capture`）；桌機有相機時開拍照對話框（即時預覽、拍攝、重拍、使用這張、切換鏡頭）；
 *   沒有權限或沒有相機時說明原因並改為選擇檔案。
 * - 上傳交給 `adapter`（`UploadAdapter`）：同時最多 `concurrency` 個，其餘等待；可以取消（abort）、失敗可以重試、可以移除。
 *   `maxImageDimension` 先把大照片縮小（依 EXIF 轉正）再上傳。
 * - 表單：`formControlName`／`[formControl]`／`[(value)]` 都可以；`Validators.required` 在沒有任何已上傳的檔案時無效。
 *   上傳中 `busy()` 是 true（也有 `(busyChange)`），頁面據此停用送出鈕。`readonly` 只列出附件與下載連結，給詳情頁用。
 * - 每個檔案的狀態變化會由報讀器念出（「已上傳 報價單.pdf」）；移除後焦點移到下一個檔案（沒有時回到拖放區）。
 */
@Component({
  selector: 'lib-file-upload',
  imports: [MatButtonModule, FileUploadItemComponent],
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lib-file-upload',
    '[class.lib-file-upload--readonly]': 'readonly()',
    '[class.lib-file-upload--grid]': "layout() === 'grid'",
    '[attr.aria-busy]': "busy() ? 'true' : null",
  },
})
export class FileUploadComponent implements ControlValueAccessor, OnInit, DoCheck {
  /** 上傳到哪裡。唯讀模式不需要。 */
  readonly adapter = input<UploadAdapter | null>(null);
  /** 欄位標籤（例：「附件」）；有 `Validators.required` 或 `required` 時後面加 *。 */
  readonly label = input('');
  /** 拖放區下方的說明，寫出接受的類型，例：「PDF 或圖片」。大小與個數上限會自動接在後面。 */
  readonly hint = input('');
  /** 驗證錯誤時顯示的文字，例：「請至少上傳一個附件」。 */
  readonly errorMessage = input('');
  /** 同 `<input accept>`：`image/*,.pdf,application/pdf`。空字串＝任何檔案。 */
  readonly accept = input('');
  /** 可以一次選多個檔案。false 時新選的檔案會取代原本的。 */
  readonly multiple = input(true, { transform: booleanAttribute });
  /** 單一檔案的大小上限（bytes），0＝不限。 */
  readonly maxSize = input(0, { transform: numberAttribute });
  /** 檔案個數上限（含上傳中與失敗的），0＝不限。 */
  readonly maxFiles = input(0, { transform: numberAttribute });
  /** 拍照鈕：`off`／`auto`（允許圖片且有相機時顯示）／`only`（只有拍照鈕）。 */
  readonly camera = input<FileUploadCameraMode>('off');
  /** 圖片長邊超過這個值（px）時先縮小再上傳，0＝不縮。只縮 JPEG、PNG、WebP，格式不變。 */
  readonly maxImageDimension = input(0, { transform: numberAttribute });
  /** 同時上傳幾個，其餘顯示「等待上傳」。 */
  readonly concurrency = input(3, { transform: numberAttribute });
  /** `list` 一列一個檔案；`grid` 縮圖方塊（照片）。 */
  readonly layout = input<FileUploadLayout>('list');
  readonly required = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  /** 只列出附件與下載連結（詳情頁）；沒有拖放區與動作。 */
  readonly readonly = input(false, { transform: booleanAttribute });

  /** 已上傳完成的檔案（表單的值）。 */
  readonly value = model<readonly UploadedFile[]>([]);
  /** 有檔案在等待或上傳中。 */
  readonly busyChange = output<boolean>();
  /** 一個檔案上傳完成。 */
  readonly uploaded = output<UploadedFile>();
  /** 使用者移除了一個已上傳的檔案（要不要刪伺服器上的檔案由頁面決定）。 */
  readonly removed = output<UploadedFile>();
  /** 這次加入的檔案中，因類型、大小、個數而無法加入的。 */
  readonly rejected = output<FileRejection[]>();

  protected readonly labels = assertFileUploadLabels(inject(FILE_UPLOAD_LABELS, { optional: true }));
  protected readonly uid = `lib-file-upload-${nextId++}`;

  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly ngControl = inject(NgControl, { self: true, optional: true });
  private readonly parentForm = inject(NgForm, { optional: true }) ?? inject(FormGroupDirective, { optional: true });
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private readonly captureInput = viewChild<ElementRef<HTMLInputElement>>('captureInput');
  private readonly zone = viewChild<ElementRef<HTMLElement>>('zone');

  protected readonly items = signal<readonly FileUploadItem[]>([]);
  protected readonly dragOver = signal(false);
  protected readonly announcement = signal('');
  /** 拍照時的提示（瀏覽器不支援相機，已改為選擇檔案）。 */
  protected readonly cameraNotice = signal('');
  private readonly formDisabled = signal(false);
  private readonly touched = signal(false);
  /** 裝置有沒有相機：桌機用 enumerateDevices 查（不需要權限），沒有相機時 `auto` 不顯示拍照鈕。 */
  private readonly hasCamera = signal(true);
  private readonly controlVersion = signal(0);

  private seq = 0;
  private dragDepth = 0;
  private readonly aborts = new Map<string, AbortController>();
  /** 最近一次由元件自己寫出的值：value 的 effect 看到它就不重建清單。 */
  private lastEmitted: readonly UploadedFile[] | null = null;
  private pendingAnnouncements: string[] = [];
  private watchedControl: AbstractControl | null = null;
  private controlEvents: Subscription | null = null;
  private onChange: (value: UploadedFile[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  readonly busy = computed(() => this.items().some((item) => item.status === 'queued' || item.status === 'uploading'));
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());
  protected readonly isRequired = computed(
    () => this.required() || !!this.ngControl?.control?.hasValidator(Validators.required),
  );
  protected readonly showZone = computed(() => this.camera() !== 'only');
  protected readonly cameraVisible = computed(() => {
    const mode = this.camera();
    if (mode === 'off' || !acceptsImages(this.accept())) return false;
    return mode === 'only' || isCoarsePointer() || (hasMediaApi() && this.hasCamera());
  });
  protected readonly canPasteImages = computed(() => acceptsImages(this.accept()));
  protected readonly hintParts = computed(() => {
    const parts: string[] = [];
    if (this.hint()) parts.push(this.hint());
    if (this.maxSize() > 0) parts.push(formatFileUploadLabel(this.labels.limitSize, { max: formatFileSize(this.maxSize()) }));
    if (this.maxFiles() > 0 && this.multiple()) parts.push(formatFileUploadLabel(this.labels.limitCount, { max: this.maxFiles() }));
    return parts;
  });
  /**
   * 範本讀這個 signal：表單在別處被標成碰過（markAllAsTouched）或送出時也會重畫錯誤外觀。
   * 上傳中不顯示錯誤（使用者已經加了檔案，只是還沒傳完）。
   */
  protected readonly invalidShown = computed(() => {
    this.controlVersion();
    this.touched();
    this.value();
    const control = this.ngControl?.control;
    if (!control || this.busy()) return false;
    const submitted = !!this.parentForm?.submitted;
    return control.invalid && (control.touched || submitted);
  });

  constructor() {
    if (this.ngControl) this.ngControl.valueAccessor = this;

    effect(() => {
      const value = this.value();
      untracked(() => this.syncFromValue(value));
    });

    let lastBusy = false;
    effect(() => {
      const busy = this.busy();
      if (busy === lastBusy) return;
      lastBusy = busy;
      untracked(() => this.busyChange.emit(busy));
    });

    afterNextRender(() => void this.detectCamera());

    const submitted = this.parentForm?.ngSubmit.subscribe(() => this.controlVersion.update((n) => n + 1));
    inject(DestroyRef).onDestroy(() => {
      submitted?.unsubscribe();
      this.controlEvents?.unsubscribe();
      for (const controller of this.aborts.values()) controller.abort();
      this.aborts.clear();
      for (const item of this.items()) this.releaseItem(item);
    });
  }

  ngOnInit(): void {
    if (!this.readonly() && !this.adapter()) {
      throw new Error('FileUpload：缺少 adapter。請給 [adapter]（UploadAdapter），或設 readonly 只顯示附件。');
    }
  }

  /** formControlName 在本元件之後才把控制項接上，所以在這裡看到新控制項時才訂閱它的事件（同 relation-select）。 */
  ngDoCheck(): void {
    const control = this.ngControl?.control ?? null;
    if (control === this.watchedControl) return;
    this.watchedControl = control;
    this.controlEvents?.unsubscribe();
    this.controlEvents = control?.events.subscribe(() => this.controlVersion.update((n) => n + 1)) ?? null;
  }

  // ---- ControlValueAccessor ----
  writeValue(value: readonly UploadedFile[] | null | undefined): void {
    this.lastEmitted = null;
    this.value.set(value ?? []);
  }

  registerOnChange(fn: (value: UploadedFile[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.formDisabled.set(disabled);
  }

  // ---- 公開方法 ----
  /** 打開檔案選擇器（必須在使用者的點擊裡呼叫）。 */
  openFilePicker(): void {
    if (this.isDisabled() || this.readonly()) return;
    const input = this.fileInput()?.nativeElement;
    if (!input) return;
    input.value = '';
    input.click();
  }

  /** 用程式加入檔案（等同使用者選了這些檔案）。 */
  addFiles(files: readonly File[]): void {
    if (this.isDisabled() || this.readonly() || files.length === 0) return;
    this.markTouched();
    let incoming = [...files];
    if (!this.multiple()) {
      incoming = incoming.slice(0, 1);
      if (this.validate(incoming[0], 0) === null) this.removeAccepted();
    }
    // 上一次的「無法加入」不留著：只顯示這一次選的。
    this.items.update((list) => list.filter((item) => item.status !== 'rejected'));

    let accepted = this.items().length;
    const added: FileUploadItem[] = [];
    const rejections: FileRejection[] = [];
    for (const file of incoming) {
      const reason = this.validate(file, accepted);
      if (reason) {
        rejections.push({ file, reason });
        added.push(this.createItem(file, 'rejected', this.rejectText(reason)));
        this.announce(formatFileUploadLabel(this.labels.announceRejected, { name: file.name, reason: this.rejectText(reason) }));
      } else {
        accepted += 1;
        added.push(this.createItem(file, 'queued', ''));
      }
    }
    this.items.update((list) => [...list, ...added]);
    if (rejections.length) this.rejected.emit(rejections);
    this.pump();
  }

  // ---- 範本事件 ----
  protected onZoneKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.openFilePicker();
  }

  protected onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.addFiles(files);
  }

  protected onPaste(event: ClipboardEvent): void {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length === 0) return;
    event.preventDefault();
    this.addFiles(files);
  }

  protected onDragEnter(event: DragEvent): void {
    if (!hasFiles(event) || this.isDisabled()) return;
    event.preventDefault();
    this.dragDepth += 1;
    this.dragOver.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    if (!hasFiles(event) || this.isDisabled()) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  protected onDragLeave(): void {
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) this.dragOver.set(false);
  }

  protected onDrop(event: DragEvent): void {
    if (this.isDisabled()) return;
    event.preventDefault();
    this.dragDepth = 0;
    this.dragOver.set(false);
    this.addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  protected onBlur(): void {
    this.markTouched();
  }

  /** 拍照：觸控裝置開系統相機；桌機開拍照對話框；瀏覽器不支援相機時說明並改為選擇檔案。 */
  protected async openCamera(): Promise<void> {
    if (this.isDisabled()) return;
    this.cameraNotice.set('');
    if (isCoarsePointer()) {
      const input = this.captureInput()?.nativeElement;
      if (input) {
        input.value = '';
        input.click();
      }
      return;
    }
    if (!hasMediaApi()) {
      this.cameraNotice.set(this.labels.cameraUnavailable);
      this.openFilePicker();
      return;
    }
    const files = await openFileUploadCameraDialog(this.injector, {
      labels: this.labels,
      accept: this.accept() || 'image/*',
    });
    if (files?.length) this.addFiles(files);
  }

  protected preview(item: FileUploadItem): void {
    const images = this.items()
      .filter((i) => i.status !== 'rejected' && isImageType(i.type) && (i.result?.url || i.localUrl))
      .map((i) => ({ key: i.key, name: i.name, url: (i.result?.url ?? i.localUrl) as string }));
    const index = images.findIndex((image) => image.key === item.key);
    openFileUploadPreviewDialog(this.injector, {
      labels: this.labels,
      images: images.map(({ name, url }) => ({ name, url })),
      index: Math.max(0, index),
    });
  }

  protected cancel(item: FileUploadItem): void {
    this.aborts.get(item.key)?.abort();
    this.aborts.delete(item.key);
    this.drop(item, formatFileUploadLabel(this.labels.announceCanceled, { name: item.name }));
    this.pump();
  }

  protected retry(item: FileUploadItem): void {
    if (item.status !== 'failed' || !item.file) return;
    this.patch(item.key, { status: 'queued', progress: 0, error: '' });
    this.pump();
  }

  protected remove(item: FileUploadItem): void {
    this.drop(item, formatFileUploadLabel(this.labels.announceRemoved, { name: item.name }));
    if (item.status === 'done' && item.result) {
      this.removed.emit(item.result);
      this.commitValue();
    }
  }

  // ---- 上傳 ----
  /** 有空位就開始下一個等待中的檔案。 */
  private pump(): void {
    const limit = Math.max(1, this.concurrency());
    let active = this.items().filter((item) => item.status === 'uploading').length;
    for (const item of this.items()) {
      if (active >= limit) break;
      if (item.status !== 'queued') continue;
      active += 1;
      void this.upload(item);
    }
  }

  private async upload(item: FileUploadItem): Promise<void> {
    const adapter = this.adapter();
    if (!adapter || !item.file) return;
    const controller = new AbortController();
    this.aborts.set(item.key, controller);
    this.patch(item.key, { status: 'uploading', progress: 0, error: '' });
    try {
      const file = await downscaleImage(item.file, this.maxImageDimension());
      if (controller.signal.aborted) return;
      const result = await adapter.upload(file, {
        signal: controller.signal,
        onProgress: (fraction) => {
          if (!controller.signal.aborted) this.patch(item.key, { progress: clamp(fraction) });
        },
      });
      if (controller.signal.aborted || !this.find(item.key)) {
        adapter.release?.(result);
        return;
      }
      this.patch(item.key, { status: 'done', progress: 1, result, size: result.size || file.size });
      this.announce(formatFileUploadLabel(this.labels.announceDone, { name: item.name }));
      this.uploaded.emit(result);
      this.commitValue();
    } catch (error) {
      if (controller.signal.aborted || isUploadAbortError(error) || !this.find(item.key)) return;
      const reason = isUploadError(error) && error.message ? error.message : this.labels.statusFailed;
      this.patch(item.key, { status: 'failed', error: reason });
      this.announce(formatFileUploadLabel(this.labels.announceFailed, { name: item.name, reason }));
    } finally {
      if (this.aborts.get(item.key) === controller) this.aborts.delete(item.key);
      this.pump();
    }
  }

  // ---- 清單 ----
  private validate(file: File, acceptedCount: number): FileRejectReason | null {
    if (!matchesAccept(file, this.accept())) return 'type';
    if (this.maxSize() > 0 && file.size > this.maxSize()) return 'size';
    const max = this.multiple() ? this.maxFiles() : 1;
    if (max > 0 && acceptedCount >= max) return 'count';
    return null;
  }

  private rejectText(reason: FileRejectReason): string {
    if (reason === 'type') return this.labels.rejectType;
    if (reason === 'size') return formatFileUploadLabel(this.labels.rejectSize, { max: formatFileSize(this.maxSize()) });
    return formatFileUploadLabel(this.labels.rejectCount, { max: this.multiple() ? this.maxFiles() : 1 });
  }

  private createItem(file: File, status: FileUploadItem['status'], error: string): FileUploadItem {
    const localUrl = status !== 'rejected' && isImageType(file.type) ? URL.createObjectURL(file) : null;
    return {
      key: `${this.uid}-${++this.seq}`,
      name: file.name,
      size: file.size,
      type: file.type,
      file,
      status,
      progress: 0,
      error,
      result: null,
      localUrl,
    };
  }

  /** 單一檔案模式選了新檔：先拿掉原本的（上傳中的取消）。 */
  private removeAccepted(): void {
    const old = this.items().filter((item) => item.status !== 'rejected');
    if (old.length === 0) return;
    for (const item of old) {
      this.aborts.get(item.key)?.abort();
      this.aborts.delete(item.key);
      this.releaseItem(item);
      if (item.status === 'done' && item.result) this.removed.emit(item.result);
    }
    this.items.update((list) => list.filter((item) => item.status === 'rejected'));
    this.commitValue();
  }

  /** 從清單拿掉一列、念出結果、焦點移到下一列（沒有時上一列，再沒有時回到拖放區）。 */
  private drop(item: FileUploadItem, message: string): void {
    const list = this.items();
    const index = list.findIndex((i) => i.key === item.key);
    if (index === -1) return;
    this.releaseItem(list[index]);
    const rest = list.filter((i) => i.key !== item.key);
    this.items.set(rest);
    this.announce(message);
    const next = rest[index] ?? rest[index - 1] ?? null;
    afterNextRender(
      () => {
        const root = this.host.nativeElement;
        const target = next
          ? root.querySelector<HTMLElement>(`[data-item-key="${next.key}"]`)
          : (this.zone()?.nativeElement ?? root.querySelector<HTMLElement>('[data-camera-button]'));
        target?.focus();
      },
      { injector: this.injector },
    );
  }

  private releaseItem(item: FileUploadItem): void {
    if (item.localUrl) URL.revokeObjectURL(item.localUrl);
    if (item.result) this.adapter()?.release?.(item.result);
  }

  private find(key: string): FileUploadItem | undefined {
    return this.items().find((item) => item.key === key);
  }

  private patch(key: string, changes: Partial<FileUploadItem>): void {
    this.items.update((list) => list.map((item) => (item.key === key ? { ...item, ...changes } : item)));
  }

  /** 已上傳完成的檔案寫回 value 與表單。 */
  private commitValue(): void {
    const value = this.items()
      .filter((item) => item.status === 'done' && item.result)
      .map((item) => item.result as UploadedFile);
    this.lastEmitted = value;
    this.value.set(value);
    this.onChange(value);
  }

  /**
   * 外部改了 value（writeValue、`[(value)]`）：已完成的列換成 value 的內容（同 id 的保留原位），
   * 上傳中、失敗、無法加入的列不動。
   */
  private syncFromValue(value: readonly UploadedFile[]): void {
    if (value === this.lastEmitted) return;
    const ids = new Set(value.map((file) => file.id));
    const kept: FileUploadItem[] = [];
    const present = new Set<string>();
    for (const item of this.items()) {
      if (item.status !== 'done' || !item.result) {
        kept.push(item);
      } else if (ids.has(item.result.id) && !present.has(item.result.id)) {
        present.add(item.result.id);
        kept.push(item);
      } else {
        this.releaseItem(item);
      }
    }
    const incoming = value
      .filter((file) => !present.has(file.id))
      .map<FileUploadItem>((file) => ({
        key: `${this.uid}-${++this.seq}`,
        name: file.name,
        size: file.size,
        type: file.type,
        file: null,
        status: 'done',
        progress: 1,
        error: '',
        result: file,
        localUrl: null,
      }));
    this.items.set([...kept.filter((item) => item.status === 'done'), ...incoming, ...kept.filter((item) => item.status !== 'done')]);
  }

  private markTouched(): void {
    if (this.touched()) return;
    this.touched.set(true);
    this.onTouched();
  }

  /** 同一輪的幾個狀態變化合成一句念出（例如一次選了三個檔案，兩個無法加入）。 */
  private announce(message: string): void {
    this.pendingAnnouncements.push(message);
    if (this.pendingAnnouncements.length > 1) return;
    queueMicrotask(() => {
      this.announcement.set(this.pendingAnnouncements.join(' '));
      this.pendingAnnouncements = [];
    });
  }

  private async detectCamera(): Promise<void> {
    if (this.camera() !== 'auto' || isCoarsePointer() || !hasMediaApi()) return;
    try {
      const devices = (await navigator.mediaDevices.enumerateDevices?.()) ?? [];
      this.hasCamera.set(devices.some((device) => device.kind === 'videoinput'));
    } catch {
      this.hasCamera.set(false);
    }
  }
}

function clamp(fraction: number): number {
  return Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
}

function hasFiles(event: DragEvent): boolean {
  return !!event.dataTransfer && Array.from(event.dataTransfer.types ?? []).includes('Files');
}

/** 觸控為主的裝置（手機、平板）：直接開系統相機。 */
function isCoarsePointer(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

function hasMediaApi(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
}
