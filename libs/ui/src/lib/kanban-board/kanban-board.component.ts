import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  contentChild,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragEnter,
  CdkDragStart,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatIconButton } from '@angular/material/button';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { KANBAN_LABELS, assertKanbanLabels, formatKanbanLabel } from './kanban-board-labels';
import {
  KanbanAddCardEvent,
  KanbanCanMove,
  KanbanColumn,
  KanbanKey,
  KanbanMoveEvent,
  KanbanMoveRejectedEvent,
} from './kanban-board.types';
import { KanbanCardContext, KanbanCardDirective } from './kanban-card.directive';
import { KanbanAddCardComponent } from './kanban-add-card.component';
import { KanbanColumnHeadComponent } from './kanban-column-head.component';

interface CardView<T> {
  item: T;
  key: KanbanKey;
  /** `data-kanban-card` 的值（找回卡片、還焦點用）。 */
  domKey: string;
  title: string;
  index: number;
  context: KanbanCardContext<T>;
  positionId: string;
  positionText: string;
  moveLabel: string;
}

interface ColumnView<T> {
  column: KanbanColumn;
  index: number;
  cards: CardView<T>[];
  headingId: string;
  listId: string;
  countText: string;
  countLabel: string;
  /** 超過 WIP 上限幾張（0 = 沒超過或沒有上限）。 */
  over: number;
  overText: string;
  addLabel: string;
}

type MoveVia = 'drag' | 'keyboard' | 'menu';

let nextId = 0;

/**
 * 看板：欄位並排、卡片可拖曳排序與換欄（CDK drag-drop；觸控長按 250ms 才開始拖，手指仍能捲動頁面）。
 *
 * 受控模式：元件不改資料，只送出 `(moved)`，由使用端更新 `[items]`（`moveKanbanItem` 可以代勞）。換欄前問 `[canMove]`，
 * 回字串就拒絕：卡片留在原位並送出 `(moveRejected)`（附原因），由使用端提示。
 *
 * 拖曳以外的操作：每張卡片的「移動」選單（移到其他欄的最後、上移、下移），以及卡片聚焦時 Alt＋←／→ 換欄（保持同一列，
 * 目標欄沒那麼多張就放最後）、Alt＋↑／↓ 在欄內移動。移動後用 polite 的 live region 念出結果，焦點留在被移動的卡片上
 *（拖曳放下也一樣；被 canMove 拒絕或放回原位時，焦點回到原來那張卡片）。
 *
 * 卡片內容由使用端的 `<ng-template libKanbanCard let-item>` 提供。畫面文字全部來自 `KANBAN_LABELS`。
 */
@Component({
  selector: 'lib-kanban-board',
  imports: [
    NgTemplateOutlet,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkScrollable,
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    KanbanAddCardComponent,
    KanbanColumnHeadComponent,
  ],
  templateUrl: './kanban-board.component.html',
  styleUrl: './kanban-board.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lib-kanban-board',
    role: 'group',
    '[attr.aria-label]': 'label() || null',
  },
})
export class KanbanBoardComponent<T> {
  /** 欄位（順序就是畫面順序）。 */
  readonly columns = input.required<readonly KanbanColumn[]>();
  /** 全部卡片；各欄的順序就是它們在這個陣列裡的先後。 */
  readonly items = input.required<readonly T[]>();
  /** 卡片的唯一鍵（`@for` 的 track、找回卡片還焦點）。 */
  readonly cardKey = input.required<(item: T) => KanbanKey>();
  /** 卡片在哪一欄（回傳欄位 id；對不到任何欄的卡片不顯示）。 */
  readonly cardColumn = input.required<(item: T) => string>();
  /** 卡片標題：報讀器念的卡片名稱、選單與移動結果的宣告都用它。 */
  readonly cardTitle = input.required<(item: T) => string>();
  /** 換欄前的檢查；不給就全部允許。 */
  readonly canMove = input<KanbanCanMove<T> | null>(null);
  /** 整個看板的無障礙名稱，例：「工單看板」。 */
  readonly label = input('');
  /** 欄名的標題層級（`aria-level`），依頁面結構調整。 */
  readonly headingLevel = input(3);
  /** true：不能拖曳、沒有「移動」選單與新增卡片（唯讀檢視）。 */
  readonly readonly = input(false);

  /** 卡片換了位置（含同欄排序）。 */
  readonly moved = output<KanbanMoveEvent<T>>();
  /** `canMove` 拒絕的換欄：卡片已回到原位。 */
  readonly moveRejected = output<KanbanMoveRejectedEvent<T>>();
  /** 欄底新增卡片按了 Enter。 */
  readonly addCard = output<KanbanAddCardEvent>();

  protected readonly labels = assertKanbanLabels(inject(KANBAN_LABELS, { optional: true }));
  private readonly cardDef = contentChild.required(KanbanCardDirective);
  protected readonly cardTemplate = computed(() => this.cardDef().template);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly idPrefix = `lib-kanban-${nextId++}`;
  protected readonly hintId = `${this.idPrefix}-hint`;
  /** 觸控長按 250ms 才開始拖曳（手指先能捲動頁面）；滑鼠立即開始（仍需移動 5px 才算拖，點擊照常）。 */
  protected readonly dragDelay = { touch: 250, mouse: 0 };
  /** 拖曳中的預覽掛在 body 底下：帶上 `.lib-kanban-board`，質地設的變數才吃得到（CDK 要陣列，一個 class 一項）。 */
  protected readonly previewClasses = ['lib-kanban-board', 'kb-preview'];

  protected readonly announcement = signal('');
  protected readonly dragging = signal(false);
  /** 拖曳中、游標所在的欄（`blocked`：canMove 會拒絕）。 */
  protected readonly dropTarget = signal<{ columnId: string; blocked: boolean } | null>(null);
  private draggedFrom: string | null = null;
  private pendingFocus: string | null = null;
  private announceTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly views = computed<ColumnView<T>[]>(() => {
    const labels = this.labels;
    const keyOf = this.cardKey();
    const columnOf = this.cardColumn();
    const titleOf = this.cardTitle();
    const byColumn = new Map<string, T[]>();
    for (const item of this.items()) {
      const id = columnOf(item);
      const list = byColumn.get(id);
      if (list) list.push(item);
      else byColumn.set(id, [item]);
    }
    return this.columns().map((column, ci) => {
      const items = byColumn.get(column.id) ?? [];
      const total = items.length;
      const cards = items.map((item, index): CardView<T> => {
        const key = keyOf(item);
        const title = titleOf(item);
        return {
          item,
          key,
          domKey: String(key),
          title,
          index,
          context: { $implicit: item, column: column.id, index },
          positionId: `${this.idPrefix}-c${ci}-${index}`,
          positionText: formatKanbanLabel(labels.cardPosition, { column: column.title, position: index + 1, total }),
          moveLabel: formatKanbanLabel(labels.moveMenu, { title }),
        };
      });
      const limit = column.wipLimit;
      const hasLimit = typeof limit === 'number' && limit >= 0;
      const over = hasLimit ? Math.max(0, total - limit) : 0;
      return {
        column,
        index: ci,
        cards,
        headingId: `${this.idPrefix}-h${ci}`,
        listId: `${this.idPrefix}-l${ci}`,
        countText: hasLimit ? formatKanbanLabel(labels.wipCount, { count: total, limit }) : String(total),
        countLabel: hasLimit
          ? formatKanbanLabel(labels.wipCountLabel, { count: total, limit })
          : formatKanbanLabel(labels.count, { count: total }),
        over,
        overText: over > 0 ? formatKanbanLabel(labels.wipExceeded, { over }) : '',
        addLabel: formatKanbanLabel(labels.addCardInput, { column: column.title }),
      };
    });
  });

  constructor() {
    // 鍵盤／選單／拖曳移動之後，等使用端更新資料、畫面重畫完，把焦點放回被移動的卡片（換欄時卡片是新建的元素）。
    afterRenderEffect(() => {
      this.views();
      untracked(() => this.flushFocus());
    });
  }

  protected moveToLabel(column: KanbanColumn): string {
    return formatKanbanLabel(this.labels.moveTo, { column: column.title });
  }

  protected otherColumns(view: ColumnView<T>): KanbanColumn[] {
    return this.columns().filter((c) => c.id !== view.column.id);
  }

  // ---- 拖曳 ----

  protected onDragStarted(event: CdkDragStart<CardView<T>>): void {
    this.dragging.set(true);
    this.draggedFrom = this.cardColumn()(event.source.data.item);
    this.dropTarget.set({ columnId: this.draggedFrom, blocked: false });
  }

  protected onDragEnded(): void {
    this.dragging.set(false);
    this.dropTarget.set(null);
    this.draggedFrom = null;
  }

  protected onEntered(event: CdkDragEnter<string, unknown>): void {
    const to = event.container.data;
    const from = this.draggedFrom ?? to;
    const card = event.item.data as CardView<T>;
    this.dropTarget.set({ columnId: to, blocked: from !== to && this.verdict(card.item, from, to) !== true });
  }

  protected onDropped(event: CdkDragDrop<string, string, CardView<T>>): void {
    const from = event.previousContainer.data;
    const to = event.container.data;
    const item = event.item.data.item;
    if (from === to && event.previousIndex === event.currentIndex) {
      // 放回原位：沒有移動，卡片已在原處（CDK 放下前就把它放回去），焦點直接放上去。
      this.focusCard(String(this.cardKey()(item)));
      return;
    }
    this.tryMove(item, from, to, event.previousIndex, event.currentIndex, 'drag');
  }

  // ---- 鍵盤 ----

  protected onCardKeydown(event: KeyboardEvent, view: ColumnView<T>, card: CardView<T>): void {
    if (!event.altKey || event.ctrlKey || event.metaKey || this.readonly()) return;
    const target = event.target as HTMLElement | null;
    // 卡片內容若有輸入框，Alt＋方向鍵留給輸入框（逐字移動游標）。
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    const views = this.views();
    let toView = view;
    let toIndex = card.index;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        const next = views[view.index + (event.key === 'ArrowLeft' ? -1 : 1)];
        if (!next) return;
        toView = next;
        toIndex = Math.min(card.index, next.cards.length);
        break;
      }
      case 'ArrowUp':
        toIndex = card.index - 1;
        break;
      case 'ArrowDown':
        toIndex = card.index + 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (toView === view && (toIndex < 0 || toIndex >= view.cards.length)) return;
    this.tryMove(card.item, view.column.id, toView.column.id, card.index, toIndex, 'keyboard');
  }

  // ---- 選單 ----

  protected moveToColumn(view: ColumnView<T>, card: CardView<T>, column: KanbanColumn): void {
    const target = this.views().find((v) => v.column.id === column.id);
    this.tryMove(card.item, view.column.id, column.id, card.index, target?.cards.length ?? 0, 'menu');
  }

  protected moveBy(view: ColumnView<T>, card: CardView<T>, delta: -1 | 1): void {
    const toIndex = card.index + delta;
    if (toIndex < 0 || toIndex >= view.cards.length) return;
    this.tryMove(card.item, view.column.id, view.column.id, card.index, toIndex, 'menu');
  }

  protected onAdd(view: ColumnView<T>, title: string): void {
    this.addCard.emit({ columnId: view.column.id, title });
  }

  // ---- 共用 ----

  private verdict(item: T, from: string, to: string): true | string {
    const check = this.canMove();
    if (!check || from === to) return true;
    return check(item, from, to);
  }

  private tryMove(item: T, from: string, to: string, fromIndex: number, toIndex: number, via: MoveVia): void {
    const verdict = this.verdict(item, from, to);
    if (verdict !== true) {
      this.moveRejected.emit({ item, fromColumnId: from, toColumnId: to, reason: verdict });
      // 拖曳被拒絕：卡片已回到原位、畫面不會重畫，焦點直接放回這張卡片（鍵盤操作時焦點本來就在卡片上）。
      if (via === 'drag') this.focusCard(String(this.cardKey()(item)));
      return;
    }
    this.moved.emit({ item, fromColumnId: from, toColumnId: to, fromIndex, toIndex });
    const column = this.columns().find((c) => c.id === to);
    this.announce(
      formatKanbanLabel(this.labels.announceMoved, {
        title: this.cardTitle()(item),
        column: column?.title ?? to,
        position: toIndex + 1,
      }),
    );
    // 使用端更新資料、畫面重畫之後（afterRenderEffect）把焦點放到這張卡片：鍵盤、選單、拖曳都一樣
    //（拖曳開始時卡片被藏起來，焦點會掉到 body；放下後由這裡放回卡片）。
    this.pendingFocus = String(this.cardKey()(item));
  }

  /** 選單關閉：沒有移動（Esc、點外面）時焦點回到選單按鈕；有移動時交給 flushFocus 放回卡片。 */
  protected onMenuClosed(card: CardView<T>): void {
    if (this.pendingFocus !== null) return;
    this.findCardElement('[data-kanban-move]', 'kanbanMove', card.domKey)?.focus();
  }

  private findCardElement(selector: string, dataKey: string, key: string): HTMLElement | undefined {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(selector)).find(
      (node) => node.dataset[dataKey] === key,
    );
  }

  private flushFocus(): void {
    const key = this.pendingFocus;
    if (key === null) return;
    if (this.focusCard(key)) this.pendingFocus = null;
  }

  /** 把焦點放到這張卡片；找不到（還沒畫出來）回 false。 */
  private focusCard(key: string): boolean {
    const el = this.findCardElement('[data-kanban-card]', 'kanbanCard', key);
    if (!el) return false;
    if (el.ownerDocument.activeElement !== el) el.focus();
    return true;
  }

  // 同一句連念兩次時報讀器可能不念：先清空，下一個 tick 再放進去。
  private announce(message: string): void {
    this.announcement.set('');
    if (this.announceTimer) clearTimeout(this.announceTimer);
    this.announceTimer = setTimeout(() => {
      this.announceTimer = null;
      this.announcement.set(message);
    }, 30);
  }
}
