import { Provider } from '@angular/core';
import { FILTER_SELECT_LABELS, PAGE_TOOLBAR_LABELS } from '@car-rental/ui';
import { ZH_TW_SHELL } from '../../core/i18n/zh-tw-shell';

/**
 * 清單頁頁首工具列（lib-page-toolbar／lib-filter-select）的文字。app.config 在根層提供；
 * 會渲染工具列的頁面測試也要加上（TestBed 沒有 app.config）。
 */
export const LIST_TOOLBAR_LABEL_PROVIDERS: Provider[] = [
  { provide: PAGE_TOOLBAR_LABELS, useValue: ZH_TW_SHELL.listToolbar },
  { provide: FILTER_SELECT_LABELS, useValue: ZH_TW_SHELL.listToolbar },
];
