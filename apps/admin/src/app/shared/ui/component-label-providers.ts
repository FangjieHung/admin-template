import { Provider } from '@angular/core';
import { CONFIRM_DIALOG_LABELS, DUAL_MONTH_RANGE_PICKER_LABELS, SIGNATURE_PAD_LABELS } from '@car-rental/ui';
import { ZH_TW } from '../../core/i18n/zh-tw';

/**
 * libs/ui 元件需要的畫面文字（libs/ui 不內建使用者可見字串）。用到元件的頁面在自己的 `providers` 加上對應的一組；
 * 刻意不放 app.config 的根層：根層一 import @car-rental/ui，整個 barrel 會被併進 Initial bundle。
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
