import { Provider } from '@angular/core';
import {
  CONFIRM_DIALOG_LABELS,
  DUAL_MONTH_RANGE_PICKER_LABELS,
  FEEDBACK_STATE_LABELS,
  SIGNATURE_PAD_LABELS,
  provideToast,
} from '@admin-template/ui';
import { PERMISSION_MATRIX_LABELS } from '@admin-template/access/permission-matrix';
import { ZH_TW } from '../../core/i18n/zh-tw';

/**
 * libs/ui 元件需要的畫面文字（libs/ui 不內建使用者可見字串）。用到元件的頁面在自己的 `providers` 加上對應的一組；
 * 刻意不放 app.config 的根層：根層一 import @admin-template/ui，整個 barrel 會被併進 Initial bundle。
 */

/** 雙月日期區間選擇器；`field`／`placeholder` 依欄位用途不同，由頁面給。 */
export function rangePickerLabelProviders(field: string, placeholder = '選擇日期範圍'): Provider[] {
  return [
    {
      provide: DUAL_MONTH_RANGE_PICKER_LABELS,
      useValue: { field, placeholder, ...ZH_TW.rangePicker },
    },
  ];
}

export const SIGNATURE_PAD_LABEL_PROVIDERS: Provider[] = [{ provide: SIGNATURE_PAD_LABELS, useValue: ZH_TW.signaturePad }];

export const CONFIRM_DIALOG_LABEL_PROVIDERS: Provider[] = [
  { provide: CONFIRM_DIALOG_LABELS, useValue: { confirm: ZH_TW.common.confirm, cancel: ZH_TW.common.cancel } },
];

/** 載入／空白／錯誤三態（lib-skeleton、lib-error-state、lib-async-state）。 */
export const FEEDBACK_STATE_LABEL_PROVIDERS: Provider[] = [{ provide: FEEDBACK_STATE_LABELS, useValue: ZH_TW.feedback }];

/** 提示訊息：ToastService 本身與錯誤提示的關閉鈕文字。要顯示提示的頁面在 providers 加上這組。 */
export const TOAST_PROVIDERS: Provider[] = provideToast(ZH_TW.toast);

/** 權限矩陣（libs/access 的 lib-permission-matrix）。不經過 @admin-template/ui，走 libs/access 的深路徑。 */
export const PERMISSION_MATRIX_LABEL_PROVIDERS: Provider[] = [
  { provide: PERMISSION_MATRIX_LABELS, useValue: ZH_TW.permissionMatrix },
];
