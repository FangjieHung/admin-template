import { describe, it, expect } from 'vitest';
import {
  COLOR_THEMES,
  texture,
  getCompatibleThemeIds,
  getDefaultThemeId,
  isThemeCompatible,
} from './theme.token';

describe('theme-compatibility（ADR 0007，2026-09-27 定案清單）', () => {
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

  // 設計定案：每個質地排除哪些配色、預設哪個配色。
  const DECISIONS: Record<string, { excluded: string[]; defaultThemeId: string }> = {
    material: { excluded: ['candy'], defaultThemeId: 'verdant' },
    linen: { excluded: ['candy', 'oled', 'signal'], defaultThemeId: 'sandstone' },
    grid: { excluded: [], defaultThemeId: 'verdant' },
    'soft-ui': { excluded: ['sandstone', 'verdant', 'oled', 'signal'], defaultThemeId: 'cool-grey' },
    clay: {
      excluded: ['verdant', 'sandstone', 'azure', 'candy', 'mist-ink', 'glacier-blue', 'oled', 'signal'],
      defaultThemeId: 'cool-grey',
    },
    editorial: { excluded: ['cool-grey'], defaultThemeId: 'mist-ink' },
    frosted: { excluded: ['sandstone', 'cool-grey', 'signal'], defaultThemeId: 'candy' },
    aero: {
      excluded: ['verdant', 'midnight', 'sandstone', 'candy', 'graphite', 'oled', 'signal'],
      defaultThemeId: 'glacier-blue',
    },
    // ADR 0011 提案（待使用者定案）；Graphite、OLED 的格子是 ADR 0012 提案（待使用者定案）
    ledger: { excluded: ['candy', 'signal'], defaultThemeId: 'azure' },
    // ADR 0012 提案（待使用者定案）：只相容深色配色
    cockpit: {
      excluded: ['verdant', 'sandstone', 'azure', 'cool-grey', 'candy', 'mist-ink', 'glacier-blue', 'signal'],
      defaultThemeId: 'graphite',
    },
    // ADR 0014 提案（待使用者定案）：只相容保有彩度的淺色配色；Signal 另進 Material、Grid、Editorial
    brutal: {
      excluded: ['verdant', 'midnight', 'cool-grey', 'mist-ink', 'glacier-blue', 'graphite', 'oled'],
      defaultThemeId: 'signal',
    },
  };

  it('每個質地都有一筆定案', () => {
    expect(Object.keys(DECISIONS).sort()).toEqual(texture.map((t) => t.id).sort());
  });

  for (const [textureId, d] of Object.entries(DECISIONS)) {
    it(`${textureId}：相容清單 = 全部扣掉 [${d.excluded.join(', ')}]，預設 ${d.defaultThemeId}`, () => {
      const expected = COLOR_THEMES.map((c) => c.id).filter((id) => !d.excluded.includes(id));
      expect(getCompatibleThemeIds(textureId)).toEqual(expected);
      expect(getDefaultThemeId(textureId)).toBe(d.defaultThemeId);
    });
  }

  it('未知質地 fallback 為全部配色相容、預設配色為 DEFAULT_THEME', () => {
    expect(isThemeCompatible('unknown-texture', 'midnight')).toBe(true);
    expect(getDefaultThemeId('unknown-texture')).toBe('verdant');
  });
});
