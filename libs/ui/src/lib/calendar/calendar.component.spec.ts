import { describe, it, expect, afterEach, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CalendarComponent } from './calendar.component';
import { CALENDAR_LABELS } from './calendar-labels';
import { CALENDAR_TEST_LABELS } from './calendar-testing';
import { ToastService } from '../toast/toast.service';
import { TOUCH_DRAG_DELAY } from './calendar-drag';
import {
  CalendarChangeFn,
  CalendarEvent,
  CalendarEventChange,
  CalendarRange,
  CalendarResource,
  CalendarSlotSelection,
  CalendarSource,
  CalendarView,
} from './calendar.types';

const d = (y: number, m: number, day: number, h = 0, min = 0) => new Date(y, m - 1, day, h, min);

const EVENTS: CalendarEvent[] = [
  { id: 'weekly', title: '團隊週會', start: d(2026, 10, 14, 10), end: d(2026, 10, 14, 11), category: 'meeting', resourceId: 'room-a' },
  { id: 'brief', title: '客戶簡報', start: d(2026, 10, 14, 10, 30), end: d(2026, 10, 14, 12), category: 'client', resourceId: 'room-a' },
  { id: 'train', title: '教育訓練', start: d(2026, 10, 14, 13), end: d(2026, 10, 14, 15), resourceId: 'room-b' },
  { id: 'leave', title: '請假', start: d(2026, 10, 14), end: d(2026, 10, 15), allDay: true },
  { id: 'ops', title: '系統維護', start: d(2026, 10, 14, 18), end: d(2026, 10, 14, 19), editable: false },
  { id: 'other', title: '讀書會', start: d(2026, 10, 20, 9), end: d(2026, 10, 20, 10) },
];

const RESOURCES: CalendarResource[] = [
  { id: 'room-a', title: '會議室 A', group: '三樓' },
  { id: 'room-b', title: '會議室 B', group: '三樓' },
  { id: 'room-c', title: '會議室 C', group: '五樓' },
];

@Component({
  imports: [CalendarComponent],
  template: `
    <lib-calendar
      [(view)]="view"
      [views]="views()"
      [(date)]="date"
      [events]="source() ? null : events()"
      [source]="source()"
      [resources]="resources"
      [categories]="categories"
      [allowOverlap]="allowOverlap()"
      [readonly]="readonly()"
      [onEventChange]="save()"
      (eventClick)="clicked.set($event)"
      (slotSelect)="selected.set($event)"
      (eventChange)="changes.push($event)"
    />
  `,
})
class HostComponent {
  readonly view = signal<CalendarView>('month');
  readonly views = signal<readonly CalendarView[]>(['month', 'week', 'day', 'agenda', 'resource']);
  readonly date = signal(d(2026, 10, 14));
  readonly events = signal<readonly CalendarEvent[]>(EVENTS);
  readonly source = signal<CalendarSource | null>(null);
  readonly resources = RESOURCES;
  readonly categories = [
    { id: 'meeting', label: '會議', color: 1 },
    { id: 'client', label: '客戶', color: 2 },
  ];
  readonly allowOverlap = signal(true);
  readonly readonly = signal(false);
  readonly save = signal<CalendarChangeFn | null>(null);
  readonly clicked = signal<CalendarEvent | null>(null);
  readonly selected = signal<CalendarSlotSelection | null>(null);
  readonly changes: CalendarEventChange[] = [];
}

function fakeToast() {
  return {
    success: vi.fn(() => ({ actionClicked: Promise.resolve(false), afterDismissed: Promise.resolve(), dismiss: () => undefined })),
    error: vi.fn(() => ({ actionClicked: Promise.resolve(false), afterDismissed: Promise.resolve(), dismiss: () => undefined })),
  };
}

async function setup(configure?: (host: HostComponent) => void) {
  const toast = fakeToast();
  TestBed.configureTestingModule({
    providers: [
      { provide: CALENDAR_LABELS, useValue: CALENDAR_TEST_LABELS },
      { provide: ToastService, useValue: toast },
    ],
  });
  const fixture = TestBed.createComponent(HostComponent);
  configure?.(fixture.componentInstance);
  const el = fixture.nativeElement as HTMLElement;
  document.body.appendChild(el);
  const settle = async () => {
    for (let i = 0; i < 4; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r, 0));
    }
    fixture.detectChanges();
  };
  await settle();
  const calendar = () => fixture.debugElement.children[0].componentInstance as CalendarComponent;
  return { fixture, host: fixture.componentInstance, el, settle, toast, calendar };
}

function pointer(type: string, x: number, y: number, target: EventTarget = window) {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  target.dispatchEvent(e);
  return e;
}

/** 觸控的指標事件（jsdom 沒有 PointerEvent，補上 pointerType／pointerId）。 */
function touchPointer(type: string, x: number, y: number, target: EventTarget = window) {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperties(e, { pointerType: { value: 'touch' }, pointerId: { value: 3 } });
  target.dispatchEvent(e);
  return e;
}

function touchMove(target: EventTarget): Event {
  const e = new Event('touchmove', { bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
}

function eventButton(el: HTMLElement, id: string): HTMLButtonElement {
  const button = el.querySelector<HTMLButtonElement>(`button[data-event-id="${id}"]:not(.is-ghost)`);
  if (!button) throw new Error(`找不到活動 ${id}`);
  return button;
}

afterEach(() => {
  document.body.querySelectorAll('ng-component, [ng-version]').forEach((n) => n.remove());
  TestBed.resetTestingModule();
});

describe('CalendarComponent（共用日曆）', () => {
  it('沒有提供畫面文字時丟出明確的錯誤', () => {
    TestBed.configureTestingModule({});
    expect(() => TestBed.createComponent(HostComponent)).toThrow(/CALENDAR_LABELS/);
  });

  it('月檢視：role="grid"、今天以外的格子不在 Tab 順序裡，活動有完整的無障礙名稱', async () => {
    const { el } = await setup();
    const grid = el.querySelector('[role="grid"]')!;
    expect(grid.getAttribute('aria-label')).toBe('2026 年 10 月');
    expect(el.querySelectorAll('[role="gridcell"]')).toHaveLength(35);
    const tabbable = el.querySelectorAll('[role="gridcell"][tabindex="0"]');
    expect(tabbable).toHaveLength(1);
    expect(eventButton(el, 'weekly').getAttribute('aria-label')).toBe('團隊週會，10 月 14 日 星期三 10:00 到 11:00，會議室 A，會議');
    expect(el.querySelector('.cal-legend')?.textContent).toContain('會議');
  });

  it('月檢視：超過 3 筆時顯示「+N 筆」，按下打開當天清單，Esc 關閉並回到按鈕', async () => {
    const { el, fixture, settle } = await setup();
    const more = el.querySelector<HTMLButtonElement>('[data-date="2026-10-14"] .cal-more')!;
    expect(more.textContent?.trim()).toBe('+3 筆');
    expect(el.querySelectorAll('[data-date="2026-10-14"] .cal-day__events > .cal-ev')).toHaveLength(2);
    more.click();
    await settle();
    const pop = el.querySelector<HTMLElement>('.cal-pop')!;
    expect(pop.querySelectorAll('.cal-ev')).toHaveLength(5);
    expect(document.activeElement).toBe(pop.querySelector('.cal-ev'));
    pop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(el.querySelector('.cal-pop')).toBeNull();
    expect(document.activeElement).toBe(more);
  });

  it('月檢視：方向鍵在日子之間移動，移出這個月時換月', async () => {
    const { el, host, settle } = await setup();
    const cell = el.querySelector<HTMLElement>('[data-date="2026-10-14"]')!;
    cell.focus();
    cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();
    expect((document.activeElement as HTMLElement).dataset['date']).toBe('2026-10-21');
    const focused = document.activeElement as HTMLElement;
    focused.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    await settle();
    expect(host.date().getMonth()).toBe(10);
    expect((document.activeElement as HTMLElement).dataset['date']).toBe('2026-11-21');
  });

  it('點空白的日子＝選取那一天（整天）；唯讀時不選取', async () => {
    const { el, host, settle } = await setup();
    el.querySelector<HTMLElement>('[data-date="2026-10-22"]')!.click();
    expect(host.selected()).toMatchObject({ allDay: true, resourceId: null });
    expect(host.selected()!.start.getDate()).toBe(22);
    host.selected.set(null);
    host.readonly.set(true);
    await settle();
    el.querySelector<HTMLElement>('[data-date="2026-10-23"]')!.click();
    expect(host.selected()).toBeNull();
  });

  it('資料來源：依看得到的範圍載入，換頁時 abort 上一次，失敗可以重試', async () => {
    const calls: { range: CalendarRange; signal: AbortSignal }[] = [];
    let fail = false;
    const resolvers: (() => void)[] = [];
    const source: CalendarSource = {
      list: (range, signal) => {
        calls.push({ range, signal });
        return new Promise((resolve, reject) => {
          resolvers.push(() => (fail ? reject(new Error('x')) : resolve(EVENTS)));
        });
      },
    };
    const { el, settle, calendar } = await setup((h) => h.source.set(source));
    expect(calls).toHaveLength(1);
    expect(calls[0].range.start.getDate()).toBe(28);
    expect(el.querySelector('.cal-loading')).not.toBeNull();
    calendar().step(1);
    await settle();
    expect(calls).toHaveLength(2);
    expect(calls[0].signal.aborted).toBe(true);
    expect(calls[1].range.start.getMonth()).toBe(9); // 11 月的月曆從 10/26 開始
    resolvers[1]();
    await settle();
    expect(el.querySelector('.cal-loading')).toBeNull();
    fail = true;
    calendar().step(1);
    await settle();
    resolvers[2]();
    await settle();
    expect(el.querySelector('lib-error-state')).not.toBeNull();
    fail = false;
    el.querySelector<HTMLButtonElement>('lib-error-state button')!.click();
    await settle();
    expect(calls).toHaveLength(4);
    resolvers[3]();
    await settle();
    expect(el.querySelector('lib-error-state')).toBeNull();
  });

  describe('週檢視：拖曳與鍵盤', () => {
    async function weekSetup(save?: CalendarChangeFn) {
      const ctx = await setup((h) => {
        h.view.set('week');
        if (save) h.save.set(save);
      });
      // 7 欄，每欄 100px 寬、1440px 高（一分鐘 1px）。
      ctx.el.querySelectorAll<HTMLElement>('.tg__col').forEach((col, i) => {
        col.getBoundingClientRect = () => rect(100 + i * 100, 0, 100, 1440);
      });
      return ctx;
    }

    it('有 7 天，重疊的活動並排，整天的放在上方', async () => {
      const { el } = await weekSetup();
      expect(el.querySelectorAll('.tg__col')).toHaveLength(7);
      const weekly = eventButton(el, 'weekly');
      const brief = eventButton(el, 'brief');
      // 水平位置交給 CSS（夠寬並排、太窄錯開疊放）：元件只給欄位
      expect([weekly.style.getPropertyValue('--ev-col'), weekly.style.getPropertyValue('--ev-cols')]).toEqual(['0', '2']);
      expect([brief.style.getPropertyValue('--ev-col'), brief.style.getPropertyValue('--ev-cols')]).toEqual(['1', '2']);
      expect(brief.getAttribute('data-col')).toBe('1');
      expect(el.querySelector('.tg__allday-cell [data-event-id="leave"]')).not.toBeNull();
    });

    it('三筆重疊：每筆都有自己的欄（第 0、1、2 欄，共 3 欄），不再用百分比寫死寬度', async () => {
      const { el, host, settle } = await weekSetup();
      host.events.set([
        ...EVENTS,
        { id: 'third', title: '專案檢討', start: d(2026, 10, 14, 10, 15), end: d(2026, 10, 14, 11, 15) },
      ]);
      await settle();
      const cols = ['weekly', 'third', 'brief'].map((id) => {
        const b = eventButton(el, id);
        return [b.style.getPropertyValue('--ev-col'), b.style.getPropertyValue('--ev-cols'), b.style.left, b.style.width];
      });
      expect(cols).toEqual([
        ['0', '3', '', ''],
        ['1', '3', '', ''],
        ['2', '3', '', ''],
      ]);
    });

    it('時間格的活動另外帶「開始時間」：矮的活動排成一行「10:00 團隊週會」用（月曆格沒有）', async () => {
      const { el } = await weekSetup();
      const weekly = eventButton(el, 'weekly');
      expect(weekly.querySelector('.cal-ev__start')?.textContent?.trim()).toBe('10:00');
      expect(weekly.querySelector('.cal-ev__time')?.textContent?.trim()).toBe('10:00 – 11:00');
      // 開始時間排在標題前面（矮的時候 CSS 只把它顯示出來，不用重排 DOM）
      const body = weekly.querySelector('.cal-ev__body')!;
      expect([...body.children].map((c) => c.className.split(' ')[0])).toEqual(['cal-ev__start', 'cal-ev__title', 'cal-ev__time']);
    });

    it('觸控：長按後拖曳移動（拖曳中擋掉捲動），放開送出和滑鼠一樣的變更', async () => {
      const save = vi.fn<CalendarChangeFn>(() => Promise.resolve());
      const { el, settle, host } = await weekSetup(save);
      const weekly = eventButton(el, 'weekly');
      touchPointer('pointerdown', 350, 610, weekly);
      touchPointer('pointermove', 352, 612);
      expect(touchMove(weekly).defaultPrevented).toBe(false);
      await wait(TOUCH_DRAG_DELAY + 60);
      await settle();
      // 長按到時：原地出現預覽（拿起來了）
      expect(el.querySelector<HTMLElement>('.cal-ev.is-ghost')?.textContent).toContain('10 月 14 日 星期三 10:00 到 11:00');
      expect(touchMove(weekly).defaultPrevented).toBe(true);
      touchPointer('pointermove', 452, 668);
      await settle();
      expect(el.querySelector<HTMLElement>('.cal-ev.is-ghost')!.textContent).toContain('10 月 15 日 星期四 11:00 到 12:00');
      expect(el.querySelector('.cal-ev.is-ghost')!.classList).not.toContain('is-tip-end');
      // 拖到右半邊的欄：提示改成靠右對齊（不超出捲動容器）
      touchPointer('pointermove', 652, 668);
      await settle();
      expect(el.querySelector('.cal-ev.is-ghost')!.classList).toContain('is-tip-end');
      touchPointer('pointermove', 452, 668);
      await settle();
      touchPointer('pointerup', 452, 668);
      await settle();
      expect(save).toHaveBeenCalledTimes(1);
      const change = save.mock.calls[0][0];
      expect([change.kind, change.via]).toEqual(['move', 'pointer']);
      expect([change.event.start.getDate(), change.event.start.getHours(), change.event.end.getHours()]).toEqual([15, 11, 12]);
      expect(host.changes).toHaveLength(1);
      expect(touchMove(eventButton(el, 'weekly')).defaultPrevented).toBe(false);
    });

    it('觸控：還沒按住就滑動＝捲動，不拖曳也不擋捲動', async () => {
      const save = vi.fn<CalendarChangeFn>(() => Promise.resolve());
      const { el, settle } = await weekSetup(save);
      const weekly = eventButton(el, 'weekly');
      touchPointer('pointerdown', 350, 610, weekly);
      const swipe = touchPointer('pointermove', 350, 660);
      expect(swipe.defaultPrevented).toBe(false);
      expect(touchMove(weekly).defaultPrevented).toBe(false);
      await wait(TOUCH_DRAG_DELAY + 60);
      await settle();
      expect(el.querySelector('.cal-ev.is-ghost')).toBeNull();
      touchPointer('pointerup', 350, 700);
      await settle();
      expect(save).not.toHaveBeenCalled();
    });

    describe('鍵盤選取時段', () => {
      const active = () => document.activeElement as HTMLElement;
      const key = (target: Element, k: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

      it('只有一格在 Tab 順序裡；方向鍵上下換時段、左右換天，名稱是日期＋時間', async () => {
        const { el, settle } = await weekSetup();
        const tabbable = el.querySelectorAll<HTMLElement>('.tg__slot[tabindex="0"]');
        expect(tabbable).toHaveLength(1);
        expect(el.querySelectorAll('.tg__slot')).toHaveLength(7 * 48);
        const start = tabbable[0];
        // 預設停在 scrollToHour（8:00）
        expect(start.dataset['minute']).toBe('480');
        expect(start.getAttribute('role')).toBe('button');
        expect(start.getAttribute('aria-label')).toMatch(/月 \d+ 日 星期.+，8:00 到 8:30$/);
        expect(start.getAttribute('aria-description')).toBe('按 Enter 在這個時段新增');

        // 先移到星期一（Home 是當天第一格，所以用左鍵走到底）
        start.focus();
        for (let i = 0; i < 7; i++) {
          key(active(), 'ArrowLeft');
          await settle();
        }
        expect(active().closest('.tg__col')!.getAttribute('data-date')).toBe('2026-10-12');
        key(active(), 'ArrowDown');
        await settle();
        expect(active().dataset['minute']).toBe('510');
        expect(active().getAttribute('aria-label')).toBe('10 月 12 日 星期一，8:30 到 9:00');
        key(active(), 'ArrowRight');
        await settle();
        expect(active().closest('.tg__col')!.getAttribute('data-date')).toBe('2026-10-13');
        expect(active().getAttribute('tabindex')).toBe('0');
        expect(el.querySelectorAll('.tg__slot[tabindex="0"]')).toHaveLength(1);
        key(active(), 'ArrowUp');
        await settle();
        expect(active().getAttribute('aria-label')).toBe('10 月 13 日 星期二，8:00 到 8:30');
        key(active(), 'End');
        await settle();
        expect(active().getAttribute('aria-label')).toBe('10 月 13 日 星期二，23:30 到 24:00');
        key(active(), 'ArrowDown');
        await settle();
        expect(active().dataset['minute']).toBe('1410');
        key(active(), 'Home');
        await settle();
        expect(active().dataset['minute']).toBe('0');
        // 按住方向鍵連發（中間沒有重新繪製）也不漏步
        key(active(), 'ArrowDown');
        key(active(), 'ArrowDown');
        key(active(), 'ArrowDown');
        expect(active().dataset['minute']).toBe('90');
        await settle();
        expect(active().getAttribute('tabindex')).toBe('0');
      });

      it('Enter 或 Space＝選取那個時段（和點空白處一樣送出 slotSelect）；唯讀時沒有時段格', async () => {
        const { el, settle, host } = await weekSetup();
        const slot = el.querySelector<HTMLElement>('.tg__col[data-date="2026-10-16"] .tg__slot[data-minute="570"]')!;
        slot.focus();
        const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        slot.dispatchEvent(enter);
        expect(enter.defaultPrevented).toBe(true);
        const sel = host.selected()!;
        expect(sel).toMatchObject({ allDay: false, resourceId: null });
        expect([sel.start.getDate(), sel.start.getHours(), sel.start.getMinutes(), sel.end.getHours(), sel.end.getMinutes()]).toEqual([16, 9, 30, 10, 0]);
        await settle();
        // 剛剛選的那格變成 Tab 順序裡的那一格
        expect(el.querySelector('.tg__slot[tabindex="0"]')).toBe(slot);
        host.selected.set(null);
        const space = el.querySelector<HTMLElement>('.tg__col[data-date="2026-10-12"] .tg__slot[data-minute="0"]')!;
        space.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
        expect(host.selected()!.start.getDate()).toBe(12);
        host.readonly.set(true);
        await settle();
        expect(el.querySelectorAll('.tg__slot')).toHaveLength(0);
      });
    });

    it('拖曳移動：對齊 30 分鐘、可以換日子，拖曳中顯示新時間；放開後送出變更', async () => {
      const save = vi.fn<CalendarChangeFn>(() => Promise.resolve());
      const { el, settle, host, toast } = await weekSetup(save);
      const weekly = eventButton(el, 'weekly');
      // 10/14 是第 3 欄（x 300–400）；10:00 在 y=600
      pointer('pointerdown', 350, 610, weekly);
      pointer('pointermove', 452, 668);
      await settle();
      const ghost = el.querySelector<HTMLElement>('.cal-ev.is-ghost')!;
      expect(ghost.textContent).toContain('10 月 15 日 星期四 11:00 到 12:00');
      expect(eventButton(el, 'weekly').classList).toContain('is-source');
      pointer('pointerup', 452, 668);
      await settle();
      expect(save).toHaveBeenCalledTimes(1);
      const change = save.mock.calls[0][0];
      expect(change.kind).toBe('move');
      expect(change.via).toBe('pointer');
      expect([change.event.start.getDate(), change.event.start.getHours(), change.event.end.getHours()]).toEqual([15, 11, 12]);
      expect(host.changes).toHaveLength(1);
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('已把「團隊週會」移到'), expect.objectContaining({ action: '復原' }));
      // 拖完之後的 click 不會把活動打開
      expect(host.clicked()).toBeNull();
    });

    it('拉下緣調整長度；Esc 取消拖曳', async () => {
      const save = vi.fn<CalendarChangeFn>(() => Promise.resolve());
      const { el, settle } = await weekSetup(save);
      const edge = eventButton(el, 'train').querySelector<HTMLElement>('[data-edge="end"]')!;
      pointer('pointerdown', 350, 900, edge);
      pointer('pointermove', 350, 958);
      await settle();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();
      expect(el.querySelector('.cal-ev.is-ghost')).toBeNull();
      expect(save).not.toHaveBeenCalled();
      pointer('pointerdown', 350, 900, eventButton(el, 'train').querySelector('[data-edge="end"]')!);
      pointer('pointermove', 350, 958);
      pointer('pointerup', 350, 958);
      await settle();
      const change = save.mock.calls[0][0];
      expect(change.kind).toBe('extend');
      expect([change.event.start.getHours(), change.event.end.getHours()]).toEqual([13, 16]);
    });

    it('不能編輯的活動不能拖；唯讀時都不能拖', async () => {
      const save = vi.fn<CalendarChangeFn>(() => Promise.resolve());
      const { el, settle, host } = await weekSetup(save);
      pointer('pointerdown', 350, 1090, eventButton(el, 'ops'));
      pointer('pointermove', 450, 1150);
      pointer('pointerup', 450, 1150);
      await settle();
      expect(save).not.toHaveBeenCalled();
      expect(eventButton(el, 'ops').getAttribute('aria-description')).toBeNull();
      host.readonly.set(true);
      await settle();
      pointer('pointerdown', 350, 610, eventButton(el, 'weekly'));
      pointer('pointermove', 450, 700);
      pointer('pointerup', 450, 700);
      await settle();
      expect(save).not.toHaveBeenCalled();
    });

    it('鍵盤：Alt＋方向鍵移動一個時段或一天，Alt＋Shift＋方向鍵調整長度', async () => {
      const save = vi.fn<CalendarChangeFn>(() => Promise.resolve());
      const { el, settle } = await weekSetup(save);
      const weekly = eventButton(el, 'weekly');
      expect(weekly.getAttribute('aria-description')).toContain('Alt');
      weekly.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
      await settle();
      expect(save.mock.calls[0][0].event.start.getMinutes()).toBe(30);
      expect(save.mock.calls[0][0].via).toBe('keyboard');
      eventButton(el, 'weekly').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
      await settle();
      expect(save.mock.calls[1][0].event.start.getDate()).toBe(15);
      eventButton(el, 'weekly').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, shiftKey: true, bubbles: true }));
      await settle();
      const extended = save.mock.calls[2][0].event;
      expect([extended.end.getHours(), extended.end.getMinutes()]).toEqual([12, 0]);
    });

    it('儲存失敗：畫面還原，錯誤提示寫出原因', async () => {
      const save = vi.fn<CalendarChangeFn>(() => Promise.reject('這個時段已鎖定'));
      const { el, settle, toast, host } = await weekSetup(save);
      eventButton(el, 'weekly').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
      await settle();
      expect(toast.error).toHaveBeenCalledWith('「團隊週會」沒有儲存，已還原：這個時段已鎖定');
      expect(eventButton(el, 'weekly').closest('.tg__col')!.getAttribute('data-date')).toBe('2026-10-14');
      expect(host.changes).toHaveLength(0);
    });

    it('樂觀更新：儲存中畫面已經是新位置；同一筆又改時上一次的請求被 abort', async () => {
      const signals: AbortSignal[] = [];
      const resolvers: (() => void)[] = [];
      const save: CalendarChangeFn = (_c, signal) => {
        signals.push(signal);
        return new Promise((resolve) => resolvers.push(resolve));
      };
      const { el, settle } = await weekSetup(save);
      eventButton(el, 'weekly').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
      await settle();
      expect(eventButton(el, 'weekly').closest('.tg__col')!.getAttribute('data-date')).toBe('2026-10-15');
      eventButton(el, 'weekly').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
      await settle();
      expect(signals[0].aborted).toBe(true);
      expect(eventButton(el, 'weekly').closest('.tg__col')!.getAttribute('data-date')).toBe('2026-10-16');
      resolvers[1]();
      await settle();
      expect(eventButton(el, 'weekly').closest('.tg__col')!.getAttribute('data-date')).toBe('2026-10-16');
    });

    it('空白處拖出一段＝選取那段時間', async () => {
      const { el, settle, host } = await weekSetup();
      const col = el.querySelectorAll<HTMLElement>('.tg__col')[4];
      pointer('pointerdown', 550, 540, col);
      pointer('pointermove', 550, 650);
      await settle();
      expect(el.querySelector('.tg__selection')).not.toBeNull();
      pointer('pointerup', 550, 650);
      await settle();
      const sel = host.selected()!;
      expect([sel.start.getDate(), sel.start.getHours(), sel.end.getHours(), sel.end.getMinutes()]).toEqual([16, 9, 11, 0]);
    });
  });

  describe('資源排程', () => {
    async function resourceSetup(save?: CalendarChangeFn) {
      const ctx = await setup((h) => {
        h.view.set('resource');
        h.allowOverlap.set(false);
        if (save) h.save.set(save);
      });
      return ctx;
    }

    it('依分組列出資源；同一列重疊的活動疊成兩條，標成衝突（圖示＋文字）', async () => {
      const { el } = await resourceSetup();
      expect([...el.querySelectorAll('.rt__group-label')].map((g) => g.textContent?.trim())).toEqual(['三樓', '五樓']);
      expect(el.querySelectorAll('[data-resource-row]')).toHaveLength(3);
      const rowA = el.querySelector<HTMLElement>('[data-resource-row="room-a"]')!;
      expect(rowA.style.getPropertyValue('--rt-lanes')).toBe('2');
      const weekly = eventButton(el, 'weekly');
      expect(weekly.classList).toContain('is-conflict');
      expect(weekly.textContent).toContain('時間衝突');
      expect(weekly.getAttribute('aria-label')).toContain('時間衝突');
      expect(eventButton(el, 'train').classList).not.toContain('is-conflict');
    });

    it('拖曳換資源與日子；鍵盤 Alt＋下移到下一個資源', async () => {
      const save = vi.fn<CalendarChangeFn>(() => Promise.resolve());
      const { el, settle } = await resourceSetup(save);
      el.querySelectorAll<HTMLElement>('.rt__track').forEach((t) => (t.getBoundingClientRect = () => rect(200, 0, 700, 40)));
      el.querySelectorAll<HTMLElement>('[data-resource-row]').forEach((row, i) => {
        row.getBoundingClientRect = () => rect(0, 100 + i * 50, 900, 50);
      });
      // 一週 700px：一天 100px
      pointer('pointerdown', 450, 120, eventButton(el, 'train'));
      pointer('pointermove', 552, 222);
      await settle();
      expect(el.querySelector('[data-resource-row="room-c"] .cal-ev.is-ghost')).not.toBeNull();
      pointer('pointerup', 552, 222);
      await settle();
      const change = save.mock.calls[0][0];
      expect(change.event.resourceId).toBe('room-c');
      expect([change.event.start.getDate(), change.event.start.getHours()]).toEqual([15, 13]);
      eventButton(el, 'weekly').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
      await settle();
      expect(save.mock.calls[1][0].event.resourceId).toBe('room-b');
    });
  });

  it('議程：依日期分組，日期是標題', async () => {
    const { el } = await setup((h) => h.view.set('agenda'));
    const heads = [...el.querySelectorAll('[role="heading"]')].map((h) => h.textContent?.replace(/\s+/g, ' ').trim());
    expect(heads).toHaveLength(2);
    expect(heads[0]).toContain('10 月 14 日 星期三');
    expect(heads[1]).toContain('10 月 20 日 星期二');
    expect(el.querySelectorAll('.ag__item')).toHaveLength(6);
  });

  it('手機寬度預設議程，平板寬度的週檢視只顯示 3 天；使用者自己選了檢視就不再自動換', async () => {
    const { el, settle, calendar } = await setup();
    const width = (calendar() as unknown as { width: { set(v: number): void } }).width;
    width.set(390);
    await settle();
    expect(el.querySelector('lib-cal-agenda')).not.toBeNull();
    calendar().setView('week');
    width.set(800);
    await settle();
    expect(el.querySelectorAll('.tg__col')).toHaveLength(3);
    width.set(390);
    await settle();
    expect(el.querySelector('lib-cal-time-grid')).not.toBeNull();
  });
});
