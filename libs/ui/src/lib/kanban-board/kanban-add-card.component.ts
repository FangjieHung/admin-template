import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';
import { MatButton } from '@angular/material/button';

let nextId = 0;

/**
 * 看板欄底的「新增卡片」（lib-kanban-board 內部用，不從 barrel 匯出）：按鈕展開成單行輸入，
 * Enter 送出（輸入框清空、保持展開，可以連續新增），Esc 取消並把焦點還給按鈕；空白時離開輸入框就收起來。
 */
@Component({
  selector: 'lib-kanban-add-card',
  imports: [MatButton],
  template: `
    @if (open()) {
      <input
        #field
        class="ka-input"
        type="text"
        autocomplete="off"
        enterkeyhint="done"
        [attr.aria-label]="inputLabel()"
        [attr.aria-describedby]="hintId"
        [value]="draft()"
        (input)="draft.set(field.value)"
        (keydown.enter)="submit($event)"
        (keydown.escape)="cancel($event)"
        (blur)="onBlur()"
      />
      <p class="ka-hint" [id]="hintId">{{ hint() }}</p>
    } @else {
      <button #trigger matButton type="button" class="ka-button" (click)="start()">
        <span class="material-symbols-rounded" aria-hidden="true">add</span>{{ buttonLabel() }}
      </button>
    }
  `,
  styleUrl: './kanban-add-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lib-kanban-add-card' },
})
export class KanbanAddCardComponent {
  readonly buttonLabel = input.required<string>();
  readonly inputLabel = input.required<string>();
  readonly hint = input.required<string>();
  readonly add = output<string>();

  protected readonly open = signal(false);
  protected readonly draft = signal('');
  protected readonly hintId = `lib-kanban-add-${nextId++}`;
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  private readonly trigger = viewChild('trigger', { read: ElementRef });
  private readonly injector = inject(Injector);

  protected start(): void {
    this.open.set(true);
    afterNextRender(() => this.field()?.nativeElement.focus(), { injector: this.injector });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    // 輸入法選字中按的 Enter 不算送出。
    if ((event as KeyboardEvent).isComposing) return;
    const title = this.draft().trim();
    if (!title) return;
    this.add.emit(title);
    this.draft.set('');
    const el = this.field()?.nativeElement;
    if (el) el.value = '';
  }

  protected cancel(event: Event): void {
    event.preventDefault();
    this.close(true);
  }

  protected onBlur(): void {
    if (!this.draft().trim()) this.close(false);
  }

  private close(restoreFocus: boolean): void {
    if (!this.open()) return;
    this.draft.set('');
    this.open.set(false);
    if (restoreFocus) {
      afterNextRender(() => (this.trigger()?.nativeElement as HTMLElement | undefined)?.focus(), { injector: this.injector });
    }
  }
}
