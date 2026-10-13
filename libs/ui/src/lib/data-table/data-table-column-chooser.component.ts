import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { OrderedColumn, formatLabel } from './data-table-query';
import { DataTableColumnChooserLabels, DataTableColumnPrefs } from './data-table.types';

/**
 * 欄位選擇面板：勾選顯示／隱藏、拖曳或用上移／下移鈕（鍵盤可用）調整順序、恢復預設。
 * 只發出新的偏好（prefsChange），狀態本身由 lib-data-table 的 columnPrefs 持有。
 */
@Component({
  selector: 'lib-data-table-column-chooser',
  imports: [OverlayModule, DragDropModule, MatButtonModule],
  templateUrl: './data-table-column-chooser.component.html',
  styleUrl: './data-table-column-chooser.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableColumnChooserComponent<T = unknown> {
  readonly columns = input.required<readonly OrderedColumn<T>[]>();
  readonly labels = input.required<DataTableColumnChooserLabels>();
  /** null＝恢復預設。 */
  readonly prefsChange = output<DataTableColumnPrefs | null>();

  protected readonly open = signal(false);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];

  protected format(template: string, label: string): string {
    return formatLabel(template, { label });
  }

  protected toggle(): void {
    if (this.open()) this.close();
    else this.open.set(true);
  }

  /** returnFocus：鍵盤（Esc、關閉鈕）關掉時焦點回到觸發鈕。 */
  protected close(returnFocus = true): void {
    if (!this.open()) return;
    this.open.set(false);
    if (returnFocus) this.trigger()?.nativeElement.focus();
  }

  protected onAttach(): void {
    afterNextRender(
      () => this.panel()?.nativeElement.querySelector<HTMLElement>('input, button')?.focus(),
      { injector: this.injector },
    );
  }

  protected onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  protected toggleHidden(item: OrderedColumn<T>): void {
    if (!item.hideable) return;
    const hidden = new Set(this.columns().filter((c) => c.hidden).map((c) => c.column.key));
    if (hidden.has(item.column.key)) hidden.delete(item.column.key);
    else hidden.add(item.column.key);
    this.emit(this.columns().map((c) => c.column.key), hidden);
  }

  /** 第一個可移動的位置（固定欄永遠在最前面）。 */
  private firstMovableIndex(): number {
    return this.columns()[0]?.frozen ? 1 : 0;
  }

  protected canMove(index: number, delta: -1 | 1): boolean {
    const target = index + delta;
    return target >= this.firstMovableIndex() && target < this.columns().length && !this.columns()[index].frozen;
  }

  protected move(index: number, delta: -1 | 1): void {
    if (!this.canMove(index, delta)) return;
    const key = this.columns()[index].column.key;
    this.reorder(index, index + delta);
    // 列的 DOM 節點被搬動後焦點會掉；移到頭或尾、這顆按鈕變成停用時改聚焦另一顆。
    afterNextRender(
      () => {
        const buttons = Array.from(
          this.panel()?.nativeElement.querySelectorAll<HTMLButtonElement>('button[data-move]') ?? [],
        ).filter((b) => b.dataset['key'] === key);
        const preferred = buttons.find((b) => b.dataset['move'] === String(delta));
        const fallback = buttons.find((b) => b.dataset['move'] === String(-delta));
        (preferred && !preferred.disabled ? preferred : fallback)?.focus();
      },
      { injector: this.injector },
    );
  }

  protected drop(event: CdkDragDrop<unknown>): void {
    const to = Math.max(this.firstMovableIndex(), event.currentIndex);
    if (event.previousIndex === to) return;
    this.reorder(event.previousIndex, to);
  }

  protected reset(): void {
    this.prefsChange.emit(null);
  }

  private reorder(from: number, to: number): void {
    const keys = this.columns().map((c) => c.column.key);
    const [moved] = keys.splice(from, 1);
    keys.splice(to, 0, moved);
    const hidden = new Set(this.columns().filter((c) => c.hidden).map((c) => c.column.key));
    this.emit(keys, hidden);
  }

  private emit(order: string[], hidden: ReadonlySet<string>): void {
    this.prefsChange.emit({ order, hidden: order.filter((key) => hidden.has(key)) });
  }
}
