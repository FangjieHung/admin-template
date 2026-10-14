import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

/**
 * 富文字內容（段落、清單、引用、連結、提及標記）共用的樣式（內部元件）：lib-rich-text-editor 與 lib-rich-text-view
 * 的模板最前面各放一個。不封裝（內容是 ProseMirror 或白名單清理後動態建立的節點，拿不到 `_ngcontent` 屬性），
 * 選擇器一律從 `.lib-rich-text-content` 開始；Angular 第一次建立它時把樣式加進 `<head>`，之後共用同一份。
 */
@Component({
  selector: 'lib-rich-text-content-styles',
  template: '',
  styleUrl: './rich-text-content.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RichTextContentStylesComponent {}
