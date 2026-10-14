# Brutal 新粗野質地準則

> 模板與術語見 [`../README.md`](../README.md)。顏色只用語意 token（`--mat-sys-*`、`--app-*`），由配色軸提供；墨線、墨影的顏色是 `--mat-sys-on-surface`，色塊是配色的 `background`／`surface`／`secondary-container`／`primary-container`（`_tokens.scss` 的 `--brutal-*`）。決策紀錄見 [ADR 0014](../../../../../../../docs/adr/0014-brutal-texture-and-signal-color.md)。

## 一句話個性

新粗野主義的海報與貼紙：粗黑框、飽和色塊、刻意不對稱，每一層是一塊不同顏色的紙。

## 造型規格

| 項目 | Token | 值 | 用在 | 現況 → 目標 |
| --- | --- | --- | --- | --- |
| 圓角 small / medium / large / extra-large | `--mat-sys-corner-*` | 全部 0 | 按鈕、欄位、卡片、選單、日期選擇器、對話框、頭像、品牌標 | — |
| 圓角 full | `--mat-sys-corner-full` | 0 | Material 預設為膠囊的元件（按鈕、開關、FAB）也是方的 | — |
| 膠囊 | `.ui-chip`、`mat-chip` | 999px | 全站唯一的圓角：狀態徽章與篩選 chip | — |
| 墨線 | `--brutal-line` / `--brutal-line-thick` | `2px` / `3px solid var(--mat-sys-on-surface)` | 按鈕、徽章、表格外框、標題列分隔 / 卡片、選單、日期選擇器、對話框、側欄右緣 | — |
| 色塊 | `--brutal-canvas` / `-card` / `-raised` / `-overlay` | `background` / `surface` / `secondary-container` / `primary-container` | 畫布 / 卡片 / 選單、下拉、日期選擇器、展開中的面板標題、滑過的表格列 / 對話框 | — |
| 墨影（貼紙厚度） | `--brutal-shadow-sm` / `--brutal-shadow` / `--mat-sys-level1–4` | 3px / 5px；level 4 / 6 / 7 / 8px，全部墨色、0 模糊、往右下 | 按鈕、徽章外的小元件 / 卡片 / Material 浮層 | — |
| 滑過／按下 | `--brutal-lift` / `--brutal-press(-sm)` | 往左上 2px＋影子變長 / 往右下 3–5px＋影子收成 0 | 按鈕、可點卡片、導覽膠囊 | — |
| 選取 | `--app-state-selected` | `--mat-sys-primary-container`（實心色塊） | 卡片分頁標籤、角色清單等目前項目 | — |
| 焦點框 | `--app-focus-ring-*` | 3px 主色實線、離 2px | 全部可聚焦元件 | — |
| 欄位邊界 | `--app-field-border`（就地覆寫） | 2px 墨色（`--mat-sys-on-surface`） | Material 欄位、勾選框、單選鈕；聚焦換主色＋4px 主色硬影 | — |
| 字體 | `--font-display` / `--font-body` / `--font-mono` | Space Grotesk 700 接 `--font-zh` / 裝置無襯線（Helvetica Neue／Segoe UI／Roboto／Arial）接 `--font-zh` / IBM Plex Mono | 頁面大標、小節標、`.ui-text-display`、表頭、對話框標題 / 內文與 Material 元件（label、title 字階一律 700） / 數字輸入 | — |
| 頁面大標 | `.topbar-heading h1` | 下半截墊一條 `--mat-sys-primary-container` 的螢光筆色塊（偏下、不對稱） | 每頁的大標 | — |
| 視覺密度 | — | 與 Material 相同（不改元件尺寸） | — | — |
| 動態 | `--app-motion-fast` | 只有位移與影子長短的短轉場；減少動態時不位移 | 滑過、按下 | — |
| 背景紋理 | — | 無；畫布本身就是一塊素色色塊 | — | — |

## 層次表現

**用色塊分層：每一層是一塊不同顏色的實心紙，用粗墨線框起來。** 畫布是 `background`、卡片是 `surface`、浮起的面板（選單、下拉、日期選擇器、展開中的面板標題）是 `secondary-container`、對話框是 `primary-container`。越前面的東西不是「浮得越高」，而是「換一張更搶眼的色紙」；每塊色紙都有 2–3px 的墨框，所以在任何配色下邊界都一眼看得出來。

右下那道墨色硬影是貼紙的厚度，不是前後的依據：卡片 5px、按鈕 3px、浮層 7–8px，全部 0 模糊。滑過時貼紙往左上翹起 2px、影子變長；按下時影子收成 0、貼紙往右下壓平。

和其他質地的差別：Material 是同一種白配不同高度的模糊陰影；Linen 是同色系紙張的明暗；Grid 是 1px 的 outline 細框、outline 色的 2–6px 硬影、所有表面同一種白、細格紋背景、等寬字；Brutal 的表面**彼此是不同顏色**，框線是 2–3px 的**墨色**、影子更重、沒有紋理、標題是粗黑體，拿掉色塊就只剩一般的粗框卡片。Soft UI／Clay 是體積、Editorial 是字級、Frosted／Aero 是透光、Ledger 是斑馬紋、Cockpit 是發光，都和色塊無關。

像 Figma 裡每個 frame 換一個實心 fill（不同顏色的 style）、stroke 3px 黑色 inside，再加一個 X/Y 5、blur 0 的黑色 drop shadow。

## 新增頁面規則

- **卡片**：`.ui-card`，`surface` 底、3px 墨框、5px 墨影、直角；卡片標題列下緣一條 2px 墨線。可點卡片 `.ui-card--clickable` 滑過時往左上翹 2px、影子變 7px，按下時壓平。`.ui-card--inverse` 是一整塊墨色（`inverse-surface`），影子換成 `primary-container` 色——全站唯一一張彩色影子的卡片，用在需要最搶眼的重點卡。
- **表格**：一律用 `lib-data-table`；外框 2px 墨線，表頭是 `primary-container` 色塊＋標題字粗體＋墨色下緣，滑過的列換 `secondary-container` 色塊。數字欄給 `align: 'end'`（`.ui-text-numeric`，tabular-nums）。 表格內直接編輯：目前的格子是 3px 墨框，編輯中再加 4px 實心墨影；已修改是大一號的墨色三角，錯誤格 2px 錯誤色框（匯入精靈的錯誤格一起變粗）。
- **日曆**：`lib-calendar` 只設 `--lib-cal-*`（CONTRACT.md「共用日曆」）。3px 墨框、2px 墨色格線、粗體展示字星期；活動是 2px 墨框的直角色塊（類別色 34%，字仍是墨色），今天是 primary-container 方塊＋墨影，拖曳中拖出最長的墨影，現在線是 3px 墨線。
- **表單**：欄位是白色（`surface-container-lowest`）填寫格、2px 墨框、直角、標籤粗體；滑過多一道 3px 墨影，聚焦時框換主色、右下一道 4px 主色硬影。相連欄位用 `.ui-field-group`（中間只留一條 2px 墨線）。
- **空狀態**：卡片內一張便條——`surface-container-low` 底、2px 墨色虛線框（`--app-empty-*`），裡面置中圖示、說明、動作按鈕。
- **對話框**：`primary-container` 整塊色紙、3px 墨框、8px 墨影、直角；標題 24px Space Grotesk 粗體，標題列與動作列各一條 2px 墨線。遮罩用配色的 `--app-scrim`。
- **chip／徽章**：`.ui-chip` + tone，999px 膠囊、tone 色底、2px 墨框、粗體小字，圓點外一圈墨線；狀態不可只靠顏色表達，文字一定要寫出來。

## Do / Don't

**Do**

- 每一層換一塊色：畫布、卡片、浮層、對話框用 `--brutal-canvas/-card/-raised/-overlay`，不要自己挑顏色。
- 框線一律是墨色（`--brutal-line`、`--brutal-line-thick`），影子一律是墨色、0 模糊、往右下（`--brutal-shadow*`、`--mat-sys-level*`）。
- 回饋用位移：滑過往左上翹、按下往右下壓平（影子同時收起）；減少動態時只換影子。
- 標題、表頭、按鈕、欄位標籤用粗體；頁面大標可以墊螢光筆色塊，其他文字不要。
- 需要「這是目前項目」時用實心色塊（`--app-state-selected`），不要用淡淡的疊加。

**Don't**

- 用模糊陰影或透明度表示前後（那是 Material／Frosted）。
- 用 1px 的灰色細框（那是 Grid、Ledger）；這個質地的框一定是 2–3px 墨線。
- 在畫布或卡片上加紋理、漸層、雜訊。
- 讓狀態徽章以外的元件變成膠囊或圓角。
- 在一般內文、說明文字上墊色塊，或讓整頁同時出現四種以上的色塊（色塊是分層用的，不是裝飾）。
- 把這個質地配低彩度或深色配色（相容清單已排除：色塊太淡就分不出層，深色下墨線變成淺色線）。

## 相容配色

見 [`theme.token.ts`](../../../theme/theme.token.ts) 的 `TEXTURE_COMPATIBILITY.brutal`。
