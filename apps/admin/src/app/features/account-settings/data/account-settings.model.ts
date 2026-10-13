/**
 * 設定頁樣板的資料型別與選項清單。示範資料一律中性；新專案換成自己的欄位與選項。
 */

// ---- 分組 ----

export type SettingsSectionId = 'profile' | 'notifications' | 'security' | 'preferences' | 'advanced';

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  /** Material Symbols 圖示名稱。 */
  icon: string;
}

/** 左側導覽的分組，依畫面順序；網址是 /templates/settings/<id>。 */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { id: 'profile', label: '個人資料', icon: 'person' },
  { id: 'notifications', label: '通知', icon: 'notifications' },
  { id: 'security', label: '安全性', icon: 'lock' },
  { id: 'preferences', label: '偏好', icon: 'tune' },
  { id: 'advanced', label: '進階', icon: 'warning' },
];

// ---- 個人資料（明確存檔） ----

export const DISPLAY_NAME_MAX = 40;
export const JOB_TITLE_MAX = 40;

export interface AccountProfile {
  displayName: string;
  email: string;
  jobTitle: string;
  /** 介面語言：libs/ui i18n 的語系 id（DEFAULT_LOCALES）。 */
  locale: string;
  /** IANA 時區名稱。 */
  timeZone: string;
}

export interface TimeZoneOption {
  id: string;
  label: string;
}

export const TIME_ZONES: readonly TimeZoneOption[] = [
  { id: 'Asia/Taipei', label: '(UTC+08:00) 台北' },
  { id: 'Asia/Tokyo', label: '(UTC+09:00) 東京' },
  { id: 'Asia/Singapore', label: '(UTC+08:00) 新加坡' },
  { id: 'Europe/London', label: '(UTC+00:00) 倫敦' },
  { id: 'America/New_York', label: '(UTC-05:00) 紐約' },
  { id: 'America/Los_Angeles', label: '(UTC-08:00) 洛杉磯' },
  { id: 'Etc/UTC', label: '(UTC+00:00) 協調世界時' },
];

// ---- 通知（即時儲存） ----

export type NotificationEventId = 'assigned' | 'status-changed' | 'commented' | 'daily-digest';
export type NotificationChannelId = 'in-app' | 'email';

export interface NotificationEvent {
  id: NotificationEventId;
  label: string;
  description: string;
}

export interface NotificationChannel {
  id: NotificationChannelId;
  label: string;
}

export const NOTIFICATION_EVENTS: readonly NotificationEvent[] = [
  { id: 'assigned', label: '被指派', description: '有人把工作指派給你' },
  { id: 'status-changed', label: '狀態變更', description: '你負責或關注的項目換了狀態' },
  { id: 'commented', label: '有人留言', description: '你參與的項目有新留言或提到你' },
  { id: 'daily-digest', label: '每日摘要', description: '每天早上一封，整理前一天的動態' },
];

export const NOTIFICATION_CHANNELS: readonly NotificationChannel[] = [
  { id: 'in-app', label: '站內' },
  { id: 'email', label: 'Email' },
];

export type NotificationMatrix = Record<NotificationEventId, Record<NotificationChannelId, boolean>>;

export interface NotificationSettings {
  /** 全部暫停：開啟時不送任何通知，個別設定保留。 */
  paused: boolean;
  matrix: NotificationMatrix;
}

// ---- 安全性 ----

export interface AccountSession {
  id: string;
  /** 裝置與瀏覽器，例：「MacBook Pro · Chrome」。 */
  device: string;
  /** Material Symbols 圖示名稱。 */
  icon: string;
  location: string;
  /** 最後活動時間（ISO 字串）。 */
  lastActiveAt: string;
  /** 目前正在用的這台：不能從這裡登出。 */
  current: boolean;
}

export interface SecuritySettings {
  twoFactor: boolean;
  sessions: AccountSession[];
}

// ---- 偏好（明確存檔） ----

export type DateFormatId = 'ymd-slash' | 'ymd-dash' | 'dmy-slash' | 'mdy-slash';
export type PageSize = 25 | 50 | 100;

export interface DateFormatOption {
  id: DateFormatId;
  label: string;
}

export const DATE_FORMATS: readonly DateFormatOption[] = [
  { id: 'ymd-slash', label: '年/月/日' },
  { id: 'ymd-dash', label: '年-月-日' },
  { id: 'dmy-slash', label: '日/月/年' },
  { id: 'mdy-slash', label: '月/日/年' },
];

export const PAGE_SIZES: readonly PageSize[] = [25, 50, 100];

export interface HomePageOption {
  /** 網址（不含開頭的 /）。 */
  route: string;
  label: string;
}

/** 「開啟時的預設首頁」可以選的頁面；新專案換成自己的主要頁面。 */
export const HOME_PAGES: readonly HomePageOption[] = [
  { route: '', label: '首頁' },
  { route: 'templates/dashboard', label: '儀表板' },
  { route: 'templates/tickets', label: '工單列表' },
];

export interface AccountPreferences {
  dateFormat: DateFormatId;
  pageSize: PageSize;
  homePage: string;
}

/** 用選擇的日期格式顯示一個日期（偏好頁的「範例」）。 */
export function formatDateWith(format: DateFormatId, date: Date): string {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  switch (format) {
    case 'ymd-dash':
      return `${y}-${m}-${d}`;
    case 'dmy-slash':
      return `${d}/${m}/${y}`;
    case 'mdy-slash':
      return `${m}/${d}/${y}`;
    default:
      return `${y}/${m}/${d}`;
  }
}

/** 即時儲存失敗（示範）。 */
export class SettingsSaveError extends Error {
  constructor(message = '儲存失敗（示範）') {
    super(message);
    this.name = 'SettingsSaveError';
  }
}

/** 變更密碼時目前密碼不對（示範：目前密碼輸入「wrong-password」時）。 */
export class WrongPasswordError extends Error {
  constructor() {
    super('目前密碼不正確（示範）');
    this.name = 'WrongPasswordError';
  }
}
