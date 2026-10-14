import { Injectable, Provider, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ToastComponent } from './toast.component';
import { TOAST_DURATIONS, TOAST_LABELS, ToastData, ToastLabels, ToastOptions, ToastRef, ToastType } from './toast.types';

/**
 * 提示訊息（toast）：成功、資訊、警告、錯誤 4 類，底部置中、一次只有一則（新的會取代舊的），最多一個動作。
 * 包在 MatSnackBar 外面；報讀器透過 snackbar 的 live region 念出訊息（錯誤 assertive，其餘 polite）。
 *
 * 不是 root 服務：用 `provideToast(labels)` 提供（app 根層或頁面的 providers 都可以），
 * 這樣 TOAST_LABELS 跟服務在同一層，頁面層提供時也找得到。所有實例共用同一個 MatSnackBar，所以全站仍是一次一則。
 */
@Injectable()
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly labels = inject(TOAST_LABELS, { optional: true });

  success(message: string, options?: ToastOptions): ToastRef {
    return this.show('success', message, options);
  }

  info(message: string, options?: ToastOptions): ToastRef {
    return this.show('info', message, options);
  }

  warning(message: string, options?: ToastOptions): ToastRef {
    return this.show('warning', message, options);
  }

  /** 錯誤不會自動消失，一定有關閉鈕。 */
  error(message: string, options?: ToastOptions): ToastRef {
    return this.show('error', message, options);
  }

  show(type: ToastType, message: string, options: ToastOptions = {}): ToastRef {
    const preset = TOAST_DURATIONS[type];
    const duration = preset === null ? null : (options.duration ?? preset);
    const data: ToastData = {
      type,
      message,
      action: options.action || null,
      // 不會自己消失的提示一定要能關掉。
      closeLabel: duration === null ? this.closeLabel() : null,
      duration,
    };
    const ref = this.snackBar.openFromComponent(ToastComponent, {
      data,
      // 計時由 ToastComponent 自己管（滑過、聚焦時暫停），不交給 MatSnackBar 的 duration。
      duration: 0,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      politeness: type === 'error' ? 'assertive' : 'polite',
      panelClass: ['lib-toast-panel', `lib-toast-panel--${type}`],
    });

    let clicked = false;
    const actionClicked = new Promise<boolean>((resolve) => {
      ref.onAction().subscribe(() => {
        clicked = true;
        resolve(true);
      });
      ref.afterDismissed().subscribe(() => resolve(clicked));
    });
    const afterDismissed = new Promise<void>((resolve) => ref.afterDismissed().subscribe(() => resolve()));
    return { actionClicked, afterDismissed, dismiss: () => ref.dismiss() };
  }

  /** 關掉目前顯示中的提示（如果有）。 */
  dismiss(): void {
    this.snackBar.dismiss();
  }

  private closeLabel(): string {
    if (!this.labels?.close) {
      throw new Error('ToastService：缺少「close」文字。請用 provideToast({ close: … }) 提供 TOAST_LABELS。');
    }
    return this.labels.close;
  }
}

/** 提供 ToastService 與它的內建文字。例：`providers: [provideToast({ close: '關閉' })]`。 */
export function provideToast(labels: ToastLabels): Provider[] {
  return [ToastService, { provide: TOAST_LABELS, useValue: labels }];
}
