import { OverlayModule } from '@angular/cdk/overlay';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  DateRange,
  MAT_DATE_RANGE_SELECTION_STRATEGY,
  MatCalendar,
  MatDatepickerModule,
} from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { HoverPreviewRangeStrategy } from './hover-preview-range-strategy';
import { DUAL_MONTH_RANGE_PICKER_LABELS } from './dual-month-range-picker-labels';

export interface SelectedDateRange {
  start: Date;
  end: Date;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * 雙月日期區間選擇器：點欄位開出並排的兩個月曆，點起日、再點迄日後送出 `rangeSelected`。
 * 適合跨月的期間（專案期間、請假、報表區間）；
 * 畫面文字由 DUAL_MONTH_RANGE_PICKER_LABELS 提供。
 */
@Component({
  selector: 'lib-dual-month-range-picker',
  imports: [OverlayModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatDatepickerModule],
  templateUrl: './dual-month-range-picker.component.html',
  styleUrl: './dual-month-range-picker.component.scss',
  providers: [
    // `MatCalendar` never provides this itself — only `MatDateRangePicker` does — so without it
    // `MatMonthView._previewChanged` is a no-op and hover reporting silently never fires.
    HoverPreviewRangeStrategy,
    { provide: MAT_DATE_RANGE_SELECTION_STRATEGY, useExisting: HoverPreviewRangeStrategy },
  ],
})
export class DualMonthRangePickerComponent implements OnChanges, AfterViewChecked {
  @Input() start: Date | null = null;
  @Input() end: Date | null = null;
  @Output() rangeSelected = new EventEmitter<SelectedDateRange>();

  protected readonly labels = inject(DUAL_MONTH_RANGE_PICKER_LABELS);

  @ViewChild('leftCal') private leftCal?: MatCalendar<Date>;
  @ViewChild('rightCal') private rightCal?: MatCalendar<Date>;
  @ViewChild('triggerInput') private triggerInput?: ElementRef<HTMLInputElement>;
  @ViewChild('panel') private panel?: ElementRef<HTMLElement>;

  protected isOpen = false;
  protected leftMonth = startOfMonth(new Date());
  protected selectedRange = new DateRange<Date>(null, null);

  private readonly hoverStrategy = inject(HoverPreviewRangeStrategy);

  private pendingStart: Date | null = null;
  private pendingEnd: Date | null = null;
  private hoverDate: Date | null = null;

  /**
   * Set by {@link onPanelAttached}, consumed here. `(attach)` fires as soon as the overlay content
   * exists, which can race this component's own `@ViewChild('leftCal')` query for that
   * just-created calendar — calling `focusActiveCell()` straight from the `(attach)` handler risks
   * `leftCal` still being `undefined`. Deferring to `ngAfterViewChecked` guarantees the query has
   * resolved first. Mirrors `MatCalendar`'s own `_moveFocusOnNextTick` pattern for the same problem.
   */
  private focusCalendarOnNextCheck = false;

  constructor() {
    this.hoverStrategy.onHover = (date) => this.onHover(date);
  }

  ngAfterViewChecked(): void {
    if (this.focusCalendarOnNextCheck) {
      this.focusCalendarOnNextCheck = false;
      this.leftCal?.focusActiveCell();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['start'] || changes['end']) {
      this.pendingStart = this.start;
      this.pendingEnd = this.end;
      this.hoverDate = null;
      this.syncSelectedRange();
      if (this.start) {
        this.leftMonth = startOfMonth(this.start);
      }
    }
  }

  protected get rightMonth(): Date {
    return addMonths(this.leftMonth, 1);
  }

  protected get displayValue(): string {
    if (!this.start || !this.end) return '';
    return `${this.formatDate(this.start)} - ${this.formatDate(this.end)}`;
  }

  protected monthLabel(month: Date): string {
    return this.labels.monthTitle
      .replace('{year}', String(month.getFullYear()))
      .replace('{month}', String(month.getMonth() + 1));
  }

  protected open(): void {
    this.hoverDate = null;
    this.isOpen = true;
  }

  protected close(): void {
    this.hoverDate = null;
    this.syncSelectedRange();
    this.isOpen = false;
  }

  /**
   * Bound to the trigger input's `(keydown.enter)` / `(keydown.space)` / `(keydown.alt.arrowdown)` —
   * the WCAG combobox/datepicker convention for opening a popup from a closed, focused field.
   * `preventDefault` guards Space's default (inserting a character — moot since the field is
   * `readonly`, but explicit is cheap) without touching the existing mouse-driven `(click)="open()"`.
   */
  protected openViaKeyboard(event: Event): void {
    event.preventDefault();
    this.open();
  }

  /**
   * Bound to `(attach)` on the overlay template: content just got attached, so it's the right moment
   * to move focus into the panel (requirement: focus must land inside, not stay on the trigger or
   * disappear). Actually calling `focusActiveCell()` is deferred — see {@link focusCalendarOnNextCheck}.
   */
  protected onPanelAttached(): void {
    this.focusCalendarOnNextCheck = true;
  }

  /**
   * Bound to `(keydown.escape)` on the panel. `cdkConnectedOverlayDisableClose` on the template
   * disables CDK's own Escape-closes-overlay default, so this is the only Escape path — it closes
   * and returns focus to the trigger field. Deliberately not folded into `close()`: that method is
   * also called on backdrop click and on finishing a selection, and moving focus there would be an
   * unrequested behaviour change on those (mouse-driven) paths.
   */
  protected onPanelEscape(): void {
    this.close();
    this.triggerInput?.nativeElement.focus();
  }

  protected goPrev(): void {
    this.shiftMonths(-1);
  }

  protected goNext(): void {
    this.shiftMonths(1);
  }

  protected onDateClicked(date: Date | null): void {
    if (!date) return;
    if (!this.pendingStart || this.pendingEnd) {
      this.pendingStart = date;
      this.pendingEnd = null;
    } else if (date < this.pendingStart) {
      this.pendingStart = date;
    } else {
      this.pendingEnd = date;
    }
    this.hoverDate = null;
    this.syncSelectedRange();

    if (this.pendingStart && this.pendingEnd) {
      // Closing detaches the panel; if focus is on a calendar cell (keyboard Enter, or a Chrome mouse
      // click, which focuses the cell button) it would fall to <body> and a keyboard user would have
      // to Tab from the top of the page again. Hand it back to the field first — only when focus is
      // actually inside the panel, so a selection finished some other way leaves focus where it is.
      // Backdrop-click closing goes through `close()` and is deliberately untouched.
      const active = this.panel?.nativeElement.ownerDocument.activeElement;
      if (active && this.panel?.nativeElement.contains(active)) {
        this.triggerInput?.nativeElement.focus();
      }
      this.rangeSelected.emit({ start: this.pendingStart, end: this.pendingEnd });
      this.isOpen = false;
    }
  }

  /** Reported by {@link HoverPreviewRangeStrategy}; also called from the template on mouseleave. */
  protected onHover(date: Date | null): void {
    // Only preview while a start is set and the end is still open.
    const next = this.pendingStart && !this.pendingEnd ? date : null;
    if (sameDay(next, this.hoverDate)) return; // fires per cell — skip redundant rebuilds
    this.hoverDate = next;
    this.syncSelectedRange();
  }

  /**
   * Rebuilds the range both calendars read from, folding in the hovered date so the highlight
   * runs across the month boundary. Kept as an explicit assignment rather than a getter: a getter
   * would hand back a new `DateRange` every check, which reads as a changed `[selected]` on every
   * cycle and re-runs `ngOnChanges` on both calendars.
   */
  private syncSelectedRange(): void {
    let end = this.pendingEnd;
    if (this.pendingStart && !end && this.hoverDate && this.hoverDate > this.pendingStart) {
      end = this.hoverDate;
    }
    this.selectedRange = new DateRange<Date>(this.pendingStart, end);
  }

  /**
   * `activeDate` is a plain setter rather than an `@Input`, so the two calendars have to be
   * moved imperatively. Initial positioning goes through `[startAt]` instead, which the
   * calendar reads in `ngAfterContentInit` — binding it avoids a visible jump on open.
   */
  private shiftMonths(delta: number): void {
    this.leftMonth = addMonths(this.leftMonth, delta);
    if (this.leftCal) this.leftCal.activeDate = this.leftMonth;
    if (this.rightCal) this.rightCal.activeDate = this.rightMonth;
  }

  private formatDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
  }
}
