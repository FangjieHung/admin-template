# Material 質地準則

> 模板與術語見 [`../README.md`](../README.md)。本文件描述**目標樣子**；「現況 → 目標」欄標示尚未實作的差異。

## 一句話個性

Google 風的親切工作台：大圓角、白色卡片輕輕浮在畫布上，靠**柔和的模糊陰影**分出前後。

## 造型規格

顏色一律用語意 token（`--mat-sys-*`、`--app-*`），顏色由配色軸決定；本質地不指定任何色碼。陰影顏色目前寫在 `_tokens.scss`，是這個質地唯一允許的例外。

| 項目 | Token | 目標值 | 用在 | 現況 → 目標 |
| --- | --- | --- | --- | --- |
| 圓角 small | `--mat-sys-corner-small` | 10px | 小按鈕、checkbox 容器、snackbar 內元件 | — |
| 圓角 medium | `--mat-sys-corner-medium` | 16px | 輸入框、按鈕、snackbar | — |
| 圓角 large | `--mat-sys-corner-large` | 22px | 卡片、面板、選單 | — |
| 圓角 extra-large | `--mat-sys-corner-extra-large` | 28px | 對話框、底部面板 | — |
| 圓角 full | `--mat-sys-corner-full` | 999px（膠囊） | 導覽膠囊、狀態徽章、頭像 | — |
| 陰影 level1 | `--mat-sys-level1` | `0 1px 2px` 約 4% | 靜止的卡片 | — |
| 陰影 level2 | `--mat-sys-level2` | `0 2px 8px` 約 5% | 可點卡片的 hover、sticky 列 | 現況可點卡片 hover 不升高 → 目標升到 level2 |
| 陰影 level3 | `--mat-sys-level3` | `0 8px 24px` 約 7% | 選單、日期選擇器、下拉清單 | — |
| 陰影 level4 | `--mat-sys-level4` | `0 16px 40px` 約 10% | 對話框 | — |
| 邊線 | `--mat-sys-outline-variant` | 1px hairline，幾乎看不見 | 卡片外框 | — |
| 字體 display | `--font-display` | Plus Jakarta Sans ＋ Noto Sans TC | 頁面大標、大數字、小節標 | — |
| 字體 body | `--font-body` | Inter ＋ Noto Sans TC | 內文、表格、表單 | — |
| 字體 mono | `--font-mono` | IBM Plex Mono | 訂單編號、車牌等代碼 | — |
| 視覺密度 | Material 預設 | 表格列高 52px、欄位 56px | 表格、表單 | — |
| 背景紋理 | — | 無，純色畫布 | 頁面底層 | — |

## 層次表現

**用陰影高度分層。** 所有表面都是同一種白（`--mat-sys-surface`），差別只在「浮多高」：畫布（`--mat-sys-background`）→ 卡片 level1 → hover 中的可點卡片 level2 → 選單 level3 → 對話框 level4。越暫時、越需要注意的東西浮得越高，陰影越大越散。

像 Figma 裡同一個白色 frame 套不同的 drop-shadow effect style：換的是 effect，不是 fill。

## 新增頁面規則

- **卡片**：用 `.ui-card`（白底、hairline 邊、22px 圓角、level1）。可點的加 `.ui-card--clickable`。重點數字卡用 `.ui-card--inverse`（無邊無影）。卡片內再分區用 16px 以上的間距，不再套一層卡片。
- **表格**：放在 `.ui-card` 裡，表格本身透明無框；列之間只用 `--mat-sys-outline-variant` 細線。數字欄靠右對齊。
- **表單**：用 Material filled 欄位（16px 圓角、無底線）。相連欄位用 `.ui-field-group`。區塊標題用 `.ui-text-subtitle`。
- **空狀態**：卡片內置中，一個大圖示（`--mat-sys-on-surface-variant`）、一行 `.ui-text-subtitle`、一行 `.ui-text-caption` 說明、一顆主要按鈕。不另加陰影或邊框。
- **對話框**：28px 圓角、level4 陰影，底下有遮罩。標題用 `.ui-text-subtitle`，動作按鈕靠右。
- **chip／徽章**：用 `.ui-chip` ＋ `.ui-chip--{tone}`，膠囊形（corner-full），底色與文字來自 `--app-{tone}-bg/fg`。

## Do / Don't

**Do**
- 用陰影層級表達「這東西浮起來了」：hover、選單、對話框依序升高。
- 保持大圓角的一致：卡片 22、欄位 16、對話框 28，同一畫面不混用小圓角。
- 膠囊形給導覽和徽章，讓可點與狀態一眼可辨。
- 需要強調時用 `.ui-card--inverse` 的反白，而不是加粗陰影。

**Don't**
- 讓陰影變硬或變深（無模糊的實心陰影是 Grid 的語言）。
- 用粗框線或不同底色的色塊來分層（那是 Grid、Linen 的手段）。
- 在卡片裡再疊一層有陰影的卡片。
- 在元件裡寫色碼或直接寫 `box-shadow` 數值；一律用 `--mat-sys-level*`。

## 相容配色

見 [`theme.token.ts`](../../../theme/theme.token.ts) 中 `material` 的 `compatibleThemes` 與 `defaultTheme`（唯一來源，此處不列清單）。
