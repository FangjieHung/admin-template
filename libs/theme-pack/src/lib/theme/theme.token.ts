export interface ThemeOption {
  id: string;
  label: string;
}

export const texture: ThemeOption[] = [
  { id: 'material', label: 'Material' },
  { id: 'linen', label: 'Linen 紙感' },
  { id: 'grid', label: 'Grid 網格' },
  { id: 'soft-ui', label: 'Soft UI 浮雕' },
  { id: 'clay', label: 'Clay 立體軟陶' },
  { id: 'editorial', label: 'Editorial 編輯式極簡' },
  { id: 'frosted', label: 'Frosted 霧光玻璃' },
  { id: 'aero', label: 'Aero 雲霧玻璃' },
];

export const COLOR_THEMES: ThemeOption[] = [
  { id: 'verdant', label: 'Verdant 綠' },
  { id: 'midnight', label: 'Midnight 深' },
  { id: 'sandstone', label: 'Sandstone 暖沙' },
  { id: 'azure', label: 'Azure 清亮藍' },
  { id: 'cool-grey', label: 'Cool Grey 冷灰' },
  { id: 'candy', label: 'Candy 糖果色' },
  { id: 'mist-ink', label: 'Mist Ink 霧藍墨色' },
  { id: 'glacier-blue', label: 'Glacier Blue 冰霧藍' },
];

export const DEFAULT_PARADIGM = 'material';
export const DEFAULT_THEME = 'verdant';

export const PARADIGM_KEY = 'cr.paradigm';
export const THEME_KEY = 'cr.theme';

// ADR 0007：質地是主軸，每個質地宣告自己的相容配色（白名單）與一個預設配色。
// 清單於 2026-09-27 由設計定案（ticket 09），依據是美感；56 格對比已全數合格（ticket 15）。
// 相容清單只存在這一處，settings 頁與之後的外觀浮動面板（ticket 03）都透過 ThemeService 讀取，不重抄清單。
export interface TextureCompatibility {
  readonly compatibleThemeIds: readonly string[];
  readonly defaultThemeId: string;
}

const ALL_COLOR_THEME_IDS: readonly string[] = COLOR_THEMES.map((c) => c.id);

// 白名單一律逐一列出（ADR 0007 第 1 條）：新增配色時不會自動出現在任何質地，要逐一加進來。
export const TEXTURE_COMPATIBILITY: Record<string, TextureCompatibility> = {
  // 排除 Candy
  material: {
    compatibleThemeIds: ['verdant', 'midnight', 'sandstone', 'azure', 'cool-grey', 'mist-ink', 'glacier-blue'],
    defaultThemeId: 'verdant',
  },
  // 排除 Candy
  linen: {
    compatibleThemeIds: ['verdant', 'midnight', 'sandstone', 'azure', 'cool-grey', 'mist-ink', 'glacier-blue'],
    defaultThemeId: 'sandstone',
  },
  // 全部相容
  grid: {
    compatibleThemeIds: ['verdant', 'midnight', 'sandstone', 'azure', 'cool-grey', 'candy', 'mist-ink', 'glacier-blue'],
    defaultThemeId: 'verdant',
  },
  // 排除 Sandstone、Verdant
  'soft-ui': {
    compatibleThemeIds: ['midnight', 'azure', 'cool-grey', 'candy', 'mist-ink', 'glacier-blue'],
    defaultThemeId: 'cool-grey',
  },
  // 只保留 Midnight、Cool Grey
  clay: { compatibleThemeIds: ['midnight', 'cool-grey'], defaultThemeId: 'cool-grey' },
  // 排除 Cool Grey
  editorial: {
    compatibleThemeIds: ['verdant', 'midnight', 'sandstone', 'azure', 'candy', 'mist-ink', 'glacier-blue'],
    defaultThemeId: 'mist-ink',
  },
  // 排除 Sandstone、Cool Grey
  frosted: {
    compatibleThemeIds: ['verdant', 'midnight', 'azure', 'candy', 'mist-ink', 'glacier-blue'],
    defaultThemeId: 'candy',
  },
  // 高亮度雲霧玻璃只搭配冷調、淺色畫布；深色與暖沙會讓透明層失去參考圖的空氣感。
  aero: {
    compatibleThemeIds: ['azure', 'cool-grey', 'mist-ink', 'glacier-blue'],
    defaultThemeId: 'glacier-blue',
  },
};

/** 不認得的質地 id（已刪除的質地殘留在 localStorage、拼錯）一律退回 DEFAULT_PARADIGM。 */
export function resolveParadigmId(id: string | null | undefined): string {
  return texture.some((t) => t.id === id) ? (id as string) : DEFAULT_PARADIGM;
}

/** 某個質地的相容配色 id 清單；未知質地 fallback 為全部配色相容。 */
export function getCompatibleThemeIds(paradigmId: string): readonly string[] {
  return TEXTURE_COMPATIBILITY[paradigmId]?.compatibleThemeIds ?? ALL_COLOR_THEME_IDS;
}

/** 某個質地的預設配色 id；未知質地 fallback 為 DEFAULT_THEME。 */
export function getDefaultThemeId(paradigmId: string): string {
  return TEXTURE_COMPATIBILITY[paradigmId]?.defaultThemeId ?? DEFAULT_THEME;
}

/** 某個配色是否在該質地的相容清單內。 */
export function isThemeCompatible(paradigmId: string, themeId: string): boolean {
  return getCompatibleThemeIds(paradigmId).includes(themeId);
}
