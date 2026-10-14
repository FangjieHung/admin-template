import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import type { DataTableEditIntent, DataTableEditorContext } from './data-table-edit.controller';
import { DataTableEditorOption } from './data-table.types';

let nextId = 0;

/**
 * 儲存格裡的編輯器（內部元件，lazy）：文字、數字、日期、下拉；手機整列表單裡另外有開關。
 * 儲存格模式：Enter 確定往下、Shift+Enter 往上、Tab／Shift+Tab 確定往右／左、Esc 取消、離開格子時確定。
 * 用原生 input／select（不是 mat-form-field）：高度跟文字一樣，打開編輯器時列高不跳。
 */
@Component({
  selector: 'lib-data-table-cell-editor',
  templateUrl: './data-table-cell-editor.component.html',
  styleUrl: './data-table-cell-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dt-ed',
    '[class.dt-ed--form]': "context().mode === 'form'",
    '[class.dt-ed--end]': "context().align === 'end'",
  },
})
export class DataTableCellEditorComponent implements OnInit {
  readonly context = input.required<DataTableEditorContext>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly errorId = `dt-ed-error-${nextId++}`;
  /** 確定或取消過了：之後的 blur（元件被移除時）不再送出。 */
  private done = false;

  protected readonly error = computed(() => this.context().error());
  protected readonly type = computed(() => this.context().editor.type);
  protected readonly options = computed<readonly DataTableEditorOption[]>(() => {
    const editor = this.context().editor;
    return editor.type === 'select' ? editor.options : [];
  });
  /** 下拉目前選第幾個（-1＝空白）。用 [selected] 綁在 option 上：@for 產生的選項比 select 的 [value] 晚建立。 */
  protected readonly selectedIndex = signal(-1);
  protected readonly showEmptyOption = computed(() => !this.context().editor.required || this.selectedIndex() === -1);
  protected readonly checked = signal(false);

  constructor() {
    afterNextRender({
      write: () => {
        const ctx = this.context();
        if (ctx.mode !== 'cell') return;
        const el = this.field();
        if (!el) return;
        el.focus({ preventScroll: true });
        if (el instanceof HTMLInputElement && el.type === 'text') {
          if (ctx.seeded) el.setSelectionRange(el.value.length, el.value.length);
          else el.select();
        }
      },
    });
  }

  ngOnInit(): void {
    const ctx = this.context();
    if (ctx.editor.type === 'select') {
      this.selectedIndex.set(ctx.editor.options.findIndex((o) => o.value === ctx.value));
    }
    this.checked.set(!!ctx.value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const ctx = this.context();
    if (event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation(); // 不要順便關掉外層的對話框
      this.done = true;
      ctx.cancel();
      return;
    }
    if (ctx.mode === 'form') {
      if (event.key === 'Enter' && this.type() !== 'select') {
        event.preventDefault();
        ctx.change(this.read());
        ctx.commit(this.read(), 'stay');
      }
      return;
    }
    let intent: DataTableEditIntent | null = null;
    if (event.key === 'Enter') intent = event.shiftKey ? 'up' : 'down';
    else if (event.key === 'Tab') intent = event.shiftKey ? 'left' : 'right';
    if (!intent) return;
    event.preventDefault();
    event.stopPropagation();
    this.send(intent);
  }

  protected onInput(): void {
    if (this.type() === 'select') {
      const v = (this.field() as HTMLSelectElement).value;
      this.selectedIndex.set(v === '' ? -1 : Number(v));
    }
    if (this.type() === 'toggle') this.checked.set((this.field() as HTMLInputElement).checked);
    this.context().change(this.read());
  }

  protected onBlur(): void {
    if (this.context().mode !== 'cell' || this.done) return;
    this.context().commit(this.read(), 'blur');
  }

  private send(intent: DataTableEditIntent): void {
    const raw = this.read();
    const ctx = this.context();
    ctx.commit(raw, intent);
    // 有錯時編輯器留著（即時儲存）：之後的 blur 還要能再送出；沒錯時元件即將被移除。
    if (!ctx.error()) this.done = true;
  }

  /** 目前的值：文字類是字串，下拉是選項的值（空白是 null），開關是布林。 */
  private read(): unknown {
    const el = this.field();
    if (!el) return null;
    if (this.type() === 'select') return this.options()[this.selectedIndex()]?.value ?? null;
    if (this.type() === 'toggle') return (el as HTMLInputElement).checked;
    return (el as HTMLInputElement).value;
  }

  private field(): HTMLInputElement | HTMLSelectElement | null {
    return this.host.nativeElement.querySelector<HTMLInputElement | HTMLSelectElement>('[data-dt-editor]');
  }
}
