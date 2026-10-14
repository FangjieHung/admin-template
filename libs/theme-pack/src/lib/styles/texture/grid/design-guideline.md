# Grid 網格質地準則

> 模板與術語見 [`../README.md`](../README.md)。ticket 06（2026-09-26）已依本文件改版；下表「現況 → 目標」欄已全部完成，保留紀錄供追溯。

## 一句話個性

工程藍圖上的操作台：直角、清楚的實線框、**不模糊的硬邊偏移陰影**，數字一律等寬對齊，資訊密度高。

## 造型規格

顏色一律用語意 token（`--mat-sys-*`、`--app-*`），顏色由配色軸決定；本質地不指定任何色碼。硬邊陰影的顏色也要取自語意 token（例如 `--mat-sys-outline` 或 `color-mix(in srgb, var(--mat-sys-on-surface) 通透度, transparent)`），才能在深色配色下仍然看得到。

| 項目 | Token | 目標值 | 用在 | 現況 → 目標 |
| --- | --- | --- | --- | --- |
| 圓角 small | `--mat-sys-corner-small` | 2px | 按鈕、輸入框、徽章、導覽膠囊 | — |
| 圓角 medium | `--mat-sys-corner-medium` | 2px | 輸入框、snackbar | 已完成（4px → 2px） |
| 圓角 large | `--mat-sys-corner-large` | 0 | 卡片、面板、選單 | 已完成（6px → 0） |
| 圓角 extra-large | `--mat-sys-corner-extra-large` | 0 | 對話框 | 已完成（8px → 0） |
| 圓角 full | `--mat-sys-corner-full` | 2px | Material 預設為膠囊的元件（按鈕、toggle） | 已完成（999px → 2px，不做膠囊）；頭像、狀態點等硬編碼 `border-radius: 50%`／`999px` 的元件不受影響，仍是正圓 |
| 陰影 level1 | `--mat-sys-level1` | `2px 2px 0 0 var(--mat-sys-outline)`（0 模糊） | 卡片 | 已完成 |
| 陰影 level2 | `--mat-sys-level2` | `3px 3px 0 0 var(--mat-sys-outline)` | 可點卡片 hover、按鈕 hover | 已完成（`.ui-card--clickable:hover` 已補 level2） |
| 陰影 level3 | `--mat-sys-level3` | `4px 4px 0 0 var(--mat-sys-outline)` | 選單、日期選擇器 | 已完成 |
| 陰影 level4 | `--mat-sys-level4` | `6px 6px 0 0 var(--mat-sys-outline)` | 對話框 | 已完成 |
| 邊線 | `--mat-sys-outline`（欄位用 `--app-field-border`） | 1px 實線，明顯可見 | 卡片、對話框、選單、日期選擇器、表格外框、表單欄位 | 已完成：對話框／選單／日期選擇器補上 1px outline；欄位邊框改吃 `--app-field-border`（Verdant 的 outline 不到 3:1，配色層加深），focus 時改 2px `--mat-sys-primary` |
| 內格線 | `--mat-sys-outline-variant` | 1px | 表格列線與欄線、卡片內分區、對話框標題列/動作列分隔 | 已完成。Admin 實際表格是共用元件 `libs/ui/data-table`（`.dt-table` 原生 `<table>`，非 `mat-mdc-table`），外框與欄線是 grid `recipes.scss` 在 `.dt-table` 上設元件暴露的變數（`--dt-frame`、`--dt-col-divider`，見 CONTRACT.md「共用元件的外觀變數」），不覆寫屬性 |
| 字體 display | `--font-display` | IBM Plex Mono ＋ 系統中文字（`--font-zh`） | 頁面大標、大數字 | — |
| 字體 body | `--font-body` | Inter ＋ 系統中文字（`--font-zh`） | 內文、表單 | — |
| 字體 mono | `--font-mono` | IBM Plex Mono（中文接 `--font-zh`） | **所有數字資料**：金額、日期、時間、數量、單號 | 已完成：共用 class `.ui-text-numeric`（CONTRACT.md）在 Grid 換成 `var(--font-mono), var(--font-zh)`；元件裡原本寫死 `tabular-nums` 的數字文字（金額、數量、日期時間等）都改掛這個 class，data-table 的 `align: 'end'` 欄自動掛上；數字輸入（`input[type='number']`）另有規則；統計大數字沿用 `.ui-text-display` |
| 視覺密度 | `--mat-table-row-item-container-height` 等 | 表格列高 44px、表頭 48px、儲存格左右 12px | 表格 | —（互動目標仍維持 ≥ 44px） |
| 背景紋理 | 作用在 `body`、`.sidenav-container` | 28px 細格，每 5 格（140px）一條較深的主格線，像方格紙 | 只在頁面底層 | 已完成：疊加 140px 主格線圖層，透明度比細格線高（55% vs 35%），低調不干擾閱讀 |

## 層次表現

**用框線粗細與硬邊偏移分層。** 每個東西都有清楚的實線外框；越往前的東西，右下方的實心影子偏移越多（2 → 3 → 4 → 6px），像一疊壓在方格紙上的卡紙，影子沒有任何模糊。內外之分靠線的強弱：外框用 `--mat-sys-outline`，內部格線用 `--mat-sys-outline-variant`。

hover 的回饋是「影子多推出去一格」，按下時影子歸零、元件往右下移同樣距離（像按下實體按鍵）。

像 Figma 的 drop-shadow 把 blur 設 0、X/Y 各給 2–6，再配 1px 實線 stroke。

## 新增頁面規則

- **卡片**：`.ui-card`，直角、1px `--mat-sys-outline` 實框、level1 硬影。卡片標題列下方用一條 1px 內格線隔開。可點卡片 hover 升到 level2。
- **表格**：外框 1px `outline`，列線與欄線都畫（`outline-variant`）。列高 44px。所有數字欄用 `--font-mono`、`font-variant-numeric: tabular-nums`、靠右對齊，讓個位數上下對齊。表頭與內容之間原本要用 `outline` 實線加強，但那條規則權重輸給共用元件、從未生效（見「已知限制」）。 表格內直接編輯：目前的格子是一條貼齊格線的 2px 直角框，編輯中不加光暈（`--dt-active-*`、`--dt-editing-shadow`）。
- **表單**：欄位 2px 圓角、1px `--app-field-border` 實框（對外側底色 ≥ 3:1），聚焦時框線換成 2px `--mat-sys-primary`，錯誤時換 error 色。標籤可以用全大寫英文或小字 caption，像工程圖的欄位標示。數字輸入（金額、里程、天數）用 mono。
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

## 已決定（2026-09-26 審核）

- 硬邊陰影顏色用 `--mat-sys-outline`（藍圖感，暗色配色下也不刺眼），不用 `--mat-sys-on-surface`。
- 保留每 140px 的主格線，但只比細格線略深，維持低調，不可干擾閱讀。

## 已知限制（ticket 06 實作紀錄，2026-09-26）

- **表頭分隔線沒有加強**：準則要的「表頭與內容之間用 `outline` 實線」原本寫成 `.dt-table thead tr { border-bottom: … }`，權重（0-3-2）輸給 data-table 元件封裝後的 0-4-2，實際一直是 `outline-variant`（2026-09-28 量測確認）。改成變數時為了畫面不變沒有補上；要加強只要在 grid `recipes.scss` 的 `.dt-table` 加 `--dt-head-border-color: var(--mat-sys-outline);`，需要先看截圖定案。
- **對話框／選單／欄位邊框**：既有 `.mat-mdc-dialog-surface`、`.mat-mdc-menu-panel`、`.mat-datepicker-content`、`.mat-mdc-text-field-wrapper.mdc-text-field--filled` 都補了 1px 實線框（前三者 `--mat-sys-outline`，欄位 `--app-field-border`）；欄位群組（`.ui-field-group`）為避免相鄰欄位雙線，中間欄位改 `border-left: 0`，原本的裝飾用 `::before` 分隔線保留。
- **表格欄線只加在儲存格右側**（`--dt-col-divider`，最後一欄由元件歸零；DOM 上最後一欄是手機才顯示的展開欄，所以桌機可見的最後一欄仍有右線，與改前相同），未在 `<tr>` 加左右外框，外框由 `--dt-frame: 1px solid outline` 提供。
