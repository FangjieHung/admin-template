import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { KanbanPageComponent } from './kanban-page.component';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('KanbanPageComponent（看板展示頁）', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  const demo = (id: string) => el.querySelector<HTMLElement>(`[data-demo="${id}"]`)!;
  const column = (scope: HTMLElement, id: string) => scope.querySelector<HTMLElement>(`[data-kanban-column="${id}"]`)!;
  const ids = (scope: HTMLElement, id: string) =>
    Array.from(column(scope, id).querySelectorAll('.kanban-ticket__id')).map((n) => n.textContent?.trim());
  const card = (id: string) => el.querySelector<HTMLElement>(`[data-kanban-card="${id}"]`)!;
  const altKey = (target: HTMLElement, key: string) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, altKey: true, bubbles: true, cancelable: true }));
  const log = () => Array.from(demo('board').querySelectorAll('.kanban-demo-log li')).map((li) => li.textContent?.trim());
  const settle = async (ms = 0) => {
    for (let i = 0; i < 3; i++) {
      harness.detectChanges();
      await sleep(ms);
    }
    harness.detectChanges();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: KanbanPageComponent }])] });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/components/kanban', KanbanPageComponent);
    el = harness.routeNativeElement as HTMLElement;
    await settle();
  });

  afterEach(() => {
    TestBed.inject(OverlayContainer).getContainerElement().innerHTML = '';
  });

  it('工單看板：四欄，「進行中」一開始就放滿 WIP 上限 3 張；卡片有編號、優先順序、負責人、期限', () => {
    const board = demo('board');
    const titles = Array.from(board.querySelectorAll('.kh-title')).map((n) => n.textContent?.trim());
    expect(titles).toEqual(['待處理', '進行中', '待確認', '已完成']);
    expect(column(board, 'doing').querySelector('.kh-count')?.textContent?.trim()).toBe('3 / 3');
    expect(column(board, 'doing').classList).not.toContain('is-over-limit');
    const first = card('TK-2101');
    expect(first.querySelector('.ui-chip')?.textContent?.trim()).toBe('高');
    expect(first.querySelector('.kanban-ticket__person')?.textContent).toContain('未指派');
    expect(first.querySelector('.kanban-ticket__due')?.textContent).toContain('期限 10/16');
    expect(first.getAttribute('aria-label')).toBe('三樓印表機卡紙，無法列印');
  });

  it('再放一張到「進行中」：欄位提醒超過上限；事件記錄寫出移動結果', async () => {
    altKey(card('TK-2102'), 'ArrowRight');
    await settle();
    const doing = column(demo('board'), 'doing');
    expect(doing.classList).toContain('is-over-limit');
    expect(doing.querySelector('.kh-wip')?.textContent).toContain('超過上限 1 張');
    expect(ids(demo('board'), 'doing')).toEqual(['TK-2096', 'TK-2102', 'TK-2097', 'TK-2099']);
    expect(log()[0]).toBe('TK-2102：「待處理」→「進行中」第 2 張');
  });

  it('沒有負責人的工單移到「已完成」被擋下：留在原位、跳出提示說明原因', async () => {
    (card('TK-2103').querySelector('.kb-move') as HTMLButtonElement).click();
    await settle();
    const items = Array.from(document.querySelectorAll<HTMLButtonElement>('.lib-kanban-menu [mat-menu-item]'));
    items.find((b) => b.textContent?.includes('已完成'))!.click();
    await settle(20);
    expect(ids(demo('board'), 'done')).toEqual(['TK-2081']);
    expect(ids(demo('board'), 'todo')).toContain('TK-2103');
    const toast = document.querySelector('.cdk-overlay-container')?.textContent ?? '';
    expect(toast).toContain('「TK-2103」還沒有負責人，指派之後才能移到「已完成」');
    expect(log()[0]).toContain('TK-2103 被擋下');
  });

  it('「待處理」欄底新增卡片：新的工單出現在該欄最後；重設回到初始資料', async () => {
    const todo = column(demo('board'), 'todo');
    (todo.querySelector('.ka-button') as HTMLButtonElement).click();
    await settle();
    const input = todo.querySelector<HTMLInputElement>('.ka-input')!;
    input.value = '門禁卡失效';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await settle();
    expect(ids(demo('board'), 'todo')).toEqual(['TK-2101', 'TK-2102', 'TK-2103', 'TK-2104']);
    (demo('board').querySelector('[data-demo-action="reset"]') as HTMLButtonElement).click();
    await settle();
    expect(ids(demo('board'), 'todo')).toEqual(['TK-2101', 'TK-2102', 'TK-2103']);
    expect(log()).toEqual(['（還沒有移動或新增）']);
  });

  it('依負責人分組：四道（最後是未指派）；Alt＋↓ 換到下一道＝換負責人；拖到「未指派」的「已完成」被擋下並提示', async () => {
    const lanes = demo('lanes');
    const laneIds = Array.from(lanes.querySelectorAll<HTMLElement>('[data-kanban-group]')).map((l) => l.dataset['kanbanGroup']);
    expect(laneIds).toEqual(['王小明', '林雅婷', '陳志豪', 'unassigned']);
    expect(Array.from(lanes.querySelectorAll('.kl-title')).map((n) => n.textContent?.trim())).toEqual(['王小明', '林雅婷', '陳志豪', '未指派']);
    // 欄頭只有一排，WIP 照整欄算（王小明 2 張＋陳志豪 1 張＝3）
    expect(lanes.querySelectorAll('lib-kanban-column-head')).toHaveLength(4);
    expect(lanes.querySelectorAll('.kh-count')[1].textContent?.trim()).toBe('3 / 3');
    const laneCard = (id: string) => lanes.querySelector<HTMLElement>(`[data-kanban-card="${id}"]`)!;
    const laneOf = (id: string) => laneCard(id).closest<HTMLElement>('[data-kanban-group]')!.dataset['kanbanGroup'];
    const laneLog = () => Array.from(lanes.querySelectorAll('[data-demo-log="lanes"] li')).map((li) => li.textContent?.trim());

    altKey(laneCard('TK-2102'), 'ArrowDown');
    await settle();
    expect(laneOf('TK-2102')).toBe('陳志豪');
    expect(laneLog()[0]).toBe('TK-2102：負責人「林雅婷」→「陳志豪」');

    // TK-2081（王小明／已完成）一路往下：林雅婷、陳志豪都可以，到「未指派」被擋下
    for (const expected of ['林雅婷', '陳志豪']) {
      altKey(laneCard('TK-2081'), 'ArrowDown');
      await settle();
      expect(laneOf('TK-2081')).toBe(expected);
    }
    altKey(laneCard('TK-2081'), 'ArrowDown');
    await settle(20);
    expect(laneOf('TK-2081')).toBe('陳志豪');
    expect(document.querySelector('.cdk-overlay-container')?.textContent ?? '').toContain('「TK-2081」要有負責人才能放進「已完成」');
    expect(laneLog()[0]).toContain('TK-2081 被擋下');
  });

  it('載入中與空看板：骨架 → 空狀態 → 有欄位但每欄都沒有卡片', async () => {
    const states = demo('states');
    expect(states.querySelectorAll('lib-skeleton').length).toBeGreaterThan(0);
    (states.querySelector('[data-state="empty"]') as HTMLButtonElement).click();
    await settle();
    const empty = states.querySelector('lib-empty-state')!;
    expect(empty.textContent).toContain('還沒有工單');
    (empty.querySelector('button') as HTMLButtonElement).click();
    await settle();
    expect(states.querySelector('lib-kanban-board')).not.toBeNull();
    expect(Array.from(states.querySelectorAll('.kb-empty')).map((n) => n.textContent)).toEqual([
      '沒有卡片',
      '沒有卡片',
      '沒有卡片',
      '沒有卡片',
    ]);
    expect(states.querySelector('[data-state="ready"]')?.getAttribute('aria-pressed')).toBe('true');
  });
});
