# Cockpit 儀表艙質地準則

> 模板與術語見 [`../README.md`](../README.md)。顏色只用語意 token（`--mat-sys-*`、`--app-*`），由配色軸提供；亮邊、光暈、刻度的顏色一律從 `--mat-sys-primary` 以 `color-mix()` 調出，暗角取配色的 `--app-shadow-tint`。決策紀錄見 [ADR 0012](../../../../../../../docs/adr/0012-cockpit-texture-and-dark-colors.md)。

## 一句話個性

深色的飛航儀表艙：數字像刻度、狀態一眼看出亮暗，越重要的東西越亮。

## 造型規格

| 項目 | Token | 值 | 用在 | 現況 → 目標 |
| --- | --- | --- | --- | --- |
| 圓角 small / medium | `--mat-sys-corner-small` / `-medium` | 4px / 6px | 按鈕、欄位、徽章 / 提示訊息、品牌標、頭像 | — |
| 圓角 large / extra-large | `--mat-sys-corner-large` / `-extra-large` | 8px / 8px | 卡片、選單、日期選擇器、對話框 | — |
| 圓角 full | `--mat-sys-corner-full` | 6px | 開關軌道、FAB：圓角方鍵，不是整顆膠囊 | — |
| 髮絲亮邊 | `--cockpit-edge` / `--cockpit-edge-strong` | primary 22% / 50% 混進 outline-variant | 靜止卡片、側欄右緣、卡片標題列下緣 / 浮層、啟用中的元件、表頭下緣 | — |
| 光暈 | `--cockpit-glow-1`…`-3`、`--cockpit-glow-active` | `0 0 12/20/36px` primary 22/28/34%；啟用 `0 0 14px` primary 50% | 滑過的卡片、浮層、對話框；目前項目、焦點、實心主要按鈕 | — |
| 陰影 level1–4 | `--mat-sys-level1`…`-level4` | 1：只有 1px 亮邊；2–4：亮邊＋光暈 1–3（沒有偏移，是一圈光，不是影子） | Material 浮層（另把各元件的 `--mat-*-elevation-shadow` 指向它或 `none`） | — |
| 表面亮度 | `--mat-sys-background` → `surface` → `surface-container` → `-high` → `-highest` | 畫布 → 卡片 → 滑過的卡片 → 選單／日期選擇器 → 對話框 | 越前面越亮一階 | — |
| 選取底 | `--app-state-selected`（`--cockpit-lit`） | primary 16% | 卡片分頁標籤、導覽膠囊目前項目 | — |
| 焦點框 | `--app-focus-ring-*` | 2px 主色實線、離 2px，外加 `--cockpit-glow-active` | 全部可聚焦元件 | — |
| 字體 | `--font-display` / `--font-body` / `--font-mono` | Barlow Condensed 接 `--font-zh` / 裝置無襯線（Helvetica Neue／Segoe UI／Roboto／Arial）接 `--font-zh` / IBM Plex Mono | 頁面大標、小節標、caption、表頭、對話框標題 / 內文與 Material 元件 / `.ui-text-numeric`、`.ui-text-display`、數字輸入；`body` 全面 `tabular-nums` | — |
| 大數字 | `.ui-text-display` | 等寬字、主色微光、底下一排 0.25em 間距的刻度線＋1px 基線 | KPI、統計卡 | — |
| 視覺密度 | — | 與 Material 相同（不改元件尺寸） | — | — |
| 動態 | `--app-motion-fast` | 只有光暈、底色、亮邊的短淡入淡出；不位移、不縮放；減少動態時歸零 | 滑過、聚焦、展開 | — |
| 背景紋理 | — | 無；畫布四周一圈極淡的暗角（`--app-shadow-tint` 35%） | `.app-shell` | — |

## 層次表現

**用亮度分層：越前面越亮，外面多一圈主色的光。** 畫布最暗（四周還有一圈淡淡的暗角），卡片亮一階、只有一條帶主色的 1px 髮絲亮邊；選單、日期選擇器再亮一階、亮邊變強、外面一圈柔光；對話框最亮、光暈最大。沒有任何往下投的影子——box-shadow 只有模糊、沒有偏移。

狀態也用亮度表達：滑過的可點卡片換亮一階的表面並開始發光；目前所在的選單項目、啟用的膠囊、勾選的勾選框、鍵盤焦點像亮起的指示燈（小而亮的光暈）；狀態徽章的圓點是一顆亮著的 LED（中性狀態不亮）。

和其他質地的差別：Material 用往下投的模糊陰影、Linen 用紙張色階（沒有光）、Grid 用硬邊偏移影子、Frosted／Aero 用透光的玻璃；Cockpit 的面板不透明，前後只看「多亮、發不發光」。拿掉光暈與亮邊，它就退化成一張平的深色卡片。

像 Figma 裡一個 drop shadow 把 X/Y 都設 0、只留 blur 和主色——它是外光暈（outer glow），再配一條 1px、帶一點主色的 inside stroke。

**只用在深色配色上。** 光暈在淺色底上讀不出來（白底上的橘色光暈像髒污），所以相容清單只有深色配色。

## 新增頁面規則

- **卡片**：`.ui-card`，`--mat-sys-surface` 底、1px `--cockpit-edge` 亮邊、8px 圓角、頂端一條 1px 內側反光；不要加陰影。可點卡片 `.ui-card--clickable` 滑過時換 `surface-container`、亮邊變強、外面一圈光，不位移。`.ui-card--inverse` 在這個質地是「點亮的顯示面板」：主色容器底＋強亮邊＋光暈。
- **表格**：一律用 `lib-data-table`；表頭是 `surface-container` 的標示帶、窄體字、下緣一條強亮邊；列線是暗的 outline-variant；滑過的列疊 primary 10%。數字欄給 `align: 'end'`，自動掛 `.ui-text-numeric`（等寬字）。 表格內直接編輯：目前的格子像亮起的指示燈（焦點框＋`--cockpit-glow-active`），編輯中光暈再亮一階；已修改的格子 primary 12% 淡淡發亮。
- **日曆**：`lib-calendar` 只設 `--lib-cal-*`（CONTRACT.md「共用日曆」）。格線是 cockpit-edge，活動是類別色 22% 的發光片，現在線是會發光的主色線，今天是亮起來的方塊，拖曳中光最強。
- **表單**：欄位是凹進去的讀數窗——最暗的 `surface-container-lowest` 底、1px `--app-field-border` 實線框、4px 圓角；聚焦時框換主色、外面亮一圈。數字輸入自動用等寬字。相連欄位用 `.ui-field-group`。
- **空狀態**：卡片內置中，一個圖示、一句說明、一個動作；不加色塊或框（`--app-empty-*` 維持預設）。
- **對話框**：`surface-container-highest` 底（全站最亮的表面）、強亮邊＋最大光暈、8px 圓角；標題 22px 窄體。遮罩用配色的 `--app-scrim`。
- **chip／徽章**：`.ui-chip` + tone，4px 圓角、暗底亮字、外加一圈 35% tone 色細框，圓點會發光（中性不發光）；狀態不可只靠顏色表達，文字一定要寫出來。

## Do / Don't

**Do**

- 讓「目前、選取、焦點」這些狀態發光，其餘保持暗；一眼掃過去，亮的就是要注意的。
- 金額、數量、時間、單號用 `.ui-text-numeric`，KPI 用 `.ui-text-display`，數字以等寬字直向對齊。
- 浮得越高的東西用越亮的表面（`surface-container` → `-high` → `-highest`）＋越大的 level token，不要自己寫 box-shadow。
- 光暈、亮邊、刻度一律用 `--cockpit-*` 或 `--mat-sys-level*`（都從 `--mat-sys-primary` 調出），換配色就跟著換色。
- 轉場只用 `--app-motion-fast`，只動 `box-shadow`、`background-color`、`border-color`。

**Don't**

- 用往下偏移的陰影（`0 4px 12px …`）表示前後；這個質地沒有影子，只有光。
- 讓大面積同時發光，或在一般內文、說明文字上加光暈（只有 KPI 數字有微光）。
- 在畫布或卡片上加雜訊、紋理、漸層；畫布只有那一圈暗角。
- 用超過 8px 的圓角或整顆膠囊按鈕。
- 把這個質地配淺色配色（相容清單已排除；光暈在淺底上讀不出來）。
- 用位移、縮放、彈跳當回饋；減少動態時光暈的淡入淡出也會歸零。

## 相容配色

見 [`theme.token.ts`](../../../theme/theme.token.ts) 的 `TEXTURE_COMPATIBILITY.cockpit`。
