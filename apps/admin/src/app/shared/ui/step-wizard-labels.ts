import { Provider } from '@angular/core';
import { STEP_WIZARD_LABELS, StepWizardLabels } from '@admin-template/ui';

/**
 * 步驟精靈（lib-step-wizard）的畫面文字。用到它的頁面在自己的 `providers` 加上這組；
 * 不放 app.config 根層，理由同 component-label-providers.ts。
 *
 * 文字直接寫在這裡、不放 core/i18n/zh-tw.ts：那份字典被殼層 import，整份在 Initial bundle 裡
 * （esbuild 把每個中文字輸出成 6 bytes 的跳脫序列），這 16 句只有用到精靈的頁面（lazy chunk）需要。
 */
export const ZH_TW_STEP_WIZARD: StepWizardLabels = {
  previous: '上一步',
  next: '下一步',
  finish: '完成',
  submitting: '送出中…',
  cancel: '取消',
  optional: '選填',
  stepList: '步驟',
  compactStatus: '步驟 {current}／{total} · {label}',
  stepListToggle: '所有步驟',
  announce: '步驟 {current}，共 {total} 步：{label}',
  stateDone: '已完成',
  stateError: '有錯誤',
  stateLocked: '尚未開放',
  stateUpcoming: '未完成',
  errorSummary: '這一步有 {count} 個欄位需要修正',
  stepInvalid: '這一步還有內容需要修正',
};

export const STEP_WIZARD_LABEL_PROVIDERS: Provider[] = [{ provide: STEP_WIZARD_LABELS, useValue: ZH_TW_STEP_WIZARD }];
