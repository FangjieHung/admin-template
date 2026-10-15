import { describe, it, expect, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CdkDrag } from '@angular/cdk/drag-drop';
import { KanbanBoardComponent } from './kanban-board.component';
import { KanbanCardDirective } from './kanban-card.directive';
import { KANBAN_LABELS, KanbanLabels } from './kanban-board-labels';
import {
  KanbanAddCardEvent,
  KanbanCanMove,
  KanbanColumn,
  KanbanGroup,
  KanbanMoveEvent,
  KanbanMoveRejectedEvent,
  moveKanbanItem,
} from './kanban-board.types';

const LABELS: KanbanLabels = {
  card: '卡片',
  cardPosition: '{column}，第 {position} 張，共 {total} 張',
  keyboardHint: '按 Alt 加方向鍵移動',
  moveMenu: '移動「{title}」',
  moveTo: '移到「{column}」',
  moveUp: '上移',
  moveDown: '下移',
  announceMoved: '已將「{title}」移到「{column}」第 {position} 張',
  count: '{count} 張卡片',
  wipCount: '{count} / {limit}',
  wipCountLabel: '{count} 張卡片，上限 {limit} 張',
  wipExceeded: '超過上限 {over} 張',
  emptyColumn: '沒有卡片',
  addCard: '新增卡片',
  addCardInput: '新增到「{column}」的卡片標題',
  addCardHint: 'Enter 新增，Esc 取消',
  groupCardPosition: '{group}，{column}，第 {position} 張，共 {total} 張',
  groupKeyboardHint: '分組模式：按 Alt 加方向鍵移動',
  announceMovedGroup: '已將「{title}」移到「{group}」的「{column}」第 {position} 張',
  moveToGroupMenu: '換到其他分組',
  moveToGroup: '換到「{group}」',
};

interface Task {
  id: string;
  title: string;
  status: string;
  owner?: string;
}

const NONE = 'none';
const ownerOf = (t: Task) => t.owner ?? NONE;
/** 分組清單：陳 不在清單裡（依出現順序接在最後，名稱來自 groupTitle）；張 沒有卡片也要顯示。 */
const GROUPS: KanbanGroup[] = [
  { id: '王', title: '王' },
  { id: '林', title: '林' },
  { id: '張', title: '張' },
  { id: NONE, title: '未指派' },
];

const COLUMNS: KanbanColumn[] = [
  { id: 'todo', title: '待處理', allowAdd: true },
  { id: 'doing', title: '進行中', wipLimit: 2, hint: '最多同時 2 張' },
  { id: 'done', title: '已完成' },
];

function seed(): Task[] {
  return [
    { id: 'a', title: '印表機卡紙', status: 'todo', owner: '林' },
    { id: 'b', title: '更換網路線', status: 'todo' },
    { id: 'c', title: '帳號開通', status: 'doing', owner: '王' },
    { id: 'd', title: '報表匯出', status: 'doing', owner: '陳' },
  ];
}

@Component({
  imports: [KanbanBoardComponent, KanbanCardDirective],
  template: `
    <lib-kanban-board
      label="工單看板"
      [columns]="columns()"
      [items]="items()"
      [cardKey]="key"
      [cardColumn]="column"
      [cardTitle]="title"
      [canMove]="canMove()"
      [groupBy]="groupBy()"
      [groups]="groups()"
      [groupTitle]="groupTitle"
      [(collapsedGroups)]="collapsed"
      (moved)="onMoved($event)"
      (moveRejected)="rejected.push($event)"
      (addCard)="added.push($event)"
    >
      <ng-template libKanbanCard [libKanbanCardOf]="items()" let-task let-index="index">
        <span class="t-title">{{ task.title }}</span><span class="t-index">{{ index }}</span>
      </ng-template>
    </lib-kanban-board>
  `,
})
class HostComponent {
  readonly columns = signal<KanbanColumn[]>(COLUMNS);
  readonly items = signal<Task[]>(seed());
  readonly canMove = signal<KanbanCanMove<Task> | null>(null);
  readonly groupBy = signal<((t: Task) => string) | null>(null);
  readonly groups = signal<KanbanGroup[] | null>(null);
  readonly groupTitle = (id: string) => `${id}（外部）`;
  collapsed: readonly string[] = [];
  /** false：模擬使用端不更新資料（只記錄事件）。 */
  apply = true;
  readonly key = (t: Task) => t.id;
  readonly column = (t: Task) => t.status;
  readonly title = (t: Task) => t.title;
  moves: KanbanMoveEvent<Task>[] = [];
  rejected: KanbanMoveRejectedEvent<Task>[] = [];
  added: KanbanAddCardEvent[] = [];

  onMoved(event: KanbanMoveEvent<Task>): void {
    this.moves.push(event);
    if (!this.apply) return;
    this.items.update((items) =>
      moveKanbanItem(items, event, {
        key: this.key,
        column: this.column,
        withColumn: (t, status) => ({ ...t, status }),
        group: ownerOf,
        withGroup: (t, owner) => ({ ...t, owner: owner === NONE ? undefined : owner }),
      }),
    );
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('KanbanBoardComponent（看板）', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;

  async function settle(rounds = 3): Promise<void> {
    for (let i = 0; i < rounds; i++) {
      fixture.detectChanges();
      await sleep(0);
    }
    fixture.detectChanges();
  }

  async function setup(): Promise<void> {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: KANBAN_LABELS, useValue: LABELS }],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
    await settle();
  }

  const column = (id: string) => el.querySelector<HTMLElement>(`[data-kanban-column="${id}"]`)!;
  const titlesIn = (id: string) =>
    Array.from(column(id).querySelectorAll('.t-title')).map((n) => n.textContent?.trim());
  const card = (id: string) => el.querySelector<HTMLElement>(`[data-kanban-card="${id}"]`)!;
  const live = () => el.querySelector('[aria-live="polite"]')!.textContent?.trim();
  const press = (target: HTMLElement, key: string, altKey = true) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, altKey, bubbles: true, cancelable: true }));
  /** 直接呼叫放下的處理函式（CDK 的 drop 事件）：放置清單的 data 是「格」，用欄（＋分組）找。 */
  const dropper = () => {
    const board = fixture.debugElement.children[0].componentInstance as KanbanBoardComponent<Task>;
    const internals = board as unknown as {
      onDropped(e: unknown): void;
      model(): { cells: { column: { id: string }; groupId: string | null }[][] };
    };
    const cell = (spec: string) => {
      const [columnId, groupId] = spec.split('@');
      return internals.model().cells.flat().find((c) => c.column.id === columnId && (groupId === undefined || c.groupId === groupId));
    };
    return (from: string, to: string, previousIndex: number, currentIndex: number, id: string) =>
      internals.onDropped({
        previousContainer: { data: cell(from) },
        container: { data: cell(to) },
        previousIndex,
        currentIndex,
        item: { data: { item: host.items().find((t) => t.id === id) } },
      });
  };

  afterEach(() => {
    fixture?.destroy();
    document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove());
  });

  it('沒有提供畫面文字或少了一句時，建立元件就丟出錯誤並列出缺的名稱', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    expect(() => TestBed.createComponent(HostComponent).detectChanges()).toThrow(/KANBAN_LABELS/);
    TestBed.resetTestingModule();
    const { moveUp: _m, ...partial } = LABELS;
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [{ provide: KANBAN_LABELS, useValue: partial }] });
    expect(() => TestBed.createComponent(HostComponent).detectChanges()).toThrow(/「moveUp」/);
  });

  it('依欄位排出卡片、欄名是標題、欄頭顯示張數；卡片內容來自使用端範本', async () => {
    await setup();
    expect(el.querySelector('lib-kanban-board')?.getAttribute('aria-label')).toBe('工單看板');
    expect(titlesIn('todo')).toEqual(['印表機卡紙', '更換網路線']);
    expect(titlesIn('doing')).toEqual(['帳號開通', '報表匯出']);
    const heading = column('todo').querySelector('[role="heading"]')!;
    expect(heading.textContent?.trim()).toBe('待處理');
    expect(heading.getAttribute('aria-level')).toBe('3');
    expect(column('todo').getAttribute('aria-labelledby')).toBe(heading.id);
    const count = column('todo').querySelector('.kh-count')!;
    expect(count.textContent?.trim()).toBe('2');
    expect(count.getAttribute('aria-label')).toBe('2 張卡片');
    expect(column('doing').querySelector('.kh-hint')?.textContent).toBe('最多同時 2 張');
    // 卡片：role、角色描述、名稱、位置描述
    const c = card('b');
    expect(c.getAttribute('role')).toBe('group');
    expect(c.getAttribute('aria-roledescription')).toBe('卡片');
    expect(c.getAttribute('aria-label')).toBe('更換網路線');
    const [posId, hintId] = c.getAttribute('aria-describedby')!.split(' ');
    expect(el.querySelector(`#${posId}`)?.textContent).toBe('待處理，第 2 張，共 2 張');
    expect(el.querySelector(`#${hintId}`)?.textContent).toBe('按 Alt 加方向鍵移動');
    expect(c.querySelector('.t-index')?.textContent).toBe('1');
    expect(c.querySelector('.kb-move')?.getAttribute('aria-label')).toBe('移動「更換網路線」');
  });

  it('拖曳：觸控長按 250ms 才開始；預覽帶 .lib-kanban-board（質地變數）且 class 一項一個（含空白會讓 classList.add 丟錯）', async () => {
    await setup();
    const drag = fixture.debugElement.query(By.directive(CdkDrag)).injector.get(CdkDrag);
    expect(drag.dragStartDelay).toEqual({ touch: 250, mouse: 0 });
    const classes = ([] as string[]).concat(drag.previewClass as string | string[]);
    expect(classes).toContain('lib-kanban-board');
    expect(classes.every((c) => !/\s/.test(c))).toBe(true);
  });

  it('空欄顯示空狀態文字', async () => {
    await setup();
    expect(column('done').querySelector('.kb-empty')?.textContent).toBe('沒有卡片');
    expect(column('todo').querySelector('.kb-empty')).toBeNull();
  });

  it('WIP：顯示「張數 / 上限」；超過上限時欄位進入警告狀態，並寫出超過幾張（附圖示）', async () => {
    await setup();
    const doing = column('doing');
    expect(doing.querySelector('.kh-count')?.textContent?.trim()).toBe('2 / 2');
    expect(doing.querySelector('.kh-count')?.getAttribute('aria-label')).toBe('2 張卡片，上限 2 張');
    expect(doing.classList).not.toContain('is-over-limit');
    expect(doing.querySelector('.kh-wip')).toBeNull();

    host.items.update((items) => [...items, { id: 'e', title: '主機升級', status: 'doing' }]);
    await settle();
    expect(doing.classList).toContain('is-over-limit');
    expect(doing.querySelector('.kh-count')?.textContent?.trim()).toBe('3 / 2');
    const warning = doing.querySelector('.kh-wip')!;
    expect(warning.textContent).toContain('超過上限 1 張');
    expect(warning.querySelector('.material-symbols-rounded')?.textContent?.trim()).toBe('warning');
  });

  it('鍵盤：Alt＋→ 換到右邊一欄（保持同一列）、Alt＋↓ 欄內下移；送出受控事件、宣告結果、焦點留在卡片上', async () => {
    await setup();
    card('b').focus();
    press(card('b'), 'ArrowRight');
    await settle();
    expect(host.moves).toEqual([
      { item: expect.objectContaining({ id: 'b' }), fromColumnId: 'todo', toColumnId: 'doing', fromIndex: 1, toIndex: 1 },
    ]);
    expect(titlesIn('doing')).toEqual(['帳號開通', '更換網路線', '報表匯出']);
    expect(document.activeElement).toBe(card('b'));
    await sleep(40);
    fixture.detectChanges();
    expect(live()).toBe('已將「更換網路線」移到「進行中」第 2 張');

    press(card('b'), 'ArrowDown');
    await settle();
    expect(host.moves[1]).toMatchObject({ fromColumnId: 'doing', toColumnId: 'doing', fromIndex: 1, toIndex: 2 });
    expect(titlesIn('doing')).toEqual(['帳號開通', '報表匯出', '更換網路線']);
    expect(document.activeElement).toBe(card('b'));

    // 已經在最下面、最左邊一欄的左邊沒有欄：不送事件。
    press(card('b'), 'ArrowDown');
    press(card('a'), 'ArrowLeft');
    // 沒按 Alt 不算。
    press(card('a'), 'ArrowRight', false);
    await settle();
    expect(host.moves).toHaveLength(2);
  });

  it('Alt＋→ 到比較短的欄：放在該欄最後', async () => {
    await setup();
    press(card('d'), 'ArrowRight');
    await settle();
    expect(host.moves[0]).toMatchObject({ fromColumnId: 'doing', toColumnId: 'done', fromIndex: 1, toIndex: 0 });
    expect(titlesIn('done')).toEqual(['報表匯出']);
  });

  it('canMove 拒絕：不送 moved、送出 moveRejected（附原因），卡片留在原位', async () => {
    await setup();
    host.canMove.set((task, _from, to) => (to === 'done' && !task.owner ? '沒有負責人的卡片不能移到已完成' : true));
    await settle();
    // b 沒有負責人：先移到進行中（允許），再往已完成（拒絕）
    press(card('b'), 'ArrowRight');
    await settle();
    press(card('b'), 'ArrowRight');
    await settle();
    expect(host.moves).toHaveLength(1);
    expect(host.rejected).toEqual([
      { item: expect.objectContaining({ id: 'b' }), fromColumnId: 'doing', toColumnId: 'done', reason: '沒有負責人的卡片不能移到已完成' },
    ]);
    expect(titlesIn('done')).toEqual([]);
    expect(document.activeElement).toBe(card('b'));
  });

  it('拖曳放下：換欄送出 moved（含索引）；canMove 拒絕時送出 moveRejected；放回原位不送事件', async () => {
    await setup();
    host.canMove.set((task, _from, to) => (to === 'done' && !task.owner ? '需要負責人' : true));
    await settle();
    const drop = dropper();
    drop('todo', 'done', 0, 0, 'a');
    drop('todo', 'done', 1, 0, 'b');
    drop('doing', 'doing', 0, 0, 'c');
    await settle();
    expect(host.moves).toEqual([
      { item: expect.objectContaining({ id: 'a' }), fromColumnId: 'todo', toColumnId: 'done', fromIndex: 0, toIndex: 0 },
    ]);
    expect(host.rejected.map((r) => [r.item.id, r.reason])).toEqual([['b', '需要負責人']]);
    expect(titlesIn('done')).toEqual(['印表機卡紙']);
    expect(titlesIn('todo')).toEqual(['更換網路線']);
  });

  it('拖曳放下後焦點跟到卡片：換欄等重畫後放到新位置的卡片；canMove 拒絕或放回原位時回到原卡片；拖曳前焦點不在卡片上也一樣', async () => {
    await setup();
    host.canMove.set((task, _from, to) => (to === 'done' && !task.owner ? '需要負責人' : true));
    await settle();
    const drop = dropper();
    // 拖曳開始前焦點在看板外（滑鼠拖曳時卡片被藏起來，焦點會掉到 body）。
    const outside = document.createElement('button');
    document.body.append(outside);
    try {
      outside.focus();
      const before = card('a');
      drop('todo', 'done', 0, 0, 'a');
      await settle();
      expect(titlesIn('done')).toEqual(['印表機卡紙']);
      // 換欄時卡片是新建的元素：焦點在新的那一個上。
      expect(card('a')).not.toBe(before);
      expect(document.activeElement).toBe(card('a'));

      // 同欄排序（成功）：一樣跟到卡片。
      outside.focus();
      drop('doing', 'doing', 0, 1, 'c');
      await settle();
      expect(titlesIn('doing')).toEqual(['報表匯出', '帳號開通']);
      expect(document.activeElement).toBe(card('c'));

      // canMove 拒絕：卡片留在原欄，焦點立刻回到原卡片（不等重畫）。
      outside.focus();
      drop('todo', 'done', 0, 0, 'b');
      expect(document.activeElement).toBe(card('b'));
      await settle();
      expect(titlesIn('todo')).toEqual(['更換網路線']);
      expect(document.activeElement).toBe(card('b'));

      // 放回原位：沒有事件，焦點放到那張卡片。
      outside.focus();
      drop('doing', 'doing', 0, 0, 'd');
      expect(document.activeElement).toBe(card('d'));
      expect(host.moves).toHaveLength(2);
    } finally {
      outside.remove();
    }
  });

  it('「移動」選單：列出其他欄、上移／下移（頭尾停用）；選了之後移到該欄最後、焦點回到卡片', async () => {
    await setup();
    host.items.update((items) => [...items, { id: 'e', title: '主機升級', status: 'done', owner: '林' }]);
    await settle();
    (card('a').querySelector('.kb-move') as HTMLButtonElement).click();
    await settle();
    const items = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.lib-kanban-menu [mat-menu-item]'));
    expect(items().map((b) => b.textContent?.trim())).toEqual(['east移到「進行中」', 'east移到「已完成」', 'arrow_upward上移', 'arrow_downward下移']);
    expect(items()[2].disabled).toBe(true);
    expect(items()[3].disabled).toBe(false);
    items()[1].click();
    await settle();
    await sleep(20);
    await settle();
    expect(host.moves[0]).toMatchObject({ fromColumnId: 'todo', toColumnId: 'done', fromIndex: 0, toIndex: 1 });
    expect(titlesIn('done')).toEqual(['主機升級', '印表機卡紙']);
    expect(document.activeElement).toBe(card('a'));
  });

  it('選單沒選就關掉（Esc）：焦點回到選單按鈕', async () => {
    await setup();
    const button = card('c').querySelector<HTMLButtonElement>('.kb-move')!;
    button.click();
    await settle();
    const panel = document.querySelector<HTMLElement>('.lib-kanban-menu')!;
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    await settle();
    await sleep(20);
    await settle();
    expect(host.moves).toHaveLength(0);
    expect(document.activeElement).toBe(button);
  });

  it('新增卡片：按鈕展開單行輸入，Enter 送出（去空白、清空、保持展開），Esc 收起並把焦點還給按鈕', async () => {
    await setup();
    expect(column('doing').querySelector('lib-kanban-add-card')).toBeNull();
    const add = () => column('todo').querySelector<HTMLButtonElement>('.ka-button');
    const input = () => column('todo').querySelector<HTMLInputElement>('.ka-input');
    add()!.click();
    await settle();
    expect(document.activeElement).toBe(input());
    expect(input()!.getAttribute('aria-label')).toBe('新增到「待處理」的卡片標題');
    input()!.value = '  新的工單  ';
    input()!.dispatchEvent(new Event('input'));
    press(input()!, 'Enter', false);
    // 空白不送出
    press(input()!, 'Enter', false);
    await settle();
    expect(host.added).toEqual([{ columnId: 'todo', title: '新的工單' }]);
    expect(input()!.value).toBe('');
    press(input()!, 'Escape', false);
    await settle();
    expect(input()).toBeNull();
    expect(document.activeElement).toBe(add());
  });

  it('使用端不更新資料時，卡片留在原位（受控）', async () => {
    await setup();
    host.apply = false;
    press(card('a'), 'ArrowRight');
    await settle();
    expect(host.moves).toHaveLength(1);
    expect(titlesIn('todo')).toEqual(['印表機卡紙', '更換網路線']);
  });
  // ---- 分組（泳道） ----

  async function setupGrouped(): Promise<void> {
    await setup();
    host.groupBy.set(ownerOf);
    host.groups.set(GROUPS);
    await settle();
  }
  const lane = (id: string) => el.querySelector<HTMLElement>(`[data-kanban-group="${id}"]`)!;
  const cellTitles = (groupId: string, columnId: string) =>
    Array.from(lane(groupId)?.querySelectorAll(`[data-kanban-cell="${columnId}"] .t-title`) ?? []).map((n) => n.textContent?.trim());
  const laneHead = (id: string) => lane(id).querySelector<HTMLElement>('lib-kanban-lane-head')!;

  it('分組：依 groupBy 分道，順序照 groups（沒有卡片的也顯示），清單外的值接在最後、名稱來自 groupTitle；欄頭只出現一次', async () => {
    await setupGrouped();
    const lanes = Array.from(el.querySelectorAll<HTMLElement>('[data-kanban-group]'));
    expect(lanes.map((l) => l.dataset['kanbanGroup'])).toEqual(['王', '林', '張', NONE, '陳']);
    expect(lanes.map((l) => l.querySelector('.kl-title')?.textContent?.trim())).toEqual(['王', '林', '張', '未指派', '陳（外部）']);
    // 道標題：張數（報讀器念「N 張卡片」）、標題層級、收合按鈕
    expect(laneHead(NONE).querySelector('.kl-count')?.textContent?.trim()).toBe('1');
    expect(laneHead(NONE).querySelector('.kl-sr')?.textContent?.trim()).toBe('1 張卡片');
    expect(laneHead('張').querySelector('.kl-count')?.textContent?.trim()).toBe('0');
    expect(laneHead('王').querySelector('[role="heading"]')?.getAttribute('aria-level')).toBe('3');
    expect(laneHead('王').querySelector('button')?.getAttribute('aria-expanded')).toBe('true');
    // 欄頭只有一排（3 欄），卡片排在「欄 × 分組」的格子裡
    expect(el.querySelectorAll('lib-kanban-column-head')).toHaveLength(3);
    expect(el.querySelectorAll('.kb-column')).toHaveLength(0);
    expect(cellTitles('林', 'todo')).toEqual(['印表機卡紙']);
    expect(cellTitles(NONE, 'todo')).toEqual(['更換網路線']);
    expect(cellTitles('王', 'doing')).toEqual(['帳號開通']);
    expect(cellTitles('陳', 'doing')).toEqual(['報表匯出']);
    // 格子的清單：名稱是欄名＋分組名；卡片念的位置帶分組
    const list = lane(NONE).querySelector('[data-kanban-cell="todo"] .kb-list')!;
    const names = list.getAttribute('aria-labelledby')!.split(' ').map((id) => el.querySelector(`#${id}`)?.textContent?.trim());
    expect(names).toEqual(['待處理', '未指派']);
    const posId = card('b').getAttribute('aria-describedby')!.split(' ')[0];
    expect(el.querySelector(`#${posId}`)?.textContent).toBe('未指派，待處理，第 1 張，共 1 張');
    expect(el.querySelector(`#${card('b').getAttribute('aria-describedby')!.split(' ')[1]}`)?.textContent).toBe('分組模式：按 Alt 加方向鍵移動');
  });

  it('分組：WIP 照欄計算（所有道加總），超過時欄頭警告只出現一次', async () => {
    await setupGrouped();
    const head = () => el.querySelectorAll<HTMLElement>('lib-kanban-column-head')[1];
    expect(head().querySelector('.kh-count')?.textContent?.trim()).toBe('2 / 2');
    host.items.update((items) => [...items, { id: 'e', title: '主機升級', status: 'doing', owner: '林' }]);
    await settle();
    expect(head().querySelector('.kh-count')?.textContent?.trim()).toBe('3 / 2');
    expect(head().querySelector('.kh-wip')?.textContent).toContain('超過上限 1 張');
    expect(el.querySelectorAll('.kh-wip')).toHaveLength(1);
    expect(el.querySelector('[data-kanban-column="doing"]')?.classList).toContain('is-over-limit');
  });

  it('分組：收合一道（雙向綁定 collapsedGroups），格子收起來、張數還在；再按一次展開', async () => {
    await setupGrouped();
    laneHead('王').querySelector('button')!.click();
    await settle();
    expect(host.collapsed).toEqual(['王']);
    expect(laneHead('王').querySelector('button')?.getAttribute('aria-expanded')).toBe('false');
    expect(lane('王').querySelectorAll('.kb-cell')).toHaveLength(0);
    expect(laneHead('王').querySelector('.kl-count')?.textContent?.trim()).toBe('1');
    expect(card('c')).toBeNull();
    laneHead('王').querySelector('button')!.click();
    await settle();
    expect(host.collapsed).toEqual([]);
    expect(cellTitles('王', 'doing')).toEqual(['帳號開通']);
  });

  it('分組：跨道拖曳送出新的欄與分組（使用端改負責人）；canMove 收到前後分組，拒絕時送出 moveRejected、卡片留在原位', async () => {
    await setupGrouped();
    const checks: unknown[][] = [];
    host.canMove.set((task, from, to, groups) => {
      checks.push([task.id, from, to, groups]);
      return to === 'done' && groups?.toGroupId === NONE ? '未指派的卡片不能移到已完成' : true;
    });
    await settle();
    const drop = dropper();
    // 同一欄換道：未指派 → 王（待處理）
    drop(`todo@${NONE}`, 'todo@王', 0, 0, 'b');
    await settle();
    expect(host.moves[0]).toEqual({
      item: expect.objectContaining({ id: 'b' }),
      fromColumnId: 'todo',
      toColumnId: 'todo',
      fromGroupId: NONE,
      toGroupId: '王',
      fromIndex: 0,
      toIndex: 0,
    });
    expect(checks[0]).toEqual(['b', 'todo', 'todo', { fromGroupId: NONE, toGroupId: '王' }]);
    expect(host.items().find((t) => t.id === 'b')?.owner).toBe('王');
    expect(cellTitles('王', 'todo')).toEqual(['更換網路線']);
    expect(document.activeElement).toBe(card('b'));
    // 換欄又換道：王／進行中 → 林／已完成
    drop('doing@王', 'done@林', 0, 0, 'c');
    await settle();
    expect(host.moves[1]).toMatchObject({ fromColumnId: 'doing', toColumnId: 'done', fromGroupId: '王', toGroupId: '林' });
    expect(cellTitles('林', 'done')).toEqual(['帳號開通']);
    // 拒絕：移到未指派的已完成
    drop('todo@林', `done@${NONE}`, 0, 0, 'a');
    await settle();
    expect(host.moves).toHaveLength(2);
    expect(host.rejected).toEqual([
      {
        item: expect.objectContaining({ id: 'a' }),
        fromColumnId: 'todo',
        toColumnId: 'done',
        fromGroupId: '林',
        toGroupId: NONE,
        reason: '未指派的卡片不能移到已完成',
      },
    ]);
    expect(cellTitles('林', 'todo')).toEqual(['印表機卡紙']);
    expect(cellTitles(NONE, 'done')).toEqual([]);
    // 同一格排序不問 canMove
    const before = checks.length;
    host.items.update((items) => [...items, { id: 'e', title: '主機升級', status: 'todo', owner: '王' }]);
    await settle();
    dropper()('todo@王', 'todo@王', 0, 1, 'b');
    await settle();
    expect(checks.length).toBe(before);
    expect(cellTitles('王', 'todo')).toEqual(['主機升級', '更換網路線']);
  });

  it('分組：鍵盤 Alt＋↓ 在格子最後一張時換到下一道最前、Alt＋↑ 在第一張時換到上一道最後；Alt＋←／→ 留在同一道；移到收合的道會自動展開', async () => {
    await setupGrouped();
    // b 在「未指派／待處理」唯一的一張：Alt＋↑ → 張（上一道）的最後（空格，第 1 張）
    press(card('b'), 'ArrowUp');
    await settle();
    expect(host.moves[0]).toMatchObject({ fromGroupId: NONE, toGroupId: '張', fromColumnId: 'todo', toColumnId: 'todo', toIndex: 0 });
    expect(cellTitles('張', 'todo')).toEqual(['更換網路線']);
    expect(document.activeElement).toBe(card('b'));
    await sleep(40);
    fixture.detectChanges();
    expect(live()).toBe('已將「更換網路線」移到「張」的「待處理」第 1 張');
    // 再 Alt＋↑ → 林（上一道）的最後：林／待處理原本有 a，放在第 2 張
    press(card('b'), 'ArrowUp');
    await settle();
    expect(cellTitles('林', 'todo')).toEqual(['印表機卡紙', '更換網路線']);
    // Alt＋↓ 在最後一張：換到下一道（張）的最前
    press(card('b'), 'ArrowDown');
    await settle();
    expect(cellTitles('張', 'todo')).toEqual(['更換網路線']);
    // Alt＋→：同一道換欄
    press(card('b'), 'ArrowRight');
    await settle();
    expect(host.moves.at(-1)).toMatchObject({ fromGroupId: '張', toGroupId: '張', fromColumnId: 'todo', toColumnId: 'doing' });
    // 收合「未指派」，再 Alt＋↓ 換道過去：自動展開，焦點跟到卡片
    laneHead(NONE).querySelector('button')!.click();
    await settle();
    card('b').focus();
    press(card('b'), 'ArrowDown');
    await settle();
    expect(host.collapsed).toEqual([]);
    expect(cellTitles(NONE, 'doing')).toEqual(['更換網路線']);
    expect(document.activeElement).toBe(card('b'));
    // 最後一道的最後一張再往下：沒有下一道，不送事件
    const count = host.moves.length;
    press(card('d'), 'ArrowDown');
    await settle();
    expect(host.moves).toHaveLength(count);
  });

  it('分組：「移動」選單有「換到其他分組」，列出其他道；選了之後移到該道同一欄的最後', async () => {
    await setupGrouped();
    (card('c').querySelector('.kb-move') as HTMLButtonElement).click();
    await settle();
    const groupItem = document.querySelector<HTMLButtonElement>('.lib-kanban-menu [data-kanban-group-menu]')!;
    expect(groupItem.textContent).toContain('換到其他分組');
    groupItem.click();
    await settle();
    await sleep(20);
    await settle();
    const options = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[data-kanban-move-group]'));
    expect(options().map((b) => b.textContent?.trim())).toEqual(['換到「林」', '換到「張」', '換到「未指派」', '換到「陳（外部）」']);
    options().find((b) => b.dataset['kanbanMoveGroup'] === '陳')!.click();
    await settle();
    await sleep(20);
    await settle();
    expect(host.moves[0]).toMatchObject({ fromGroupId: '王', toGroupId: '陳', fromColumnId: 'doing', toColumnId: 'doing', toIndex: 1 });
    expect(cellTitles('陳', 'doing')).toEqual(['報表匯出', '帳號開通']);
    expect(document.activeElement).toBe(card('c'));
  });

  it('分組：新增卡片在每一格底下，事件帶 groupId', async () => {
    await setupGrouped();
    const cell = lane('林').querySelector<HTMLElement>('[data-kanban-cell="todo"]')!;
    expect(lane('林').querySelector('[data-kanban-cell="doing"] lib-kanban-add-card')).toBeNull();
    cell.querySelector<HTMLButtonElement>('.ka-button')!.click();
    await settle();
    const input = cell.querySelector<HTMLInputElement>('.ka-input')!;
    input.value = '新的工單';
    input.dispatchEvent(new Event('input'));
    press(input, 'Enter', false);
    await settle();
    expect(host.added).toEqual([{ columnId: 'todo', title: '新的工單', groupId: '林' }]);
  });
});

describe('moveKanbanItem', () => {
  const opts = {
    key: (t: Task) => t.id,
    column: (t: Task) => t.status,
    withColumn: (t: Task, status: string) => ({ ...t, status }),
  };
  const ids = (items: Task[]) => items.map((t) => `${t.id}:${t.status}`).join(' ');

  it('換欄：插在目標欄第 toIndex 張之前；超過就接在該欄最後；空欄放清單最後', () => {
    const items = seed();
    const a = items[0];
    expect(ids(moveKanbanItem(items, { item: a, fromColumnId: 'todo', toColumnId: 'doing', fromIndex: 0, toIndex: 1 }, opts))).toBe(
      'b:todo c:doing a:doing d:doing',
    );
    expect(ids(moveKanbanItem(items, { item: a, fromColumnId: 'todo', toColumnId: 'doing', fromIndex: 0, toIndex: 9 }, opts))).toBe(
      'b:todo c:doing d:doing a:doing',
    );
    expect(ids(moveKanbanItem(items, { item: a, fromColumnId: 'todo', toColumnId: 'done', fromIndex: 0, toIndex: 0 }, opts))).toBe(
      'b:todo c:doing d:doing a:done',
    );
    // 原陣列不變
    expect(ids(items)).toBe('a:todo b:todo c:doing d:doing');
  });

  it('分組：位置在「欄 × 分組」那一格裡算，換組時用 withGroup 更新卡片', () => {
    const items = [...seed(), { id: 'e', title: '主機升級', status: 'doing', owner: '王' }];
    const grouped = { ...opts, group: ownerOf, withGroup: (t: Task, owner: string) => ({ ...t, owner: owner === NONE ? undefined : owner }) };
    const owners = (list: Task[]) => list.map((t) => `${t.id}:${t.status}:${ownerOf(t)}`).join(' ');
    // b（未指派／待處理）→ 王／進行中的第 1 張之前：王的進行中是 c、e，插在 e 前面（不是整欄的第 1 張 d 前面）
    const b = items[1];
    expect(
      owners(moveKanbanItem(items, { item: b, fromColumnId: 'todo', toColumnId: 'doing', fromGroupId: NONE, toGroupId: '王', fromIndex: 0, toIndex: 1 }, grouped)),
    ).toBe('a:todo:林 c:doing:王 d:doing:陳 b:doing:王 e:doing:王');
    // 只換組不換欄
    expect(
      owners(moveKanbanItem(items, { item: b, fromColumnId: 'todo', toColumnId: 'todo', fromGroupId: NONE, toGroupId: '林', fromIndex: 0, toIndex: 9 }, grouped)),
    ).toBe('a:todo:林 b:todo:林 c:doing:王 d:doing:陳 e:doing:王');
  });

  it('同欄：toIndex 是拿掉原卡片之後的位置（同 moveItemInArray）', () => {
    const items = seed();
    expect(ids(moveKanbanItem(items, { item: items[0], fromColumnId: 'todo', toColumnId: 'todo', fromIndex: 0, toIndex: 1 }, opts))).toBe(
      'b:todo a:todo c:doing d:doing',
    );
    expect(ids(moveKanbanItem(items, { item: items[3], fromColumnId: 'doing', toColumnId: 'doing', fromIndex: 1, toIndex: 0 }, opts))).toBe(
      'a:todo b:todo d:doing c:doing',
    );
  });
});
