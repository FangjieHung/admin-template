import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  contentChild,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
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
  KanbanGroup,
  KanbanGroupChange,
  KanbanKey,
  KanbanMoveEvent,
  KanbanMoveRejectedEvent,
} from './kanban-board.types';
import { KanbanCardContext, KanbanCardDirective } from './kanban-card.directive';
import { KanbanAddCardComponent } from './kanban-add-card.component';
import { KanbanColumnHeadComponent } from './kanban-column-head.component';
import { KanbanLaneHeadComponent } from './kanban-lane-head.component';
import { KanbanSwitcherComponent, KanbanSwitcherItem } from './kanban-switcher.component';

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

/** 一格：沒有分組時就是一欄；分組模式是「欄 × 分組」。拖曳的放置清單、鍵盤與選單都以格為單位。 */
interface CellView<T> {
  column: KanbanColumn;
  columnIndex: number;
  /** 分組模式的分組 id；沒有分組時 null。 */
  groupId: string | null;
  laneIndex: number;
  listId: string;
  cards: CardView<T>[];
  /** 清單的 aria-labelledby（分組模式：欄名＋分組名）。 */
  labelledBy: string;
  addLabel: string;
}

interface ColumnView<T> {
  column: KanbanColumn;
  index: number;
  /** 沒有分組時這一欄唯一的一格（分組模式不用）。 */
  cell: CellView<T>;
  headingId: string;
  countText: string;
  countLabel: string;
  /** 超過 WIP 上限幾張（0 = 沒超過或沒有上限）；分組模式是所有分組加總。 */
  over: number;
  overText: string;
}

interface LaneView<T> {
  group: KanbanGroup;
  index: number;
  titleId: string;
  collapsed: boolean;
  countText: string;
  countLabel: string;
  cells: CellView<T>[];
  /** 這一道標題列在看板 grid 的第幾列（格子在下一列）。 */
  row: number;
}

interface BoardModel<T> {
  columns: ColumnView<T>[];
  /** 分組模式的各道；沒有分組時 null。 */
  lanes: LaneView<T>[] | null;
  /** 分組模式：看板 grid 一共幾列（欄頭＋每道標題＋展開的格子）。 */
  rows: number;
  /** cells[分組][欄]（沒有分組時只有一列）。 */
  cells: CellView<T>[][];
}

type MoveVia = 'drag' | 'keyboard' | 'menu';

let nextId = 0;

/**
 * 看板：欄位並排、卡片可拖曳排序與換欄（CDK drag-drop；觸控長按 250ms 才開始拖，手指仍能捲動頁面）。
 *
 * 受控模式：元件不改資料，只送出 `(moved)`，由使用端更新 `[items]`（`moveKanbanItem` 可以代勞）。換欄前問 `[canMove]`，
 * 回字串就拒絕：卡片留在原位並送出 `(moveRejected)`（附原因），由使用端提示。
 *
 * 分組（泳道）：給 `[groupBy]` 就依它的值把卡片分成橫向的道（例：負責人），每道有標題、張數，可以收合（`[(collapsedGroups)]`）。
 * 道的順序是 `[groups]`，其餘出現在卡片上的值依出現順序接在後面（名稱用 `[groupTitle]`）。欄頭只出現一次、黏在看板頂端，
 * WIP 上限照欄計算（所有道加總）。拖曳、鍵盤、選單都能換道；換道一樣先問 `canMove`（第四個參數帶前後的分組），
 * `(moved)` 另外帶 `fromGroupId`／`toGroupId`，由使用端決定接受（更新資料）或拒絕。
 *
 * 拖曳以外的操作：每張卡片的「移動」選單（移到其他欄的最後、上移、下移；分組模式另有「換到其他分組」），以及卡片聚焦時
 * Alt＋←／→ 換欄（保持同一列，目標欄沒那麼多張就放最後）、Alt＋↑／↓ 在格內移動（分組模式到頭尾時換到上一道的最後或下一道的最前）。
 * 移動後用 polite 的 live region 念出結果，焦點留在被移動的卡片上（拖曳放下也一樣；被 canMove 拒絕或放回原位時，焦點回到原來那張卡片）。
 *
 * 窄版（看板本身寬度小於 600px，用 container query 判斷，不看視窗）：一次顯示一欄，左右滑動吸附到欄（scroll-snap），
 * 上方出現欄位切換（欄名＋張數）；按切換捲到那一欄，手指滑動時切換跟著亮起目前那一欄。換欄以「移動」選單為主，長按拖曳照常可用。
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
    KanbanLaneHeadComponent,
    KanbanSwitcherComponent,
  ],
  templateUrl: './kanban-board.component.html',
  styleUrls: ['./kanban-board.component.scss', './kanban-board-lanes.scss'],
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
  /** 換欄（分組模式另含換道）前的檢查；不給就全部允許。 */
  readonly canMove = input<KanbanCanMove<T> | null>(null);
  /** 整個看板的無障礙名稱，例：「工單看板」。 */
  readonly label = input('');
  /** 欄名的標題層級（`aria-level`），依頁面結構調整；分組標題用同一層。 */
  readonly headingLevel = input(3);
  /** true：不能拖曳、沒有「移動」選單與新增卡片（唯讀檢視）。 */
  readonly readonly = input(false);
  /** 分組（泳道）：回傳卡片所在分組的 id；null（預設）＝不分組。 */
  readonly groupBy = input<((item: T) => string) | null>(null);
  /** 分組的順序與名稱；卡片上出現、清單裡沒有的分組依出現順序接在後面。清單裡的分組沒有卡片也會顯示（可以拖進去）。 */
  readonly groups = input<readonly KanbanGroup[] | null>(null);
  /** 不在 `[groups]` 裡的分組名稱；不給就顯示 id。 */
  readonly groupTitle = input<((groupId: string) => string) | null>(null);
  /** 收合中的分組 id（雙向綁定；移動卡片到收合的分組時會自動展開那一組）。 */
  readonly collapsedGroups = model<readonly string[]>([]);

  /** 卡片換了位置（含同格排序）。 */
  readonly moved = output<KanbanMoveEvent<T>>();
  /** `canMove` 拒絕的移動：卡片已回到原位。 */
  readonly moveRejected = output<KanbanMoveRejectedEvent<T>>();
  /** 新增卡片按了 Enter（分組模式帶 `groupId`）。 */
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
  /** 拖曳中、游標所在的格（`blocked`：canMove 會拒絕）。 */
  protected readonly dropTarget = signal<{ listId: string; columnId: string; blocked: boolean } | null>(null);
  /** 「移動」選單目前開著的卡片（分組清單是整個看板共用一份，靠它知道要移哪一張）。 */
  protected readonly menuTarget = signal<{ cell: CellView<T>; card: CardView<T> } | null>(null);
  /** 窄版：目前顯示的是第幾欄（欄位切換亮哪一顆）；寬版時也照捲動位置更新，只是切換藏起來。 */
  protected readonly activeColumn = signal(0);
  private readonly board = viewChild.required<ElementRef<HTMLElement>>('board');
  /** 按切換後捲動中的目標欄：捲到之前不讓捲動事件把切換改成途經的欄。 */
  private scrollTarget: { index: number; until: number } | null = null;
  private draggedFrom: CellView<T> | null = null;
  private pendingFocus: string | null = null;
  private announceTimer: ReturnType<typeof setTimeout> | null = null;

  /** 分組模式的各組（依 `[groups]`，再接上卡片裡出現的其他值）；沒有分組時 null。 */
  private readonly grouping = computed(() => {
    const groupOf = this.groupBy();
    if (!groupOf) return null;
    const columnIds = new Set(this.columns().map((c) => c.id));
    const columnOf = this.cardColumn();
    const titleOf = this.groupTitle();
    const groups: KanbanGroup[] = [...(this.groups() ?? [])];
    const seen = new Set(groups.map((g) => g.id));
    for (const item of this.items()) {
      if (!columnIds.has(columnOf(item))) continue;
      const id = groupOf(item);
      if (seen.has(id)) continue;
      seen.add(id);
      groups.push({ id, title: titleOf ? titleOf(id) : id });
    }
    return { groupOf, groups };
  });

  protected readonly model = computed<BoardModel<T>>(() => {
    const labels = this.labels;
    const keyOf = this.cardKey();
    const columnOf = this.cardColumn();
    const titleOf = this.cardTitle();
    const columns = this.columns();
    const grouping = this.grouping();
    const collapsed = new Set(this.collapsedGroups());
    const groups: (KanbanGroup | null)[] = grouping ? grouping.groups : [null];
    const columnIndex = new Map(columns.map((c, i) => [c.id, i]));
    const groupIndex = new Map(groups.map((g, i) => [g?.id ?? '', i]));
    const buckets = groups.map(() => columns.map((): T[] => []));
    for (const item of this.items()) {
      const ci = columnIndex.get(columnOf(item));
      if (ci === undefined) continue;
      const gi = grouping ? (groupIndex.get(grouping.groupOf(item)) ?? 0) : 0;
      buckets[gi][ci].push(item);
    }
    const headingId = (ci: number) => `${this.idPrefix}-h${ci}`;
    const titleId = (gi: number) => `${this.idPrefix}-g${gi}`;

    const cells = buckets.map((row, gi) =>
      row.map((items, ci): CellView<T> => {
        const column = columns[ci];
        const group = groups[gi];
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
            context: { $implicit: item, column: column.id, index, ...(group ? { group: group.id } : {}) },
            positionId: `${this.idPrefix}-c${gi}-${ci}-${index}`,
            positionText: group
              ? formatKanbanLabel(labels.groupCardPosition, { group: group.title, column: column.title, position: index + 1, total })
              : formatKanbanLabel(labels.cardPosition, { column: column.title, position: index + 1, total }),
            moveLabel: formatKanbanLabel(labels.moveMenu, { title }),
          };
        });
        return {
          column,
          columnIndex: ci,
          groupId: group?.id ?? null,
          laneIndex: gi,
          listId: `${this.idPrefix}-l${gi}-${ci}`,
          cards,
          labelledBy: group ? `${headingId(ci)} ${titleId(gi)}` : headingId(ci),
          addLabel: formatKanbanLabel(labels.addCardInput, { column: column.title }),
        };
      }),
    );

    const columnViews = columns.map((column, ci): ColumnView<T> => {
      const total = cells.reduce((sum, row) => sum + row[ci].cards.length, 0);
      const limit = column.wipLimit;
      const hasLimit = typeof limit === 'number' && limit >= 0;
      const over = hasLimit ? Math.max(0, total - limit) : 0;
      return {
        column,
        index: ci,
        cell: cells[0][ci],
        headingId: headingId(ci),
        countText: hasLimit ? formatKanbanLabel(labels.wipCount, { count: total, limit }) : String(total),
        countLabel: hasLimit
          ? formatKanbanLabel(labels.wipCountLabel, { count: total, limit })
          : formatKanbanLabel(labels.count, { count: total }),
        over,
        overText: over > 0 ? formatKanbanLabel(labels.wipExceeded, { over }) : '',
      };
    });

    if (!grouping) return { columns: columnViews, lanes: null, rows: 3, cells };
    // grid 的列：1 是欄頭；每一道一列標題，展開時下面再一列格子。
    let row = 2;
    const lanes = grouping.groups.map((group, gi): LaneView<T> => {
      const isCollapsed = collapsed.has(group.id);
      const count = cells[gi].reduce((sum, cell) => sum + cell.cards.length, 0);
      const lane: LaneView<T> = {
        group,
        index: gi,
        titleId: titleId(gi),
        collapsed: isCollapsed,
        countText: String(count),
        countLabel: formatKanbanLabel(labels.count, { count }),
        cells: cells[gi],
        row,
      };
      row += isCollapsed ? 1 : 2;
      return lane;
    });
    return { columns: columnViews, lanes, rows: row - 1, cells };
  });

  protected readonly switcherItems = computed<KanbanSwitcherItem[]>(() =>
    this.model().columns.map((view) => ({
      id: view.column.id,
      title: view.column.title,
      countText: view.countText,
      countLabel: view.countLabel,
    })),
  );

  constructor() {
    // 鍵盤／選單／拖曳移動之後，等使用端更新資料、畫面重畫完，把焦點放回被移動的卡片（換欄時卡片是新建的元素）。
    afterRenderEffect(() => {
      this.model();
      untracked(() => this.flushFocus());
    });
    // 捲動同步欄位切換：自己掛 listener（不經過範本），捲動時不會每一格都跑一次變更偵測，只有目前那一欄換了才更新。
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const board = this.board().nativeElement;
      const onScroll = () => this.syncActiveColumn();
      board.addEventListener('scroll', onScroll, { passive: true });
      destroyRef.onDestroy(() => board.removeEventListener('scroll', onScroll));
    });
  }

  /** 欄位切換：把看板捲到第 `index` 欄（減少動態時不平滑捲動）。 */
  protected showColumn(index: number): void {
    const board = this.board().nativeElement;
    const column = this.columnElements()[index];
    if (!column) return;
    this.activeColumn.set(index);
    const delta = column.getBoundingClientRect().left - this.contentLeft(board);
    if (Math.abs(delta) < 1) return;
    this.scrollTarget = { index, until: Date.now() + 1000 };
    const reduce = board.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    board.scrollBy({ left: delta, behavior: reduce ? 'auto' : 'smooth' });
  }

  /** 目前最靠近看板內框左緣的那一欄＝目前顯示的欄。 */
  private syncActiveColumn(): void {
    // 拖曳中（CDK 自動捲動）不換：窄版分組模式只畫目前那一欄的格子，拖曳途中換欄會把來源格藏起來。
    if (this.dragging()) return;
    const board = this.board().nativeElement;
    const left = this.contentLeft(board);
    const columns = this.columnElements();
    let best = 0;
    let bestDistance = Infinity;
    columns.forEach((column, index) => {
      const distance = Math.abs(column.getBoundingClientRect().left - left);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    const target = this.scrollTarget;
    if (target) {
      // 按切換後的平滑捲動途中：到達目標（或逾時）之前不更新，切換才不會在途經的欄之間閃。
      if (best !== target.index && Date.now() < target.until) return;
      this.scrollTarget = null;
    }
    if (best !== this.activeColumn()) this.activeColumn.set(best);
  }

  /** 每一欄的元素：沒有分組時是欄（section），分組模式是欄底的 track。 */
  private columnElements(): HTMLElement[] {
    return Array.from(this.board().nativeElement.querySelectorAll<HTMLElement>(':scope > [data-kanban-column]'));
  }

  private contentLeft(board: HTMLElement): number {
    const padding = parseFloat(board.ownerDocument.defaultView?.getComputedStyle(board).paddingLeft ?? '0') || 0;
    return board.getBoundingClientRect().left + padding;
  }

  protected moveToLabel(column: KanbanColumn): string {
    return formatKanbanLabel(this.labels.moveTo, { column: column.title });
  }

  protected moveToGroupLabel(group: KanbanGroup): string {
    return formatKanbanLabel(this.labels.moveToGroup, { group: group.title });
  }

  protected otherColumns(cell: CellView<T>): KanbanColumn[] {
    return this.columns().filter((c) => c.id !== cell.column.id);
  }

  protected toggleGroup(groupId: string): void {
    this.collapsedGroups.update((list) => (list.includes(groupId) ? list.filter((id) => id !== groupId) : [...list, groupId]));
  }

  // ---- 拖曳 ----

  protected onDragStarted(event: CdkDragStart<CardView<T>>): void {
    const from = event.source.dropContainer.data as CellView<T>;
    this.dragging.set(true);
    this.draggedFrom = from;
    this.dropTarget.set({ listId: from.listId, columnId: from.column.id, blocked: false });
  }

  protected onDragEnded(): void {
    this.dragging.set(false);
    this.dropTarget.set(null);
    this.draggedFrom = null;
    this.syncActiveColumn();
  }

  protected onEntered(event: CdkDragEnter<CellView<T>, unknown>): void {
    const to = event.container.data;
    const from = this.draggedFrom ?? to;
    const card = event.item.data as CardView<T>;
    this.dropTarget.set({ listId: to.listId, columnId: to.column.id, blocked: this.verdict(card.item, from, to) !== true });
  }

  protected onDropped(event: CdkDragDrop<CellView<T>, CellView<T>, CardView<T>>): void {
    const from = event.previousContainer.data;
    const to = event.container.data;
    const item = event.item.data.item;
    if (from.listId === to.listId && event.previousIndex === event.currentIndex) {
      // 放回原位：沒有移動，卡片已在原處（CDK 放下前就把它放回去），焦點直接放上去。
      this.focusCard(String(this.cardKey()(item)));
      return;
    }
    this.tryMove(item, from, to, event.previousIndex, event.currentIndex, 'drag');
  }

  // ---- 鍵盤 ----

  protected onCardKeydown(event: KeyboardEvent, cell: CellView<T>, card: CardView<T>): void {
    if (!event.altKey || event.ctrlKey || event.metaKey || this.readonly()) return;
    const target = event.target as HTMLElement | null;
    // 卡片內容若有輸入框，Alt＋方向鍵留給輸入框（逐字移動游標）。
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    const cells = this.model().cells;
    const grouped = !!this.grouping();
    let to: CellView<T> | undefined = cell;
    let toIndex = card.index;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        to = cells[cell.laneIndex][cell.columnIndex + (event.key === 'ArrowLeft' ? -1 : 1)];
        if (!to) return;
        toIndex = Math.min(card.index, to.cards.length);
        break;
      }
      case 'ArrowUp':
        toIndex = card.index - 1;
        // 分組模式：已經是這一格的第一張時，換到上一道同一欄的最後。
        if (toIndex < 0 && grouped) {
          to = cells[cell.laneIndex - 1]?.[cell.columnIndex];
          toIndex = to?.cards.length ?? 0;
        }
        break;
      case 'ArrowDown':
        toIndex = card.index + 1;
        // 分組模式：已經是這一格的最後一張時，換到下一道同一欄的最前。
        if (toIndex >= cell.cards.length && grouped) {
          to = cells[cell.laneIndex + 1]?.[cell.columnIndex];
          toIndex = 0;
        }
        break;
      default:
        return;
    }
    event.preventDefault();
    if (!to || (to === cell && (toIndex < 0 || toIndex >= cell.cards.length))) return;
    this.tryMove(card.item, cell, to, card.index, toIndex, 'keyboard');
  }

  // ---- 選單 ----

  protected onMenuOpened(cell: CellView<T>, card: CardView<T>): void {
    this.menuTarget.set({ cell, card });
  }

  protected moveToColumn(cell: CellView<T>, card: CardView<T>, column: KanbanColumn): void {
    const target = this.model().cells[cell.laneIndex].find((c) => c.column.id === column.id);
    if (target) this.tryMove(card.item, cell, target, card.index, target.cards.length, 'menu');
  }

  protected moveToGroup(lane: LaneView<T>): void {
    const current = this.menuTarget();
    if (!current) return;
    const target = lane.cells[current.cell.columnIndex];
    this.tryMove(current.card.item, current.cell, target, current.card.index, target.cards.length, 'menu');
  }

  protected moveBy(cell: CellView<T>, card: CardView<T>, delta: -1 | 1): void {
    const toIndex = card.index + delta;
    if (toIndex < 0 || toIndex >= cell.cards.length) return;
    this.tryMove(card.item, cell, cell, card.index, toIndex, 'menu');
  }

  protected onAdd(cell: CellView<T>, title: string): void {
    this.addCard.emit({ columnId: cell.column.id, title, ...(cell.groupId !== null ? { groupId: cell.groupId } : {}) });
  }

  // ---- 共用 ----

  private groupChange(from: CellView<T>, to: CellView<T>): KanbanGroupChange | undefined {
    return from.groupId !== null && to.groupId !== null ? { fromGroupId: from.groupId, toGroupId: to.groupId } : undefined;
  }

  private verdict(item: T, from: CellView<T>, to: CellView<T>): true | string {
    const check = this.canMove();
    if (!check || (from.column.id === to.column.id && from.groupId === to.groupId)) return true;
    const groups = this.groupChange(from, to);
    return groups ? check(item, from.column.id, to.column.id, groups) : check(item, from.column.id, to.column.id);
  }

  private tryMove(item: T, from: CellView<T>, to: CellView<T>, fromIndex: number, toIndex: number, via: MoveVia): void {
    const verdict = this.verdict(item, from, to);
    const groups = this.groupChange(from, to);
    const base = { item, fromColumnId: from.column.id, toColumnId: to.column.id, ...(groups ?? {}) };
    if (verdict !== true) {
      this.moveRejected.emit({ ...base, reason: verdict });
      // 拖曳被拒絕：卡片已回到原位、畫面不會重畫，焦點直接放回這張卡片（鍵盤操作時焦點本來就在卡片上）。
      if (via === 'drag') this.focusCard(String(this.cardKey()(item)));
      return;
    }
    // 移到收合中的分組：先展開，卡片和焦點才看得到。
    if (to.groupId !== null && this.collapsedGroups().includes(to.groupId)) this.toggleGroup(to.groupId);
    this.moved.emit({ ...base, fromIndex, toIndex });
    // 換到另一欄：目前的欄跟著換（窄版分組模式只畫目前那一欄的格子，卡片要先畫出來焦點才放得上去；焦點會把那一欄捲進畫面）。
    if (to.columnIndex !== from.columnIndex) this.activeColumn.set(to.columnIndex);
    const title = this.cardTitle()(item);
    const lane = to.groupId !== null ? this.model().lanes?.[to.laneIndex] : undefined;
    this.announce(
      lane
        ? formatKanbanLabel(this.labels.announceMovedGroup, { title, group: lane.group.title, column: to.column.title, position: toIndex + 1 })
        : formatKanbanLabel(this.labels.announceMoved, { title, column: to.column.title, position: toIndex + 1 }),
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
