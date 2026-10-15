import { Injectable, InjectionToken, inject } from '@angular/core';
import {
  AccountPreferences,
  AccountProfile,
  AccountSession,
  NotificationChannelId,
  NotificationEventId,
  NotificationSettings,
  SecuritySettings,
  SettingsSaveError,
  WrongPasswordError,
} from './account-settings.model';
import { UserPreferencesStore } from '../../../core/user-preferences';

/**
 * 設定頁的資料存取層。畫面只透過這個類別讀寫，介面全部是非同步的：新專案換成 HTTP 時只改這一個檔案
 * （例如 `saveProfile()` 改成 `firstValueFrom(http.put('/api/me/profile', profile))`），頁面不用動。
 *
 * 示範版本把資料放在記憶體裡：存檔會真的改，切換分組後還在，重新整理頁面才恢復。
 * 每個呼叫模擬 300ms 的網路延遲（測試用 ACCOUNT_SETTINGS_DELAY 改成 0）。
 */

/** 模擬的網路延遲（毫秒）。 */
export const ACCOUNT_SETTINGS_DELAY = new InjectionToken<number>('ACCOUNT_SETTINGS_DELAY', {
  providedIn: 'root',
  factory: () => 300,
});

/** 即時儲存的示範開關（只在示範版本有意義，接後端後拿掉）。 */
export interface InstantSaveOptions {
  /** 模擬儲存失敗（網址帶 ?demo=fail）。 */
  simulateError?: boolean;
}

/** 示範：這一格第一次切換固定失敗一次，讓「失敗時還原」看得到。 */
export const DEMO_FAIL_ONCE_CELL = 'daily-digest.email';

/** 示範：目前密碼輸入這個字串時，變更密碼會失敗（目前密碼不正確）。 */
export const DEMO_WRONG_PASSWORD = 'wrong-password';

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

@Injectable({ providedIn: 'root' })
export class AccountSettingsRepository {
  private readonly delayMs = inject(ACCOUNT_SETTINGS_DELAY);
  private failOnceUsed = false;

  private profileData: AccountProfile = {
    displayName: '林雅婷',
    email: 'yating.lin@example.com',
    jobTitle: '專案經理',
    locale: 'zh-TW',
    timeZone: 'Asia/Taipei',
  };

  /** 偏好直接讀寫目前生效的那一份：存完，工單列表、詳情、儀表板與登入頁不必重新整理就套用。 */
  private readonly preferenceStore = inject(UserPreferencesStore);

  private notificationData: NotificationSettings = {
    paused: false,
    matrix: {
      assigned: { 'in-app': true, email: true },
      'status-changed': { 'in-app': true, email: false },
      commented: { 'in-app': true, email: false },
      'daily-digest': { 'in-app': false, email: true },
    },
  };

  private securityData: SecuritySettings = {
    twoFactor: false,
    sessions: [
      { id: 's-1', device: 'MacBook Pro · Chrome', icon: 'laptop_mac', location: '台北', lastActiveAt: hoursAgo(0), current: true },
      { id: 's-2', device: 'iPhone · Safari', icon: 'smartphone', location: '台北', lastActiveAt: hoursAgo(2), current: false },
      { id: 's-3', device: 'Windows 桌機 · Edge', icon: 'desktop_windows', location: '新竹', lastActiveAt: hoursAgo(74), current: false },
    ],
  };

  // ---- 個人資料 ----

  async profile(): Promise<AccountProfile> {
    await this.delay();
    return { ...this.profileData };
  }

  async saveProfile(profile: AccountProfile): Promise<AccountProfile> {
    await this.delay();
    this.profileData = { ...profile };
    return { ...this.profileData };
  }

  // ---- 偏好 ----

  async preferences(): Promise<AccountPreferences> {
    await this.delay();
    return { ...this.preferenceStore.value() };
  }

  async savePreferences(preferences: AccountPreferences): Promise<AccountPreferences> {
    await this.delay();
    this.preferenceStore.set(preferences);
    return { ...this.preferenceStore.value() };
  }

  // ---- 通知（即時儲存） ----

  async notifications(): Promise<NotificationSettings> {
    await this.delay();
    return structuredClone(this.notificationData);
  }

  async setNotification(
    event: NotificationEventId,
    channel: NotificationChannelId,
    enabled: boolean,
    options: InstantSaveOptions = {},
  ): Promise<void> {
    await this.delay();
    const cell = `${event}.${channel}`;
    if (options.simulateError) throw new SettingsSaveError();
    if (cell === DEMO_FAIL_ONCE_CELL && !this.failOnceUsed) {
      this.failOnceUsed = true;
      throw new SettingsSaveError();
    }
    this.notificationData.matrix[event][channel] = enabled;
  }

  async setNotificationsPaused(paused: boolean, options: InstantSaveOptions = {}): Promise<void> {
    await this.delay();
    if (options.simulateError) throw new SettingsSaveError();
    this.notificationData.paused = paused;
  }

  // ---- 安全性 ----

  async security(): Promise<SecuritySettings> {
    await this.delay();
    return structuredClone(this.securityData);
  }

  async setTwoFactor(enabled: boolean, options: InstantSaveOptions = {}): Promise<void> {
    await this.delay();
    if (options.simulateError) throw new SettingsSaveError();
    this.securityData.twoFactor = enabled;
  }

  /** 變更密碼。示範不保存密碼；目前密碼是 DEMO_WRONG_PASSWORD 時丟 WrongPasswordError。 */
  async changePassword(current: string, next: string): Promise<void> {
    await this.delay();
    if (current === DEMO_WRONG_PASSWORD) throw new WrongPasswordError();
    void next;
  }

  /** 登出某一台裝置（目前這台不能從這裡登出）。 */
  async signOutSession(id: string): Promise<AccountSession[]> {
    await this.delay();
    this.securityData.sessions = this.securityData.sessions.filter((s) => s.current || s.id !== id);
    return structuredClone(this.securityData.sessions);
  }

  // ---- 進階 ----

  /** 開始準備匯出檔（示範：什麼都不做）。 */
  async requestExport(): Promise<void> {
    await this.delay();
  }

  /** 送出刪除帳號（示範：什麼都不刪）。 */
  async deleteAccount(): Promise<void> {
    await this.delay();
  }

  private delay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.delayMs));
  }
}
