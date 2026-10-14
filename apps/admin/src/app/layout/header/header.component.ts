import { Component, computed, inject, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconButton } from '../../../vendor/mat-icon-button';
import { ZH_TW_SHELL } from '../../core/i18n/zh-tw-shell';
import { HeaderToolbarSlot } from './header-toolbar-slot';
import { HeaderTitleExtraSlot } from './header-title-extra-slot';
import { HeaderTitleData, HeaderTitleSlot } from './header-title';
import { NotificationCenterService } from '../../core/notifications/notification-center.service';

/**
 * 頁首：麵包屑（上層路徑，可點）＋大標題（這一頁的名字，頁面唯一的 h1）。
 * 預設值（`defaultTitle`）由 App 依側欄選單算出；頁面可透過 `provideHeaderTitle()`
 * （header-title.ts）登記覆寫，蓋過預設值——詳情頁這類標題含動態資料的頁面都是這樣做。
 */
@Component({
  selector: 'app-header',
  imports: [NgTemplateOutlet, RouterLink, MatIconButton],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  protected readonly t = ZH_TW_SHELL;

  readonly defaultTitle = input.required<HeaderTitleData>();
  readonly menuToggle = output<void>();

  private readonly titleSlot = inject(HeaderTitleSlot);
  protected readonly toolbarTemplate = inject(HeaderToolbarSlot).template;
  protected readonly titleExtraTemplate = inject(HeaderTitleExtraSlot).template;

  private readonly current = computed<HeaderTitleData>(
    () => this.titleSlot.entry()?.value ?? this.defaultTitle(),
  );
  protected readonly currentTitle = computed(() => this.current().title);
  protected readonly breadcrumbs = computed(() => this.current().breadcrumbs);
  protected readonly backTo = computed(() => this.current().backTo ?? null);

  /**
   * 通知鈴鐺：未讀數（0 不顯示徽章，超過 99 顯示 99+）與面板開關都在 NotificationCenterService。
   * 這裡在 Initial bundle，只放按鈕與徽章；面板、overlay 與 lib-notification-list 在
   * layout/notification-bell，第一次打開時才動態載入（NotificationCenterService.toggle）。
   */
  protected readonly notifications = inject(NotificationCenterService);
  protected readonly badge = computed(() => {
    const n = this.notifications.unread();
    return n ? (n > 99 ? '99+' : n) : null;
  });
  protected readonly bellLabel = computed(() => {
    const t = this.t.notifications;
    const n = this.notifications.unread();
    return n ? `${t.bell}，${n}${t.unread}` : t.bell;
  });
}
