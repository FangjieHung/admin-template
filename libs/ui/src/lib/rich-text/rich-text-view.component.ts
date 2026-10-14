import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, ViewEncapsulation, effect, inject, input, viewChild } from '@angular/core';
import { renderRichText } from './rich-text-html';
import { RichTextContentStylesComponent } from './rich-text-content-styles.component';

/**
 * 顯示富文字編輯器產生的 HTML（留言、備註）。
 *
 * 安全：不用 `[innerHTML]`，也不依賴 Angular 的預設清理——元件自己用白名單重建節點（`rich-text-html.ts`）：
 * 只留段落、粗體、斜體、清單、引用、連結（http／https／mailto，加 `rel="noopener noreferrer"`、`target="_blank"`）
 * 與提及標記；`<script>`、`on*` 屬性、`javascript:` 連結、圖片、樣式全部拿掉。提及畫成「@名字」小標籤。
 */
@Component({
  selector: 'lib-rich-text-view',
  imports: [RichTextContentStylesComponent],
  template: '<lib-rich-text-content-styles /><div #body class="lib-rich-text-view__body lib-rich-text-content"></div>',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lib-rich-text-view lib-rich-text' },
  styles: '.lib-rich-text-view { display: block; min-width: 0; }',
})
export class RichTextViewComponent {
  /** 要顯示的 HTML（通常是 lib-rich-text-editor 的值）。 */
  readonly html = input<string | null | undefined>('');

  private readonly body = viewChild<ElementRef<HTMLElement>>('body');
  private readonly document = inject(DOCUMENT);

  constructor() {
    effect(() => {
      const body = this.body()?.nativeElement;
      const html = this.html();
      if (body) body.replaceChildren(renderRichText(html, this.document));
    });
  }
}
