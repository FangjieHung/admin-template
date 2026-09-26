import { Injectable, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  COLOR_THEMES,
  DEFAULT_PARADIGM,
  DEFAULT_THEME,
  PARADIGM_KEY,
  THEME_KEY,
  getDefaultThemeId,
  isThemeCompatible,
  type ThemeOption,
} from './theme.token';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private doc = inject(DOCUMENT);
  readonly paradigm = signal(DEFAULT_PARADIGM);
  readonly theme = signal(DEFAULT_THEME);

  // ADR 0007：質地是主軸，配色只顯示目前質地的相容清單。ticket 03 的外觀浮動面板重用這個 computed，不重抄過濾邏輯。
  readonly compatibleThemes = computed<ThemeOption[]>(() => {
    const paradigmId = this.paradigm();
    return COLOR_THEMES.filter((c) => isThemeCompatible(paradigmId, c.id));
  });

  init(): void {
    const paradigmId = localStorage.getItem(PARADIGM_KEY) ?? DEFAULT_PARADIGM;
    this.paradigm.set(paradigmId);
    this.doc.documentElement.dataset['paradigm'] = paradigmId;
    localStorage.setItem(PARADIGM_KEY, paradigmId);

    // 載入時若已存的組合不相容，自動校正為該質地的預設配色（setTheme 會一併持久化）。
    const storedThemeId = localStorage.getItem(THEME_KEY) ?? DEFAULT_THEME;
    const themeId = isThemeCompatible(paradigmId, storedThemeId)
      ? storedThemeId
      : getDefaultThemeId(paradigmId);
    this.setTheme(themeId);
  }

  setParadigm(id: string): void {
    this.paradigm.set(id);
    this.doc.documentElement.dataset['paradigm'] = id;
    localStorage.setItem(PARADIGM_KEY, id);

    // 切換質地時，若目前配色不相容新質地，改用該質地的預設配色。
    if (!isThemeCompatible(id, this.theme())) {
      this.setTheme(getDefaultThemeId(id));
    }
  }

  setTheme(id: string): void {
    this.theme.set(id);
    this.doc.documentElement.dataset['theme'] = id;
    localStorage.setItem(THEME_KEY, id);
  }
}
