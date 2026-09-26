import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import { DEFAULT_THEME } from './theme.token';

describe('ThemeService', () => {
  let svc: ThemeService;
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-paradigm');
    TestBed.configureTestingModule({});
    svc = TestBed.inject(ThemeService);
  });

  it('setTheme 同時改 signal、dataset、localStorage', () => {
    svc.setTheme('midnight');
    expect(svc.theme()).toBe('midnight');
    expect(document.documentElement.dataset['theme']).toBe('midnight');
    expect(localStorage.getItem('cr.theme')).toBe('midnight');
  });

  it('setParadigm 同時改 signal、dataset、localStorage', () => {
    svc.setParadigm('material');
    expect(svc.paradigm()).toBe('material');
    expect(document.documentElement.dataset['paradigm']).toBe('material');
    expect(localStorage.getItem('cr.paradigm')).toBe('material');
  });

  it('init 從 localStorage 還原；無值用預設', () => {
    localStorage.setItem('cr.theme', 'midnight');
    svc.init();
    expect(svc.theme()).toBe('midnight');
    expect(svc.paradigm()).toBe('material'); // 無值 → 預設
  });

  it('ADR 0007：切換質地時，目前配色若不相容該質地，改用該質地的預設配色', () => {
    svc.setTheme('sandstone');
    svc.setParadigm('soft-ui'); // soft-ui 不相容 sandstone
    expect(svc.theme()).toBe('cool-grey'); // soft-ui 的預設配色
    expect(document.documentElement.dataset['theme']).toBe('cool-grey');
    expect(localStorage.getItem('cr.theme')).toBe('cool-grey');
  });

  it('ADR 0007：切換質地時，目前配色若仍相容，維持原本配色不變', () => {
    svc.setTheme('midnight');
    svc.setParadigm('soft-ui'); // soft-ui 相容 midnight
    expect(svc.theme()).toBe('midnight');
  });

  it('ADR 0007：init 時 localStorage 存的組合不相容，自動校正為該質地的預設配色並持久化', () => {
    localStorage.setItem('cr.paradigm', 'soft-ui');
    localStorage.setItem('cr.theme', 'verdant'); // soft-ui 不相容 verdant
    svc.init();
    expect(svc.paradigm()).toBe('soft-ui');
    expect(svc.theme()).toBe('cool-grey');
    expect(localStorage.getItem('cr.theme')).toBe('cool-grey');
  });

  it('ADR 0007：init 時已存組合相容，維持原樣', () => {
    localStorage.setItem('cr.paradigm', 'soft-ui');
    localStorage.setItem('cr.theme', 'midnight');
    svc.init();
    expect(svc.theme()).toBe('midnight');
  });

  it('ADR 0007：compatibleThemes 只列出目前質地相容的配色，供 settings 頁與外觀浮動面板重用', () => {
    svc.setParadigm('soft-ui');
    const ids = svc.compatibleThemes().map((t) => t.id);
    expect(ids).not.toContain('sandstone');
    expect(ids).not.toContain('verdant');
    expect(ids).toContain('cool-grey');

    svc.setParadigm('material');
    expect(svc.compatibleThemes().map((t) => t.id)).toContain('verdant');
  });
});
