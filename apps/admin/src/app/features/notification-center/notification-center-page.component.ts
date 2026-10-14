import { Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  NotificationFilter,
  NotificationItem,
  NotificationListComponent,
  createDemoNotificationSource,
} from '@admin-template/ui';
import { NotificationCenterService, NotificationRuntime } from '../../core/notifications/notification-center.service';
import { demoNotifications, incomingNotification } from '../../core/notifications/demo-notification-data';
import {
  DEMO_NOTIFICATION_CATEGORIES,
  NOTIFICATION_CENTER_LABEL_PROVIDERS,
} from '../../shared/ui/notification-center-labels';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

const ENTRY = detailOf('notification-center');

/** 通知中心展示頁（/components/notification-center）。 */
@Component({
  selector: 'app-notification-center-page',
  imports: [MatButtonModule, NotificationListComponent, ShowcasePageComponent, DemoBlockComponent],
  providers: [...NOTIFICATION_CENTER_LABEL_PROVIDERS],
  templateUrl: './notification-center-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './notification-center-page.component.scss'],
})
export class NotificationCenterPageComponent {
  protected readonly entry = ENTRY;
  protected readonly categories = DEMO_NOTIFICATION_CATEGORIES;
  protected readonly center = inject(NotificationCenterService);

  // ---- 示範 1：卡片裡的清單（自己的資料來源，跟頁首鈴鐺分開） ----
  protected readonly cardSource = createDemoNotificationSource(demoNotifications(Date.now()), {
    latencyMs: 500,
    idPrefix: 'card-',
  });
  protected readonly cardFilter = signal<NotificationFilter>('all');
  protected readonly cardCategory = signal<string | null>(null);
  protected readonly cardLog = signal('（尚未點任何通知）');
  private cardSeq = 0;

  protected pushToCard(): void {
    this.cardSource.push(incomingNotification(++this.cardSeq));
  }

  protected onCardOpen(item: NotificationItem): void {
    this.cardLog.set(`(open)：「${item.title}」→ ${item.link}（示範不導覽）`);
  }

  // ---- 示範 3：沒有通知 ----
  protected readonly emptySource = createDemoNotificationSource([], { latencyMs: 400 });

  // ---- 示範 4：載入失敗（第一次失敗，重試成功） ----
  protected readonly errorSource = createDemoNotificationSource(demoNotifications(Date.now()).slice(0, 3), {
    latencyMs: 400,
    failOnce: true,
  });
  private readonly errorList = viewChild<NotificationListComponent>('errorList');

  protected failAgain(): void {
    this.errorSource.failNext();
    this.errorList()?.refresh();
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cardSource.stopTimer());
    void this.center.load().then((runtime) => this.runtime.set(runtime));
  }

  // ---- 示範 2：頁首鈴鐺 ----
  /** 頁首鈴鐺的示範執行期（未讀數、定時推播）；頁面打開時通常已經載入了。 */
  protected readonly runtime = signal<NotificationRuntime | null>(null);

  protected async pushToBell(count: number): Promise<void> {
    (await this.center.load()).push(count);
  }

  protected async toggleAutoPush(event: Event): Promise<void> {
    const on = (event.target as HTMLInputElement).checked;
    (await this.center.load()).setAutoPush(on);
  }

  protected openBell(): void {
    this.center.toggle(true);
  }

  protected readonly whenToUse = [
    '系統要告訴使用者「有事情需要你」：工單指派給你、有人 @提及你、你關注的專案狀態變了、系統維護公告。',
    '使用者離開一陣子回來，要知道錯過了什麼（未讀數、未讀篩選）。',
    '通知可以直接處理：打開對應的頁面，或在通知上按一個動作（「查看留言」「更新密碼」）。',
  ];
  protected readonly avoid = [
    '剛剛那個操作的結果（「已儲存」）：用提示訊息（toast），不要進通知中心。',
    '需要使用者立刻決定的事（「確定要刪除嗎？」）：用確認對話框。',
    '紀錄某筆資料「誰在何時改了什麼」：用活動紀錄，通知只放和「我」有關的事。',
  ];

  protected readonly usage = `// 頁面（或殼層 lazy 載入的面板）的 providers：畫面文字（{title}、{count} 會被換掉）
providers: [{ provide: NOTIFICATION_CENTER_LABELS, useValue: ZH_TW_NOTIFICATION_CENTER }]

// 資料來源：接伺服器時把 signal 傳給 fetch／HttpClient；changes 接 WebSocket／SSE 推播
readonly source: NotificationSource = {
  list: (query, signal) => this.api.notifications(query, { signal }),   // { items, nextCursor }
  unreadCount: () => this.api.unreadCount(),
  markRead: (ids, read) => this.api.markRead(ids, read),
  markAllRead: () => this.api.markAllRead(),
  remove: (id) => this.api.remove(id),
  changes: this.socket.notifications$,   // { type: 'added', item } | { type: 'read', ids, read } | …
};

<lib-notification-list
  [source]="source"
  [categories]="[{ id: 'assigned', label: '指派給我' }, { id: 'mention', label: '提及' }]"
  [(filter)]="filter"
  (open)="router.navigateByUrl($event.link!)"
  (action)="handle($event.action.id, $event.item)"
/>

// 頁首鈴鐺：鈴鐺與未讀數在 Initial bundle，面板第一次打開才載入（layout/notification-bell）
@defer (on immediate) { <app-notification-panel /> }`;

  protected readonly api: ApiSection[] = [
    {
      title: 'lib-notification-list 輸入',
      rows: [
        { name: '[source]', type: 'NotificationSource', default: '必填', description: 'list(query, signal) 回傳一頁（新到舊）與 nextCursor；unreadCount、markRead(ids, read)、markAllRead、remove(id)；選填的 changes（Observable）是伺服器推播。動作失敗（reject）時畫面還原並念出「沒有完成」。' },
        { name: '[categories]', type: 'NotificationCategory[]', default: '[]', description: '類別篩選（id、label）；不給就不顯示類別列。每則通知的 category 對到這裡的 id，名稱也顯示在時間旁邊。' },
        { name: '[(filter)]', type: "'all' | 'unread'", default: "'all'", description: '全部或未讀；「未讀」鈕帶未讀數。在「未讀」裡標為已讀的通知留在原地，換篩選後才消失（不會跳動）。' },
        { name: '[(category)]', type: 'string | null', default: 'null', description: '目前的類別；null 是不限類別。' },
        { name: '[pageSize]', type: 'number', default: '10', description: '一頁幾則；還有下一頁（nextCursor）時底部出現「載入更多」。' },
        { name: '[headingLevel]', type: 'number', default: '3', description: '今天／昨天／更早分組標題的 aria-level。' },
        { name: '[announceArrivals]', type: 'boolean', default: 'true', description: '新通知送達時用 polite 的 live region 念「有 1 則新通知：…」（短時間內好幾則會合併）。頁面另外用提示訊息告知時設 false。' },
      ],
    },
    {
      title: 'lib-notification-list 輸出與方法',
      rows: [
        { name: '(open)', type: 'NotificationItem', description: '點了有 link 的通知（已標為已讀）；元件不認得路由，由頁面導覽。沒有 link 的通知點了只標為已讀。' },
        { name: '(action)', type: '{ item, action }', description: '按了通知上的動作鈕（已標為已讀）。' },
        { name: 'refresh()／focusFirst()', type: 'method', description: '重新載入第一頁；把焦點放到第一則通知。' },
        { name: '鍵盤', type: '—', description: '上下鍵在通知之間移動、Home／End 到頭尾、Enter 打開、Delete 移除；Tab 只停在目前那一則與它的「標為已讀」「移除」。移除後焦點移到下一則。' },
      ],
    },
    {
      title: '其他匯出',
      rows: [
        { name: 'NotificationItem', type: 'interface', description: 'id、title、body（最多兩行）、createdAt、read、category、icon＋tone（狀態語意的圖示底色）或 avatar（名字縮寫）、link、action（最多一個）。' },
        { name: 'createDemoNotificationSource(seed, options)', type: 'DemoNotificationSource', description: '示範用的資料來源：latencyMs、failOnce（第一次 list 失敗）；push(item) 馬上送達一則、startTimer(ms, next)／stopTimer() 定時送達、failNext()。' },
        { name: 'groupNotifications(items, now)', type: 'function', description: '依當地日期分成今天、昨天、更早。' },
        { name: 'NOTIFICATION_CENTER_LABELS', type: 'NotificationCenterLabels', default: '必填', description: '28 句畫面文字；少一句會在建立元件時丟出錯誤，列出缺的名稱。' },
      ],
    },
    {
      title: '頁首鈴鐺（apps/admin/src/app/layout/notification-bell）',
      rows: [
        { name: 'NotificationCenterService', type: 'root 服務', description: 'unread（鈴鐺的數字）、panelOpen；load() 動態載入資料來源與示範資料（core/notifications，回傳 source、push(n)、setAutoPush(on)），toggle(open?) 第一次呼叫時才動態載入面板。服務本身在 Initial bundle，不 import @admin-template/ui。' },
        { name: '徽章', type: '—', description: '0 時不顯示，超過 99 顯示 99+；報讀器念「通知 N 則未讀」。造型讀 --lib-notif-badge-*（CONTRACT.md「通知中心」）。' },
        { name: '面板', type: '—', description: '第一次打開才載入（@defer，另一個 chunk）；桌機錨在鈴鐺下方（380px 寬、內部捲動），600px 以下滿版。Esc、點外面會關閉並讓焦點回到鈴鐺，Tab 離開面板時收起；面板開著時新通知由清單念出，關著時跳提示訊息。' },
      ],
    },
  ];
}
