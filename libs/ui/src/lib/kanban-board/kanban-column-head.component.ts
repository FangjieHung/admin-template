import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * 看板的欄頭（lib-kanban-board 內部用，不從 barrel 匯出）：欄名（標題）、張數（有上限時「張數 / 上限」）、
 * 超過上限的警告（圖示＋文字，不只靠顏色）與一行說明。拆成內部元件是為了讓每份樣式表都在 8 kB 預算內；
 * 造型一樣讀 `.lib-kanban-board` 上的 --lib-kanban-* 變數（會繼承下來）。
 */
@Component({
  selector: 'lib-kanban-column-head',
  template: `
    <div class="kh-row">
      <div class="kh-title" role="heading" [attr.aria-level]="level()" [id]="headingId()">{{ title() }}</div>
      <span class="kh-count ui-text-numeric" role="img" [attr.aria-label]="countLabel()">{{ countText() }}</span>
    </div>
    @if (over() > 0) {
      <p class="kh-wip">
        <span class="material-symbols-rounded" aria-hidden="true">warning</span>
        <span>{{ overText() }}</span>
      </p>
    }
    @if (hint()) {
      <p class="kh-hint">{{ hint() }}</p>
    }
  `,
  styleUrl: './kanban-column-head.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lib-kanban-column-head', '[class.is-over-limit]': 'over() > 0' },
})
export class KanbanColumnHeadComponent {
  readonly title = input.required<string>();
  readonly headingId = input.required<string>();
  readonly level = input(3);
  readonly countText = input.required<string>();
  readonly countLabel = input.required<string>();
  readonly over = input(0);
  readonly overText = input('');
  readonly hint = input<string | undefined>('');
}
