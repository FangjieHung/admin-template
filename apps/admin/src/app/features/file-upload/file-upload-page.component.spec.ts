import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { FileUploadPageComponent } from './file-upload-page.component';

describe('FileUploadPageComponent（附件上傳展示頁）', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  const demo = (id: string) => el.querySelector<HTMLElement>(`[data-demo="${id}"]`)!;
  const rows = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('lib-file-upload-item'));
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      harness.detectChanges();
      await new Promise((resolve) => setTimeout(resolve));
    }
    harness.detectChanges();
  };

  beforeEach(async () => {
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: FileUploadPageComponent }])] });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/components/file-upload', FileUploadPageComponent);
    el = harness.routeNativeElement as HTMLElement;
    await settle();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    TestBed.inject(OverlayContainer).getContainerElement().innerHTML = '';
  });

  it('有五個示範：工單附件、現場照片（grid＋拍照）、表單、唯讀、限制', () => {
    for (const id of ['ticket', 'photos', 'form', 'readonly', 'limits']) expect(demo(id)).not.toBeNull();
    expect(demo('photos').querySelector('lib-file-upload')?.classList).toContain('lib-file-upload--grid');
    expect(demo('readonly').querySelector('.fu-zone')).toBeNull();
    expect(demo('readonly').textContent).toContain('維修完工報告.pdf');
    expect(demo('readonly').querySelector('a.fui-name')?.getAttribute('href')).toBe('blob:test');
  });

  it('工單附件：加入示範檔案後逐一上傳', async () => {
    demo('ticket').querySelector<HTMLButtonElement>('[data-demo-action="ticket"]')!.click();
    await settle();
    expect(rows(demo('ticket'))).toHaveLength(4);
    expect(demo('ticket').textContent).toContain('上傳中');
  });

  it('限制：類型、大小、個數不符的檔案寫出原因', async () => {
    demo('limits').querySelector<HTMLButtonElement>('[data-demo-action="limits"]')!.click();
    await settle();
    const text = demo('limits').textContent ?? '';
    expect(text).toContain('超過 5 MB，無法上傳');
    expect(text).toContain('不支援這種檔案類型');
    expect(text).toContain('超過 3 個檔案的上限');
  });

  it('表單：沒有附件時送出顯示錯誤；上傳中送出鈕停用', async () => {
    const form = demo('form');
    form.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await settle();
    expect(form.querySelector('.fu-error')?.textContent).toContain('請至少上傳一個附件');

    const input = form.querySelector<HTMLInputElement>('lib-file-upload input[type=file]:not([capture])')!;
    Object.defineProperty(input, 'files', { value: [new File(['x'], '報價單.pdf', { type: 'application/pdf' })], configurable: true });
    input.dispatchEvent(new Event('change'));
    await settle();
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submit.disabled).toBe(true);
    expect(submit.textContent).toContain('附件上傳中');
  });
});
