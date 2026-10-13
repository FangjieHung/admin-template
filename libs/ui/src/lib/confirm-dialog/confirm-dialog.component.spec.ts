import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, Injector, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { CONFIRM_DIALOG_LABELS, ConfirmDialogData, openConfirmDialog } from './confirm-dialog.component';

function buttons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll('.cdk-overlay-container button'));
}

/** 只在自己的 providers 提供 CONFIRM_DIALOG_LABELS 的頁面（admin 的展示頁都是這樣）。 */
@Component({
  selector: 'lib-test-page',
  template: '',
  providers: [{ provide: CONFIRM_DIALOG_LABELS, useValue: { confirm: '好', cancel: '算了' } }],
})
class PageWithLabelsComponent {
  private readonly injector = inject(Injector);
  confirm(data: ConfirmDialogData): Promise<boolean> {
    return openConfirmDialog(this.injector, data);
  }
}

describe('openConfirmDialog', () => {
  afterEach(() => {
    TestBed.inject(OverlayContainer).getContainerElement().innerHTML = '';
  });

  describe('app 層提供文字', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [{ provide: CONFIRM_DIALOG_LABELS, useValue: { confirm: '確認', cancel: '取消' } }],
      });
    });

    it('顯示訊息與預設按鈕文字；按確認回 true', async () => {
      const result = openConfirmDialog(TestBed.inject(Injector), { message: '確定刪除？' });
      TestBed.tick();
      expect(document.querySelector('.confirm-dialog__content')?.textContent).toContain('確定刪除？');
      expect(buttons().map((b) => b.textContent?.trim())).toEqual(['取消', '確認']);
      buttons()[1].click();
      TestBed.tick();
      await expect(result).resolves.toBe(true);
    });

    it('data 的按鈕文字與標題優先；按取消回 false', async () => {
      const result = openConfirmDialog(TestBed.inject(Injector), {
        title: '刪除專案',
        message: '刪除後無法復原。',
        confirmLabel: '刪除',
        cancelLabel: '先不要',
        tone: 'primary',
      });
      TestBed.tick();
      expect(document.querySelector('[mat-dialog-title]')?.textContent).toContain('刪除專案');
      expect(buttons().map((b) => b.textContent?.trim())).toEqual(['先不要', '刪除']);
      expect(buttons()[1].classList).not.toContain('confirm-dialog__confirm--danger');
      buttons()[0].click();
      TestBed.tick();
      await expect(result).resolves.toBe(false);
    });
  });

  describe('只在頁面層提供文字（MatDialog 自己的 injector 看不到）', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [PageWithLabelsComponent] });
    });

    it('用頁面的 injector 開：對話框讀得到頁面 providers 的文字（以前會開成空白並報「缺少 cancel 按鈕文字」）', async () => {
      const page = TestBed.createComponent(PageWithLabelsComponent).componentInstance;
      const result = page.confirm({ message: '刪除所有自訂角色？', confirmLabel: '還原' });
      TestBed.tick();
      expect(document.querySelector('.confirm-dialog__content')?.textContent).toContain('刪除所有自訂角色？');
      expect(buttons().map((b) => b.textContent?.trim())).toEqual(['算了', '還原']);
      buttons()[0].click();
      TestBed.tick();
      await expect(result).resolves.toBe(false);
    });

    it('哪裡都沒有文字：開啟之前就丟錯，不會開出空白對話框', async () => {
      await expect(openConfirmDialog(TestBed.inject(Injector), { message: '確定？', confirmLabel: '好' })).rejects.toThrow(
        '缺少「cancel」按鈕文字',
      );
      TestBed.tick();
      expect(document.querySelector('.cdk-overlay-container mat-dialog-container, .cdk-overlay-container .mat-mdc-dialog-container')).toBeNull();
    });
  });
});
