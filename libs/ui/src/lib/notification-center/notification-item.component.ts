import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { NotificationCenterLabels, formatNotificationLabel } from './notification-center-labels';
import { NotificationItem } from './notification-source';

/** 一則通知的時間：機器可讀、相對時間、完整日期時間。 */
export interface NotificationItemTime {
  iso: string;
  ago: string;
  full: string;
}

/** 列表裡的一則通知（內部元件，讓每份樣式表留在 8 kB 以內）。 */
@Component({
  selector: 'li[lib-notification-item]',
  imports: [MatButton, MatIconButton],
  templateUrl: './notification-item.component.html',
  styleUrl: './notification-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lib-notification-item',
    '[class.is-unread]': '!item().read',
    '[attr.data-notification-id]': 'item().id',
  },
})
export class NotificationItemComponent {
  readonly item = input.required<NotificationItem>();
  readonly time = input.required<NotificationItemTime>();
  readonly labels = input.required<NotificationCenterLabels>();
  readonly categoryLabel = input('');
  /** 這一則是不是清單裡唯一在 Tab 順序裡的那一則（roving tabindex）。 */
  readonly tabbable = input(false);
  readonly idPrefix = input.required<string>();

  /** 點了通知本身。 */
  readonly activate = output<void>();
  readonly toggleRead = output<void>();
  readonly remove = output<void>();
  readonly runAction = output<void>();
  /** 通知本身的按鍵（上下鍵、Home／End、Delete 由清單處理）。 */
  readonly navigate = output<KeyboardEvent>();
  readonly focused = output<void>();

  protected readonly tabIndex = computed(() => (this.tabbable() ? 0 : -1));
  protected readonly baseId = computed(() => `${this.idPrefix()}-${this.item().id}`);
  protected readonly lead = computed(() => {
    const item = this.item();
    return item.avatar ? { avatar: item.avatar, icon: '' } : { avatar: '', icon: item.icon || 'notifications' };
  });
  protected readonly readLabel = computed(() =>
    formatNotificationLabel(this.item().read ? this.labels().markUnread : this.labels().markRead, { title: this.item().title }),
  );
  protected readonly removeLabel = computed(() =>
    formatNotificationLabel(this.labels().remove, { title: this.item().title }),
  );
}
