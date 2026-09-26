import { describe, it, expect } from 'vitest';
import {
  COLOR_THEMES,
  texture,
  getCompatibleThemeIds,
  getDefaultThemeId,
  isThemeCompatible,
} from './theme.token';

describe('theme-compatibility（ADR 0007，暫定清單）', () => {
  it('質地清單裡的每個質地都有相容清單與預設配色', () => {
    for (const t of texture) {
      const ids = getCompatibleThemeIds(t.id);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain(getDefaultThemeId(t.id));
    }
  });

  it('預設配色一定在該質地的相容清單內', () => {
    for (const t of texture) {
      expect(isThemeCompatible(t.id, getDefaultThemeId(t.id))).toBe(true);
    }
  });

  it('soft-ui 不相容 sandstone 與 verdant（暫定清單）', () => {
    expect(isThemeCompatible('soft-ui', 'sandstone')).toBe(false);
    expect(isThemeCompatible('soft-ui', 'verdant')).toBe(false);
  });

  it('soft-ui 的預設配色不是 verdant（因為不相容）', () => {
    expect(getDefaultThemeId('soft-ui')).not.toBe('verdant');
  });

  it('soft-ui 以外的質地暫定與全部配色相容', () => {
    const allIds = COLOR_THEMES.map((c) => c.id);
    for (const t of texture) {
      if (t.id === 'soft-ui') continue;
      expect(getCompatibleThemeIds(t.id)).toEqual(allIds);
    }
  });

  it('未知質地 fallback 為全部配色相容、預設配色為 DEFAULT_THEME', () => {
    expect(isThemeCompatible('unknown-texture', 'midnight')).toBe(true);
    expect(getDefaultThemeId('unknown-texture')).toBe('verdant');
  });
});
