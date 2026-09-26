# Linen 紙感質地準則

> 模板與術語見 [`../README.md`](../README.md)。本文件描述**目標樣子**；「現況 → 目標」欄標示尚未實作的差異（改版見 ticket 05–07）。

## 一句話個性

一疊攤在亞麻桌布上的紙：**完全沒有陰影**，前後關係靠紙張本身的色階深淺，邊緣只有極淡的細線。

## 造型規格

顏色一律用語意 token（`--mat-sys-*`、`--app-*`），顏色由配色軸決定；本質地不指定任何色碼。背景織紋的線色也由語意 token 調出。

| 項目 | Token | 目標值 | 用在 | 現況 → 目標 |
| --- | --- | --- | --- | --- |
| 圓角 small | `--mat-sys-corner-small` | 4px | 狀態徽章、導覽膠囊、checkbox | — |
| 圓角 medium | `--mat-sys-corner-medium` | 8px | 輸入框、按鈕、snackbar | — |
| 圓角 large | `--mat-sys-corner-large` | 8px | 卡片、面板、選單 | 12px → 8px |
| 圓角 extra-large | `--mat-sys-corner-extra-large` | 8px | 對話框 | 16px → 8px |
| 圓角 full | `--mat-sys-corner-full` | 8px | Material 預設為膠囊的元件（按鈕、toggle 等） | 999px → 8px（現況 Material 按鈕是膠囊形；本質地不做膠囊）；頭像、狀態點仍用正圓 |
| 陰影 level1–4 | `--mat-sys-level1` … `-level4` | 全部 `none` | — | 現況有 3.5–9% 的淡陰影 → 全部移除 |
| 邊線 | `--mat-sys-outline-variant` | 1px，淡 | 卡片、對話框、選單、表格列線 | 對話框、選單現況無框 → 補 1px 淡框（沒有陰影時要靠它和遮罩分出邊界） |
| 字體 display | `--font-display` | Georgia ＋ Noto Serif TC（襯線） | 頁面大標、大數字 | —（見文末待決問題） |
| 字體 body | `--font-body` | Inter ＋ Noto Sans TC | 內文、小節標、表格、表單 | — |
| 字體 mono | `--font-mono` | IBM Plex Mono | 代碼類資料 | — |
| 視覺密度 | Material 預設 | 表格列高 52px | 表格、表單 | — |
| 背景紋理 | 作用在 `body`、`.sidenav-container` | 橫＋直兩向細線交織成布紋，線色 `--mat-sys-outline-variant` 約 20% 起調；一眼看得出是布，但文字對比仍 ≥ 4.5:1 | 只在頁面底層，卡片等表面維持實色 | 現況只有橫線、13%，幾乎看不見 → 加直線、加深到明顯可見 |

## 層次表現

**用紙張色階分層，不用陰影。** 越往前的紙越亮、越往裡嵌的區塊越深，像在同一張紙上再貼一張不同磅數的紙：

| 層 | 表面 token |
| --- | --- |
| 畫布（有布紋） | `--mat-sys-background` |
| 卡片、對話框、選單 | `--mat-sys-surface`（最亮的一張紙） |
| 卡片內嵌區塊（摘要框、篩選列、次要資訊） | `--mat-sys-surface-container-low` |
| 表頭、hover 列、欄位底色 | `--mat-sys-surface-container` ／ `-high` |
| 選取中、強調區 | `--mat-sys-surface-container-highest` |

邊界只靠 1px 淡線（`--mat-sys-outline-variant`）描出紙緣。浮起的東西（選單、對話框）不會有影子，而是「換一張更亮的紙＋細框」，對話框另靠遮罩隔開背景。

像 Figma 裡不加任何 effect，只用 fill 的深淺與 1px stroke 排出前後。

## 新增頁面規則

- **卡片**：`.ui-card`，`--mat-sys-surface` 底、1px 淡框、8px 圓角、無陰影。卡片內要分區時用 `--mat-sys-surface-container-low` 的色塊，不要再畫一張有框的卡片。可點卡片 hover 改變底色（往 `-container-low` 走一階），不浮起。
- **表格**：表頭列用 `--mat-sys-surface-container` 底色；資料列之間 1px 淡線；hover 列用 `--mat-sys-surface-container-low`。不加欄線。
- **表單**：filled 欄位 8px 圓角、底色 `--mat-sys-surface-container-high`、無底線；聚焦時 2px `--mat-sys-primary` 外框（現況沿用 Material 預設底色、無聚焦外框 → 目標如上）。相連欄位用 `.ui-field-group`，接縫用淡線。
- **空狀態**：在卡片內放一塊 `--mat-sys-surface-container-low` 的色塊，裡面置中圖示＋一行標題＋一行說明＋按鈕。色塊本身就是視覺焦點，不另加框或插畫陰影。
- **對話框**：8px 圓角、`--mat-sys-surface` 底、1px 淡框、無陰影；遮罩維持預設。對話框內的次要區塊用 `-container-low`。
- **chip／徽章**：`.ui-chip--{tone}`，4px 圓角的小方籤（不是膠囊），顏色來自 `--app-{tone}-bg/fg`。

## Do / Don't

**Do**
- 需要「這塊比較重要／比較外層」時，換一階表面色，而不是加影子。
- 所有卡片、面板、對話框統一 8px 圓角。
- 讓布紋看得出來——這是 Linen 和 Material 最直接的差別；但文字只放在實色表面或對比合格的位置。
- 細線一律 1px `--mat-sys-outline-variant`。

**Don't**
- 使用任何 `box-shadow`（包括 hover、按下、對話框）。
- 用粗框、深色框或雙線框（那是 Grid 的語言）。
- 把布紋畫到卡片、表格、輸入框裡面，或讓它壓低文字對比。
- 用膠囊形按鈕或徽章。

## 相容配色

見 [`theme.token.ts`](../../../theme/theme.token.ts) 中 `linen` 的 `compatibleThemes` 與 `defaultTheme`（唯一來源，此處不列清單）。

## 待決問題（審核時請決定）

- 大標用襯線字體：Editorial 目標也改為襯線大標，兩者會共用「襯線」這個特徵。要保留 Linen 的 Georgia，還是改回無襯線，讓襯線成為 Editorial 專屬？另外 Noto Serif TC 目前**沒有載入**，中文大標實際顯示的是系統襯線字（macOS 為宋體類），在 Windows 上可能不同。
