import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DATE_RANGE_SELECTION_STRATEGY } from '@angular/material/datepicker';
import { DualMonthRangePickerComponent, SelectedDateRange } from './dual-month-range-picker.component';
import { HoverPreviewRangeStrategy } from './hover-preview-range-strategy';
import { DUAL_MONTH_RANGE_PICKER_LABELS, DualMonthRangePickerLabels } from './dual-month-range-picker-labels';

const LABELS: DualMonthRangePickerLabels = {
  field: '專案期間',
  placeholder: '選擇日期範圍',
  prevMonth: '上個月',
  nextMonth: '下個月',
  monthTitle: '{year}年{month}月',
};

const AUG_28 = new Date(2026, 7, 28);
const SEP_3 = new Date(2026, 8, 3);
const SEP_5 = new Date(2026, 8, 5);

describe('DualMonthRangePickerComponent hover 預覽', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<DualMonthRangePickerComponent>>;
  let component: DualMonthRangePickerComponent;
  let strategy: HoverPreviewRangeStrategy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DualMonthRangePickerComponent],
      providers: [provideNativeDateAdapter(), { provide: DUAL_MONTH_RANGE_PICKER_LABELS, useValue: LABELS }],
    });
    fixture = TestBed.createComponent(DualMonthRangePickerComponent);
    component = fixture.componentInstance;
    strategy = fixture.debugElement.injector.get(
      MAT_DATE_RANGE_SELECTION_STRATEGY,
    ) as HoverPreviewRangeStrategy;
  });

  const range = () => component['selectedRange'];

  it('元件有 provide range strategy——沒有它 Material 的 hover 回報會靜默失效', () => {
    expect(strategy).toBeInstanceOf(HoverPreviewRangeStrategy);
  });

  it('選了起點後 hover 到下個月，折進共用的 selected，讓兩個日曆一起亮', () => {
    component['onDateClicked'](AUG_28);
    expect(range().end).toBeNull();

    // 透過 strategy 呼叫，一併驗證 createPreview → onHover 這條接線
    strategy.createPreview(SEP_3, range());

    expect(range().start).toEqual(AUG_28);
    expect(range().end).toEqual(SEP_3);
  });

  it('hover 不會污染實際選取：第二次點擊送出的是點擊值而非 hover 值', () => {
    const emitted: SelectedDateRange[] = [];
    component.rangeSelected.subscribe((r) => emitted.push(r));

    component['onDateClicked'](AUG_28);
    strategy.createPreview(SEP_3, range());
    component['onDateClicked'](SEP_5);

    expect(emitted).toEqual([{ start: AUG_28, end: SEP_5 }]);
  });

  it('滑鼠離開後預覽清除，範圍回到只有起點', () => {
    component['onDateClicked'](AUG_28);
    strategy.createPreview(SEP_3, range());
    expect(range().end).toEqual(SEP_3);

    component['onHover'](null);

    expect(range().start).toEqual(AUG_28);
    expect(range().end).toBeNull();
  });

  it('還沒選起點時 hover 不上色', () => {
    strategy.createPreview(SEP_3, range());

    expect(range().start).toBeNull();
    expect(range().end).toBeNull();
  });

  it('範圍已選定後 hover 不會改動它', () => {
    component['onDateClicked'](AUG_28);
    component['onDateClicked'](SEP_5);

    component['onHover'](SEP_3);

    expect(range().start).toEqual(AUG_28);
    expect(range().end).toEqual(SEP_5);
  });

  it('hover 到比起點早的日期不會產生反向範圍', () => {
    component['onDateClicked'](SEP_5);
    strategy.createPreview(AUG_28, range());

    expect(range().start).toEqual(SEP_5);
    expect(range().end).toBeNull();
  });

  it('關閉面板會清掉殘留的預覽', () => {
    component['onDateClicked'](AUG_28);
    strategy.createPreview(SEP_3, range());

    component['close']();

    expect(range().end).toBeNull();
  });

  it('帶著既有 start/end 重新開啟時顯示原範圍', () => {
    component.start = AUG_28;
    component.end = SEP_5;
    component.ngOnChanges({ start: { firstChange: true } as never });

    expect(range().start).toEqual(AUG_28);
    expect(range().end).toEqual(SEP_5);
  });
});

describe('DualMonthRangePickerComponent 畫面文字與相依', () => {
  it('欄位標籤、提示文字、月份標題都取自 DUAL_MONTH_RANGE_PICKER_LABELS（libs/ui 不內建文字）', () => {
    TestBed.configureTestingModule({
      imports: [DualMonthRangePickerComponent],
      providers: [
        provideNativeDateAdapter(),
        {
          provide: DUAL_MONTH_RANGE_PICKER_LABELS,
          useValue: { ...LABELS, field: 'Dates', placeholder: 'Pick dates', monthTitle: '{month}/{year}' },
        },
      ],
    });
    const fixture = TestBed.createComponent(DualMonthRangePickerComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('mat-label')?.textContent?.trim()).toBe('Dates');
    expect(el.querySelector('input')?.getAttribute('placeholder')).toBe('Pick dates');
    expect(fixture.componentInstance['monthLabel'](SEP_3)).toBe('9/2026');
  });

  it('面板還沒開啟時不需要 DateAdapter 也建得起來（月曆開啟時才需要）', () => {
    TestBed.configureTestingModule({
      imports: [DualMonthRangePickerComponent],
      providers: [{ provide: DUAL_MONTH_RANGE_PICKER_LABELS, useValue: LABELS }],
    });
    const fixture = TestBed.createComponent(DualMonthRangePickerComponent);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect((fixture.nativeElement as HTMLElement).querySelector('mat-label')?.textContent?.trim()).toBe('專案期間');
  });
});

describe('DualMonthRangePickerComponent 鍵盤操作（WCAG combobox/datepicker pattern）', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<DualMonthRangePickerComponent>>;
  let component: DualMonthRangePickerComponent;
  let input: HTMLInputElement;

  // `.dual-calendar-panel` is CDK overlay content: it renders into the global
  // `.cdk-overlay-container` appended under `document.body`, not under `fixture.nativeElement` —
  // so it has to be queried from `document`, not from the fixture.
  const panel = () => document.querySelector<HTMLElement>('.dual-calendar-panel');
  const pressKey = (target: EventTarget, init: KeyboardEventInit & { keyCode?: number }) => {
    const { keyCode, ...rest } = init;
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...rest });
    // Angular's `(keydown.foo)` bindings match on `event.key`, but `MatCalendarBody`'s own arrow-key
    // handling (Material-internal, not our code) still switches on the legacy numeric `event.keyCode`
    // — which the standard `KeyboardEvent` constructor never derives from `key`. Force it for callers
    // that need to drive that path.
    if (keyCode !== undefined) {
      Object.defineProperty(event, 'keyCode', { get: () => keyCode });
    }
    target.dispatchEvent(event);
  };

  /**
   * `MatCalendar.focusActiveCell()` (called from this component's `ngAfterViewChecked` once the
   * panel attaches) does not move focus synchronously — Material's own `MatCalendarBody
   * ._focusActiveCell` schedules the real `.focus()` call via `afterNextRender(() => setTimeout(...))`.
   * A couple of real macrotask turns (plus a `detectChanges` to give `afterNextRender` a render to
   * hook onto) reliably flushes it in this zoneless test setup.
   */
  const flushFocusActiveCell = async (f: typeof fixture) => {
    f.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    f.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DualMonthRangePickerComponent],
      providers: [provideNativeDateAdapter(), { provide: DUAL_MONTH_RANGE_PICKER_LABELS, useValue: LABELS }],
    });
    fixture = TestBed.createComponent(DualMonthRangePickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
  });

  it('觸發欄位是原生可以被 Tab 聚焦到的 input（沒有被拿掉 tab 順序）', () => {
    expect(input.tabIndex).not.toBe(-1);
    input.focus();
    expect(document.activeElement).toBe(input);
  });

  it('欄位有 aria-haspopup="dialog"；aria-expanded 隨開關狀態真的切換，不是寫死', () => {
    expect(input.getAttribute('aria-haspopup')).toBe('dialog');
    expect(input.getAttribute('aria-expanded')).toBe('false');

    // Goes through the real keydown/Escape paths (not a direct `component['open']()` call): a plain
    // property write made outside Angular's event dispatch never gets picked up by `detectChanges()`
    // here, since nothing marks the view dirty for it — the same reason production code must always
    // flip `isOpen` from inside a template-bound handler.
    input.focus();
    pressKey(input, { key: 'Enter' });
    fixture.detectChanges();
    expect(input.getAttribute('aria-expanded')).toBe('true');

    pressKey(panel()!, { key: 'Escape' });
    fixture.detectChanges();
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('聚焦欄位時按 Enter 會開啟面板', () => {
    input.focus();
    pressKey(input, { key: 'Enter' });
    expect(component['isOpen']).toBe(true);
  });

  it('聚焦欄位時按空白鍵會開啟面板', () => {
    input.focus();
    pressKey(input, { key: ' ' });
    expect(component['isOpen']).toBe(true);
  });

  it('聚焦欄位時按 Alt+↓ 會開啟面板', () => {
    input.focus();
    pressKey(input, { key: 'ArrowDown', altKey: true });
    expect(component['isOpen']).toBe(true);
  });

  it('單純按 ↓（沒按 Alt）不會開啟面板——確認只有指定的三鍵有效', () => {
    input.focus();
    pressKey(input, { key: 'ArrowDown' });
    expect(component['isOpen']).toBe(false);
  });

  it('滑鼠點欄位仍然正常開啟面板（既有滑鼠行為不能變）', () => {
    const formField = (fixture.nativeElement as HTMLElement).querySelector('mat-form-field') as HTMLElement;
    formField.click();
    expect(component['isOpen']).toBe(true);
  });

  it('開啟後焦點真的進入月曆面板本體，不是停在原欄位或消失', async () => {
    input.focus();
    pressKey(input, { key: 'Enter' });
    fixture.detectChanges();
    // `MatCalendar.focusActiveCell()` doesn't focus synchronously: Material's own
    // `MatCalendarBody._focusActiveCell` schedules the real `.focus()` call via
    // `afterNextRender(() => setTimeout(...))`. Give both a turn before asserting.
    await flushFocusActiveCell(fixture);

    expect(document.activeElement).not.toBe(input);
    expect(document.activeElement?.classList.contains('mat-calendar-body-cell')).toBe(true);
    expect(panel()?.contains(document.activeElement)).toBe(true);
  });

  it('面板開啟時方向鍵可以在格子間移動焦點——Material 內建行為，確認我方接線沒有擋住它', async () => {
    input.focus();
    pressKey(input, { key: 'Enter' });
    fixture.detectChanges();
    await flushFocusActiveCell(fixture);
    const firstActiveCell = document.activeElement;
    expect(firstActiveCell?.classList.contains('mat-calendar-body-cell')).toBe(true);

    pressKey(firstActiveCell!, { key: 'ArrowRight', keyCode: 39 });
    // Material's own re-focus after an arrow-key move is likewise deferred (`_focusActiveCellAfterViewChecked`
    // → the same `afterNextRender`/`setTimeout` chain as the initial open).
    await flushFocusActiveCell(fixture);

    expect(document.activeElement).not.toBe(firstActiveCell);
    expect(document.activeElement?.classList.contains('mat-calendar-body-cell')).toBe(true);
  });

  it('面板打開時按 Esc 會關閉面板，並把焦點還給原本的觸發欄位', () => {
    input.focus();
    pressKey(input, { key: 'Enter' });
    fixture.detectChanges();
    expect(component['isOpen']).toBe(true);

    pressKey(panel()!, { key: 'Escape' });
    fixture.detectChanges();

    expect(component['isOpen']).toBe(false);
    expect(document.activeElement).toBe(input);
  });
  it('用鍵盤（Enter）在月曆選完起訖、面板自動關閉後，焦點回到日期欄位而不是掉到 <body>', async () => {
    input.focus();
    pressKey(input, { key: 'Enter' });
    fixture.detectChanges();
    await flushFocusActiveCell(fixture);

    const emitted: unknown[] = [];
    component.rangeSelected.subscribe((r) => emitted.push(r));

    // Material 的月曆格子：Enter 在 keydown 記下、keyup 才真正選取（MatMonthView 內建行為），兩個都要送。
    const pressKeyUp = (target: EventTarget, keyCode: number, key: string) => {
      const ev = new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key });
      Object.defineProperty(ev, 'keyCode', { get: () => keyCode });
      target.dispatchEvent(ev);
    };

    // 起日
    let cell = document.activeElement!;
    pressKey(cell, { key: 'Enter', keyCode: 13 });
    pressKeyUp(cell, 13, 'Enter');
    fixture.detectChanges();
    await flushFocusActiveCell(fixture);
    expect(component['isOpen']).toBe(true);

    // 往後三天再 Enter 當迄日
    for (let i = 0; i < 3; i++) {
      pressKey(document.activeElement!, { key: 'ArrowRight', keyCode: 39 });
      await flushFocusActiveCell(fixture);
    }
    cell = document.activeElement!;
    expect(panel()?.contains(cell)).toBe(true);
    pressKey(cell, { key: 'Enter', keyCode: 13 });
    pressKeyUp(cell, 13, 'Enter');
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(component['isOpen']).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  it('選取完成時焦點不在面板內（例如程式直接選取），不會去搶焦點', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    component['open']();
    fixture.detectChanges();
    outside.focus();

    component['onDateClicked'](new Date(2026, 9, 20));
    component['onDateClicked'](new Date(2026, 9, 23));
    fixture.detectChanges();

    expect(component['isOpen']).toBe(false);
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});
