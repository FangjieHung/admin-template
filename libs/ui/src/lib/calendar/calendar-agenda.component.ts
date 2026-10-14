import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CalendarEvent, CalendarRange } from './calendar.types';
import { CalendarEventComponent } from './calendar-event.component';
import { CalendarStore } from './calendar-store';
import { dayKey, isSameDay } from './calendar-date';
import { groupAgenda } from './calendar-layout';
import { EmptyStateComponent } from '../feedback-state/empty-state.component';

/**
 * 議程（lib-calendar 內部用）：看得到的範圍內每一天一組（沒有活動的日子跳過），左邊時間、右邊活動；
 * 手機寬度的預設檢視。日期標題是 heading（層級 `headingLevel`），報讀器可以用標題跳日子。
 */
@Component({
  selector: 'lib-cal-agenda',
  imports: [CalendarEventComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cal-agenda' },
  template: `
    @for (day of days(); track day.key) {
      <section class="ag__day" [class.is-today]="day.today" [attr.aria-labelledby]="day.headingId">
        <div class="ag__head" role="heading" [attr.aria-level]="headingLevel()" [id]="day.headingId">
          <span class="ag__num ui-text-numeric">{{ day.date.getDate() }}</span>
          <span class="ag__label">{{ day.label }}</span>
        </div>
        <ul class="ag__list">
          @for (seg of day.segments; track seg.event.id) {
            <li class="ag__item">
              <span class="ag__time ui-text-numeric" aria-hidden="true">{{ seg.event.allDay ? store.labels().allDay : store.fmt().shortTime(seg) }}</span>
              <button libCalEvent [event]="seg.event" [segment]="seg" variant="agenda" (click)="open(seg.event)"></button>
            </li>
          }
        </ul>
      </section>
    } @empty {
      <lib-empty-state [message]="store.labels().empty" icon="event_available" [compact]="true" />
    }
  `,
  styleUrl: './calendar-agenda.component.scss',
})
export class CalendarAgendaComponent {
  readonly range = input.required<CalendarRange>();
  readonly headingLevel = input(3);

  protected readonly store = inject(CalendarStore);

  protected readonly days = computed(() => {
    const today = this.store.today();
    const fmt = this.store.fmt();
    return groupAgenda(this.store.events(), this.range()).map((d) => {
      const isToday = isSameDay(d.date, today);
      return {
        ...d,
        key: dayKey(d.date),
        headingId: `cal-ag-${dayKey(d.date)}-${this.uid}`,
        today: isToday,
        label: [fmt.dateLong(d.date), isToday ? this.store.labels().todayMark : ''].filter(Boolean).join('，'),
      };
    });
  });

  private readonly uid = nextId++;

  protected open(event: CalendarEvent): void {
    this.store.state().open(event);
  }
}

let nextId = 0;
