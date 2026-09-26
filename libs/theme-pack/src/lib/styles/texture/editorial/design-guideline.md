# Editorial 編輯式極簡質地準則

> 模板與術語見 [`../README.md`](../README.md)。本文件描述**目標樣子**；「現況 → 目標」欄標示尚未實作的差異（改版見 ticket 05–07）。

## 一句話個性

雜誌版面般的工作台：完全平面、方正，靠**襯線大標、字級對比、留白與髮絲線**安排主次，幾乎不用框和影子。

## 造型規格

顏色一律用語意 token（`--mat-sys-*`、`--app-*`），顏色由配色軸決定；本質地不指定任何色碼。

| 項目 | Token | 目標值 | 用在 | 現況 → 目標 |
| --- | --- | --- | --- | --- |
| 圓角 small | `--mat-sys-corner-small` | 2px | chip／徽章、checkbox | 已於 ticket 07 實作 |
| 圓角 medium | `--mat-sys-corner-medium` | 2px | 按鈕、輸入框、導覽項目、snackbar | 已於 ticket 07 實作 |
| 圓角 large | `--mat-sys-corner-large` | 0 | 卡片、面板、選單、日期選擇器、側欄使用者卡 | 已於 ticket 07 實作 |
| 圓角 extra-large | `--mat-sys-corner-extra-large` | 0 | 對話框 | 已於 ticket 07 實作 |
| 圓角 full | `--mat-sys-corner-full` | 2px | Material 預設為膠囊的元件 | 已於 ticket 07 實作（`.ui-chip` 改用 corner-small）；頭像、狀態點仍用正圓（未經 corner token，維持 `border-radius: 50%`） |
| 陰影 level1–3 | `--mat-sys-level1` … `-level3` | `none` | — | 已於 ticket 07 實作 |
| 陰影 level4 | `--mat-sys-level4` | `none` | 對話框、選單 | 已於 ticket 07 實作，改由髮絲框＋遮罩界定 |
| 邊線（髮絲線） | `--mat-sys-outline-variant` | 1px | 區塊分隔線、對話框與選單外框、表格列線 | 已於 ticket 07 實作（對話框標題下、動作列上、表格列間） |
| 強調線 | `--mat-sys-on-surface` | 1px（大標下方可 2px） | 頁面大標下方、表頭下方 | 已於 ticket 07 實作：`.topbar` 底線 2px、`.mat-mdc-header-row` 底線 2px |
| 字體 display | `--font-display` | 襯線：英文載入 **Lora**（Google Fonts，400/500/600/700，見 `_fonts.scss`）；中文用系統內建襯線（`"Songti TC"`），沒有則退回 `--font-zh`（Noto Sans TC 等無襯線），不下載中文襯線字檔 | 頁面大標（`.topbar-heading h1`）、卡片／表單標題（`.ui-text-subtitle`）、對話框標題（`[mat-dialog-title]`）、大數字（`.ui-text-display`） | 已於 ticket 07 實作 |
| 字體 body | `--font-body` | Helvetica Neue ＋ Noto Sans TC | 內文、表格、表單、按鈕 | — |
| 字體 mono | `--font-mono` | IBM Plex Mono | 代碼類資料 | — |
| 視覺密度 | `--mat-table-row-item-container-height` | 表格列高 52px；內文行高 1.6 | 表格、內文 | — |
| 背景紋理 | — | 無，純色畫布（`--mat-sys-surface`） | 頁面底層 | — |

## 層次表現

**用字級對比、留白與髮絲線分層，不用盒子。** 主次由文字本身決定：襯線大標最大最重 → 小節標 → 內文 → 灰色 caption。區塊之間靠大量留白與一條 1px 髮絲線分開，而不是各自裝進有底色、有影子的卡片。需要最強調的地方用一條 `--mat-sys-on-surface` 的深色線，像報紙版頭下的粗線。

浮起的元素（對話框、選單）也不浮：它們是一塊方正的平面加髮絲框，對話框再靠遮罩和背景隔開。

像 Figma 的排版稿：沒有任何 effect，全部 frame 是直角，層次只在 text style 與 1px line 上。

## 新增頁面規則

- **卡片**：`.ui-card` 目標為直角、無陰影、1px 髮絲框、底色 `--mat-sys-surface-container-low`（現況 12px 圓角，hover 會出現陰影 → 目標 hover 只把框線換成 `--mat-sys-outline`）。新頁面優先用「標題＋髮絲分隔線」的段落排版，真的需要一個可點的單元時才用卡片。
- **表格**：無外框，表頭用小字 caption 樣式、下方一條 `--mat-sys-on-surface` 強調線；資料列之間 1px 髮絲線，不加欄線。數字欄靠右。
- **表單**：輸入框 2px 圓角、`--mat-sys-surface-container-high` 底、1px 髮絲框；聚焦時 2px `--mat-sys-primary` 外框。欄位群組之間用留白與小節標分段，不另加卡片框。
- **空狀態**：不放色塊、不放框。一行襯線標題、一行灰色說明、一顆文字或外框按鈕，左對齊或置中都可，但要有充足留白。
- **對話框**：直角、1px 髮絲框、無陰影，標題用襯線 display 字體，標題下方一條髮絲線，動作列上方一條髮絲線。
- **chip／徽章**：`.ui-chip--{tone}`，2px 圓角的小方籤，顏色來自 `--app-{tone}-bg/fg`；字級小、可加字距，不做膠囊。

## Do / Don't

**Do**
- 讓字級對比承擔主次：頁面上最顯眼的應該是襯線大標，而不是某張卡片。
- 用 1px 髮絲線和留白分段。
- 卡片、面板、對話框一律直角；按鈕、輸入框、徽章一律 2px。
- hover 只換底色或框線顏色。

**Don't**
- 使用任何陰影，包括 hover 與對話框。
- 使用膠囊形或超過 2px 的圓角。
- 用粗框、雙線框或實心偏移影（那是 Grid）。
- 用多階底色把畫面切成一塊塊色塊（那是 Linen）；本質地最多用到 `-container-low` 一階。

## 相容配色

見 [`theme.token.ts`](../../../theme/theme.token.ts) 中 `editorial` 的 `compatibleThemes` 與 `defaultTheme`（唯一來源，此處不列清單）。

## 已決定（2026-09-26 審核）

- 襯線字型：英文載入一套輕量網頁襯線字；中文不下載字檔，用系統襯線（`"Songti TC"` 等），沒有時退回無襯線。代價：Windows 上中文大標可能是無襯線。
- 襯線使用範圍維持本文件所寫：頁面大標、卡片標題、對話框標題、大數字。
- 側欄照同一規則：導覽項目 2px、使用者卡直角。

## 實作紀錄（ticket 07，2026-09-26）

- 英文襯線最終選用 **Lora**（Google Fonts，`wght@400;500;600;700`），透過 `editorial/_fonts.scss` 用 `@import url(...)` 載入 CSS，仿照 `clay/_fonts.scss` 的作法；在 `apps/admin/src/styles.scss` 與 clay 字型並列 `@use`。中文沿用系統襯線 `"Songti TC"`，退回鏈為 `--font-zh`（Noto Sans TC/sans-serif），不下載任何 CJK 襯線檔。字重只到 700：原本 `.ui-text-display`／`.ui-text-title`／`.topbar-heading h1` 的 `font-weight: 800` 一併降為 700，避免瀏覽器對未載入字重做假粗體。
- 對話框圓角除了 `.mat-mdc-dialog-surface { border-radius: var(--mat-sys-corner-extra-large) !important }`，另外加了 `.cdk-overlay-pane .mat-mdc-dialog-surface` 的同值覆寫（specificity 0-4-0）作為保險，防止 Material 質地那份 `[data-paradigm='material'] .mat-mdc-dialog-surface`（0-2-0 + !important）規則同時載入時搶贏。
- 修正圓角 token 對應：對話框改用 `--mat-sys-corner-extra-large`、選單／日期選擇器改用 `--mat-sys-corner-large`（原本兩者共用 `-large`，與造型規格表不符，但目標值都是 0，視覺上無差異）。
- 新增「強調線」：`.topbar` 加 `border-bottom: 2px solid var(--mat-sys-on-surface)`；`.mat-mdc-header-row` 同樣加 2px 底線；`.mat-mdc-row` 之間 1px `--mat-sys-outline-variant` 髮絲線（最後一列不畫）。
- 對話框標題／動作列髮絲線改用屬性選擇器 `[mat-dialog-title]`／`[mat-dialog-actions]`，對所有既有對話框元件生效，不需逐一改各對話框的自訂 class。
- `.ui-chip` 圓角改用 `--mat-sys-corner-small`（而非原本的 `--mat-sys-corner-full`），對齊造型規格表「small = chip／徽章」；數值結果相同（2px），但語意對應正確。
- 未動：`.avatar`、`.ui-chip__dot` 沒有套用 corner token，維持既有 `border-radius: 50%`（頭像／狀態點仍正圓，未受 `corner-full` 由 999px 改 2px 影響）。
