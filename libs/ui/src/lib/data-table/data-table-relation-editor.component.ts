import { ChangeDetectionStrategy, Component, ElementRef, OnInit, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';
import { RelationSelectComponent } from '../relation-select/relation-select.component';
import type { DataTableEditIntent, DataTableEditorContext } from './data-table-edit.controller';

/**
 * 關聯欄的編輯器（內部元件，自己一個 lazy chunk：只有表格裡有關聯欄時才下載 relation-select 與 mat-autocomplete）。
 * 就是 lib-relation-select（畫面文字吃頁面提供的 RELATION_SELECT_LABELS）：選了一筆就確定；清單開著時 Enter／Esc
 * 交給清單，關著時 Enter 確定往下、Tab 往右、Esc 取消。
 */
@Component({
  selector: 'lib-data-table-relation-editor',
  imports: [RelationSelectComponent],
  template: `
    @let ctx = context();
    <lib-relation-select
      appearance="outline"
      subscriptSizing="dynamic"
      [source]="source()"
      [displayWith]="displayWith()"
      [secondaryWith]="secondaryWith()"
      [ariaLabel]="ctx.mode === 'cell' ? ctx.label : null"
      [label]="ctx.mode === 'form' ? ctx.label : ''"
      [required]="!!ctx.editor.required"
      [placeholder]="ctx.editor.placeholder || ''"
      [(value)]="value"
      (selectionChange)="onSelected()"
      (keydown)="onKeydown($event)"
      (focusout)="onFocusOut()"
    />
    @if (ctx.error(); as message) {
      <span class="dt-rel__error" role="alert">
        <span class="material-symbols-rounded" aria-hidden="true">error</span>{{ message }}
      </span>
    }
  `,
  styleUrl: './data-table-relation-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dt-rel', '[class.dt-rel--form]': "context().mode === 'form'" },
})
export class DataTableRelationEditorComponent implements OnInit {
  readonly context = input.required<DataTableEditorContext>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly select = viewChild.required(RelationSelectComponent);
  protected readonly value = signal<string | null>(null);
  private done = false;

  private readonly relation = computed(() => {
    const editor = this.context().editor;
    if (editor.type !== 'relation') throw new Error('DataTable：關聯編輯器只給 type: relation 的欄位用');
    return editor;
  });
  protected readonly source = computed(() => this.relation().source);
  protected readonly displayWith = computed(() => (item: unknown) => this.relation().displayWith(item));
  protected readonly secondaryWith = computed(() => {
    const editor = this.relation();
    return editor.secondaryWith ? (item: unknown) => editor.secondaryWith!(item) : null;
  });

  constructor() {
    afterNextRender({
      write: () => {
        const ctx = this.context();
        if (ctx.mode !== 'cell') return;
        const input = this.input();
        if (!input) return;
        input.focus({ preventScroll: true });
        if (ctx.seeded) {
          // 打字開始編輯：那個字就是搜尋字（原本的值查完也不蓋回去；Esc 取消時回到原本的值）。
          this.select().startSearch(ctx.text);
        } else {
          input.select();
        }
      },
    });
  }

  ngOnInit(): void {
    const v = this.context().value;
    this.value.set(typeof v === 'string' ? v : v == null ? null : String(v));
  }

  protected onSelected(): void {
    const ctx = this.context();
    ctx.change(this.value());
    if (ctx.mode === 'cell') this.send('stay');
  }

  protected onKeydown(event: KeyboardEvent): void {
    const ctx = this.context();
    // 清單開著時，Enter（選這一筆）與 Esc（關清單）已經被 mat-autocomplete 處理掉。
    if (event.defaultPrevented || event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.done = true;
      ctx.cancel();
      return;
    }
    if (ctx.mode !== 'cell') return;
    let intent: DataTableEditIntent | null = null;
    if (event.key === 'Enter') intent = event.shiftKey ? 'up' : 'down';
    else if (event.key === 'Tab') intent = event.shiftKey ? 'left' : 'right';
    if (!intent) return;
    event.preventDefault();
    event.stopPropagation();
    this.send(intent);
  }

  /** 焦點離開整個編輯器（不是移到它自己的清單）時確定。 */
  protected onFocusOut(): void {
    if (this.context().mode !== 'cell' || this.done) return;
    setTimeout(() => {
      if (this.done) return;
      const active = this.host.nativeElement.ownerDocument.activeElement;
      if (active && (this.host.nativeElement.contains(active) || active.closest('.lib-relation-select-panel'))) return;
      this.send('blur');
    });
  }

  private send(intent: DataTableEditIntent): void {
    const ctx = this.context();
    ctx.commit(this.value(), intent);
    if (!ctx.error()) this.done = true;
  }

  private input(): HTMLInputElement | null {
    return this.host.nativeElement.querySelector('input');
  }
}
