import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * 新密碼的規則（畫面上的清單會即時打勾）與強度提示。新專案依自己的密碼政策改這個檔案；
 * 伺服器一定要再檢查一次，前端只是提示。
 */

export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordRule {
  id: 'length' | 'letter' | 'digit' | 'different';
  label: string;
  test: (next: string, current: string) => boolean;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: 'length', label: `至少 ${PASSWORD_MIN_LENGTH} 個字元`, test: (next) => next.length >= PASSWORD_MIN_LENGTH },
  { id: 'letter', label: '包含英文字母', test: (next) => /[A-Za-z]/.test(next) },
  { id: 'digit', label: '包含數字', test: (next) => /\d/.test(next) },
  { id: 'different', label: '跟目前的密碼不同', test: (next, current) => next.length > 0 && next !== current },
];

export interface PasswordRuleState {
  id: PasswordRule['id'];
  label: string;
  met: boolean;
}

export function checkPasswordRules(next: string, current: string): PasswordRuleState[] {
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, met: rule.test(next, current) }));
}

export type PasswordStrength = 'weak' | 'fair' | 'strong';

export const PASSWORD_STRENGTH_LABELS: Readonly<Record<PasswordStrength, string>> = {
  weak: '弱',
  fair: '中',
  strong: '強',
};

/**
 * 粗略的強度提示：長度、大小寫、數字、符號各加分。只是提示，不擋存檔（擋存檔的是上面的規則）。
 * 空字串回 null（不顯示強度）。
 */
export function passwordStrength(value: string): PasswordStrength | null {
  if (!value) return null;
  let score = 0;
  if (value.length >= PASSWORD_MIN_LENGTH) score++;
  if (value.length >= 12) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  if (score >= 4) return 'strong';
  if (score >= 2) return 'fair';
  return 'weak';
}

/**
 * 新密碼欄位的驗證：任何一條規則沒過就是 `{ passwordRules: [沒過的規則 id] }`。
 * 「跟目前的密碼不同」要讀同一個表單群組的 `current` 欄位。
 */
export const passwordRulesValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const next = String(control.value ?? '');
  if (!next) return null; // 空白交給 required
  const current = String(control.parent?.get('current')?.value ?? '');
  const unmet = checkPasswordRules(next, current).filter((r) => !r.met).map((r) => r.id);
  return unmet.length ? { passwordRules: unmet } : null;
};

/** 確認新密碼：要跟同一個表單群組的 `next` 一樣。 */
export const matchesNewPasswordValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  if (!value) return null;
  const next = String(control.parent?.get('next')?.value ?? '');
  return value === next ? null : { mismatch: true };
};
