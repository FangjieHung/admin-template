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
  { id: 'ledger', label: 'Ledger 帳冊' },
  { id: 'cockpit', label: 'Cockpit 儀表艙' },
  { id: 'brutal', label: 'Brutal 新粗野' },
  { id: 'riso', label: 'Riso 孔版' },
  { id: 'sketch', label: 'Sketch 手繪' },
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
  { id: 'graphite', label: 'Graphite 石墨橘' },
  { id: 'oled', label: 'OLED 純黑' },
  { id: 'signal', label: 'Signal 訊號色' },
  { id: 'riso-duo', label: 'Riso 雙色' },
];

export const DEFAULT_PARADIGM = 'material';
export const DEFAULT_THEME = 'verdant';

export const PARADIGM_KEY = 'app.paradigm';
export const THEME_KEY = 'app.theme';

// ADR 0010：常駐質地編進主樣式（一打開就有，也是按需質地載入失敗時的退路）；其餘質地都是按需質地，
// 各自編成 `texture-<id>.css`（apps/admin/project.json 的 styles，`inject: false`），用到時才下載。
// 新增質地預設就是按需，不用改這裡。admin index.html 的開機腳本有一份按需質地 id 清單，
// scripts/texture-registration.spec.mjs 會比對它、這份 `texture` 與 project.json 三處一致。
export const RESIDENT_TEXTURE_IDS: readonly string[] = [DEFAULT_PARADIGM];

/** 這個質地的樣式是否要按需下載（常駐質地以外的已知質地）。 */
export function isOnDemandTexture(id: string): boolean {
  return texture.some((t) => t.id === id) && !RESIDENT_TEXTURE_IDS.includes(id);
}

/** 按需質地樣式檔的網址（相對於 `<base href>`；檔名不帶 hash，見 ADR 0010）。 */
export function textureStylesheetHref(id: string): string {
  return `texture-${id}.css`;
}

// ADR 0013：配色比照質地。常駐配色（預設配色）編進主樣式，也是按需配色載入失敗時的退路；其餘配色都是按需配色，
// 各自編成 `color-<id>.css`（apps/admin/project.json 的 styles，`inject: false`）。新增配色預設就是按需，不用改這裡；
// admin index.html 開機腳本的 `onDemandColors` 與 project.json 由 scripts/texture-registration.spec.mjs 比對。
export const RESIDENT_COLOR_THEME_IDS: readonly string[] = [DEFAULT_THEME];

/** 這個配色的樣式是否要按需下載（常駐配色以外的已知配色）。 */
export function isOnDemandColorTheme(id: string): boolean {
  return COLOR_THEMES.some((c) => c.id === id) && !RESIDENT_COLOR_THEME_IDS.includes(id);
}

/** 按需配色樣式檔的網址（相對於 `<base href>`；檔名不帶 hash，同 ADR 0010）。 */
export function colorThemeStylesheetHref(id: string): string {
  return `color-${id}.css`;
}

/** 不認得的配色 id（已刪除的配色殘留在 localStorage、拼錯）一律退回 DEFAULT_THEME。 */
export function resolveThemeId(id: string | null | undefined): string {
  return COLOR_THEMES.some((c) => c.id === id) ? (id as string) : DEFAULT_THEME;
}

// ADR 0007：質地是主軸，每個質地宣告自己的相容配色（白名單）與一個預設配色。
// 清單於 2026-09-27 由設計定案（ticket 09），依據是美感；56 格對比已全數合格（ticket 15）。
// 2026-10-13 新增 Graphite、OLED 兩套深色配色與 Cockpit 質地（ADR 0012）：新增的格子於 2026-10-13 由使用者定案；
// 兩套配色比照 Midnight 的相容範圍，再依美感排除（Aero 兩者都排除，OLED 另排除 Linen、Soft UI、Clay）。
// 2026-10-13 新增 Signal 配色與 Brutal 質地（ADR 0014）：新增的格子是提案，待使用者定案。
// 2026-10-13 新增 Riso 雙色配色與 Riso 質地（ADR 0015）：新增的格子是提案，待使用者定案。
// 2026-10-13 新增 Sketch 質地（ADR 0016）：新增的格子是提案，待使用者定案。
// 相容清單只存在這一處，settings 頁與之後的外觀浮動面板（ticket 03）都透過 ThemeService 讀取，不重抄清單。
export interface TextureCompatibility {
  readonly compatibleThemeIds: readonly string[];
  readonly defaultThemeId: string;
}

const ALL_COLOR_THEME_IDS: readonly string[] = COLOR_THEMES.map((c) => c.id);

// 白名單一律逐一列出（ADR 0007 第 1 條）：新增配色時不會自動出現在任何質地，要逐一加進來。
export const TEXTURE_COMPATIBILITY: Record<string, TextureCompatibility> = {
  // 排除 Candy。Signal 是 ADR 0014 提案、Riso 雙色是 ADR 0015 提案（待使用者定案）。
  material: {
    compatibleThemeIds: ['verdant', 'midnight', 'sandstone', 'azure', 'cool-grey', 'mist-ink', 'glacier-blue', 'graphite', 'oled', 'signal', 'riso-duo'],
    defaultThemeId: 'verdant',
  },
  // 排除 Candy；OLED 依美感排除（ADR 0012：紙張色階在純黑上幾乎沒有差，紙感消失）；
  // Signal 依美感排除（ADR 0014 提案：同 Candy，飽和色塊蓋掉紙張色階）
  // Riso 雙色依美感排除（ADR 0015 提案：同色系紙張色階已經是「紙」，再疊孔版的螢光粉與滿版藍側欄，兩種紙感互搶）。
  linen: {
    compatibleThemeIds: ['verdant', 'midnight', 'sandstone', 'azure', 'cool-grey', 'mist-ink', 'glacier-blue', 'graphite'],
    defaultThemeId: 'sandstone',
  },
  // 全部相容（Signal 是 ADR 0014 提案、Riso 雙色是 ADR 0015 提案，待使用者定案）
  grid: {
    compatibleThemeIds: ['verdant', 'midnight', 'sandstone', 'azure', 'cool-grey', 'candy', 'mist-ink', 'glacier-blue', 'graphite', 'oled', 'signal', 'riso-duo'],
    defaultThemeId: 'verdant',
  },
  // 排除 Sandstone、Verdant；OLED 依美感排除（ADR 0012：純黑上暗面陰影看不見，浮雕消失）；
  // Signal 依美感排除（ADR 0014 提案：墨黑側欄與飽和色塊壓過浮雕的柔和光影）
  // Riso 雙色依美感排除（ADR 0015 提案：滿版藍側欄與螢光粉蓋過浮雕的柔和光影）。
  'soft-ui': {
    compatibleThemeIds: ['midnight', 'azure', 'cool-grey', 'candy', 'mist-ink', 'glacier-blue', 'graphite'],
    defaultThemeId: 'cool-grey',
  },
  // 只保留 Midnight、Cool Grey，加上 Graphite（ADR 0012）；OLED 依美感排除（環境陰影在純黑上看不見，體積感消失）；
  // Signal 依美感排除（ADR 0014 提案：同其他淺色配色）
  // Riso 雙色依美感排除（ADR 0015 提案：Clay 只搭深色與冷灰）。
  clay: { compatibleThemeIds: ['midnight', 'cool-grey', 'graphite'], defaultThemeId: 'cool-grey' },
  // 排除 Cool Grey。Signal 是 ADR 0014 提案、Riso 雙色是 ADR 0015 提案（待使用者定案）。
  editorial: {
    compatibleThemeIds: ['verdant', 'midnight', 'sandstone', 'azure', 'candy', 'mist-ink', 'glacier-blue', 'graphite', 'oled', 'signal', 'riso-duo'],
    defaultThemeId: 'mist-ink',
  },
  // 排除 Sandstone、Cool Grey；Signal 依美感排除（ADR 0014 提案：墨黑側欄與飽和色塊讓霧光玻璃失去透光感）
  // Riso 雙色依美感排除（ADR 0015 提案：平面印刷的不透明墨色讓霧光玻璃失去透光感）。
  frosted: {
    compatibleThemeIds: ['verdant', 'midnight', 'azure', 'candy', 'mist-ink', 'glacier-blue', 'graphite', 'oled'],
    defaultThemeId: 'candy',
  },
  // 高亮度雲霧玻璃只搭配冷調、淺色畫布；深色與暖沙會讓透明層失去參考圖的空氣感（Signal 同理排除，ADR 0014 提案）。
  // Riso 雙色依美感排除（ADR 0015 提案：高亮度雲霧玻璃只搭冷調淺色）。
  aero: {
    compatibleThemeIds: ['azure', 'cool-grey', 'mist-ink', 'glacier-blue'],
    defaultThemeId: 'glacier-blue',
  },
  // 排除 Candy（ADR 0011）：8 格對比全數合格，Candy 是依美感排除——高彩度糖果色和帳冊的冷靜數字感衝突。
  // 2026-10-13 由使用者定案。
  // Graphite、OLED 於 2026-10-13 依 ADR 0012 加入（對比全數合格），同日由使用者定案。
  // Signal 依美感排除（ADR 0014 提案：理由同 Candy）。
  // Riso 雙色依美感排除（ADR 0015 提案：螢光粉和帳冊的冷靜數字感衝突，同 Candy、Signal）。
  ledger: {
    compatibleThemeIds: ['verdant', 'midnight', 'sandstone', 'azure', 'cool-grey', 'mist-ink', 'glacier-blue', 'graphite', 'oled'],
    defaultThemeId: 'azure',
  },
  // 深色優先（ADR 0012）：層次靠發光，只相容深色配色。淺色配色即使對比合格也排除——光暈在淺底上讀不出來。
  // 2026-10-13 由使用者定案。Signal 是淺色配色，同樣排除。
  // Riso 雙色依美感排除（ADR 0015 提案：深色優先質地，淺色配色一律排除）。
  cockpit: {
    compatibleThemeIds: ['midnight', 'graphite', 'oled'],
    defaultThemeId: 'graphite',
  },
  // ADR 0014 提案（待使用者定案）：層次靠飽和色塊，只相容保有足夠彩度的淺色配色。對比 11 格全數合格；
  // Verdant、Cool Grey、Mist Ink、Glacier Blue 依美感排除（色塊太淡或畫布與卡片同色，色塊分層讀不出來），
  // 深色配色排除（墨線變成淺色線、色塊變成暗色容器，海報感消失）。
  // Riso 雙色依美感排除（ADR 0015 提案：平網色塊太淡，Brutal 的色塊分層讀不出來）。
  brutal: {
    compatibleThemeIds: ['sandstone', 'azure', 'candy', 'signal'],
    defaultThemeId: 'signal',
  },
  // ADR 0015 提案（待使用者定案）：層次靠第二墨的網點與疊印，只相容「兩種墨分得開、第二墨讀得出是另一個顏色」的淺色配色
  // （主墨對第二墨 ΔE ≥ 25、第二墨對文字墨 ΔE ≥ 20）。對比 12 格中 11 格合格（Cool Grey 的欄位邊界 2.78:1 不合格）；
  // Verdant、Azure 的第二墨太接近文字墨（網點讀起來像髒污），Mist Ink、Glacier Blue 是單色墨，深色配色排除（孔版是印在紙上的）。
  // Riso 雙色在其他質地只進 Material、Grid、Editorial（平面印刷感）；其餘排除的理由見 ADR 0015。
  riso: {
    compatibleThemeIds: ['sandstone', 'candy', 'signal', 'riso-duo'],
    defaultThemeId: 'riso-duo',
  },
  // ADR 0016 提案（待使用者定案）：層次靠手繪線條（筆是文字墨），只要「深色的筆畫在紙上」讀得出來即可。對比 12 格全數合格。
  // Cool Grey、Candy 依美感排除（冷灰紙像未完成的線框稿；糖果色塊搶走墨線，同 Material 排除 Candy）；
  // 深色配色只留 Midnight（深藍底上的淺色筆線像黑板／藍圖），Graphite、OLED 排除（炭灰配橘、純黑上的筆線像發光的 UI 邊線，
  // 不像手繪）。預設 Sandstone：暖色筆記紙＋棕墨。
  sketch: {
    compatibleThemeIds: ['verdant', 'midnight', 'sandstone', 'azure', 'mist-ink', 'glacier-blue', 'signal', 'riso-duo'],
    defaultThemeId: 'sandstone',
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
