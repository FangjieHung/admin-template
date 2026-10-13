import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/core';
import { DateAdapter, provideNativeDateAdapter } from '@angular/material/core';
import { I18nService, provideI18n } from './i18n.service';

const MESSAGES = {
  'zh-TW': { title: '專案清單' },
  en: { title: 'Projects' },
  ja: { title: 'プロジェクト' },
};

describe('I18nService（沒有 provideI18n）', () => {
  let i18n: I18nService;

  beforeEach(() => {
    localStorage.clear();
    i18n = TestBed.inject(I18nService);
  });

  it('固定預設語言（清單第一筆），不讀也不寫 localStorage', () => {
    expect(i18n.locale()).toBe('zh-TW');
    i18n.setLocale('en');
    TestBed.tick();
    expect(localStorage.length).toBe(0);
  });

  it('translate() 跟著語言切換；不認得的語言 id 會被忽略', () => {
    const t = i18n.translate(MESSAGES);
    expect(t().title).toBe('專案清單');
    i18n.setLocale('ja');
    expect(t().title).toBe('プロジェクト');
    i18n.setLocale('ko');
    expect(i18n.locale()).toBe('ja');
  });

  it('字典缺少目前語言時退回預設語言', () => {
    const t = i18n.translate<{ title: string }>({ 'zh-TW': { title: '只有中文' } });
    i18n.setLocale('en');
    expect(t().title).toBe('只有中文');
  });

  it('日期、月份、數字依語言格式化；YYYY-MM-DD 當作當地日期', () => {
    expect(i18n.date('2026-09-01')).toBe('2026/09/01');
    expect(i18n.number(12345.678)).toBe('12,345.68');
    expect(i18n.number(Number.NaN)).toBe('—');
    i18n.setLocale('en');
    expect(i18n.date('2026-09-22')).toBe('09/22/2026');
    expect(i18n.month(new Date(2026, 8, 1))).toBe('September 2026');
  });
});

describe('provideI18n', () => {
  afterEach(() => localStorage.clear());

  function setup(storedLocale?: string) {
    localStorage.clear();
    if (storedLocale) localStorage.setItem('app.locale', storedLocale);
    TestBed.configureTestingModule({ providers: [provideNativeDateAdapter(), provideI18n({ detectBrowser: false })] });
    return TestBed.inject(I18nService);
  }

  it('沿用上次的選擇，並同步 <html lang> 與 DateAdapter', () => {
    const i18n = setup('ja');
    TestBed.tick();
    expect(i18n.locale()).toBe('ja');
    expect(TestBed.inject(DOCUMENT).documentElement.lang).toBe('ja');
    expect((TestBed.inject(DateAdapter) as unknown as { locale: string }).locale).toBe('ja-JP');
  });

  it('切換後記住選擇', () => {
    const i18n = setup();
    i18n.setLocale('en');
    TestBed.tick();
    expect(localStorage.getItem('app.locale')).toBe('en');
  });

  it('存的是不支援的語言時用預設語言', () => {
    const i18n = setup('fr');
    expect(i18n.locale()).toBe('zh-TW');
  });
});
