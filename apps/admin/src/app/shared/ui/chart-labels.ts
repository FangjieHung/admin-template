import { Provider } from '@angular/core';
import { CHART_LABELS } from '@admin-template/ui';
import { ZH_TW } from '../../core/i18n/zh-tw';

/**
 * 數字小卡與圖表的畫面文字。用到它們的頁面在自己的 `providers` 加上這組；
 * 不放 app.config 根層，理由同 component-label-providers.ts。
 */
export const CHART_LABEL_PROVIDERS: Provider[] = [{ provide: CHART_LABELS, useValue: ZH_TW.chart }];
