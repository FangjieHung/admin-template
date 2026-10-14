import { InjectionToken } from '@angular/core';

/**
 * 步驟精靈（lib-step-wizard）的畫面文字。libs/ui 不內建使用者可見字串，由使用端在 `providers` 提供一次。
 * `{current}` 換成目前第幾步、`{total}` 換成總步數、`{label}` 換成步驟名稱、`{count}` 換成需要修正的欄位數。
 */
export interface StepWizardLabels {
  /** 例：「上一步」。 */
  previous: string;
  /** 例：「下一步」。 */
  next: string;
  /** 最後一步的送出鈕，例：「完成」。每個精靈可以再用 `finishLabel` 換成更具體的動詞（「建立專案」）。 */
  finish: string;
  /** 送出中的按鈕文字，例：「送出中…」。 */
  submitting: string;
  /** `showCancel` 時的取消鈕，例：「取消」。 */
  cancel: string;
  /** 選填步驟在名稱下方的小字，例：「選填」。 */
  optional: string;
  /** 步驟清單的無障礙名稱（`<nav aria-label>`），例：「步驟」。 */
  stepList: string;
  /** 窄版精簡列的文字，例：「步驟 {current}／{total} · {label}」。 */
  compactStatus: string;
  /** 窄版展開完整步驟清單的按鈕，例：「所有步驟」（展開與否由 aria-expanded 表達）。 */
  stepListToggle: string;
  /** 換步驟時報讀器念的字，例：「步驟 {current}，共 {total} 步：{label}」。 */
  announce: string;
  /** 只給報讀器的步驟狀態（不只靠顏色），例：「已完成」。 */
  stateDone: string;
  /** 例：「有錯誤」。 */
  stateError: string;
  /** 線性模式還不能前往的步驟，例：「尚未開放」。 */
  stateLocked: string;
  /** 還沒完成的步驟，例：「未完成」。 */
  stateUpcoming: string;
  /** 按下一步被擋下時的錯誤摘要標題，例：「這一步有 {count} 個欄位需要修正」。 */
  errorSummary: string;
  /** 錯誤不在單一欄位上（整組驗證失敗）時的摘要標題，例：「這一步還有內容需要修正」。 */
  stepInvalid: string;
}

export const STEP_WIZARD_LABELS = new InjectionToken<StepWizardLabels>('STEP_WIZARD_LABELS');

const KEYS: readonly (keyof StepWizardLabels)[] = [
  'previous',
  'next',
  'finish',
  'submitting',
  'cancel',
  'optional',
  'stepList',
  'compactStatus',
  'stepListToggle',
  'announce',
  'stateDone',
  'stateError',
  'stateLocked',
  'stateUpcoming',
  'errorSummary',
  'stepInvalid',
];

/** 開發期設定錯誤（忘了提供文字或少了某一句）時直接丟出明確訊息，不靜默顯示空白。 */
export function assertStepWizardLabels(labels: Partial<StepWizardLabels> | null): StepWizardLabels {
  if (!labels) throw new Error('StepWizard：缺少畫面文字。請在 providers 提供 STEP_WIZARD_LABELS。');
  const missing = KEYS.filter((key) => !labels[key]);
  if (missing.length > 0) {
    throw new Error(`StepWizard：STEP_WIZARD_LABELS 缺少 ${missing.map((k) => `「${k}」`).join('')}。`);
  }
  return labels as StepWizardLabels;
}

/** 把 `{name}` 換成對應的值。 */
export function formatStepWizardLabel(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}
