import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CalendarEvent } from './calendar.types';
import { CalendarSegment } from './calendar-layout';
import { CalendarStore } from './calendar-store';
import { isTouchDragActive } from './calendar-drag';

/** 活動出現在哪裡：月曆格、時間格、整天列、資源排程、議程清單。 */
export type CalendarEventVariant = 'month' | 'grid' | 'allday' | 'timeline' | 'agenda';

/**
 * 一筆活動（內部元件，掛在 `<button>` 上）：左緣色條＋類別色的淡底，文字一律 on-surface（任何類別色上都 ≥ 4.5:1）。
 * 拖曳、鍵盤移動由外層的檢視處理；這裡只負責外觀、無障礙名稱與兩端的拉把（`data-edge`）。
 * 造型讀 `--lib-cal-event-*`（CONTRACT.md「共用日曆」），質地在 `.lib-calendar` 上設。
 */
@Component({
  selector: 'button[libCalEvent]',
  templateUrl: './calendar-event.component.html',
  styleUrl: './calendar-event.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    type: 'button',
    class: 'cal-ev',
    '[attr.data-variant]': 'variant()',
    '[attr.data-event-id]': 'event().id',
    '[attr.aria-label]': 'name()',
    '[attr.aria-description]': 'editable() ? store.labels().keyboardHint : null',
    '[attr.tabindex]': 'tabbable() ? null : -1',
    '[style.--cal-ev-color]': 'color()',
    '[class.is-editable]': 'editable()',
    '[class.is-conflict]': 'conflict()',
    '[class.is-ghost]': 'ghost()',
    '[class.is-source]': 'source()',
    '[class.is-cont-before]': 'segment()?.continuesBefore',
    '[class.is-cont-after]': 'segment()?.continuesAfter',
    '[class.is-all-day]': 'event().allDay',
    '(touchmove)': 'onTouchMove($event)',
  },
})
export class CalendarEventComponent {
  readonly event = input.required<CalendarEvent>();
  readonly variant = input<CalendarEventVariant>('month');
  /** 這一天的片段（跨日活動）。 */
  readonly segment = input<CalendarSegment | null>(null);
  /** 拖曳中的預覽。 */
  readonly ghost = input(false);
  /** 正在被拖的原本那一筆（變淡）。 */
  readonly source = input(false);
  /** 預覽的提示（新的時間）。 */
  readonly tip = input('');
  /** 預覽是否衝突（預覽用；一般活動讀 store）。 */
  readonly previewConflict = input(false);
  /** false：不在 Tab 順序裡（月曆只有目前那一格裡的活動可以 Tab 到）。 */
  readonly tabbable = input(true);

  protected readonly store = inject(CalendarStore);

  protected readonly color = computed(() => this.store.colorOf(this.event()));
  protected readonly editable = computed(() => !this.ghost() && this.store.canEdit(this.event()));
  protected readonly conflict = computed(() => (this.ghost() ? this.previewConflict() : this.store.isConflict(this.event())));
  protected readonly name = computed(() => this.store.accessibleName(this.event(), this.segment()));

  /** 拉把：時間格上下、整天列與資源排程左右；跨日片段只有真正的開始／結束那一端可以拉。 */
  protected readonly handles = computed(() => {
    const v = this.variant();
    if (!this.editable() || (v !== 'grid' && v !== 'allday' && v !== 'timeline')) return { start: false, end: false };
    const seg = this.segment();
    return { start: !seg?.continuesBefore, end: !seg?.continuesAfter };
  });

  protected readonly time = computed(() => {
    const event = this.event();
    const v = this.variant();
    if (event.allDay || v === 'allday') return '';
    const fmt = this.store.fmt();
    const seg = this.segment();
    if (v === 'month') return seg?.continuesBefore ? '' : fmt.time(event.start);
    if (v === 'timeline' || v === 'agenda') return '';
    return seg ? fmt.shortTime(seg) : '';
  });

  /** 時間格只有一行高（或很窄）時改顯示的開始時間：「9:00 站立會議」。前一天開始的片段不顯示。 */
  protected readonly startTime = computed(() => {
    const seg = this.segment();
    if (this.variant() !== 'grid' || !seg || seg.event.allDay || seg.continuesBefore) return '';
    return this.store.fmt().time(seg.start);
  });

  /** 觸控長按拖曳中：擋掉捲動（只有非 passive 的 touchmove 能阻止，所以掛在活動本身）。 */
  protected onTouchMove(e: Event): void {
    if (isTouchDragActive() && e.cancelable) e.preventDefault();
  }
}
