import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface Part {
  text: string;
  hit: boolean;
}

/** 把文字依查詢字串切段（不分大小寫，所有出現的位置都標）。 */
export function splitTreeHighlight(text: string, query: string): Part[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [{ text, hit: false }];
  const lower = text.toLocaleLowerCase();
  const parts: Part[] = [];
  let at = 0;
  for (let i = lower.indexOf(q); i >= 0; i = lower.indexOf(q, at)) {
    if (i > at) parts.push({ text: text.slice(at, i), hit: false });
    parts.push({ text: text.slice(i, i + q.length), hit: true });
    at = i + q.length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), hit: false });
  return parts;
}

/**
 * 搜尋結果的文字：比對到的字包在 `<mark>` 裡。lib-tree 沒給節點範本時自動使用；自訂範本時這樣用：
 * `<lib-tree-highlight [text]="node.name" [query]="query" />`（`query` 來自範本的 `let-query="query"`）。
 * 底色與字色是 `--lib-tree-mark-bg`／`--lib-tree-mark-fg`（預設警示色調的底與字）。
 */
@Component({
  selector: 'lib-tree-highlight',
  template: `@for (part of parts(); track $index) {@if (part.hit) {<mark class="th-mark">{{ part.text }}</mark>} @else {{{ part.text }}}}`,
  styles: `
    .th-mark {
      border-radius: var(--mat-sys-corner-small);
      background: var(--lib-tree-mark-bg, var(--app-warning-bg));
      color: var(--lib-tree-mark-fg, var(--app-warning-fg));
      font-weight: 600;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreeHighlightComponent {
  readonly text = input.required<string>();
  readonly query = input('');
  protected readonly parts = computed(() => splitTreeHighlight(this.text(), this.query()));
}
