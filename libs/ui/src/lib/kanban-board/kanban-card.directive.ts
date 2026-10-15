import { Directive, TemplateRef, inject, input } from '@angular/core';

/** `<ng-template libKanbanCard let-item>` 的內容：`item` 是卡片資料，另外可取 `let-column="column" let-index="index" let-group="group"`。 */
export interface KanbanCardContext<T> {
  $implicit: T;
  /** 卡片所在欄的 id。 */
  column: string;
  /** 在這一格（沒有分組時就是這一欄）的第幾張（從 0 起算）。 */
  index: number;
  /** 分組模式：卡片所在分組的 id（沒有分組時 undefined）。 */
  group?: string;
}

/**
 * 看板卡片的內容範本：元件只畫卡片外框、拖曳與「移動」選單，卡片裡的版面全由使用端決定。
 * 想讓 `let-item` 有型別時加上 `[libKanbanCardOf]="items"`（只用來推斷型別，不影響畫面）。
 */
@Directive({ selector: 'ng-template[libKanbanCard]' })
export class KanbanCardDirective<T> {
  readonly template = inject<TemplateRef<KanbanCardContext<T>>>(TemplateRef);
  readonly libKanbanCardOf = input<readonly T[] | null | undefined>(undefined);

  static ngTemplateContextGuard<T>(_dir: KanbanCardDirective<T>, _ctx: unknown): _ctx is KanbanCardContext<T> {
    return true;
  }
}
