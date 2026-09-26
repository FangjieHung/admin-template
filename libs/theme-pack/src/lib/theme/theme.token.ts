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
// 這份清單是暫定版（issue #02）：全部相容，僅 Soft UI 不相容 Sandstone、Verdant；定案見 issue #09。
// 相容清單只存在這一處，settings 頁與之後的外觀浮動面板（ticket 03）都透過 ThemeService 讀取，不重抄清單。
export interface TextureCompatibility {
  readonly compatibleThemeIds: readonly string[];
  readonly defaultThemeId: string;
}

const ALL_COLOR_THEME_IDS: readonly string[] = COLOR_THEMES.map((c) => c.id);

export const TEXTURE_COMPATIBILITY: Record<string, TextureCompatibility> = {
  material: { compatibleThemeIds: ALL_COLOR_THEME_IDS, defaultThemeId: 'verdant' },
  linen: { compatibleThemeIds: ALL_COLOR_THEME_IDS, defaultThemeId: 'verdant' },
  grid: { compatibleThemeIds: ALL_COLOR_THEME_IDS, defaultThemeId: 'verdant' },
  'soft-ui': {
    // Soft UI 的陰影是冷灰藍調（rgb 163 177 198），跟暖沙 Sandstone、偏亮綠的 Verdant 對比不足；
    // 預設改用色調相近的 Cool Grey。
    compatibleThemeIds: ALL_COLOR_THEME_IDS.filter((id) => id !== 'sandstone' && id !== 'verdant'),
    defaultThemeId: 'cool-grey',
  },
  clay: { compatibleThemeIds: ALL_COLOR_THEME_IDS, defaultThemeId: 'verdant' },
  editorial: { compatibleThemeIds: ALL_COLOR_THEME_IDS, defaultThemeId: 'verdant' },
  frosted: { compatibleThemeIds: ALL_COLOR_THEME_IDS, defaultThemeId: 'verdant' },
};

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
