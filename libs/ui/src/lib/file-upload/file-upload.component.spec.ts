import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component, Injector, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { OverlayContainer } from '@angular/cdk/overlay';
import { FileUploadComponent } from './file-upload.component';
import { FILE_UPLOAD_LABELS, FileUploadLabels, assertFileUploadLabels, formatFileUploadLabel } from './file-upload-labels';
import { UploadAdapter, UploadOptions, UploadedFile, createDemoUploadAdapter, uploadError } from './upload-adapter';
import { FileRejection, FileUploadCameraMode, FileUploadLayout } from './file-upload.types';
import { acceptsImages, fileTypeIcon, formatFileSize, matchesAccept, splitFileName } from './file-upload-utils';
import { openFileUploadCameraDialog } from './file-upload-camera-dialog.component';
import { openFileUploadPreviewDialog } from './file-upload-preview-dialog.component';

const LABELS: FileUploadLabels = {
  dropAction: '選擇檔案',
  dropInstructions: '或把檔案拖放到這裡',
  pasteHint: '也可以貼上圖片',
  dropActive: '放開以加入檔案',
  camera: '拍照',
  limitSize: '每個檔案 {max} 以內',
  limitCount: '最多 {max} 個',
  listLabel: '附件',
  readonlyEmpty: '沒有附件',
  statusQueued: '等待上傳',
  statusUploading: '上傳中 {percent}%',
  statusDone: '已上傳',
  statusFailed: '上傳失敗',
  progressLabel: '{name} 上傳進度',
  rejectType: '不支援這種檔案類型',
  rejectSize: '超過 {max}',
  rejectCount: '超過 {max} 個檔案的上限',
  retry: '重試',
  retryFile: '重試上傳 {name}',
  cancelFile: '取消上傳 {name}',
  removeFile: '移除 {name}',
  previewFile: '預覽 {name}',
  downloadFile: '下載 {name}',
  announceDone: '已上傳 {name}',
  announceFailed: '上傳失敗：{name}，{reason}',
  announceRejected: '無法加入 {name}：{reason}',
  announceRemoved: '已移除 {name}',
  announceCanceled: '已取消上傳 {name}',
  cameraTitle: '拍照',
  cameraStarting: '正在開啟相機…',
  cameraCapture: '拍攝',
  cameraRetake: '重拍',
  cameraUse: '使用這張',
  cameraSwitch: '切換鏡頭',
  cameraDenied: '沒有相機權限',
  cameraUnavailable: '找不到可以使用的相機',
  cameraFallback: '改為選擇檔案',
  close: '關閉',
  previewPrevious: '上一張',
  previewNext: '下一張',
  previewCounter: '{current}／{total}',
};

interface Call {
  file: File;
  options: UploadOptions;
  resolve: (file: UploadedFile) => void;
  reject: (error: unknown) => void;
}

/** 上傳何時進度、成功、失敗都由測試決定。 */
class ControlledAdapter implements UploadAdapter {
  readonly calls: Call[] = [];
  readonly released: UploadedFile[] = [];
  upload(file: File, options: UploadOptions): Promise<UploadedFile> {
    return new Promise((resolve, reject) => this.calls.push({ file, options, resolve, reject }));
  }
  release(file: UploadedFile): void {
    this.released.push(file);
  }
  succeed(index: number): UploadedFile {
    const call = this.calls[index];
    const result: UploadedFile = {
      id: `f-${index}`,
      name: call.file.name,
      size: call.file.size,
      type: call.file.type,
      url: `https://files.example.com/f-${index}`,
    };
    call.resolve(result);
    return result;
  }
}

@Component({
  imports: [FileUploadComponent, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <lib-file-upload
        formControlName="files"
        label="附件"
        hint="PDF 或圖片"
        errorMessage="請至少上傳一個附件"
        [adapter]="adapter"
        [accept]="accept()"
        [maxSize]="maxSize()"
        [maxFiles]="maxFiles()"
        [multiple]="multiple()"
        [camera]="camera()"
        [layout]="layout()"
        [concurrency]="concurrency()"
        (busyChange)="busy.push($event)"
        (removed)="removed.push($event)"
        (rejected)="rejected.push($event)"
      />
    </form>
  `,
})
class FormHostComponent {
  adapter = new ControlledAdapter();
  readonly form = new FormGroup({ files: new FormControl<UploadedFile[]>([], { nonNullable: true, validators: Validators.required }) });
  readonly accept = signal('');
  readonly maxSize = signal(0);
  readonly maxFiles = signal(0);
  readonly multiple = signal(true);
  readonly camera = signal<FileUploadCameraMode>('off');
  readonly layout = signal<FileUploadLayout>('list');
  readonly concurrency = signal(3);
  readonly busy: boolean[] = [];
  readonly removed: UploadedFile[] = [];
  readonly rejected: FileRejection[][] = [];
}

@Component({
  imports: [FileUploadComponent],
  template: `<lib-file-upload readonly layout="list" [value]="files()" />`,
})
class ReadonlyHostComponent {
  readonly files = signal<UploadedFile[]>([]);
}

function file(name: string, type: string, size = 10): File {
  return new File(['x'.repeat(size)], name, { type });
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }
}

function choose(fixture: ComponentFixture<unknown>, files: File[]): void {
  const input = fixture.nativeElement.querySelector('input[type=file]:not([capture])') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

function rows(fixture: ComponentFixture<unknown>): HTMLElement[] {
  return Array.from(fixture.nativeElement.querySelectorAll('lib-file-upload-item'));
}

function rowText(row: HTMLElement): string {
  return row.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function live(fixture: ComponentFixture<unknown>): string {
  return (fixture.nativeElement.querySelector('[aria-live]') as HTMLElement).textContent?.trim() ?? '';
}

describe('file-upload utils', () => {
  it('formatFileSize：1024 進位、小數一位', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatFileSize(3.46 * 1024 * 1024)).toBe('3.5 MB');
  });

  it('matchesAccept：MIME、萬用 MIME、副檔名，不分大小寫；空字串全部接受', () => {
    expect(matchesAccept(file('a.PDF', ''), '.pdf')).toBe(true);
    expect(matchesAccept(file('a.png', 'image/png'), 'image/*')).toBe(true);
    expect(matchesAccept(file('a.png', 'image/png'), 'application/pdf, .pdf')).toBe(false);
    expect(matchesAccept(file('a.txt', 'text/plain'), '')).toBe(true);
    expect(acceptsImages('.pdf')).toBe(false);
    expect(acceptsImages('image/*,.pdf')).toBe(true);
  });

  it('splitFileName：後段保留最後幾個字與副檔名；類型圖示', () => {
    expect(splitFileName('2026-第三季設備維修報價單-最終版.pdf')).toEqual({ start: '2026-第三季設備維修報', end: '價單-最終版.pdf' });
    expect(splitFileName('a.pdf')).toEqual({ start: '', end: 'a.pdf' });
    expect(fileTypeIcon(file('x.xlsx', ''))).toBe('table_chart');
    expect(fileTypeIcon(file('x.pdf', 'application/pdf'))).toBe('picture_as_pdf');
  });
});

describe('FILE_UPLOAD_LABELS', () => {
  it('沒有提供或少了句子時丟出錯誤並列出缺的名稱', () => {
    expect(() => assertFileUploadLabels(null)).toThrow(/FILE_UPLOAD_LABELS/);
    const partial: Partial<FileUploadLabels> = { ...LABELS, retry: '', close: undefined };
    expect(() => assertFileUploadLabels(partial)).toThrow(/「retry」「close」/);
    expect(formatFileUploadLabel('已上傳 {name}（{x}）', { name: 'a.pdf' })).toBe('已上傳 a.pdf（{x}）');
  });

  it('元件建立時缺少文字就丟錯', () => {
    TestBed.configureTestingModule({});
    expect(() => TestBed.createComponent(FormHostComponent).detectChanges()).toThrow(/FILE_UPLOAD_LABELS/);
  });
});

describe('FileUploadComponent', () => {
  let created: string[];
  let revoked: string[];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    created = [];
    revoked = [];
    let n = 0;
    URL.createObjectURL = vi.fn(() => {
      const url = `blob:test-${++n}`;
      created.push(url);
      return url;
    });
    URL.revokeObjectURL = vi.fn((url: string) => void revoked.push(url));
    TestBed.configureTestingModule({ providers: [{ provide: FILE_UPLOAD_LABELS, useValue: LABELS }] });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    TestBed.inject(OverlayContainer).getContainerElement().innerHTML = '';
    vi.restoreAllMocks();
  });

  function setup(configure?: (host: FormHostComponent) => void) {
    const fixture = TestBed.createComponent(FormHostComponent);
    const host = fixture.componentInstance;
    configure?.(host);
    fixture.detectChanges();
    return { fixture, host, adapter: host.adapter };
  }

  it('拖放區是有名稱與說明的按鈕；限制說明自動接在 hint 後面', () => {
    const { fixture } = setup((h) => {
      h.maxSize.set(5 * 1024 * 1024);
      h.maxFiles.set(3);
    });
    const zone = fixture.nativeElement.querySelector('.fu-zone') as HTMLElement;
    expect(zone.getAttribute('role')).toBe('button');
    expect(zone.getAttribute('tabindex')).toBe('0');
    const describedBy = zone.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? [];
    const description = describedBy.map((id) => fixture.nativeElement.querySelector(`#${id}`)?.textContent ?? '').join(' ');
    expect(description).toContain('或把檔案拖放到這裡');
    expect(description).toContain('PDF 或圖片');
    expect(description).toContain('每個檔案 5 MB 以內');
    expect(description).toContain('最多 3 個');
  });

  it('Enter／Space 與點擊拖放區都打開檔案選擇器', () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    const { fixture } = setup();
    const zone = fixture.nativeElement.querySelector('.fu-zone') as HTMLElement;
    zone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    zone.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    zone.click();
    expect(click).toHaveBeenCalledTimes(3);
  });

  it('類型、大小、個數不符的檔案顯示原因，不影響其他檔案', async () => {
    const { fixture, host, adapter } = setup((h) => {
      h.accept.set('.pdf,image/*');
      h.maxSize.set(100);
      h.maxFiles.set(2);
    });
    choose(fixture, [
      file('報價單.pdf', 'application/pdf'),
      file('說明.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      file('大圖.png', 'image/png', 200),
      file('現場.jpg', 'image/jpeg'),
      file('第三個.pdf', 'application/pdf'),
    ]);
    await settle(fixture);
    const texts = rows(fixture).map(rowText);
    expect(texts[0]).toContain('報價單.pdf');
    expect(texts[1]).toContain('不支援這種檔案類型');
    expect(texts[2]).toContain('超過 100 B');
    expect(texts[3]).toContain('現場.jpg');
    expect(texts[4]).toContain('超過 2 個檔案的上限');
    expect(adapter.calls.map((c) => c.file.name)).toEqual(['報價單.pdf', '現場.jpg']);
    expect(host.rejected[0].map((r) => r.reason)).toEqual(['type', 'size', 'count']);
    expect(live(fixture)).toContain('無法加入 說明.docx：不支援這種檔案類型');
    // 無法加入的圖片不建立預覽網址。
    expect(created).toHaveLength(1);
  });

  it('上傳中顯示進度條（role=progressbar）；完成後念出、表單值只有完成的檔案', async () => {
    const { fixture, host, adapter } = setup();
    choose(fixture, [file('a.pdf', 'application/pdf'), file('b.pdf', 'application/pdf')]);
    await settle(fixture);
    expect(host.busy).toEqual([true]);
    adapter.calls[0].options.onProgress(0.45);
    fixture.detectChanges();
    const bar = rows(fixture)[0].querySelector('[role=progressbar]') as HTMLElement;
    expect(bar.getAttribute('aria-valuenow')).toBe('45');
    expect(bar.getAttribute('aria-label')).toBe('a.pdf 上傳進度');
    expect(rowText(rows(fixture)[0])).toContain('上傳中 45%');

    const a = adapter.succeed(0);
    await settle(fixture);
    expect(host.form.controls.files.value).toEqual([a]);
    expect(host.form.controls.files.valid).toBe(true);
    expect(rowText(rows(fixture)[0])).toContain('已上傳');
    expect(rows(fixture)[0].querySelector('[role=progressbar]')).toBeNull();
    expect(live(fixture)).toBe('已上傳 a.pdf');

    const b = adapter.succeed(1);
    await settle(fixture);
    expect(host.form.controls.files.value).toEqual([a, b]);
    expect(host.busy).toEqual([true, false]);
  });

  it('同時上傳數超過 concurrency 的檔案先等待', async () => {
    const { fixture, adapter } = setup((h) => h.concurrency.set(1));
    choose(fixture, [file('a.pdf', 'application/pdf'), file('b.pdf', 'application/pdf')]);
    await settle(fixture);
    expect(adapter.calls).toHaveLength(1);
    expect(rowText(rows(fixture)[1])).toContain('等待上傳');
    adapter.succeed(0);
    await settle(fixture);
    expect(adapter.calls.map((c) => c.file.name)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('失敗時顯示原因與重試；重試成功後進入表單值', async () => {
    const { fixture, host, adapter } = setup();
    choose(fixture, [file('a.pdf', 'application/pdf')]);
    await settle(fixture);
    adapter.calls[0].reject(uploadError('伺服器沒有回應'));
    await settle(fixture);
    expect(rowText(rows(fixture)[0])).toContain('伺服器沒有回應');
    expect(live(fixture)).toBe('上傳失敗：a.pdf，伺服器沒有回應');
    expect(host.form.controls.files.value).toEqual([]);

    const retry = rows(fixture)[0].querySelector('.fui-retry') as HTMLButtonElement;
    expect(retry.getAttribute('aria-label')).toBe('重試上傳 a.pdf');
    retry.click();
    await settle(fixture);
    expect(adapter.calls).toHaveLength(2);
    const a = adapter.succeed(1);
    await settle(fixture);
    expect(host.form.controls.files.value).toEqual([a]);
  });

  it('沒有原因的錯誤只顯示「上傳失敗」', async () => {
    const { fixture, adapter } = setup();
    choose(fixture, [file('a.pdf', 'application/pdf')]);
    await settle(fixture);
    adapter.calls[0].reject(new Error('500 internal'));
    await settle(fixture);
    expect(rowText(rows(fixture)[0])).toContain('上傳失敗');
    expect(rowText(rows(fixture)[0])).not.toContain('500');
  });

  it('取消會 abort 上傳的 signal、拿掉那一列，焦點移到下一列', async () => {
    const { fixture, adapter } = setup();
    choose(fixture, [file('a.pdf', 'application/pdf'), file('b.pdf', 'application/pdf')]);
    await settle(fixture);
    const signal = adapter.calls[0].options.signal;
    (rows(fixture)[0].querySelector('[data-action=cancel]') as HTMLButtonElement).click();
    await settle(fixture);
    expect(signal.aborted).toBe(true);
    expect(rows(fixture).map(rowText).join('|')).not.toContain('a.pdf');
    expect(live(fixture)).toBe('已取消上傳 a.pdf');
    expect((document.activeElement as HTMLElement | null)?.querySelector('lib-file-upload-item')?.textContent).toContain('b.pdf');
  });

  it('移除已上傳的圖片：釋放預覽網址、呼叫 adapter.release、送出 removed；最後一個移除後焦點回到拖放區', async () => {
    const { fixture, host, adapter } = setup();
    fixture.nativeElement.querySelector('.fu-zone').focus();
    choose(fixture, [file('現場.jpg', 'image/jpeg')]);
    await settle(fixture);
    const result = adapter.succeed(0);
    await settle(fixture);
    expect(rows(fixture)[0].querySelector('img')?.getAttribute('src')).toBe(result.url);
    (rows(fixture)[0].querySelector('[data-action=remove]') as HTMLButtonElement).click();
    await settle(fixture);
    expect(revoked).toEqual(created);
    expect(adapter.released).toEqual([result]);
    expect(host.removed).toEqual([result]);
    expect(host.form.controls.files.value).toEqual([]);
    expect(live(fixture)).toBe('已移除 現場.jpg');
    expect(document.activeElement?.classList).toContain('fu-zone');
  });

  it('元件銷毀時取消上傳中的檔案、釋放所有預覽網址', async () => {
    const { fixture, adapter } = setup();
    choose(fixture, [file('a.jpg', 'image/jpeg'), file('b.jpg', 'image/jpeg')]);
    await settle(fixture);
    adapter.succeed(0);
    await settle(fixture);
    const signal = adapter.calls[1].options.signal;
    fixture.destroy();
    expect(signal.aborted).toBe(true);
    expect(revoked.sort()).toEqual([...created].sort());
    expect(adapter.released.map((f) => f.id)).toEqual(['f-0']);
  });

  it('required：沒有檔案時無效，碰過之後拖放區顯示錯誤；上傳中 busy', async () => {
    const { fixture, host, adapter } = setup();
    const control = host.form.controls.files;
    expect(control.invalid).toBe(true);
    expect(fixture.nativeElement.querySelector('.fu-error')).toBeNull();
    host.form.markAllAsTouched();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.fu-error')?.textContent).toContain('請至少上傳一個附件');
    expect(fixture.nativeElement.querySelector('.fu-zone').classList).toContain('is-invalid');
    expect(fixture.nativeElement.querySelector('.fu-label')?.textContent).toContain('*');

    choose(fixture, [file('a.pdf', 'application/pdf')]);
    await settle(fixture);
    const component = fixture.debugElement.children[0].children[0].componentInstance as FileUploadComponent;
    expect(component.busy()).toBe(true);
    expect(control.invalid).toBe(true);
    adapter.succeed(0);
    await settle(fixture);
    expect(component.busy()).toBe(false);
    expect(control.valid).toBe(true);
    expect(fixture.nativeElement.querySelector('.fu-error')).toBeNull();
  });

  it('表單停用時拖放區與動作都停用；reset 清空已上傳的列', async () => {
    const { fixture, host, adapter } = setup();
    choose(fixture, [file('a.pdf', 'application/pdf')]);
    await settle(fixture);
    adapter.succeed(0);
    await settle(fixture);
    host.form.disable();
    fixture.detectChanges();
    const zone = fixture.nativeElement.querySelector('.fu-zone') as HTMLElement;
    expect(zone.getAttribute('aria-disabled')).toBe('true');
    expect(zone.getAttribute('tabindex')).toBe('-1');
    expect((rows(fixture)[0].querySelector('[data-action=remove]') as HTMLButtonElement).disabled).toBe(true);
    host.form.enable();
    host.form.reset();
    fixture.detectChanges();
    expect(rows(fixture)).toHaveLength(0);
  });

  it('writeValue 帶入既有的附件（顯示為已上傳）', () => {
    const { fixture, host } = setup();
    host.form.setValue({ files: [{ id: 'x', name: '合約.pdf', size: 2048, type: 'application/pdf', url: 'https://x' }] });
    fixture.detectChanges();
    expect(rowText(rows(fixture)[0])).toContain('合約.pdf');
    expect(rowText(rows(fixture)[0])).toContain('2 KB');
    expect(rowText(rows(fixture)[0])).toContain('已上傳');
  });

  it('單一檔案模式：新選的檔案取代原本的', async () => {
    const { fixture, host, adapter } = setup((h) => h.multiple.set(false));
    choose(fixture, [file('a.pdf', 'application/pdf')]);
    await settle(fixture);
    const a = adapter.succeed(0);
    await settle(fixture);
    choose(fixture, [file('b.pdf', 'application/pdf'), file('c.pdf', 'application/pdf')]);
    await settle(fixture);
    expect(rows(fixture).map(rowText).join('|')).not.toContain('a.pdf');
    expect(rows(fixture)).toHaveLength(1);
    expect(host.removed).toEqual([a]);
    expect(host.form.controls.files.value).toEqual([]);
  });

  it('聚焦拖放區時貼上圖片會加入；拖放檔案時顯示拖放狀態', async () => {
    const { fixture, adapter } = setup();
    const zone = fixture.nativeElement.querySelector('.fu-zone') as HTMLElement;
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { files: [file('截圖.png', 'image/png')] } });
    zone.dispatchEvent(paste);
    await settle(fixture);
    expect(paste.defaultPrevented).toBe(true);
    expect(adapter.calls.map((c) => c.file.name)).toEqual(['截圖.png']);

    const drag = (type: string, files: File[] = []) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'], files, dropEffect: 'none' } });
      zone.dispatchEvent(event);
      fixture.detectChanges();
      return event;
    };
    drag('dragenter');
    expect(zone.classList).toContain('is-dragover');
    expect(zone.textContent).toContain('放開以加入檔案');
    expect(drag('dragover').defaultPrevented).toBe(true);
    drag('drop', [file('拖進來.pdf', 'application/pdf')]);
    await settle(fixture);
    expect(zone.classList).not.toContain('is-dragover');
    expect(adapter.calls.map((c) => c.file.name)).toEqual(['截圖.png', '拖進來.pdf']);
  });

  it('grid 版面：清單是縮圖方塊；按縮圖打開預覽', async () => {
    const { fixture, adapter } = setup((h) => h.layout.set('grid'));
    choose(fixture, [file('a.jpg', 'image/jpeg'), file('b.jpg', 'image/jpeg')]);
    await settle(fixture);
    adapter.succeed(0);
    adapter.succeed(1);
    await settle(fixture);
    expect(fixture.nativeElement.querySelector('.fu-list').classList).toContain('fu-list--grid');
    (rows(fixture)[1].querySelector('.fui-thumb') as HTMLButtonElement).click();
    fixture.detectChanges();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    expect(overlay.querySelector('.fup-title')?.textContent).toContain('b.jpg');
    expect(overlay.querySelector('.fup-counter')?.textContent).toContain('2／2');
  });

  describe('拍照', () => {
    afterEach(() => {
      delete (navigator as { mediaDevices?: unknown }).mediaDevices;
    });

    it('camera="off" 不顯示拍照鈕；accept 不允許圖片時 auto 也不顯示', () => {
      const { fixture, host } = setup();
      expect(fixture.nativeElement.querySelector('[data-camera-button]')).toBeNull();
      host.camera.set('only');
      host.accept.set('.pdf');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-camera-button]')).toBeNull();
    });

    it('瀏覽器沒有 navigator.mediaDevices 時說明原因並改為打開檔案選擇器', () => {
      const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
      const { fixture } = setup((h) => h.camera.set('only'));
      expect(fixture.nativeElement.querySelector('.fu-zone')).toBeNull();
      (fixture.nativeElement.querySelector('[data-camera-button]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.fu-notice')?.textContent).toContain('找不到可以使用的相機');
      expect(click).toHaveBeenCalledTimes(1);
    });

    it('auto：桌機查不到相機時不顯示拍照鈕', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: vi.fn(), enumerateDevices: vi.fn(async () => [{ kind: 'audioinput' }]) },
      });
      const { fixture } = setup((h) => h.camera.set('auto'));
      expect(fixture.nativeElement.querySelector('[data-camera-button]')).not.toBeNull();
      await settle(fixture);
      expect(fixture.nativeElement.querySelector('[data-camera-button]')).toBeNull();
    });

    it('沒有相機權限：對話框說明原因，提供改為選擇檔案', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: vi.fn(async () => Promise.reject(new DOMException('denied', 'NotAllowedError'))) },
      });
      const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
      const injector = TestBed.inject(Injector);
      const result = openFileUploadCameraDialog(injector, { labels: LABELS, accept: 'image/*' });
      const overlay = TestBed.inject(OverlayContainer).getContainerElement();
      await vi.waitFor(() => expect(overlay.querySelector('[data-camera-error=denied]')).not.toBeNull());
      expect(overlay.textContent).toContain('沒有相機權限');
      const fallback = Array.from(overlay.querySelectorAll('button')).find((b) => b.textContent?.includes('改為選擇檔案'));
      fallback?.click();
      expect(click).toHaveBeenCalledTimes(1);
      const input = overlay.querySelector('input[type=file]') as HTMLInputElement;
      const photo = file('p.jpg', 'image/jpeg');
      Object.defineProperty(input, 'files', { value: [photo], configurable: true });
      input.dispatchEvent(new Event('change'));
      await expect(result).resolves.toEqual([photo]);
    });

    it('有相機：即時預覽、有兩個鏡頭時可以切換；關閉時停掉所有軌道', async () => {
      const stops: string[] = [];
      const stream = (id: string) => ({ getTracks: () => [{ stop: () => stops.push(id) }] });
      let n = 0;
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: vi.fn(async () => stream(`s${++n}`)),
          enumerateDevices: vi.fn(async () => [{ kind: 'videoinput' }, { kind: 'videoinput' }]),
        },
      });
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async () => undefined);
      const result = openFileUploadCameraDialog(TestBed.inject(Injector), { labels: LABELS, accept: 'image/*' });
      const overlay = TestBed.inject(OverlayContainer).getContainerElement();
      const button = (text: string) => Array.from(overlay.querySelectorAll('button')).find((b) => b.textContent?.includes(text));
      await vi.waitFor(() => expect(button('切換鏡頭')).toBeTruthy());
      expect(button('拍攝')).toBeTruthy();
      button('切換鏡頭')?.click();
      await vi.waitFor(() => expect(stops).toEqual(['s1']));
      button('關閉')?.click();
      await expect(result).resolves.toBeNull();
      expect(stops).toEqual(['s1', 's2']);
    });
  });
});

describe('唯讀模式', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: FILE_UPLOAD_LABELS, useValue: LABELS }] });
  });

  it('只列出附件與下載連結，沒有拖放區與動作；沒有附件時顯示空狀態', () => {
    const fixture = TestBed.createComponent(ReadonlyHostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.fu-zone')).toBeNull();
    expect(fixture.nativeElement.querySelector('.fu-empty')?.textContent).toContain('沒有附件');

    fixture.componentInstance.files.set([
      { id: '1', name: '合約.pdf', size: 1024, type: 'application/pdf', url: 'https://files.example.com/1' },
      { id: '2', name: '說明.txt', size: 10, type: 'text/plain' },
    ]);
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a.fui-name') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://files.example.com/1');
    expect(link.getAttribute('download')).toBe('合約.pdf');
    expect(link.getAttribute('aria-label')).toBe('下載 合約.pdf');
    expect(fixture.nativeElement.querySelectorAll('a.fui-name')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('已上傳');
  });
});

describe('openFileUploadPreviewDialog', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('上一張／下一張與方向鍵循環切換', () => {
    openFileUploadPreviewDialog(TestBed.inject(Injector), {
      labels: LABELS,
      images: [
        { name: 'a.jpg', url: 'blob:a' },
        { name: 'b.jpg', url: 'blob:b' },
        { name: 'c.jpg', url: 'blob:c' },
      ],
      index: 0,
    });
    TestBed.tick();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const title = () => overlay.querySelector('.fup-title')?.textContent?.trim();
    expect(title()).toBe('a.jpg');
    (overlay.querySelector('[data-preview=previous]') as HTMLButtonElement).click();
    TestBed.tick();
    expect(title()).toBe('c.jpg');
    overlay.querySelector('lib-file-upload-preview-dialog')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    TestBed.tick();
    expect(title()).toBe('a.jpg');
    expect(overlay.querySelector('img')?.getAttribute('alt')).toBe('a.jpg');
    overlay.innerHTML = '';
  });
});

describe('createDemoUploadAdapter', () => {
  it('回報進度、回傳 object URL；failNames 第一次失敗、重試成功；release 釋放網址', async () => {
    vi.useFakeTimers();
    const created: string[] = [];
    const revoked: string[] = [];
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => {
      created.push('blob:demo');
      return 'blob:demo';
    };
    URL.revokeObjectURL = (url: string) => void revoked.push(url);
    try {
      const adapter = createDemoUploadAdapter({ delayMs: 100, steps: 4, failNames: ['壞'], failMessage: '示範失敗' });
      const progress: number[] = [];
      const ok = adapter.upload(file('好.pdf', 'application/pdf'), {
        signal: new AbortController().signal,
        onProgress: (f) => progress.push(f),
      });
      await vi.advanceTimersByTimeAsync(100);
      const result = await ok;
      expect(progress).toEqual([0.25, 0.5, 0.75, 1]);
      expect(result.url).toBe('blob:demo');

      const bad = adapter.upload(file('壞.pdf', 'application/pdf'), { signal: new AbortController().signal, onProgress: () => undefined });
      const badResult = expect(bad).rejects.toThrow('示範失敗');
      await vi.advanceTimersByTimeAsync(100);
      await badResult;
      const again = adapter.upload(file('壞.pdf', 'application/pdf'), { signal: new AbortController().signal, onProgress: () => undefined });
      await vi.advanceTimersByTimeAsync(100);
      await expect(again).resolves.toMatchObject({ name: '壞.pdf' });

      const abort = new AbortController();
      const canceled = adapter.upload(file('慢.pdf', 'application/pdf'), { signal: abort.signal, onProgress: () => undefined });
      abort.abort();
      await expect(canceled).rejects.toMatchObject({ name: 'AbortError' });

      adapter.release?.(result);
      expect(revoked).toEqual(['blob:demo']);
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      vi.useRealTimers();
    }
  });
});
