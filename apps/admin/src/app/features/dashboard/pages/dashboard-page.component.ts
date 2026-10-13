import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog } from '@angular/material/dialog';
import { ZH_TW } from '../../../core/i18n/zh-tw';
import { startOfDay } from '../../../core/date-utils';
import { OrderStore } from '../../../stores/order/order.store';
import { MemberStore } from '../../../stores/member/member.store';
import { MaintenanceStore } from '../../../stores/maintenance/maintenance.store';
import { PrepStore } from '../../../stores/prep/prep.store';
import { HeaderToolbarDirective } from '../../../layout/header/header-toolbar-slot';
import {
  CALENDAR_VIEW_PARAM,
  CalendarViewComponent,
  CalendarViewMode,
  parseCalendarViewMode,
  pickupProgress,
  returnProgress,
} from '../../dispatch/calendar-view/calendar-view.component';
import { PrepQueueDialogComponent } from '../dialogs/prep-queue-dialog.component';
import { PageToolbarComponent } from '@car-rental/ui';
import { LIST_TOOLBAR_LABEL_PROVIDERS } from '../../../shared/ui/list-toolbar-labels';

/**
 * 總覽：頁首（新增訂單、待整備、待保養、搜尋訂單）＋月曆／時間軸卡片與右側面板。
 * 3.1：原本上方的建單搜尋卡（車型＋租期＋選車小窗）拿掉了——建單頁第 1 步自己就是「先選租期再列可租車」，
 * 總覽要從某天開單就用右側「可用」分頁，點車直接進建單頁。
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    CalendarViewComponent,
    PageToolbarComponent,
    HeaderToolbarDirective,
    MatButtonModule,
    MatBadgeModule,
    RouterLink,
  ],
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['../../../app.scss'],
  providers: [LIST_TOOLBAR_LABEL_PROVIDERS],
})
export class DashboardPageComponent {
  protected readonly t = ZH_TW;
  readonly orderStore = inject(OrderStore);
  readonly memberStore = inject(MemberStore);
  readonly maintenanceStore = inject(MaintenanceStore);
  private readonly prepStore = inject(PrepStore);
  private readonly dialog = inject(MatDialog);
  private readonly todayDate = startOfDay(new Date());

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly targetDate = signal(startOfDay(new Date()));

  private readonly queryParamMap = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** 3.5：月曆｜時間軸，以網址（`?view=timeline`）為準，重新整理後保留。 */
  readonly view = computed<CalendarViewMode>(() =>
    parseCalendarViewMode(this.queryParamMap().get(CALENDAR_VIEW_PARAM)),
  );

  /** 切換檢視只改網址參數（replaceUrl，不為每次切換塞一筆瀏覽紀錄）；月曆是預設值，不留在網址上。 */
  onViewChange(view: CalendarViewMode): void {
    if (view === this.view()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [CALENDAR_VIEW_PARAM]: view === 'timeline' ? view : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  selectCalendarDate(date: Date): void {
    this.targetDate.set(startOfDay(date));
  }

  /** 1.4：總覽的放大鏡送出後導到訂單列表，帶入關鍵字讓訂單列表預填搜尋。 */
  onSearchSubmit(query: string): void {
    void this.router.navigate(['/orders'], { queryParams: { q: query } });
  }

  private readonly todayPickup = computed(() =>
    pickupProgress(this.orderStore.orders(), this.todayDate),
  );
  readonly todayPickupTotal = computed(() => this.todayPickup().total);
  readonly todayPickupDone = computed(() => this.todayPickup().done);
  readonly todayPickupPending = computed(() => this.todayPickup().pending);

  private readonly todayReturn = computed(() =>
    returnProgress(this.orderStore.orders(), this.todayDate),
  );
  readonly todayReturnTotal = computed(() => this.todayReturn().total);
  readonly todayReturnDone = computed(() => this.todayReturn().done);
  readonly todayReturnPending = computed(() => this.todayReturn().pending);

  /**
   * 4.3：頁首「待整備 N」＝目前還沒按「整備完成」的整備待辦數。以前是拿「今天已還車數」充數，
   * 但系統裡根本沒有整備這件事，按鈕點了也沒反應；現在每次還車都會列入一筆，與還車是哪一天無關。
   */
  readonly pendingPrepCount = computed(() => this.prepStore.openCount());

  /** 4.3：點「待整備」打開清單（依該車下一次取車排序，每列可按「整備完成」）。 */
  openPrepQueue(): void {
    this.dialog.open(PrepQueueDialogComponent, { width: '760px', maxWidth: '92vw' });
  }
}
