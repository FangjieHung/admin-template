import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { formatLabel } from '../data-table/data-table-query';
import { describeCondition, removeCondition } from './filter-predicates';
import { FilterCondition, FilterField, FilterLabels } from './filter.types';

/**
 * 已套用的篩選條件：每個條件一顆 chip（× 移除），最後一顆「清除全部」。沒有條件時整塊不渲染。
 * 找不到欄位定義的條件（舊檢視裡已移除的欄位）不顯示，也不影響篩選（applyFilters 同樣忽略）。
 */
@Component({
  selector: 'lib-filter-chips',
  imports: [MatButtonModule],
  templateUrl: './filter-chips.component.html',
  styleUrl: './filter-chips.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterChipsComponent<T = unknown> {
  readonly fields = input.required<readonly FilterField<T>[]>();
  readonly conditions = model<readonly FilterCondition[]>([]);
  readonly labels = input.required<FilterLabels>();

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');
  private readonly injector = inject(Injector);

  protected readonly chips = computed(() => {
    const byId = new Map(this.fields().map((f) => [f.id, f] as const));
    return this.conditions().flatMap((cond) => {
      const field = byId.get(cond.field);
      if (!field) return [];
      const text = describeCondition(cond, field, this.labels());
      return [{ field: cond.field, text, removeLabel: formatLabel(this.labels().remove, { label: text }) }];
    });
  });

  protected remove(field: string, index: number): void {
    this.conditions.set(removeCondition(this.conditions(), field));
    // 移除後焦點移到下一顆（沒有就前一顆），鍵盤使用者不會被丟回頁首。
    afterNextRender(
      () => {
        const buttons = this.list()?.nativeElement.querySelectorAll<HTMLButtonElement>('button');
        if (!buttons || buttons.length === 0) return;
        buttons[Math.min(index, buttons.length - 1)].focus();
      },
      { injector: this.injector },
    );
  }

  protected clearAll(): void {
    this.conditions.set([]);
  }
}
