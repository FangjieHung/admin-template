import { ComponentRef, Directive, OnChanges, OnDestroy, Type, ViewContainerRef, inject, input } from '@angular/core';

/** 要放進來的元件與它的 `context` 輸入。 */
export interface DataTableEditorHostSpec {
  component: Type<unknown>;
  context: unknown;
}

/**
 * 把 lazy 載入的編輯元件（編輯器、批次列、手機表單）放在這個位置（內部指令，不從 index.ts 匯出）。
 * 資料表本身不 import 那些元件：它們在編輯控制器的 chunk 裡，沒有編輯的表格不會下載。
 * spec 換成另一個物件時重建；同一個物件不動（範本每次變更偵測都會讀到同一個 computed 值）。
 */
@Directive({ selector: '[dtEditorHost]' })
export class DataTableEditorHostDirective implements OnChanges, OnDestroy {
  readonly dtEditorHost = input<DataTableEditorHostSpec | null>(null);

  private readonly vcr = inject(ViewContainerRef);
  private ref: ComponentRef<unknown> | null = null;

  ngOnChanges(): void {
    const spec = this.dtEditorHost();
    this.vcr.clear();
    this.ref = null;
    if (!spec) return;
    this.ref = this.vcr.createComponent(spec.component);
    this.ref.setInput('context', spec.context);
  }

  ngOnDestroy(): void {
    this.vcr.clear();
  }
}
