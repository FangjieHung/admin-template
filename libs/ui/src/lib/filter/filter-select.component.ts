import { Component, InjectionToken, inject, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FilterOption } from './filter.types';

/** lib-filter-select 的畫面文字。 */
export interface FilterSelectLabels {
  /** 「不篩」的選項，例：「全部」。 */
  all: string;
}

/** 刻意沒有預設值（同 PAGE_TOOLBAR_LABELS）；admin 在 app.config 的根層提供。 */
export const FILTER_SELECT_LABELS = new InjectionToken<FilterSelectLabels>('FILTER_SELECT_LABELS');

@Component({
  selector: 'lib-filter-select',
  imports: [FormsModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './filter-select.component.html',
  styleUrls: ['./filter-select.component.scss'],
})
export class FilterSelectComponent<T extends string> {
  protected readonly t = inject(FILTER_SELECT_LABELS);
  readonly label = input.required<string>();
  readonly options = input.required<FilterOption<T>[]>();
  readonly value = model<T | null>(null);
}
