import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, inject, input, output } from '@angular/core';

export interface KanbanSwitcherItem {
  id: string;
  title: string;
  /** 畫面上的張數（有上限時「張數 / 上限」）。 */
  countText: string;
  /** 張數給報讀器念的字。 */
  countLabel: string;
}

/**
 * 看板窄版（一次一欄）上方的欄位切換（lib-kanban-board 內部用，不從 barrel 匯出）：一排膠囊按鈕，欄名＋張數，
 * 目前這一欄 `aria-current="true"`。按鈕排不下時這一排自己橫向捲動，目前那一顆捲進畫面（只捲這一排，不捲整頁）。
 * 寬版時由看板的 container query 藏起來。
 */
@Component({
  selector: 'lib-kanban-switcher',
  template: `
    <div class="ks-row" role="group" [attr.aria-label]="label()">
      @for (item of items(); track item.id) {
        <button
          type="button"
          class="ui-nav-pill ks-pill"
          [class.is-active]="$index === active()"
          [attr.aria-current]="$index === active() ? 'true' : null"
          [attr.data-kanban-switch]="item.id"
          (click)="select.emit($index)"
        >
          <span>{{ item.title }}</span>
          <span class="ks-count ui-text-numeric" aria-hidden="true">{{ item.countText }}</span>
          <span class="ks-sr">{{ item.countLabel }}</span>
        </button>
      }
    </div>
  `,
  styleUrl: './kanban-switcher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lib-kanban-switcher' },
})
export class KanbanSwitcherComponent {
  readonly items = input.required<readonly KanbanSwitcherItem[]>();
  readonly active = input(0);
  readonly label = input.required<string>();
  readonly select = output<number>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // 目前這一顆捲進這一排的可視範圍（不用 scrollIntoView：它會連整頁一起捲）。
    afterRenderEffect(() => {
      const index = this.active();
      this.items();
      const row = this.host.nativeElement.firstElementChild as HTMLElement | null;
      const pill = row?.children[index] as HTMLElement | undefined;
      if (!row || !pill || row.clientWidth === 0) return;
      const start = pill.offsetLeft - row.offsetLeft;
      const end = start + pill.offsetWidth;
      if (start < row.scrollLeft) row.scrollLeft = start - 8;
      else if (end > row.scrollLeft + row.clientWidth) row.scrollLeft = end - row.clientWidth + 8;
    });
  }
}
