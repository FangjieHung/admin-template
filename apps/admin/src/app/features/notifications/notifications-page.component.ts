import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationItem, NotificationListComponent, NotificationSource } from '@admin-template/ui';
import { provideHeaderTitle } from '../../layout/header/header-title';
import { HeaderToolbarDirective } from '../../layout/header/header-toolbar-slot';
import { NotificationCenterService } from '../../core/notifications/notification-center.service';
import {
  DEMO_NOTIFICATION_CATEGORIES,
  NOTIFICATION_CENTER_LABEL_PROVIDERS,
} from '../../shared/ui/notification-center-labels';
import { TemplateInfo, TemplateInfoComponent } from '../../shared/ui/template-info.component';

const INFO: TemplateInfo = {
  summary:
    '全部通知頁樣板：頁首鈴鐺面板的「查看全部通知」連到這裡。同一個資料來源，所以在這裡標為已讀或移除，鈴鐺的未讀數跟著變；多了類別篩選與完整寬度。',
  components: ['lib-notification-list（全部／未讀、類別、分組、載入更多）', 'NotificationSource（換成伺服器的 API 與推播）', '.ui-card（造型交給質地）'],
  replace: ['core/notifications/demo-notifications.ts 的示範資料來源（換成真正的 NotificationSource）', '類別（DEMO_NOTIFICATION_CATEGORIES）', '<app-template-info>（新專案用不到，連同 INFO 一起刪）'],
  files: [
    'apps/admin/src/app/features/notifications/notifications-page.component.ts',
    'apps/admin/src/app/layout/notification-bell/（頁首鈴鐺與面板）',
    'apps/admin/src/app/core/notifications/（未讀數與示範資料）',
  ],
};

/** 全部通知（頁面樣板，/templates/notifications）。 */
@Component({
  selector: 'app-notifications-page',
  imports: [NotificationListComponent, HeaderToolbarDirective, TemplateInfoComponent],
  providers: [...NOTIFICATION_CENTER_LABEL_PROVIDERS],
  template: `
    <ng-template appHeaderToolbar>
      <app-template-info [info]="info" />
    </ng-template>

    <section class="ui-card notifications-card" aria-label="全部通知">
      @if (source(); as s) {
        <!-- 新通知會跳提示訊息（面板關著），這裡不再另外念一次。 -->
        <lib-notification-list
          [source]="s"
          [categories]="categories"
          [pageSize]="8"
          [headingLevel]="2"
          [announceArrivals]="false"
          (open)="open($event)"
          (action)="open($event.item)"
        />
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      max-width: 56rem;
      padding-top: 0.5rem;
    }

    .notifications-card {
      padding: 0.75rem 0;
    }
  `,
})
export class NotificationsPageComponent {
  protected readonly info = INFO;
  protected readonly categories = DEMO_NOTIFICATION_CATEGORIES;
  protected readonly source = signal<NotificationSource | null>(null);
  private readonly router = inject(Router);

  constructor() {
    provideHeaderTitle(() => ({ title: '全部通知', breadcrumbs: [{ label: '頁面樣板' }] }));
    void inject(NotificationCenterService)
      .load()
      .then((runtime) => this.source.set(runtime.source));
  }

  protected open(item: NotificationItem): void {
    if (item.link) void this.router.navigateByUrl(item.link);
  }
}
