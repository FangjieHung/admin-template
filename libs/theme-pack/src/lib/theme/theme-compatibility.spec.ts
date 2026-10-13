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
    linen: { excluded: ['candy', 'oled', 'signal', 'riso-duo'], defaultThemeId: 'sandstone' },
    grid: { excluded: [], defaultThemeId: 'verdant' },
    'soft-ui': { excluded: ['sandstone', 'verdant', 'oled', 'signal', 'riso-duo'], defaultThemeId: 'cool-grey' },
    clay: {
      excluded: ['verdant', 'sandstone', 'azure', 'candy', 'mist-ink', 'glacier-blue', 'oled', 'signal', 'riso-duo'],
      defaultThemeId: 'cool-grey',
    },
    editorial: { excluded: ['cool-grey'], defaultThemeId: 'mist-ink' },
    frosted: { excluded: ['sandstone', 'cool-grey', 'signal', 'riso-duo'], defaultThemeId: 'candy' },
    aero: {
      excluded: ['verdant', 'midnight', 'sandstone', 'candy', 'graphite', 'oled', 'signal', 'riso-duo'],
      defaultThemeId: 'glacier-blue',
    },
    // ADR 0011 提案（待使用者定案）；Graphite、OLED 的格子是 ADR 0012 提案（待使用者定案）
    ledger: { excluded: ['candy', 'signal', 'riso-duo'], defaultThemeId: 'azure' },
    // ADR 0012 提案（待使用者定案）：只相容深色配色
    cockpit: {
      excluded: ['verdant', 'sandstone', 'azure', 'cool-grey', 'candy', 'mist-ink', 'glacier-blue', 'signal', 'riso-duo'],
      defaultThemeId: 'graphite',
    },
    // ADR 0014 提案（待使用者定案）：只相容保有彩度的淺色配色；Signal 另進 Material、Grid、Editorial（Riso 雙色是 ADR 0015 提案）
    brutal: {
      excluded: ['verdant', 'midnight', 'cool-grey', 'mist-ink', 'glacier-blue', 'graphite', 'oled', 'riso-duo'],
      defaultThemeId: 'signal',
    },
    // ADR 0015 提案（待使用者定案）：只相容兩種墨分得開的淺色配色；Riso 雙色另進 Material、Grid、Editorial
    riso: {
      excluded: ['verdant', 'midnight', 'azure', 'cool-grey', 'mist-ink', 'glacier-blue', 'graphite', 'oled'],
      defaultThemeId: 'riso-duo',
    },
    // ADR 0016 提案（待使用者定案）：淺色紙感配色＋Midnight（黑板／藍圖）
    sketch: {
      excluded: ['cool-grey', 'candy', 'graphite', 'oled'],
      defaultThemeId: 'sandstone',
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
