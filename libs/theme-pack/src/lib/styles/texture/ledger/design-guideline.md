# Ledger 帳冊質地準則

> 模板與術語見 [`../README.md`](../README.md)。顏色只用語意 token（`--mat-sys-*`、`--app-*`），由配色軸提供；斑馬紋、分隔線的顏色也從 `--mat-sys-on-surface`、`--mat-sys-outline*` 調出。決策紀錄見 [ADR 0011](../../../../../../../docs/adr/0011-ledger-texture.md)。

## 一句話個性

帳冊、試算表、金融終端機：一頁塞得下最多資料，一眼對得齊數字。

## 造型規格

| 項目 | Token | 值 | 用在 | 現況 → 目標 |
| --- | --- | --- | --- | --- |
| 圓角 small / medium | `--mat-sys-corner-small` / `-medium` | 2px / 3px | 按鈕、欄位、徽章 / 提示訊息 | — |
| 圓角 large / extra-large | `--mat-sys-corner-large` / `-extra-large` | 4px / 4px | 卡片、選單、日期選擇器、對話框 | — |
| 圓角 full | `--mat-sys-corner-full` | 3px | 膠囊類元件也是小方角 | — |
| 陰影 level1–4 | `--mat-sys-level1`…`-level4` | `0 0 0 1px` 細框（1–2 用 outline-variant，3–4 用 outline），沒有模糊與偏移 | 選單、下拉面板等 Material 浮層（另把各元件的 `--mat-*-elevation-shadow` 指向它或 `none`） | — |
| 斑馬紋 | `--ledger-stripe` | on-surface 6% | 表格偶數列、選項清單、`mat-list` | — |
| 表頭底 | `--ledger-head-bg` | on-surface 9% 混進 surface | 資料表、`mat-table` 表頭 | — |
| 分隔線 | `--ledger-rule` / `--ledger-rule-strong` | outline-variant / outline | 列線、卡片框 / 表頭下緣、卡片標題列下緣、浮層框 | — |
| 焦點框 | `--app-focus-ring-offset` | 1px（寬度維持 2px） | 全部可聚焦元件 | — |
| 字體 | `--font-body` / `--font-display` / `--font-mono` | 裝置無襯線（Helvetica Neue／Segoe UI／Roboto／Arial）接 `--font-zh` / 同內文 / IBM Plex Mono | 內文與 Material 元件（`--mat-sys-*-font` 一併指向內文字）/ 標題 / `.ui-text-numeric`、`.ui-text-display`、數字輸入 | — |
| 字級 | `body` 13px；Material `body-medium` 13px、`label-large` 13px、`label-small` 12px | 全站下限 12px；欄位內文維持 16px（浮動標籤縮 0.75 倍＝12px，iOS 聚焦不放大） | 內文、按鈕、選單 | — |
| 視覺密度 | Material 密度 token、`--dt-*`、`--spacing` | 按鈕／圖示按鈕 32px、欄位 48px、選單項 36px、清單列 40px、分頁籤 40px；資料表列 ≈ 35px（`--dt-cell-padding-block: 0.375rem`、`--dt-font-size: 0.8125rem`）、表頭 ≈ 33px；Tailwind 間距單位 3px（原 4px） | 全站 | — |
| 動態 | `--app-motion-base` / `-slow` | 都等於 `--app-motion-fast`（150ms）；不位移、不縮放 | 轉場、面板滑入 | — |
| 背景紋理 | — | 無（素色畫布） | — | — |

## 層次表現

**用斑馬紋＋分隔線分層，所有表面貼平。** 畫布是素色的 `--mat-sys-background`，卡片是 `--mat-sys-surface` 加 1px outline-variant 框，不浮起。卡片裡的資料一列一列排下去：列與列之間一條 outline-variant 細線，偶數列疊一層 6% 的淡底，表頭再深一階並用一條 outline 實線（帳冊的「粗線」）和內容分開。卡片標題列下緣同樣是一條 outline 實線。

浮層（選單、下拉面板、日期選擇器、對話框）也不浮：它們是一塊 1px outline 框的平面，對話框靠遮罩隔開背景。

和其他質地的差別：Linen 用紙張色階（整塊表面換顏色），Editorial 用字級與留白，Grid 用框線粗細加硬邊偏移影子；Ledger 的層次只發生在**資料列**上——同一張卡片裡，斑馬紋讓眼睛沿著一列橫向讀下去，細線把每一筆隔開。

像 Figma 裡一張試算表樣板：沒有任何 effect，表格列用交替的 fill，表頭一個深一點的 fill 加 1px 底線。

## 新增頁面規則

- **卡片**：`.ui-card`，1px outline-variant 框、4px 圓角、沒有陰影；內距用 `p-4 sm:p-6`（在 Ledger 是 12／18px）。可點卡片 `.ui-card--clickable` 滑過時底色淡淡加深，不位移、不加影子。
- **表格**：一律用 `lib-data-table`；質地已設好 `--dt-*`（字級、列高、斑馬紋、表頭底、勾選欄 32px）。數字欄給 `align: 'end'`，自動掛 `.ui-text-numeric`（等寬字）。自己寫的原生表格要斑馬紋，就在 recipe 的 `:is(.showcase__api, .pm, …)` 清單加上它的 class，或改用 data-table。 表格內直接編輯：像試算表——2px 直角框、沒有光暈，已修改是 6px 的角落小三角；列高不因編輯而改變（編輯器是無框的原生輸入框）。
- **日曆**：`lib-calendar` 只設 `--lib-cal-*`（CONTRACT.md「共用日曆」）。高密度：月曆格 4.75rem、時段 1.125rem、活動 11px、直角，帳簿格線與等寬日期數字，分組列用帳簿表頭底色。
- **表單**：欄位 48px、2px 圓角、1px `--app-field-border` 實線框，聚焦時換主色並加粗為 2px（內側 1px 陰影補粗，不改外框尺寸）。數字輸入（`type="number"`）自動用等寬字。相連欄位用 `.ui-field-group`，接縫是一條完整的直線。
- **空狀態**：卡片內置中，一個圖示、一句說明、一個動作；不加色塊或框（`--app-empty-*` 維持預設）。
- **對話框**：4px 圓角、1px outline 框、沒有陰影；標題 16px 粗體，標題下一條 outline 線、動作列上一條 outline-variant 線。
- **chip／徽章**：`.ui-chip` + tone，2px 圓角、高 ≈ 22px、外加一圈 30% tone 色細框；狀態不可只靠顏色表達。

## Do / Don't

**Do**

- 長清單一律用 data-table，讓斑馬紋和列線出現；一頁看得到的列數是這個質地的賣點（1440×900 下資料表約 24 列，Material 約 12 列）。
- 金額、數量、日期、單號用 `.ui-text-numeric` 或 `align: 'end'`，讓數字以等寬字直向對齊。
- 用 1px 線分隔區塊，表頭與標題列下緣用較深的 outline。
- 保持字級 ≥ 12px；需要再小的資訊就拿掉，不要縮字。
- 互動元件可見尺寸至少 24px（WCAG 2.5.8）；觸控為主的頁面另外放大（見下方「未達 44px」）。

**Don't**

- 用陰影、模糊或位移表示前後與 hover（浮層也只用 1px 框）。
- 在卡片裡再包一層有框的卡片；同一張卡片內只用分隔線切區。
- 用大圓角、膠囊形按鈕或徽章。
- 在畫布或卡片上加紋理、漸層、光暈。
- 為了更密而把欄位內文縮到 16px 以下（浮動標籤會小於 12px，iOS 聚焦時也會放大整頁）。

**未達 44px（WCAG 2.5.5 AAA）的地方**：按鈕、圖示按鈕、勾選欄熱區、權限矩陣格子、選單項目是 32–36px，Material 的隱形 48px 觸控熱區已關閉（會蓋到密集排列的隔壁元件）。全部 ≥ 24px，符合 2.5.8 AA。觸控為主的專案不建議預設用這個質地。

## 相容配色

見 [`theme.token.ts`](../../../theme/theme.token.ts) 的 `TEXTURE_COMPATIBILITY.ledger`。
