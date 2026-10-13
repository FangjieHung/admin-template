import { Provider } from '@angular/core';
import { RELATION_SELECT_LABELS } from '@admin-template/ui';
import { ZH_TW } from '../../core/i18n/zh-tw';

/**
 * 關聯選擇欄位（lib-relation-select）的畫面文字。用到它的頁面在自己的 `providers` 加上這組；
 * 不放 app.config 根層，理由同 component-label-providers.ts。
 */
export const RELATION_SELECT_LABEL_PROVIDERS: Provider[] = [
  { provide: RELATION_SELECT_LABELS, useValue: ZH_TW.relationSelect },
];
