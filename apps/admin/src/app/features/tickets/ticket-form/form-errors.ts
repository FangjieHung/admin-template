import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * 錯誤摘要（表單頂端「有 N 個欄位需要修正」）的規則，跟欄位旁的 mat-error 用同一份文字。
 * 欄位依畫面上的順序排，摘要與「聚焦第一個錯誤欄位」都照這個順序。
 */
export interface FormFieldSpec {
  /** 表單控制項的名稱，也是畫面上 `[data-field]` 的值。 */
  key: string;
  label: string;
  /** 驗證錯誤的鍵 → 訊息；排越前面越優先顯示。 */
  messages: Readonly<Record<string, string>>;
}

export interface FormFieldError {
  key: string;
  label: string;
  message: string;
}

/** 某個欄位目前要顯示的錯誤訊息（沒有錯誤回 null）。 */
export function fieldMessage(spec: FormFieldSpec, errors: ValidationErrors | null): string | null {
  if (!errors) return null;
  const known = Object.keys(spec.messages).find((code) => errors[code] !== undefined);
  if (known) return spec.messages[known];
  // 沒列在 messages 的錯誤也不能漏掉：給一句通用的。
  return Object.keys(errors).length ? `${spec.label}的內容不正確` : null;
}

/** 依欄位順序列出所有無效的欄位。 */
export function collectFormErrors(
  controls: Readonly<Record<string, AbstractControl>>,
  specs: readonly FormFieldSpec[],
): FormFieldError[] {
  const result: FormFieldError[] = [];
  for (const spec of specs) {
    const control = controls[spec.key];
    if (!control || control.valid) continue;
    const message = fieldMessage(spec, control.errors);
    if (message) result.push({ key: spec.key, label: spec.label, message });
  }
  return result;
}

/** 必填，而且不能只有空白。 */
export const notBlank: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() === '' && control.value !== '' ? { blank: true } : null;

/**
 * 找出欄位裡可以聚焦的元素：輸入框、文字區、mat-select、單選鈕（選中的那一個，沒有就第一個）。
 * 欄位的外層元素要標 `data-field="<key>"`。
 */
export function focusTarget(root: ParentNode, key: string): HTMLElement | null {
  const field = root.querySelector<HTMLElement>(`[data-field="${key}"]`);
  if (!field) return null;
  return (
    field.querySelector<HTMLElement>('input[type="radio"]:checked') ??
    field.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, .mat-mdc-select[tabindex]') ??
    null
  );
}
