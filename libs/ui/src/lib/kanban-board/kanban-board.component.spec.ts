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
};

interface Task {
  id: string;
  title: string;
  status: string;
  owner?: string;
}

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
      moveKanbanItem(items, event, { key: this.key, column: this.column, withColumn: (t, status) => ({ ...t, status }) }),
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
    const board = fixture.debugElement.children[0].componentInstance as KanbanBoardComponent<Task>;
    const drop = (from: string, to: string, previousIndex: number, currentIndex: number, id: string) =>
      (board as unknown as { onDropped(e: unknown): void }).onDropped({
        previousContainer: { data: from },
        container: { data: to },
        previousIndex,
        currentIndex,
        item: { data: { item: host.items().find((t) => t.id === id) } },
      });
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
    const board = fixture.debugElement.children[0].componentInstance as KanbanBoardComponent<Task>;
    const drop = (from: string, to: string, previousIndex: number, currentIndex: number, id: string) =>
      (board as unknown as { onDropped(e: unknown): void }).onDropped({
        previousContainer: { data: from },
        container: { data: to },
        previousIndex,
        currentIndex,
        item: { data: { item: host.items().find((t) => t.id === id) } },
      });
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
