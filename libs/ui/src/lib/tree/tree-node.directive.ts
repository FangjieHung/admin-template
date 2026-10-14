import { Directive, TemplateRef, inject, input } from '@angular/core';

/** `<ng-template libTreeNode let-node let-level="level">` 的內容。 */
export interface TreeNodeContext<T> {
  $implicit: T;
  /** 層級，從 1 起算。 */
  level: number;
  /** 目前是否展開。 */
  expanded: boolean;
  /** 目前的搜尋文字（沒在搜尋時是空字串）：交給 `<lib-tree-highlight [query]>` 標出比對到的字。 */
  query: string;
}

/**
 * 樹狀選單節點的內容範本：元件畫縮排、展開鈕、勾選框與選取底色，節點裡的版面由使用端決定。
 * 不給範本時直接顯示 `nodeLabel` 的文字（搜尋時標出比對到的字）。
 * 想讓 `let-node` 有型別時加上 `[libTreeNodeOf]="nodes"`（只用來推斷型別，不影響畫面）。
 */
@Directive({ selector: 'ng-template[libTreeNode]' })
export class TreeNodeDirective<T> {
  readonly template = inject<TemplateRef<TreeNodeContext<T>>>(TemplateRef);
  readonly libTreeNodeOf = input<readonly T[] | null | undefined>(undefined);

  static ngTemplateContextGuard<T>(_dir: TreeNodeDirective<T>, _ctx: unknown): _ctx is TreeNodeContext<T> {
    return true;
  }
}
