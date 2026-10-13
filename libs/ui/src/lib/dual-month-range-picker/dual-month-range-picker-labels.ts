import { InjectionToken } from '@angular/core';

/**
 * 雙月日期區間選擇器的畫面文字。libs/ui 不內建使用者可見字串（同 DataTableLabels），
 * 由使用端提供（展示 app 見 apps/admin/src/app/shared/ui/component-label-providers.ts）。
 */
export interface DualMonthRangePickerLabels {
  /** 欄位標籤，例：「專案期間」。 */
  field: string;
  /** 尚未選擇時欄位內的提示文字。 */
  placeholder: string;
  /** 「上個月」按鈕的無障礙名稱。 */
  prevMonth: string;
  /** 「下個月」按鈕的無障礙名稱。 */
  nextMonth: string;
  /** 月份標題樣板，`{year}`、`{month}` 會換成數字（月份從 1 起算），例：「{year}年{month}月」。 */
  monthTitle: string;
}

/**
 * 刻意沒有預設值：忘了提供時直接在開發期報 NG0201（沒有 provider），而不是默默顯示某一種語言的文字。
 * 一般在使用選擇器的父元件 `providers` 裡提供即可（選擇器與它開出的月曆面板都會往上找到）。
 */
export const DUAL_MONTH_RANGE_PICKER_LABELS = new InjectionToken<DualMonthRangePickerLabels>(
  'DUAL_MONTH_RANGE_PICKER_LABELS',
);
