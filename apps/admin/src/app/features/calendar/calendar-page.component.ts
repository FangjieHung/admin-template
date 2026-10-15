import { Component, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  CalendarChangeFn,
  CalendarComponent,
  CalendarEvent,
  CalendarEventChange,
  CalendarFormatter,
  CalendarSlotSelection,
  CalendarSource,
  CalendarView,
  ResponsivePanelComponent,
  overlaps,
} from '@admin-template/ui';
import { TOAST_PROVIDERS } from '../../shared/ui/component-label-providers';
import { CALENDAR_LABEL_PROVIDERS, ZH_TW_CALENDAR_LABELS } from '../../shared/ui/calendar-labels';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';
import {
  DEMO_CALENDAR_CATEGORIES,
  DEMO_ROOMS,
  makeDemoCalendarEvents,
  makeDemoRoomBookings,
  makeLockedWeek,
} from './calendar-demo-data';

const ENTRY = detailOf('calendar');

/** 示範的「伺服器」延遲。 */
const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

/** 共用日曆與排程展示頁（/components/calendar）。 */
@Component({
  selector: 'app-calendar-page',
  imports: [MatButtonModule, CalendarComponent, ResponsivePanelComponent, ShowcasePageComponent, DemoBlockComponent],
  providers: [...CALENDAR_LABEL_PROVIDERS, ...TOAST_PROVIDERS],
  templateUrl: './calendar-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './calendar-page.component.scss'],
})
export class CalendarPageComponent {
  protected readonly entry = ENTRY;
  protected readonly categories = DEMO_CALENDAR_CATEGORIES;
  protected readonly rooms = DEMO_ROOMS;
  private readonly fmt = new CalendarFormatter(ZH_TW_CALENDAR_LABELS);

  /** 示範的延遲（測試改成 0）。 */
  delayMs = 400;

  // ---- 1. 月／週／日／議程：資料來源分段載入 ----

  private serverEvents = makeDemoCalendarEvents();
  protected readonly view = signal<CalendarView>('month');
  protected readonly failNext = signal(false);
  protected readonly lastRange = signal('');
  protected readonly lastChange = signal('（尚未拖曳）');
  protected readonly lastSlot = signal('（尚未選取）');
  protected readonly selected = signal<CalendarEvent | null>(null);
  protected readonly selectedWhen = computed(() => {
    const e = this.selected();
    return e ? this.fmt.when(e) : '';
  });
  protected readonly selectedCategory = computed(() => DEMO_CALENDAR_CATEGORIES.find((c) => c.id === this.selected()?.category)?.label ?? '—');

  /** 依範圍回傳活動；勾了「下次載入失敗」時丟錯一次。 */
  protected readonly source: CalendarSource = {
    list: async (range, signal) => {
      await wait(this.delayMs, signal);
      if (this.failNext()) {
        this.failNext.set(false);
        throw new Error('示範：載入失敗');
      }
      return this.serverEvents.filter((e) => overlaps(e.start, e.end, range.start, range.end));
    },
  };

  protected readonly saveMain: CalendarChangeFn = async (change, signal) => {
    await wait(this.delayMs, signal);
    this.serverEvents = this.serverEvents.map((e) => (e.id === change.event.id ? change.event : e));
  };

  protected onRange(range: { start: Date; end: Date }): void {
    this.lastRange.set(`${this.fmt.dateShort(range.start, true)} – ${this.fmt.dateShort(new Date(range.end.getTime() - 1), true)}`);
  }

  protected onChange(change: CalendarEventChange): void {
    this.lastChange.set(`${change.event.title}：${this.fmt.when(change.event)}（${change.via === 'keyboard' ? '鍵盤' : change.via === 'undo' ? '復原' : '拖曳'}）`);
  }

  protected onSlot(slot: CalendarSlotSelection): void {
    this.lastSlot.set(this.fmt.when({ id: 'slot', title: '', start: slot.start, end: slot.end, allDay: slot.allDay }));
  }

  // ---- 2. 資源排程：會議室 ----

  protected readonly bookings = signal<readonly CalendarEvent[]>(makeDemoRoomBookings());
  protected readonly lastBooking = signal('（尚未拖曳）');

  protected readonly saveBooking: CalendarChangeFn = async (change, signal) => {
    await wait(this.delayMs, signal);
    this.bookings.update((list) => list.map((e) => (e.id === change.event.id ? change.event : e)));
    const room = DEMO_ROOMS.find((r) => r.id === change.event.resourceId)?.title ?? '';
    this.lastBooking.set(`${change.event.title} → ${room}，${this.fmt.when(change.event)}`);
  };

  protected addBooking(slot: CalendarSlotSelection): void {
    const id = `bk-new-${Date.now().toString(36)}`;
    this.bookings.update((list) => [...list, { id, title: '新的預約', start: slot.start, end: slot.end, resourceId: slot.resourceId, category: 'meeting' }]);
  }

  // ---- 3. 儲存失敗：鎖定的時段 ----

  protected readonly locked = signal<readonly CalendarEvent[]>(makeLockedWeek());

  protected readonly saveLocked: CalendarChangeFn = async (change, signal) => {
    await wait(this.delayMs, signal);
    const lock = this.locked().find((e) => e.editable === false && overlaps(e.start, e.end, change.event.start, change.event.end));
    // reject 一個字串：那句話會出現在錯誤提示裡。
    if (lock) throw `這個時段已鎖定（${lock.title.replace('（鎖定）', '')}）`;
    this.locked.update((list) => list.map((e) => (e.id === change.event.id ? change.event : e)));
  };

  // ---- 4. 唯讀迷你月曆 ----

  protected readonly miniEvents = makeDemoCalendarEvents();
  protected readonly miniOpened = signal('（尚未點選）');

  protected readonly whenToUse = [
    '排班、會議室與設備預約、工單到期日、活動行程：同一份資料要用月、週、日或清單看。',
    '要看「誰（哪個資源）在什麼時候忙」：資源排程一列一個人、一間會議室或一台設備。',
    '可以直接拖曳改時間或換人，不必打開表單（失敗會還原並說明原因）。',
  ];
  protected readonly avoid = [
    '只要選一個日期或一段日期：用日期選擇器（雙月日期區間）。',
    '活動的先後與依賴關係（甘特圖、里程碑）：這個元件不畫依賴線。',
    '需要時區換算或重複規則（每週二、每月最後一天）的行事曆：這裡只有當地時間，重複的活動請由資料來源展開成一筆一筆。',
  ];

  protected readonly usage = `<!-- 依範圍載入；拖曳後交給 onEventChange（先改畫面，失敗還原） -->
<lib-calendar
  [(view)]="view" [(date)]="date"
  [views]="['month', 'week', 'day', 'agenda']"
  [source]="source"
  [categories]="categories"
  [onEventChange]="save"
  (eventClick)="openPanel($event)"
  (slotSelect)="create($event)"
/>

// providers: [...CALENDAR_LABEL_PROVIDERS, ...TOAST_PROVIDERS]
readonly categories: CalendarCategory[] = [
  { id: 'meeting', label: '會議', color: 1 },   // 1–6 → 配色的 --app-chart-1…6
  { id: 'leave', label: '請假', color: 4 },
];

readonly source: CalendarSource = {
  list: (range, signal) => firstValueFrom(this.http.get<CalendarEvent[]>('/api/events', {
    params: { from: range.start.toISOString(), to: range.end.toISOString() },
  })),   // 換頁時上一次的 signal 會 abort
};

// reject 一個字串時，那句話會出現在錯誤提示裡
readonly save: CalendarChangeFn = async (change, signal) => {
  await this.api.patchEvent(change.event.id, { start: change.event.start, end: change.event.end }, signal);
};

<!-- 資源排程：一列一個資源；同一列重疊時標成衝突 -->
<lib-calendar view="resource" [views]="['resource']" [resources]="rooms" [events]="bookings()"
  [allowOverlap]="false" [dayStart]="8" [dayEnd]="19" [onEventChange]="saveBooking" />

<!-- 唯讀的迷你月曆 -->
<lib-calendar [views]="['month']" [events]="events" [readonly]="true" [compact]="true" />`;

  protected readonly api: ApiSection[] = [
    {
      title: 'lib-calendar 輸入',
      rows: [
        { name: '[(view)]', type: "'month' | 'week' | 'day' | 'agenda' | 'resource'", default: "'month'", description: '目前的檢視。容器 ≤ 600px 時預設改用 mobileView（議程），使用者自己切換後就不再自動換。' },
        { name: '[views]', type: 'CalendarView[]', default: "['month','week','day','agenda']", description: '工具列提供哪些檢視；只有一種時不顯示切換鈕。' },
        { name: '[(date)]', type: 'Date', default: '今天', description: '目前看的日期（決定月份、週、日）。' },
        { name: '[events]／[source]', type: 'CalendarEvent[] ／ CalendarSource', description: '整份資料，或依看得到的範圍分段載入（list(range, signal)，換頁時 abort 上一次；載入中蓋一層閃光、失敗顯示重試）。' },
        { name: '[resources]', type: 'CalendarResource[]', description: '資源排程的每一列 { id, title, group?, subtitle? }；活動的 resourceId 對到這裡。' },
        { name: '[categories]', type: 'CalendarCategory[]', description: '{ id, label, color }：color 1–6 是配色的圖表色，也可以給語意 token；色條＋淡底，字一律 on-surface，下方有圖例。' },
        { name: '[resourceScale]', type: "'day' | 'week' | 'month'", default: "'week'", description: '資源排程的刻度：一天（小時欄）、一週或一個月（天欄）。' },
        { name: '[slotMinutes]', type: 'number', default: '30', description: '時段長度：拖曳與鍵盤一次移動的量，也是時間格的淡線。' },
        { name: '[dayStart]／[dayEnd]／[scrollToHour]', type: 'number', default: '0／24／8', description: '時間格與日刻度畫幾點到幾點；週／日檢視打開時捲到幾點。' },
        { name: '[weekStartsOn]', type: '0–6', default: '1（星期一）', description: '一週從星期幾開始。' },
        { name: '[maxEventsPerDay]', type: 'number', default: '3', description: '月檢視每天最多幾列，其餘收成「+N 筆」。' },
        { name: '[allowOverlap]', type: 'boolean', default: 'true', description: 'false：同一個資源時間重疊時加上警告圖示與「時間衝突」文字（拖曳中也預告）。' },
        { name: '[readonly]／[compact]', type: 'boolean', default: 'false', description: '唯讀（不能拖、不能選空白）；迷你月曆（每天只畫圓點，按下打開當天清單）。' },
        { name: '[hour12]／[showWeekNumbers]', type: 'boolean', default: 'false', description: '上午／下午的 12 小時制；月曆左邊加 ISO 週次。' },
        { name: '[resourceFilter]', type: 'boolean', default: 'false', description: '工具列加上資源篩選（依分組或單一資源）。' },
        { name: '[onEventChange]', type: '(change, signal) => Promise<void>', description: '儲存拖曳或鍵盤的變更：畫面先改，reject 時還原並提示原因（字串會顯示出來）；成功時提示「復原」5 秒。同一筆又改時上一次的 signal 會 abort。' },
      ],
    },
    {
      title: '輸出與方法',
      rows: [
        { name: '(eventClick)', type: 'CalendarEvent', description: '點了活動（Enter 也是）；通常打開側邊面板顯示詳情或編輯。' },
        { name: '(slotSelect)', type: '{ start, end, allDay, resourceId }', description: '點了空白處或拖出一段：在這段時間新增活動。' },
        { name: '(eventChange)', type: 'CalendarEventChange', description: '一筆變更存好了（kind：move／extend，via：pointer／keyboard／undo）。' },
        { name: '(rangeChange)', type: '{ start, end }', description: '看得到的範圍變了。' },
        { name: 'reload()／goToday()／step(±1)', type: 'method', description: '重新載入、回到今天、往前往後一段（viewChild 取得）。' },
        { name: 'CALENDAR_LABELS', type: 'CalendarLabels', default: '必填', description: '全部的畫面文字與日期樣板（星期、上午／下午、標題格式）；少了會在建立時丟出錯誤。' },
      ],
    },
    {
      title: '鍵盤與指標',
      rows: [
        { name: '方向鍵／PageUp／PageDown／Home／End', type: '月曆格', description: '在日子之間移動（只有一格在 Tab 順序裡），PageUp／PageDown 換月；Enter 選取那一天。' },
        { name: '方向鍵／Home／End', type: '時間格（週、日）', description: '上下一個時段、左右一天，Home／End 到當天第一個／最後一個時段（只有一格在 Tab 順序裡）；Enter 或 Space 選取那個時段＝(slotSelect)，和點空白處一樣。' },
        { name: 'Tab／Enter', type: '活動', description: '活動是按鈕，Enter 打開；報讀器念出標題、日期時間、資源、類別、狀態與衝突。' },
        { name: 'Alt＋方向鍵', type: '移動', description: '時間格：上下一個時段、左右一天；資源排程：左右一格、上下換資源；月曆：左右一天、上下一週。' },
        { name: 'Alt＋Shift＋方向鍵', type: '調整長度', description: '改結束時間（下／右變長，上／左變短），最短一個時段。' },
        { name: '拖曳／拉邊緣', type: '指標', description: '對齊時段，拖曳中跟著顯示新的時間；Esc 取消。觸控：長按約半秒（出現預覽）再拖，拖曳中頁面不捲動；按住之前就滑動＝捲動。' },
      ],
    },
  ];
}
