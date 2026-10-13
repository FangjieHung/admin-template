import { describe, it, expect } from 'vitest';
import { DEFAULT_LOCALES, matchBrowserLocale } from './locale';

describe('matchBrowserLocale', () => {
  it('繁體標籤（zh-TW／zh-Hant／zh-HK）對應到繁中', () => {
    expect(matchBrowserLocale(['zh-TW'], DEFAULT_LOCALES)).toBe('zh-TW');
    expect(matchBrowserLocale(['zh-Hant-TW'], DEFAULT_LOCALES)).toBe('zh-TW');
    expect(matchBrowserLocale(['zh-HK'], DEFAULT_LOCALES)).toBe('zh-TW');
  });

  it('英文與日文的各地區標籤對應到 en／ja', () => {
    expect(matchBrowserLocale(['en-GB'], DEFAULT_LOCALES)).toBe('en');
    expect(matchBrowserLocale(['ja-JP'], DEFAULT_LOCALES)).toBe('ja');
  });

  it('簡體中文不當成繁中，繼續往下找下一個偏好語言', () => {
    expect(matchBrowserLocale(['zh-CN', 'en-US'], DEFAULT_LOCALES)).toBe('en');
    expect(matchBrowserLocale(['zh-Hans'], DEFAULT_LOCALES)).toBeUndefined();
  });

  it('依偏好順序取第一個支援的語言；都不支援時回 undefined', () => {
    expect(matchBrowserLocale(['ko-KR', 'ja', 'en'], DEFAULT_LOCALES)).toBe('ja');
    expect(matchBrowserLocale(['ko-KR', 'fr'], DEFAULT_LOCALES)).toBeUndefined();
    expect(matchBrowserLocale([], DEFAULT_LOCALES)).toBeUndefined();
  });

  it('繁中的 html lang 標 Hant，避免被當成簡中', () => {
    expect(DEFAULT_LOCALES[0].htmlLang).toBe('zh-Hant-TW');
  });
});
