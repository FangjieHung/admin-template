import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * 看板分組（泳道）的標題列（lib-kanban-board 內部用，不從 barrel 匯出）：整列是一個收合按鈕（aria-expanded），
 * 裡面是展開箭頭、分組名稱與張數（寬版整道加總；窄版一次一欄時是目前這一欄在這一道的張數）。標題列橫跨所有欄，內容黏在左邊，橫向捲動或手機一次一欄時名稱一直看得到。
 * 造型讀 `.lib-kanban-board` 上的 --lib-kanban-* 變數（會繼承下來）。
 */
@Component({
  selector: 'lib-kanban-lane-head',
  template: `
    <div class="kl-heading" role="heading" [attr.aria-level]="level()">
      <button
        type="button"
        class="kl-toggle"
        [attr.aria-expanded]="expanded()"
        [attr.data-kanban-group-toggle]="groupId()"
        (click)="toggle.emit()"
      >
        <span class="material-symbols-rounded kl-chevron" aria-hidden="true">expand_more</span>
        <span class="kl-title" [id]="titleId()">{{ title() }}</span>
        <!-- 寬版：整道的張數；窄版（一次一欄，container query）：目前這一欄、這一道的張數。藏起來的那一組用 display: none，報讀器也不念。 -->
        <span class="kl-count kl-wide ui-text-numeric" aria-hidden="true">{{ countText() }}</span>
        <span class="kl-sr kl-wide">{{ countLabel() }}</span>
        <span class="kl-count kl-narrow ui-text-numeric" aria-hidden="true">{{ currentCountText() }}</span>
        <span class="kl-sr kl-narrow">{{ currentCountLabel() }}</span>
      </button>
    </div>
  `,
  styleUrl: './kanban-lane-head.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lib-kanban-lane-head', '[class.is-collapsed]': '!expanded()' },
})
export class KanbanLaneHeadComponent {
  readonly groupId = input.required<string>();
  readonly title = input.required<string>();
  /** 分組名稱的 id：格子的清單用它（加上欄名）當無障礙名稱。 */
  readonly titleId = input.required<string>();
  readonly level = input(3);
  readonly countText = input.required<string>();
  readonly countLabel = input.required<string>();
  /** 窄版（一次一欄）顯示的張數：目前這一欄在這一道的卡片數。 */
  readonly currentCountText = input.required<string>();
  readonly currentCountLabel = input.required<string>();
  readonly expanded = input(true);
  readonly toggle = output<void>();
}
