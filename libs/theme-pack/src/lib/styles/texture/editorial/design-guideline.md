# Editorial 編輯式極簡質地準則

> 模板與術語見 [`../README.md`](../README.md)。本文件描述**目標樣子**；「現況 → 目標」欄標示尚未實作的差異（改版見 ticket 05–07）。

## 一句話個性

雜誌版面般的工作台：完全平面、方正，靠**襯線大標、字級對比、留白與髮絲線**安排主次，幾乎不用框和影子。

## 造型規格

顏色一律用語意 token（`--mat-sys-*`、`--app-*`），顏色由配色軸決定；本質地不指定任何色碼。

| 項目 | Token | 目標值 | 用在 | 現況 → 目標 |
| --- | --- | --- | --- | --- |
| 圓角 small | `--mat-sys-corner-small` | 2px | chip／徽章、checkbox | 4px → 2px |
| 圓角 medium | `--mat-sys-corner-medium` | 2px | 按鈕、輸入框、導覽項目、snackbar | 6px → 2px |
| 圓角 large | `--mat-sys-corner-large` | 0 | 卡片、面板、選單、日期選擇器、側欄使用者卡 | 12px → 0 |
| 圓角 extra-large | `--mat-sys-corner-extra-large` | 0 | 對話框 | 12px → 0 |
| 圓角 full | `--mat-sys-corner-full` | 2px | Material 預設為膠囊的元件 | 999px → 2px（現況徽章是膠囊 → 改 2px 小方籤）；頭像、狀態點仍用正圓 |
| 陰影 level1–3 | `--mat-sys-level1` … `-level3` | `none` | — | 現況 2.5–4% 淡陰影，且卡片、按鈕 hover 會出現 level2 → 全部移除 |
| 陰影 level4 | `--mat-sys-level4` | `none` | 對話框、選單 | 現況 `0 8px 24px` 4% → 移除，改由髮絲框＋遮罩界定 |
| 邊線（髮絲線） | `--mat-sys-outline-variant` | 1px | 區塊分隔線、對話框與選單外框、表格列線 | — |
| 強調線 | `--mat-sys-on-surface` | 1px（大標下方可 2px） | 頁面大標下方、表頭下方 | 新增 |
| 字體 display | `--font-display` | 襯線：英文襯線字＋ Noto Serif TC | 頁面大標、卡片標題、大數字 | Helvetica Neue（無襯線）→ 襯線；字型需額外載入（見待決問題） |
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

## 待決問題（審核時請決定）

- 襯線字型的選擇與成本：中文用 Noto Serif TC，英文可選 Source Serif 4、Playfair Display 或直接用系統 Georgia。前兩者需要像 Clay 一樣額外載入 Google Fonts（`editorial/_fonts.scss`），中文襯線字檔較大、首次切換會有換字閃動。
- 襯線要只用在頁面大標，還是卡片標題、對話框標題也用？本文件目前寫「大標、卡片標題、對話框標題、大數字」。
- 側欄（`.app-sidenav`）的導覽項目現況 6px 圓角，目標依 medium 改 2px；使用者卡改直角。是否同意側欄也照這個規則？
