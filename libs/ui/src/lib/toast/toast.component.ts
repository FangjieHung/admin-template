import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_SNACK_BAR_DATA,
  MatSnackBarAction,
  MatSnackBarActions,
  MatSnackBarLabel,
  MatSnackBarRef,
} from '@angular/material/snack-bar';
import { ToastData, ToastType } from './toast.types';

// 圖示放在圓形徽章裡，所以選本身不帶圓框、形狀互不相同的字符（不只靠顏色分辨類型）。
const ICON: Record<ToastType, string> = {
  success: 'check',
  info: 'info_i',
  warning: 'warning',
  error: 'priority_high',
};

// 類型 → 狀態語意的色調（CONTRACT.md 的 --app-{tone}-bg/-fg）。
const TONE: Record<ToastType, string> = {
  success: 'positive',
  info: 'info',
  warning: 'warning',
  error: 'danger',
};

/**
 * 提示訊息的內容（由 ToastService 透過 MatSnackBar.openFromComponent 開啟，不直接使用）。
 * 自己管理自動消失的計時，才能在滑鼠移入、鍵盤聚焦時暫停。
 */
@Component({
  selector: 'lib-toast',
  imports: [MatButtonModule, MatSnackBarLabel, MatSnackBarActions, MatSnackBarAction],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lib-toast',
    '[attr.data-type]': 'data.type',
    '(mouseenter)': 'pause("hover")',
    '(mouseleave)': 'resume("hover")',
    '(focusin)': 'pause("focus")',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class ToastComponent {
  protected readonly data = inject<ToastData>(MAT_SNACK_BAR_DATA);
  private readonly ref = inject<MatSnackBarRef<ToastComponent>>(MatSnackBarRef);

  protected readonly icon = ICON[this.data.type];
  protected readonly tone = TONE[this.data.type];

  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly holds = new Set<'hover' | 'focus'>();
  private opened = false;

  constructor() {
    // 進場動畫結束才開始計時（與 MatSnackBar 自己的 duration 相同的起點）。
    this.ref.afterOpened().subscribe(() => {
      this.opened = true;
      this.schedule();
    });
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  protected runAction(): void {
    this.ref.dismissWithAction();
  }

  protected close(): void {
    this.ref.dismiss();
  }

  protected pause(reason: 'hover' | 'focus'): void {
    this.holds.add(reason);
    this.clear();
  }

  protected resume(reason: 'hover' | 'focus'): void {
    this.holds.delete(reason);
    this.schedule();
  }

  protected onFocusOut(event: FocusEvent): void {
    const host = event.currentTarget as HTMLElement | null;
    // 焦點只是在提示裡的兩顆按鈕之間移動時不算離開。
    if (host && event.relatedTarget instanceof Node && host.contains(event.relatedTarget)) return;
    this.resume('focus');
  }

  private schedule(): void {
    this.clear();
    const duration = this.data.duration;
    if (!this.opened || duration === null || this.holds.size > 0) return;
    this.timer = setTimeout(() => this.ref.dismiss(), duration);
  }

  private clear(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
