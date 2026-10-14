import { AbstractControl } from '@angular/forms';

/** 一個無效欄位：控制項路徑（巢狀用 `a.b`）與畫面上的標籤（沒有提供標籤時是 null）。 */
export interface StepWizardFieldError {
  path: string;
  label: string | null;
}

/** 依表單裡的順序列出所有無效的「最底層」控制項路徑（群組本身不算；停用的控制項 Angular 不算無效）。 */
export function invalidControlPaths(control: AbstractControl | null | undefined, prefix = ''): string[] {
  if (!control || !control.invalid) return [];
  const children = (control as { controls?: unknown }).controls;
  if (children && typeof children === 'object') {
    const entries = Array.isArray(children)
      ? children.map((child, i) => [String(i), child] as const)
      : Object.entries(children as Record<string, AbstractControl>);
    const nested = entries.flatMap(([key, child]) =>
      invalidControlPaths(child as AbstractControl, prefix ? `${prefix}.${key}` : key),
    );
    // 群組自己的驗證失敗（例如「結束日不能早於開始日」）但每個子欄位都有效：不列欄位，由摘要標題說明。
    return nested;
  }
  return prefix ? [prefix] : [];
}

/**
 * 錯誤摘要要列出的欄位：有提供標籤的依 `fieldLabels` 的順序排前面，其餘無效欄位接在後面（沒有標籤，只計數）。
 */
export function collectFieldErrors(
  control: AbstractControl | null | undefined,
  fieldLabels: Readonly<Record<string, string>>,
): StepWizardFieldError[] {
  const paths = invalidControlPaths(control);
  const labelled = Object.keys(fieldLabels)
    .filter((path) => paths.includes(path))
    .map((path) => ({ path, label: fieldLabels[path] }));
  const rest = paths.filter((path) => !(path in fieldLabels)).map((path) => ({ path, label: null }));
  return [...labelled, ...rest];
}

const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), ' +
  '[tabindex]:not([tabindex="-1"]), button:not([disabled])';

/**
 * 找出欄位裡可以聚焦的元素：先找 `[data-field="路徑"]`，再找 `[formControlName="最後一段名稱"]`；
 * 元素本身可以聚焦（輸入框、mat-select）就用它，否則用裡面第一個可以聚焦的元素。
 */
export function findFieldFocusTarget(root: ParentNode, path: string): HTMLElement | null {
  const name = path.split('.').pop() ?? path;
  const field =
    root.querySelector<HTMLElement>(`[data-field="${cssEscape(path)}"]`) ??
    root.querySelector<HTMLElement>(`[formControlName="${cssEscape(name)}"]`) ??
    root.querySelector<HTMLElement>(`[formcontrolname="${cssEscape(name)}"]`);
  if (!field) return null;
  if (field.matches(FOCUSABLE)) return field;
  return field.querySelector<HTMLElement>(FOCUSABLE);
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&');
}
