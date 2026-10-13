import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { CONFIRM_DIALOG_LABELS, openConfirmDialog } from './confirm-dialog.component';

function buttons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll('.cdk-overlay-container button'));
}

describe('openConfirmDialog', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: CONFIRM_DIALOG_LABELS, useValue: { confirm: '確認', cancel: '取消' } }],
    });
  });

  it('顯示訊息與預設按鈕文字；按確認回 true', async () => {
    const dialog = TestBed.inject(MatDialog);
    const result = openConfirmDialog(dialog, { message: '確定刪除？' });
    TestBed.tick();
    expect(document.querySelector('.confirm-dialog__content')?.textContent).toContain('確定刪除？');
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['取消', '確認']);
    buttons()[1].click();
    TestBed.tick();
    await expect(result).resolves.toBe(true);
  });

  it('data 的按鈕文字與標題優先；按取消回 false', async () => {
    const dialog = TestBed.inject(MatDialog);
    const result = openConfirmDialog(dialog, { title: '刪除專案', message: '刪除後無法復原。', confirmLabel: '刪除', cancelLabel: '先不要', tone: 'primary' });
    TestBed.tick();
    expect(document.querySelector('[mat-dialog-title]')?.textContent).toContain('刪除專案');
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['先不要', '刪除']);
    expect(buttons()[1].classList).not.toContain('confirm-dialog__confirm--danger');
    buttons()[0].click();
    TestBed.tick();
    await expect(result).resolves.toBe(false);
  });
});
