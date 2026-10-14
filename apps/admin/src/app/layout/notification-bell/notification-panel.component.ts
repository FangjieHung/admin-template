import { Component, ElementRef, ViewEncapsulation, afterNextRender, inject, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconButton } from '../../../vendor/mat-icon-button';
import { NotificationActionEvent, NotificationItem, NotificationListComponent, NotificationSource } from '@admin-template/ui';
import { NotificationCenterService } from '../../core/notifications/notification-center.service';
import { NOTIFICATION_CENTER_LABEL_PROVIDERS, ZH_TW_NOTIFICATION_PANEL } from '../../shared/ui/notification-center-labels';

/** 面板的 id（鈴鐺的 aria-controls 寫同一個字串：鈴鐺在 Initial bundle，不 import 這個檔案）。 */
export const NOTIFICATION_PANEL_ID = 'app-notification-panel';

/**
 * 頁首鈴鐺打開的通知面板（鈴鐺第一次打開時才載入，跟 lib-notification-list 一起在 lazy chunk）。
 * 點了通知就導覽到它的連結並關閉面板；面板關著時新通知改用提示訊息（core/notifications/demo-notifications.ts）。
 * 不設成 modal：焦點離開面板（Tab 到外面）就收起來。
 */
@Component({
  selector: 'app-notification-panel',
  imports: [RouterLink, MatIconButton, NotificationListComponent],
  providers: [...NOTIFICATION_CENTER_LABEL_PROVIDERS],
  templateUrl: './notification-panel.component.html',
  styleUrl: './notification-panel.component.scss',
  // overlay pane 的滿版規則（600px 以下）要寫在全域；其餘 class 都有 np- 前綴。
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'np-panel lib-notification-center',
    role: 'dialog',
    tabindex: '-1',
    id: NOTIFICATION_PANEL_ID,
    'aria-labelledby': NOTIFICATION_PANEL_ID + '-title',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class NotificationPanelComponent {
  /** 面板要關：關閉鈕、點了通知（true：焦點回到鈴鐺）、焦點已經移到面板外面（false）。 */
  readonly closed = output<boolean>();

  protected readonly t = ZH_TW_NOTIFICATION_PANEL;
  protected readonly source = signal<NotificationSource | null>(null);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const center = inject(NotificationCenterService);
    void center.load().then((runtime) => this.source.set(runtime.source));
    // 打開時焦點移進面板（報讀器念出「通知 對話框」），Tab 接著進到篩選與通知。
    afterNextRender(() => this.host.nativeElement.focus());
  }

  protected openItem(item: NotificationItem): void {
    this.closed.emit(true);
    if (item.link) void this.router.navigateByUrl(item.link);
  }

  protected onAction(event: NotificationActionEvent): void {
    this.openItem(event.item);
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    // relatedTarget 是 null：元素被移除（例如移除一則通知）或視窗失焦，不算離開。
    if (!next || this.host.nativeElement.contains(next)) return;
    if (document.querySelector('.topbar-bell')?.contains(next)) return;
    this.closed.emit(false);
  }
}
