# Grid 網格質地準則

> 模板與術語見 [`../README.md`](../README.md)。本文件描述**目標樣子**；「現況 → 目標」欄標示尚未實作的差異（改版見 ticket 05–07）。

## 一句話個性

工程藍圖上的操作台：直角、清楚的實線框、**不模糊的硬邊偏移陰影**，數字一律等寬對齊，資訊密度高。

## 造型規格

顏色一律用語意 token（`--mat-sys-*`、`--app-*`），顏色由配色軸決定；本質地不指定任何色碼。硬邊陰影的顏色也要取自語意 token（例如 `--mat-sys-outline` 或 `color-mix(in srgb, var(--mat-sys-on-surface) 通透度, transparent)`），才能在深色配色下仍然看得到。

| 項目 | Token | 目標值 | 用在 | 現況 → 目標 |
| --- | --- | --- | --- | --- |
| 圓角 small | `--mat-sys-corner-small` | 2px | 按鈕、輸入框、徽章、導覽膠囊 | — |
| 圓角 medium | `--mat-sys-corner-medium` | 2px | 輸入框、snackbar | 4px → 2px |
| 圓角 large | `--mat-sys-corner-large` | 0 | 卡片、面板、選單 | 6px → 0 |
| 圓角 extra-large | `--mat-sys-corner-extra-large` | 0 | 對話框 | 8px → 0 |
| 圓角 full | `--mat-sys-corner-full` | 2px | Material 預設為膠囊的元件（按鈕、toggle） | 999px → 2px（不做膠囊）；頭像、狀態點仍用正圓 |
| 陰影 level1 | `--mat-sys-level1` | `2px 2px 0 0`（0 模糊） | 卡片 | 現況 `0 1px 0` 8%（只往下、幾乎看不見）→ 右下 2px 實心偏移 |
| 陰影 level2 | `--mat-sys-level2` | `3px 3px 0 0` | 可點卡片 hover、按鈕 hover | `0 2px 0` → 3px 偏移 |
| 陰影 level3 | `--mat-sys-level3` | `4px 4px 0 0` | 選單、日期選擇器 | `0 4px 0` → 4px 偏移 |
| 陰影 level4 | `--mat-sys-level4` | `6px 6px 0 0` | 對話框 | `0 6px 0` → 6px 偏移 |
| 邊線 | `--mat-sys-outline` | 1px 實線，明顯可見 | 卡片、對話框、選單、表格外框、欄位 | 卡片已是 `outline`；對話框、選單、欄位現況無框 → 補上 |
| 內格線 | `--mat-sys-outline-variant` | 1px | 表格列線與欄線、卡片內分區 | 表格現況無欄線 → 加欄線 |
| 字體 display | `--font-display` | IBM Plex Mono ＋ Noto Sans TC | 頁面大標、大數字 | — |
| 字體 body | `--font-body` | Inter ＋ Noto Sans TC | 內文、表單 | — |
| 字體 mono | `--font-mono` | IBM Plex Mono | **所有數字資料**：金額、日期、時間、數量、訂單編號、車牌 | 現況只有大數字用等寬數字 → 表格數字欄、統計、日期全部改用 mono ＋ `tabular-nums` |
| 視覺密度 | `--mat-table-row-item-container-height` 等 | 表格列高 44px、表頭 48px、儲存格左右 12px | 表格 | —（互動目標仍維持 ≥ 44px） |
| 背景紋理 | 作用在 `body`、`.sidenav-container` | 28px 細格，每 5 格（140px）一條較深的主格線，像方格紙 | 只在頁面底層 | 現況只有單一 28px 細格 → 加主格線 |

## 層次表現

**用框線粗細與硬邊偏移分層。** 每個東西都有清楚的實線外框；越往前的東西，右下方的實心影子偏移越多（2 → 3 → 4 → 6px），像一疊壓在方格紙上的卡紙，影子沒有任何模糊。內外之分靠線的強弱：外框用 `--mat-sys-outline`，內部格線用 `--mat-sys-outline-variant`。

hover 的回饋是「影子多推出去一格」，按下時影子歸零、元件往右下移同樣距離（像按下實體按鍵）。

像 Figma 的 drop-shadow 把 blur 設 0、X/Y 各給 2–6，再配 1px 實線 stroke。

## 新增頁面規則

- **卡片**：`.ui-card`，直角、1px `--mat-sys-outline` 實框、level1 硬影。卡片標題列下方用一條 1px 內格線隔開。可點卡片 hover 升到 level2。
- **表格**：外框 1px `outline`，列線與欄線都畫（`outline-variant`），表頭與內容之間用 `outline` 實線加強。列高 44px。所有數字欄用 `--font-mono`、`font-variant-numeric: tabular-nums`、靠右對齊，讓個位數上下對齊。
- **表單**：欄位 2px 圓角、1px `outline` 實框，聚焦時框線換成 2px `--mat-sys-primary`。標籤可以用全大寫英文或小字 caption，像工程圖的欄位標示。數字輸入（金額、里程、天數）用 mono。
- **空狀態**：卡片內畫一個虛線框（1px dashed `outline-variant`），裡面置中圖示＋一行 mono 小字狀態（例如「0 筆」）＋說明＋按鈕。
- **對話框**：直角、1px `outline` 實框、level4 硬影（6px 偏移）。標題列與動作列各用 1px 內格線與內容分開。
- **chip／徽章**：`.ui-chip--{tone}`，2px 圓角的方形標籤、1px 同色系邊框（`--app-{tone}-fg` 的淡化）、粗體小字。不做膠囊。

## Do / Don't

**Do**
- 讓每個容器都有看得見的實線外框。
- 陰影只用 0 模糊、往右下偏移的實心影子，層級越高偏移越多。
- 所有會被比較、加總或排序的數字都用等寬字體與表格數字，並靠右對齊。
- 用格線把資訊切成清楚的欄與列，密度可以高，但字級不小於 13px、點擊區不小於 44px。

**Don't**
- 使用任何有模糊的陰影（那是 Material）。
- 超過 2px 的圓角或任何膠囊形狀。
- 用底色深淺當主要分層手段（那是 Linen）。
- 把網格紋理畫進卡片、表格或欄位內部；紋理只在頁面底層。

## 相容配色

見 [`theme.token.ts`](../../../theme/theme.token.ts) 中 `grid` 的 `compatibleThemes` 與 `defaultTheme`（唯一來源，此處不列清單）。

## 待決問題（審核時請決定）

- 硬邊陰影的顏色：用 `--mat-sys-outline`（中性灰、各配色都穩定）還是 `--mat-sys-on-surface`（接近黑、藍圖感更強但較搶眼）？
- 背景主格線（每 140px）是否需要；若覺得太吵可只保留細格。
