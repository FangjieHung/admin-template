import { Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  EmptyStateComponent,
  KanbanAddCardEvent,
  KanbanBoardComponent,
  KanbanCanMove,
  KanbanCardDirective,
  KanbanColumn,
  KanbanMoveEvent,
  KanbanMoveRejectedEvent,
  SkeletonComponent,
  ToastService,
  moveKanbanItem,
} from '@admin-template/ui';
import { FEEDBACK_STATE_LABEL_PROVIDERS, TOAST_PROVIDERS } from '../../shared/ui/component-label-providers';
import { KANBAN_LABEL_PROVIDERS } from '../../shared/ui/kanban-labels';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';
import {
  KANBAN_DEMO_COLUMNS,
  KANBAN_PRIORITY_LABELS,
  KANBAN_PRIORITY_TONES,
  KanbanTicket,
  kanbanDemoTickets,
} from './demo-tickets';

const ENTRY = detailOf('kanban');

type StatesDemo = 'loading' | 'empty' | 'ready';

const ticketKey = (t: KanbanTicket) => t.id;
const ticketColumn = (t: KanbanTicket) => t.status;
const ticketTitle = (t: KanbanTicket) => t.title;
const withStatus = (t: KanbanTicket, status: string): KanbanTicket => ({ ...t, status });

/** 看板展示頁（/components/kanban）。 */
@Component({
  selector: 'app-kanban-page',
  imports: [
    MatButton,
    KanbanBoardComponent,
    KanbanCardDirective,
    SkeletonComponent,
    EmptyStateComponent,
    ShowcasePageComponent,
    DemoBlockComponent,
  ],
  providers: [...KANBAN_LABEL_PROVIDERS, ...TOAST_PROVIDERS, ...FEEDBACK_STATE_LABEL_PROVIDERS],
  templateUrl: './kanban-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './kanban-page.component.scss'],
})
export class KanbanPageComponent {
  protected readonly entry = ENTRY;
  private readonly toast = inject(ToastService);

  protected readonly key = ticketKey;
  protected readonly column = ticketColumn;
  protected readonly title = ticketTitle;
  protected readonly priorityLabels = KANBAN_PRIORITY_LABELS;
  protected readonly priorityTones = KANBAN_PRIORITY_TONES;

  // ---- 示範 1：工單看板 ----
  protected readonly columns = KANBAN_DEMO_COLUMNS;
  protected readonly tickets = signal<KanbanTicket[]>(kanbanDemoTickets());
  protected readonly log = signal<readonly string[]>([]);
  private nextNumber = 2104;

  /** 示範規則：沒有負責人的工單不能移到「已完成」。 */
  protected readonly canMove: KanbanCanMove<KanbanTicket> = (ticket, _from, to) =>
    to === 'done' && !ticket.assignee ? `「${ticket.id}」還沒有負責人，指派之後才能移到「已完成」` : true;

  protected onMoved(event: KanbanMoveEvent<KanbanTicket>): void {
    this.tickets.update((list) => moveKanbanItem(list, event, { key: ticketKey, column: ticketColumn, withColumn: withStatus }));
    const to = this.columnTitle(event.toColumnId);
    const line =
      event.fromColumnId === event.toColumnId
        ? `${event.item.id} 在「${to}」從第 ${event.fromIndex + 1} 張移到第 ${event.toIndex + 1} 張`
        : `${event.item.id}：「${this.columnTitle(event.fromColumnId)}」→「${to}」第 ${event.toIndex + 1} 張`;
    this.pushLog(line);
  }

  protected onRejected(event: KanbanMoveRejectedEvent<KanbanTicket>): void {
    this.toast.warning(event.reason);
    this.pushLog(`${event.item.id} 被擋下：${event.reason}`);
  }

  protected onAdd(event: KanbanAddCardEvent): void {
    const id = `TK-${this.nextNumber++}`;
    this.tickets.update((list) => [
      ...list,
      { id, title: event.title, status: event.columnId, priority: 'medium', assignee: null, dueDate: '2026-10-21' },
    ]);
    this.pushLog(`新增 ${id}「${event.title}」到「${this.columnTitle(event.columnId)}」`);
  }

  protected reset(): void {
    this.tickets.set(kanbanDemoTickets());
    this.log.set([]);
    this.nextNumber = 2104;
  }

  protected formatDue(date: string): string {
    const [, m, d] = date.split('-');
    return `${Number(m)}/${Number(d)}`;
  }

  private columnTitle(id: string): string {
    return this.columns.find((c) => c.id === id)?.title ?? id;
  }

  private pushLog(line: string): void {
    this.log.update((log) => [line, ...log].slice(0, 5));
  }

  // ---- 示範 2：載入中與空看板 ----
  protected readonly statesDemo = signal<StatesDemo>('loading');
  protected readonly statesColumns: readonly KanbanColumn[] = KANBAN_DEMO_COLUMNS.map((c) => ({ ...c, allowAdd: true }));
  protected readonly statesTickets = signal<KanbanTicket[]>([]);
  protected readonly stateOptions: readonly { id: StatesDemo; label: string }[] = [
    { id: 'loading', label: '載入中' },
    { id: 'empty', label: '還沒有資料' },
    { id: 'ready', label: '空欄位' },
  ];

  protected showStates(state: StatesDemo): void {
    this.statesDemo.set(state);
    if (state !== 'ready') this.statesTickets.set([]);
  }

  protected onStatesMoved(event: KanbanMoveEvent<KanbanTicket>): void {
    this.statesTickets.update((list) => moveKanbanItem(list, event, { key: ticketKey, column: ticketColumn, withColumn: withStatus }));
  }

  protected onStatesAdd(event: KanbanAddCardEvent): void {
    const id = `TK-${this.nextNumber++}`;
    this.statesTickets.update((list) => [
      ...list,
      { id, title: event.title, status: event.columnId, priority: 'low', assignee: null, dueDate: '2026-10-22' },
    ]);
  }

  protected readonly whenToUse = [
    '依狀態分欄處理的工作：工單、待辦、招募流程、採購簽核的進度追蹤。',
    '需要一眼看出「每個階段卡了多少」並限制同時進行的數量（WIP 上限）。',
    '少量卡片（每欄幾十張以內）的排序與換欄，例如本週的工作。',
  ];
  protected readonly avoid = [
    '上百筆需要排序、篩選、批次處理的資料：用資料表（看板不分頁，每張卡片都會畫出來）。',
    '狀態超過 6、7 種或有分支的流程：欄位太多要一直橫向捲動，改用清單加狀態篩選。',
    '換欄需要填寫內容（結案原因、簽核意見）：在 (moved) 裡打開對話框，確認後才更新資料。',
  ];

  protected readonly usage = `// 頁面的 providers：畫面文字（{title}、{column}、{position}、{count}、{limit}、{over} 會被換掉）
providers: [{ provide: KANBAN_LABELS, useValue: ZH_TW_KANBAN }]

readonly columns: KanbanColumn[] = [
  { id: 'todo', title: '待處理', allowAdd: true },
  { id: 'doing', title: '進行中', wipLimit: 3 },
  { id: 'done', title: '已完成' },
];
readonly tickets = signal<Ticket[]>([]);

// 受控：元件不改資料，依事件更新（moveKanbanItem 依 toIndex 插回清單並換欄）
onMoved(event: KanbanMoveEvent<Ticket>) {
  this.tickets.update((list) =>
    moveKanbanItem(list, event, {
      key: (t) => t.id,
      column: (t) => t.status,
      withColumn: (t, status) => ({ ...t, status }),
    }),
  );
}

// 回字串就拒絕：卡片回到原位、送出 (moveRejected)
canMove: KanbanCanMove<Ticket> = (t, from, to) =>
  to === 'done' && !t.assignee ? '指派負責人之後才能移到「已完成」' : true;

<lib-kanban-board
  label="工單看板"
  [columns]="columns"
  [items]="tickets()"
  [cardKey]="key"
  [cardColumn]="column"
  [cardTitle]="title"
  [canMove]="canMove"
  (moved)="onMoved($event)"
  (moveRejected)="toast.warning($event.reason)"
  (addCard)="create($event.columnId, $event.title)"
>
  <ng-template libKanbanCard [libKanbanCardOf]="tickets()" let-ticket>
    <span class="ui-text-numeric">{{ ticket.id }}</span>
    <p>{{ ticket.title }}</p>
  </ng-template>
</lib-kanban-board>`;

  protected readonly api: ApiSection[] = [
    {
      title: 'lib-kanban-board 輸入',
      rows: [
        { name: '[columns]', type: 'KanbanColumn[]', default: '必填', description: '欄位：id、title、wipLimit（超過時欄位進入警告狀態，不擋移動）、hint（欄名下的說明）、allowAdd（欄底出現「新增卡片」）。順序就是畫面順序。' },
        { name: '[items]', type: 'T[]', default: '必填', description: '全部卡片；各欄的順序就是它們在陣列裡的先後。對不到任何欄的卡片不顯示。' },
        { name: '[cardKey]／[cardColumn]／[cardTitle]', type: '(item: T) => …', default: '必填', description: '唯一鍵（track 與還焦點用）、所在欄位 id、標題（報讀器念的卡片名稱、選單與移動結果的宣告）。' },
        { name: '[canMove]', type: '(item, from, to) => true | string', default: 'null（全部允許）', description: '換欄前的檢查；回字串就拒絕，卡片回到原位並送出 (moveRejected)。同欄排序不會問。拖曳到會被拒絕的欄時，欄框與放置預覽換成錯誤色並出現禁止圖示。' },
        { name: 'label', type: 'string', default: "''", description: '整個看板的無障礙名稱，例：「工單看板」。' },
        { name: '[headingLevel]', type: 'number', default: '3', description: '欄名的標題層級（aria-level）。' },
        { name: '[readonly]', type: 'boolean', default: 'false', description: '唯讀：不能拖曳，沒有「移動」選單與新增卡片。' },
      ],
    },
    {
      title: 'lib-kanban-board 輸出',
      rows: [
        { name: '(moved)', type: 'KanbanMoveEvent<T>', description: '{ item, fromColumnId, toColumnId, fromIndex, toIndex }；toIndex 是在目標欄的位置（同欄時是拿掉原卡片之後的位置）。不更新 [items] 卡片就留在原位。' },
        { name: '(moveRejected)', type: 'KanbanMoveRejectedEvent<T>', description: '{ item, fromColumnId, toColumnId, reason }：canMove 拒絕的移動，由頁面提示原因（例如提示訊息）。' },
        { name: '(addCard)', type: 'KanbanAddCardEvent', description: '{ columnId, title }：欄底輸入標題按 Enter（已去頭尾空白）。輸入框清空、保持展開，可以連續新增；Esc 取消。' },
      ],
    },
    {
      title: '範本與其他匯出',
      rows: [
        { name: 'ng-template[libKanbanCard]', type: 'KanbanCardContext<T>', default: '必填', description: '卡片內容：let-item，另有 let-column、let-index。加 [libKanbanCardOf]="items" 讓 let-item 有型別。' },
        { name: 'moveKanbanItem(items, event, options)', type: 'T[]', description: '依 (moved) 事件產生新的清單：拿掉卡片、換欄（withColumn）、插在目標欄第 toIndex 張之前。' },
        { name: 'KANBAN_LABELS', type: 'KanbanLabels', default: '必填', description: '16 句畫面文字（卡片的位置與操作提示、選單、移動結果的宣告、WIP、空欄、新增卡片）；少一句會在建立元件時丟出錯誤。' },
        { name: '鍵盤', type: '—', description: '卡片聚焦時 Alt＋←／→ 換欄（保持同一列，目標欄比較短就放最後）、Alt＋↑／↓ 欄內移動；每張卡片的「移動」選單可以移到其他欄的最後、上移、下移。移動後念出結果，焦點留在卡片上。' },
        { name: '觸控', type: '—', description: '長按 250ms 才開始拖曳，手指先能捲動頁面；600px 以下的容器改成橫向捲動，每欄約 85% 寬。' },
      ],
    },
  ];
}
