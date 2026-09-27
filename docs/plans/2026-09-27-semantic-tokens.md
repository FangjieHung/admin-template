# 計畫：語意用途變數與組合覆寫層（2026-09-27）

背景：ticket 09 定案後，使用者問「某個質地 × 配色想改邊框色、焦點色，好不好維護」。盤點（`design-taste-frontend` 審視）結論：8 套配色的顏色變數齊全，缺的是「用途變數」，質地與元件各自用 `color-mix`、`rgba()`、魔術數字重複實作同一種用途，沒有單一調整點。使用者決定全部處理，含圓角、圖層順序、選取文字顏色與五項補強。

## 分層規則（先讀）

| 層 | 選擇器 | 權重 | 放什麼 |
| --- | --- | --- | --- |
| 1. 預設 | `:root` | 0-1-0 | 每個 `--app-*` 用途變數的預設值，指向既有 `--mat-sys-*`。新檔 `libs/theme-pack/src/lib/styles/_semantic.scss` |
| 2. 質地 | `:root[data-paradigm='x']` | 0-2-0 | 造型相關的用途變數（邊框濃淡、狀態層濃度、陰影、動態、遮罩模糊） |
| 2. 配色 | `:root[data-theme='x']` | 0-2-0 | 顏色本身需要例外時（例如深色配色的陰影色調） |
| 3. 組合 | `:root[data-paradigm='x'][data-theme='y']` | 0-3-0 | 只有某一格需要例外時。新檔 `libs/theme-pack/src/lib/styles/_combos.scss`，一開始是空的，只放說明 |

同一個變數**不可以同時在質地層與配色層定義**（兩者權重相同，會變成看載入順序決定）。質地層與配色層都要改同一個變數時，就用組合層。

## 新增的變數

| 變數 | 預設（層 1） | 用途 |
| --- | --- | --- |
| `--app-focus-ring` | `var(--mat-sys-primary)` | 焦點框顏色 |
| `--app-focus-ring-width` / `--app-focus-ring-offset` | `2px` / `2px` | 焦點框粗細與距離（各處現值不同時，由質地層覆寫成現值） |
| `--app-border-emphasis` | `var(--mat-sys-outline-variant)` | 強調邊框；各質地在層 2 以 `color-mix` 覆寫成現在的濃度 |
| `--app-state-hover` / `--app-state-pressed` / `--app-state-selected` | `color-mix(in srgb, var(--mat-sys-on-surface) 8% / 12% / 16%, transparent)` 之類 | 滑過／按下／選取的底色疊加 |
| `--app-shadow-tint` | 層 2 material 設 `rgb(35 34 32)`（現值） | Material 陰影的色調 |
| `--app-shell-hairline` / `--app-shell-scrollbar` / `--app-shell-hover` / `--app-shell-subtle` | `color-mix(in srgb, var(--app-shell-on) 16% / 24% / 12% / 8%, transparent)` | 深色側欄的細線、捲軸、滑過、淡底 |
| `--app-scrim` / `--app-scrim-blur` | Material 現在的遮罩色 / `0px` | 對話框、抽屜背後的遮罩 |
| `--app-motion-fast` / `--app-motion-base` / `--app-motion-slow` / `--app-ease-standard` | `150ms` / `200ms` / `400ms` / `cubic-bezier(0.2, 0, 0, 1)` | 轉場速度 |
| `--app-disabled-fg` / `--app-disabled-bg` / `--app-disabled-opacity` | on-surface 38% / on-surface 12% / `0.38` | 停用狀態 |
| `--app-z-*` | 見下 | 跨元件的圖層順序 |
| `--app-selection-bg` / `--app-selection-fg` | `var(--mat-sys-primary-container)` / `var(--mat-sys-on-primary-container)` | 選取文字 |

圓角沿用既有 `--mat-sys-corner-*`，不新增；只把寫死的值換成它。

圖層順序：只替「會跟別的元件互相遮擋」的層命名，值維持現狀；元件內部自己的疊放（`z-index: 1`、`-1`）不必改。預計：`--app-z-sticky`（頁內固定列）、`--app-z-drawer`（responsive-panel 的 100/101）、`--app-z-floating`（外觀浮動面板 500）；CDK overlay 的 1000 只在註解中記錄，不改。實際層級以盤點結果為準。

## 第一批：畫面不變（值完全照舊）（已完成，commit 66a9fe5、a3de927、45d11b8；驗收補做後修正 1478720）

1. 新增 `_semantic.scss`、`_combos.scss`，接進 theme-pack 的樣式入口。
2. 焦點框、強調邊框、狀態疊加、Material 陰影色調、遮罩（預設 = 現況）、圖層順序改成用變數。質地層覆寫成各自現值，確保每個組合的**計算後數值**完全相同。
3. 對比掃描加上「輸入框邊框對底色 3:1」與「選取文字 4.5:1」兩組量測。
4. `lint:theme` 加規則：擋 `rgba(`／`rgb(` 寫死色（`_semantic.scss`、質地 `_tokens.scss` 的陰影定義除外，需逐條列出允許清單）、擋 `outline: … var(--mat-sys-primary)`、擋元件 scss 裡 ≥10 的 z-index 數字。
5. CONTRACT.md 補「用途變數」一節與分層規則；新增 ADR 0008。

驗收：改前、改後各跑一次「計算樣式快照」腳本（7 質地 × 相容配色 × 代表元素的一般／hover／focus 狀態，記錄 outline、border、background、box-shadow、z-index、transition），兩份 JSON 必須完全相同；另加截圖位元組比對。

## 第二批：會改變畫面（需要使用者看截圖）（已完成，commit 6204259、20310ae、3b4bfb3 與本文件所在的 docs commit）

1. 深色側欄 7 處寫死的半透明白改成 `--app-shell-*`。
2. Material 陰影色調改成跟著配色走（淺色配色取 on-surface 的色相；深色配色 Midnight 退回近黑，做法參考 Soft UI 已有的邏輯）。
3. 遮罩改成跟著配色走，Frosted 加輕微模糊。
4. 寫死的圓角（`2rem`、`1rem`、`14px`、`0.5rem` 等）換成最接近的 `--mat-sys-corner-*`；`999px` 膠囊與 `50%` 圓形只列清單，不改。
5. 9 種轉場時間收斂成 3 檔；`@media (prefers-reduced-motion: reduce)` 在層 1 把 3 檔設為 `0ms`。
6. 停用狀態：Soft UI、Clay 等自訂按鈕／膠囊的 `:disabled`／`.is-disabled` 套用 `--app-disabled-*`，並去掉浮雕陰影。
7. 選取文字套用 `--app-selection-*`（深色側欄內用 shell 色另訂）。
8. Frosted 在 `@media (prefers-reduced-transparency: reduce)` 改成實色、關掉 `backdrop-filter`。

驗收：7 質地 × 相容配色的改前／改後對照圖（儀表板、訂單列表、開啟的對話框），對比掃描 0 不合格，測試與 build 通過。

## 第三批：欄位邊界（已完成，commit c2fdbd5、bebd784 與本文件所在的 docs commit）

1. 新增 `--app-field-border`（預設 outline；只有 Verdant 在配色層混 68% on-surface-variant）。
2. 各質地的呈現形式：material／linen 恢復 1px 底線、grid／editorial／frosted 邊框、soft-ui／clay 加 1px inset 細框、outlined 欄位外框與錯誤／停用狀態統一在 `component.scss`、admin 搜尋膠囊加 inset 細框。
3. `contrast:theme` 的 `input_border_on_surface` 擴充到建單頁、訂單列表篩選列、優惠券對話框三個畫面與所有欄位形式；`lint:theme` 擋欄位邊框用非 `--app-field-border` 的顏色。
4. 文件：CONTRACT.md 用途變數表、ADR 0008「欄位邊界」一節、7 份質地準則的表單段落。

驗收：改前（HEAD eb1243f）／改後 43 個相容組合 × 3 畫面對照圖、7 張質地特寫、focus 與錯誤狀態特寫；對比掃描 43 個相容組合欄位邊界最低 3.17（56 格全過），其他 pair 0 不合格；theme-pack／admin／affiliate／booking 測試、admin build、`lint:theme`、`vitest run scripts` 通過。

## 第四批：原生勾選框與狀態對比（已完成，commit 1f34ea3、e063df5、58cf622 與本文件所在的 docs commit）

1. 新 partial `libs/theme-pack/src/lib/styles/_choice-controls.scss`（接進 admin／affiliate／booking）：原生 `input[type=checkbox|radio]` 以 `appearance: none` 重畫，保留原生 input；未勾選 `--app-field-border` 外框＋`--mat-sys-surface` 底、勾選／半選 `--mat-sys-primary` 底＋`--mat-sys-on-primary` 記號、滑過 `--mat-sys-on-surface`、焦點 `--app-focus-ring`、錯誤 `--mat-sys-error`、停用 `--app-disabled-fg`；18px、圓角 `min(4px, corner-small)`；`forced-colors` 退回原生。mat-checkbox／mat-radio 的 MDC 顏色 token 指向同一組變數。Soft UI／Clay 未勾選時加小內凹，其餘質地不加。
2. 元件：data-table、可用車輛單選拿掉寫死尺寸與 `accent-color`；可用車輛的焦點框留在整列。
3. `contrast:theme` 新增 `field_hover_border`、`field_focus_indicator`、`field_error_border`、`check_unchecked_border`、`check_checked_fill`、`check_mark`、`check_focus_ring`（皆 3:1）。
4. `lint:theme` 擋勾選框／單選鈕寫死顏色、MDC 勾選 token 與 `accent-color` 非變數；預設掃描納入 `libs/ui`、`libs/booking-flow`、`libs/contract-signing`，10 處既有違規改成 token（新增 `--app-z-sticky: 20`）。
5. 文件：CONTRACT.md 用途變數表、ADR 0008「原生勾選框與狀態對比」一節、質地準則（圓角 small 列、Soft UI／Clay 的勾選框段落）。

驗收：改前（HEAD 34b7fed）／改後 43 個相容組合 × 2 畫面（data-table、可用車輛）＋ booking 保險方案對照圖、7 質地的勾選框／單選鈕狀態特寫、欄位滑過／焦點／錯誤特寫；對比掃描 56 格 0 不合格（新 pair 在相容組合最低 3.17，不需調整變數）；鍵盤實測（Tab／Space／方向鍵）通過；theme-pack／admin／affiliate／booking 測試、admin／booking build、`lint:theme`、`vitest run scripts` 通過。

## 遺留項目收尾（已完成，commit b6a690c、ab4d5d3、67e1955 與本文件所在的 docs commit）

1. 關鍵影格動畫：進場動畫吃 `--app-motion-base`／`--app-ease-standard`，循環動畫吃新的 `--app-motion-loop`（8s），減少動態時全部歸零、循環動畫另以 `animation: none` 停止；`lint:theme` 擴充到 `animation*`。
2. `.ui-text-numeric`：取代 21 處寫死的 `tabular-nums`，Grid 換 `var(--font-mono), var(--font-zh)`；data-table 的 `align: 'end'` 欄自動掛上。
3. data-table：`--dt-*` 外觀變數，移除所有 `.dt-table` 相關 `!important`。
4. booking 前台改前（3bfa52d）／改後逐像素對照，差異皆為第二～四批預期內的變更。

驗收：43 個相容組合計算樣式改前／改後比對（表格 280,962 欄位、數字元素 17,044 欄位，0 非預期差異）、減少動態模擬下所有動畫 0s 或停止、Grid × Verdant 建單頁金額特寫；對比掃描 56 格 0 不合格；theme-pack／ui／order-form／booking-flow／admin／affiliate／booking 測試、admin／booking build、`lint:theme`、`vitest run scripts`（排除 `.claude/worktrees`）通過。
