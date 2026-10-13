import {
  DOCUMENT,
  EnvironmentProviders,
  Injectable,
  InjectionToken,
  Signal,
  computed,
  effect,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
  signal,
} from '@angular/core';
import { DateAdapter } from '@angular/material/core';
import { DEFAULT_LOCALES, LocaleOption, matchBrowserLocale } from './locale';

/** `provideI18n()`／`I18N_CONFIG` 的設定；全部選填。 */
export interface I18nConfig {
  /** 支援的語言，第一筆是預設語言。預設 `DEFAULT_LOCALES`（繁中、英文、日文）。 */
  locales?: readonly LocaleOption[];
  /** 預設語言的 id；預設是 `locales` 的第一筆。 */
  defaultLocale?: string;
  /** 記住使用者選擇的 localStorage key；`null` 代表不記住。預設 `app.locale`。 */
  storageKey?: string | null;
  /** 沒有記住的選擇時，是否依瀏覽器偏好語言決定初始語言。預設 true。 */
  detectBrowser?: boolean;
  /**
   * 是否把語言同步到 `<html lang>` 與 Material 的 `DateAdapter`（月曆星期標題、日期格式）。預設 true。
   * 只翻譯頁面局部（例如示範區塊）時設 false，避免整份文件的語言被改掉。
   */
  syncDocument?: boolean;
}

export const I18N_CONFIG = new InjectionToken<I18nConfig>('I18N_CONFIG');

/** `YYYY-MM-DD`（可帶時間）當作當地日期解讀；直接 `new Date('2026-09-22')` 會被當成 UTC 午夜，在 UTC 以西會變前一天。 */
function toLocalDate(value: string | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function readStored(key: string | null): string | null {
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string | null, value: string): void {
  if (!key) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // 無痕模式或儲存空間被封鎖時記不住選擇，不影響當下的顯示。
  }
}

/**
 * 介面語言的狀態、字典查詢與格式化。
 *
 * - 語言是 signal：模板裡讀 `t()`（`translate()` 回傳的 computed）會跟著切換，不必重新整理頁面。
 * - 字典由各功能自己定義（每種語言一份同形狀的物件），用 `translate(dict)` 取得目前語言那一份；
 *   本服務不持有任何文字。
 * - 沒有呼叫 `provideI18n()`（也沒有提供 `I18N_CONFIG`）時：固定預設語言、不偵測、不記住、不改 `<html lang>`。
 *
 * 用法：整個 app 一種語言 → `app.config.ts` 加 `provideI18n()`；
 * 只有某個區塊要切換 → 該元件 `providers: [{ provide: I18N_CONFIG, useValue: { syncDocument: false, storageKey: null } }, I18nService]`。
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly config = inject(I18N_CONFIG, { optional: true });

  /** 支援的語言清單（語言切換器依這份清單列出選項）。 */
  readonly locales: readonly LocaleOption[] = this.config?.locales ?? DEFAULT_LOCALES;
  readonly defaultLocale: string = this.config?.defaultLocale ?? this.locales[0].id;

  private readonly storageKey = this.config ? (this.config.storageKey === undefined ? 'app.locale' : this.config.storageKey) : null;

  private readonly _locale = signal<string>(this.initialLocale());
  /** 目前語言的 id。 */
  readonly locale = this._locale.asReadonly();
  /** 目前語言的完整資料。 */
  readonly current = computed<LocaleOption>(() => this.find(this._locale()) ?? this.locales[0]);

  private readonly numberFormat = computed(() => new Intl.NumberFormat(this.current().intl, { maximumFractionDigits: 2 }));
  private readonly dateFormat = computed(
    () => new Intl.DateTimeFormat(this.current().intl, { year: 'numeric', month: '2-digit', day: '2-digit' }),
  );
  private readonly monthFormat = computed(() => new Intl.DateTimeFormat(this.current().intl, { year: 'numeric', month: 'long' }));

  constructor() {
    if (!this.config) return;
    const syncDocument = this.config.syncDocument ?? true;
    const document = inject(DOCUMENT);
    const dateAdapter = syncDocument ? inject(DateAdapter, { optional: true }) : null;
    effect(() => {
      const info = this.current();
      if (syncDocument) {
        document.documentElement.lang = info.htmlLang;
        dateAdapter?.setLocale(info.intl);
      }
      writeStored(this.storageKey, info.id);
    });
  }

  /** 切換語言；不在 `locales` 裡的 id 會被忽略。 */
  setLocale(id: string): void {
    if (this.find(id)) this._locale.set(id);
  }

  /**
   * 取得字典裡目前語言的那一份；缺少該語言時退回預設語言。
   * 在元件欄位初始化時呼叫一次即可：`protected readonly t = inject(I18nService).translate(MESSAGES);`，模板讀 `t().title`。
   */
  translate<M>(dictionary: Readonly<Record<string, M>>): Signal<M> {
    return computed(() => dictionary[this._locale()] ?? dictionary[this.defaultLocale]);
  }

  /** 數字：千分位依語言，最多兩位小數。非有限數回 `—`。 */
  number(value: number | null | undefined): string {
    return value == null || !Number.isFinite(value) ? '—' : this.numberFormat().format(value);
  }

  /** 日期（不含時間）：繁中／日文 `2026/09/22`，英文 `09/22/2026`。無法解讀時回空字串。 */
  date(value: string | Date | null | undefined): string {
    if (!value) return '';
    const date = toLocalDate(value);
    return date ? this.dateFormat().format(date) : '';
  }

  /** 月份標題：繁中／日文 `2026年9月`，英文 `September 2026`。 */
  month(value: Date): string {
    return this.monthFormat().format(value);
  }

  private find(id: string | null | undefined): LocaleOption | undefined {
    return this.locales.find((locale) => locale.id === id);
  }

  private initialLocale(): string {
    const stored = readStored(this.storageKey);
    if (this.find(stored)) return stored as string;
    if (this.config && (this.config.detectBrowser ?? true) && typeof navigator !== 'undefined') {
      const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
      const detected = matchBrowserLocale(tags, this.locales);
      if (detected) return detected;
    }
    return this.defaultLocale;
  }
}

/**
 * 整個 app 啟用多語：偵測初始語言（上次的選擇 → 瀏覽器偏好 → 預設）、記住選擇，
 * 並同步 `<html lang>` 與 Material `DateAdapter`。放在 `app.config.ts` 的 `providers`。
 */
export function provideI18n(config: I18nConfig = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: I18N_CONFIG, useValue: config },
    I18nService,
    provideEnvironmentInitializer(() => {
      inject(I18nService);
    }),
  ]);
}
