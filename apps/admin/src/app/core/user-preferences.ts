import { Injectable, computed, signal } from '@angular/core';
import type { DateFormatId } from './date-utils';

export type { DateFormatId } from './date-utils';

/** 列表每頁筆數可選的值。 */
export type PageSize = 25 | 50 | 100;

/** 使用者的顯示偏好（設定頁「偏好」分組）。 */
export interface UserPreferences {
  /** 日期格式：工單樣板（列表、詳情、列印）與儀表板的日期。 */
  dateFormat: DateFormatId;
  /** 列表第一次打開時每頁幾筆：工單列表。 */
  pageSize: PageSize;
  /** 登入後先打開的頁面（網址，不含開頭的 /）：登入頁樣板。 */
  homePage: string;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = { dateFormat: 'ymd-slash', pageSize: 25, homePage: '' };

/**
 * 目前生效的使用者偏好。設定頁存檔後寫進來，用到的頁面讀 signal，存完不必重新整理就套用。
 *
 * 示範版放在記憶體裡（重新整理頁面恢復預設）；實際專案在登入後從後端讀一次使用者設定放進來，
 * 存檔時由設定頁的 repository 同時寫後端與這裡。
 *
 * 只給 lazy 頁面 inject：根層（app.config）與殼層不要 import 這個檔案（會進 Initial bundle）。
 */
@Injectable({ providedIn: 'root' })
export class UserPreferencesStore {
  private readonly state = signal<UserPreferences>(DEFAULT_USER_PREFERENCES);

  readonly value = this.state.asReadonly();
  readonly dateFormat = computed(() => this.state().dateFormat);
  readonly pageSize = computed(() => this.state().pageSize);
  readonly homePage = computed(() => this.state().homePage);

  set(preferences: UserPreferences): void {
    this.state.set({ ...preferences });
  }
}
