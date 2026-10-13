import { Provider } from '@angular/core';
import { ACTIVITY_TIMELINE_LABELS, DESCRIPTION_LIST_LABELS, DETAIL_LAYOUT_LABELS } from '@admin-template/ui';
import { ZH_TW } from '../../core/i18n/zh-tw';

/**
 * 詳情頁版型、描述清單、活動紀錄的畫面文字。用到它們的頁面在自己的 `providers` 加上對應的一組；
 * 不放 app.config 根層，理由同 component-label-providers.ts。
 */
export const DETAIL_LAYOUT_LABEL_PROVIDERS: Provider[] = [{ provide: DETAIL_LAYOUT_LABELS, useValue: ZH_TW.detailLayout }];

export const DESCRIPTION_LIST_LABEL_PROVIDERS: Provider[] = [
  { provide: DESCRIPTION_LIST_LABELS, useValue: ZH_TW.descriptionList },
];

export const ACTIVITY_TIMELINE_LABEL_PROVIDERS: Provider[] = [
  { provide: ACTIVITY_TIMELINE_LABELS, useValue: ZH_TW.activityTimeline },
];
