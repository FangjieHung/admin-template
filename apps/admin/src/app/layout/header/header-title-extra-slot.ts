import { Directive, Injectable, OnDestroy, TemplateRef, inject, signal } from '@angular/core';

/**
 * Topbar 標題旁的自訂內容插槽（例如詳情頁的狀態標籤）。
 * 比照 HeaderToolbarSlot（header-toolbar-slot.ts）的作法，只是渲染位置在 h1 旁而不是列尾。
 */
@Injectable({ providedIn: 'root' })
export class HeaderTitleExtraSlot {
  readonly template = signal<TemplateRef<unknown> | null>(null);
}

@Directive({
  selector: '[appHeaderTitleExtra]',
})
export class HeaderTitleExtraDirective implements OnDestroy {
  private readonly slot = inject(HeaderTitleExtraSlot);
  private readonly template = inject(TemplateRef<unknown>);

  constructor() {
    this.slot.template.set(this.template);
  }

  ngOnDestroy(): void {
    // 換頁時新頁面可能已先登記，只有仍是自己時才清空。
    if (this.slot.template() === this.template) {
      this.slot.template.set(null);
    }
  }
}
