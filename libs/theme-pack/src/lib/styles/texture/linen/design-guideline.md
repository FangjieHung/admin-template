# Linen 紙感質地準則

> 模板與術語見 [`../README.md`](../README.md)。本文件描述**目標樣子**。ticket 05（2026-09-26）已依本文件改版，「現況 → 目標」欄已全數落地，僅保留紀錄。

## 一句話個性

一疊攤在亞麻桌布上的紙：**完全沒有陰影**，前後關係靠紙張本身的色階深淺，邊緣只有極淡的細線。

## 造型規格

顏色一律用語意 token（`--mat-sys-*`、`--app-*`），顏色由配色軸決定；本質地不指定任何色碼。背景織紋的線色也由語意 token 調出。

| 項目 | Token | 目標值 | 用在 | 現況 → 目標 |
| --- | --- | --- | --- | --- |
| 圓角 small | `--mat-sys-corner-small` | 4px | 狀態徽章、導覽膠囊、checkbox（原生勾選框取 `min(4px, corner-small)`，見 `_choice-controls.scss`） | — |
| 圓角 medium | `--mat-sys-corner-medium` | 8px | 輸入框、按鈕、snackbar | — |
| 圓角 large | `--mat-sys-corner-large` | 8px | 卡片、面板、選單 | 已改為 8px |
| 圓角 extra-large | `--mat-sys-corner-extra-large` | 8px | 對話框 | 已改為 8px |
| 圓角 full | `--mat-sys-corner-full` | 8px | Material 預設為膠囊的元件（按鈕、toggle 等） | 已改為 8px（本質地不做膠囊）；頭像、狀態點仍用正圓（硬寫 999px，不吃此 token） |
| 陰影 level1–4 | `--mat-sys-level1` … `-level4` | 全部 `none` | — | 已全部改為 `none` |
| 邊線 | `--mat-sys-outline-variant` | 1px，淡 | 卡片、對話框、選單、表格列線 | 對話框、選單、datepicker 已補 1px 淡框 |
| 字體 display | `--font-display` | 無襯線（與 body 同字族，靠字重與字級區分） | 頁面大標、大數字 | 已改為 `var(--font-body)`（無襯線） |
| 字體 body | `--font-body` | Inter ＋ 系統中文字（`--font-zh`） | 內文、小節標、表格、表單 | — |
| 字體 mono | `--font-mono` | IBM Plex Mono | 代碼類資料 | — |
| 視覺密度 | Material 預設 | 表格列高 52px | 表格、表單 | — |
| 背景紋理 | 作用在 `body`、`.sidenav-container` | 橫＋直兩向細線交織成布紋，線色 `--mat-sys-outline-variant` 約 20% 起調；一眼看得出是布，但文字對比仍 ≥ 4.5:1 | 只在頁面底層，卡片等表面維持實色 | 已加直線、加深到 20% |

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
- **表單**：filled 欄位上緣 8px 圓角、下緣直角（底線才完整）、底色 `--mat-sys-surface-container-high`，底部 1px 底線（像信紙上的書寫線）當可見邊界，顏色 `--app-field-border`（對外側底色 ≥ 3:1）、hover 加深；聚焦時 MDC 的 2px 主色底線＋2px `--app-focus-ring` 外框（已實作）。相連欄位用 `.ui-field-group`，接縫用淡線。
- **空狀態**：在卡片內放一塊 `--mat-sys-surface-container-low` 的色塊，裡面置中圖示＋一行標題＋一行說明＋按鈕。色塊本身就是視覺焦點，不另加框或插畫陰影。
- **對話框**：8px 圓角、`--mat-sys-surface` 底、1px 淡框、無陰影；遮罩吃 `--app-scrim`（配色的 `inverse-surface` 45%）。對話框內的次要區塊用 `-container-low`。
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

## 已決定（2026-09-26 審核）

- 大標改回無襯線。襯線是 Editorial 的專屬辨識特徵；Linen 的紙感靠色塊落差與織紋表現。
