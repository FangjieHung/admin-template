import { Provider } from '@angular/core';
import { FILTER_SELECT_LABELS, PAGE_TOOLBAR_LABELS } from '@car-rental/ui';
import { ZH_TW } from '../../core/i18n/zh-tw';

/**
 * 頁首工具列（lib-page-toolbar／lib-filter-select）的文字。用到工具列的頁面在自己的 `providers` 加上它
 * （頁首的 ng-template 由頁面宣告，往上找得到頁面的 provider）。刻意不放 app.config 的根層：
 * 根層一 import @car-rental/ui，整個 barrel 會被併進 Initial bundle（實測 +165 kB）。
 */
export const LIST_TOOLBAR_LABEL_PROVIDERS: Provider[] = [
  {
    provide: PAGE_TOOLBAR_LABELS,
    useValue: {
      search: ZH_TW.common.search,
      collapseSearch: ZH_TW.common.collapseSearch,
      clearSearch: ZH_TW.common.clearSearch,
      submitSearch: ZH_TW.common.submitSearch,
      clearFilters: ZH_TW.common.clearFilters,
    },
  },
  { provide: FILTER_SELECT_LABELS, useValue: { all: ZH_TW.common.all } },
];
