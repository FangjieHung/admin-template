/**
 * 一種介面語言。`id` 是程式裡用的代碼（字典的 key、存進 localStorage 的值）。
 */
export interface LocaleOption {
  id: string;
  /** 語言切換器上顯示的名稱，一律用該語言自己的寫法（繁體中文／English／日本語），不隨目前語言翻譯。 */
  nativeName: string;
  /** 給 `Intl` 與 Material `DateAdapter` 的 BCP 47 地區設定，例：`zh-TW`、`en-US`。 */
  intl: string;
  /** 寫進 `<html lang>` 的值（繁中要標 Hant，螢幕報讀與字型選擇才不會當成簡中）。 */
  htmlLang: string;
  /** 瀏覽器語言標籤（`navigator.languages` 的一項）是否屬於這個語言；比對前已轉小寫。 */
  matches: (tag: string) => boolean;
}

/**
 * 範本內建的三種示範語言：繁中、英文、日文。新專案依需求增減；第一筆是預設語言。
 * 繁中刻意不接受簡體標籤（zh-CN／zh-Hans）——與其給看不慣繁體的人繁中，不如往下找下一個偏好語言。
 */
export const DEFAULT_LOCALES: readonly LocaleOption[] = [
  {
    id: 'zh-TW',
    nativeName: '繁體中文',
    intl: 'zh-TW',
    htmlLang: 'zh-Hant-TW',
    matches: (tag) => tag === 'zh' || /^zh-(tw|hant|hk|mo)(-|$)/.test(tag),
  },
  { id: 'en', nativeName: 'English', intl: 'en-US', htmlLang: 'en', matches: (tag) => tag === 'en' || tag.startsWith('en-') },
  { id: 'ja', nativeName: '日本語', intl: 'ja-JP', htmlLang: 'ja', matches: (tag) => tag === 'ja' || tag.startsWith('ja-') },
];

/**
 * 依偏好順序把瀏覽器語言標籤對應到支援的語言，回傳第一個對得上的 `id`；都對不上時回 undefined，
 * 由呼叫端決定預設值。
 */
export function matchBrowserLocale(tags: readonly string[], locales: readonly LocaleOption[]): string | undefined {
  for (const raw of tags) {
    const tag = raw.toLowerCase();
    const hit = locales.find((locale) => locale.matches(tag));
    if (hit) return hit.id;
  }
  return undefined;
}
