# Riso 孔版質地準則

> 模板與術語見 [`../README.md`](../README.md)。顏色只用語意 token（`--mat-sys-*`、`--app-*`），由配色軸提供；主墨是 `--mat-sys-primary`、第二墨是 `--mat-sys-secondary`、文字墨是 `--mat-sys-on-surface`（`_tokens.scss` 的 `--riso-*`）。決策紀錄與可讀性規則見 [ADR 0015](../../../../../../../docs/adr/0015-riso-texture-and-duotone-color.md)。

## 一句話個性

孔版印刷的文創刊物：兩種特別色疊印在非塗佈紙上，有紙張顆粒、網點和一點點套色錯位，字永遠印得乾淨。

## 造型規格

| 項目 | Token | 值 | 用在 | 現況 → 目標 |
| --- | --- | --- | --- | --- |
| 圓角 small / medium / large / extra-large | `--mat-sys-corner-*` | 3 / 6 / 8 / 12px | 按鈕、欄位 / 選單 / 卡片、對話框、日期選擇器 / 大面板 | — |
| 圓角 full | `--mat-sys-corner-full` | 999px | 導覽膠囊、狀態徽章、chip、圖示按鈕、FAB | — |
| 墨線 | `--riso-line` / `--riso-rule` | `1.5px solid` 主墨 / `1px` 主墨 45% | 卡片、選單、對話框、表格外框、按鈕外框 / 卡片標題列、對話框標題列與動作列、分頁籤下緣 | — |
| 各層的底 | `--riso-paper` / `-card` / `-raised` / `-overlay` | `background` / `surface` / 第二墨 12% 平網 / 主墨 10% 平網 | 畫布 / 卡片 / 選單、下拉、日期選擇器、展開中的面板標題、滑過的表格列 / 對話框 | — |
| 網點 | `--riso-screen-sparse` / `-dense` / `-heading` | 第二墨圓點、45° 網角、4px 網距，約 22% / 43% 覆蓋；大標用第二墨 45% 淡色、5px 網距 | 卡片右下 8px 的網點影 / 滑過的可點卡片 / 頁面大標下半截 | — |
| 平網影 | `--mat-sys-level1–4` | 偏移固定 8px、0 模糊；第二墨 25 / 35 / 50%，level 4 是主墨 35% 疊在第二墨 60% 上 | mat-card、浮起按鈕 / — / 選單、下拉、日期選擇器 / 對話框 | — |
| 套色錯位 | `--riso-misreg` / `-hover` / `-pressed` | 第二墨往左下錯開 2px / 3px / 0 | 實心與 tonal 按鈕、目前選單項目、啟用的導覽膠囊、反轉卡片、品牌標、頭像、提示訊息 | — |
| 紙張顆粒 | `--riso-grain-mask` / `--riso-grain-color` | fractal noise 遮罩（只取透明度）＋文字墨 9% | 只在 `body::before`（頁面底層） | — |
| 選取／滑過 | `--app-state-selected` / `-hover` / `-pressed` | 主墨 16% / 第二墨 12% / 20% 平網 | 卡片分頁標籤、角色清單等目前項目 / 滑過與按下 | — |
| 焦點框 | `--app-focus-ring-*` | 2px 主色實線、離 2px（預設值） | 全部可聚焦元件 | — |
| 欄位邊界 | `--app-field-border` | 1.5px，配色層的值；聚焦換主色並加粗到 2px | Material 欄位 | — |
| 字體 | `--font-display` / `--font-body` / `--font-mono` | Bricolage Grotesque 700 接 `--font-zh` / 裝置無襯線（Helvetica Neue／Segoe UI／Roboto／Arial）接 `--font-zh` / IBM Plex Mono | 頁面大標、小節標、`.ui-text-display`、對話框標題 / 內文與 Material 元件 / 數字輸入、`.ui-text-numeric` | — |
| 視覺密度 | — | 與 Material 相同（不改元件尺寸） | — | — |
| 動態 | `--app-motion-fast` | 只有網點密度與錯位長短的短轉場；不位移 | 滑過、按下 | — |
| 背景紋理 | `body::before` | 極淡的紙張顆粒；高對比與減少透明度時拿掉 | 只在頁面底層 | — |

## 層次表現

**用網點與疊印分層：越前面的層，墨越多。** 畫布是裸紙（只有極淡的顆粒）；卡片是紙加一圈主墨線，右下露出一塊第二墨的稀網點；浮起的面板（選單、下拉、日期選擇器、展開中的面板標題、滑過的列）整塊疊上第二墨 12% 的平網，影子是 50% 的平網；對話框疊主墨 10% 的平網，影子是兩種墨疊印出來的混色。

影子的偏移**永遠是 8px**：前後不看影子多長，只看網點或平網有多密、是一種墨還是兩種墨疊在一起。滑過的可點卡片網點變密（墨多一層＝往前一層）；實心按鈕滑過時套色錯位多 1px，按下時兩版對準（錯位歸零）。

和其他質地的差別：Material 是模糊陰影的高度；Linen 是同色系紙張的明暗加布紋；Grid 是 1px 灰框、越前面越長的硬影、格紋背景；Brutal 是飽和色塊、2–3px 墨框、越前面越長的墨影、沒有紋理；Riso 的影子長度固定、由**圓點網點**畫成、層次只看墨的覆蓋率，表面是平網淡色而不是飽和色塊，背景是隨機的紙張顆粒而不是規則線條。Soft UI／Clay 是體積、Editorial 是字級、Frosted／Aero 是透光、Ledger 是斑馬紋、Cockpit 是發光。

像 Figma 裡每個 frame 的 fill 是同一張紙色疊一層不同透明度的特別色，drop shadow 換成一個填滿圓點圖樣的矩形（X/Y 8、不模糊），再在按鈕底下複製一份第二墨的圖層往左下推 2px。

## 新增頁面規則

- **卡片**：`.ui-card`，紙底、1.5px 主墨線、8px 圓角，右下的網點影由質地自動畫（偽元素 `::after`，只露在卡片外側）。卡片標題列下緣一條 `--riso-rule`。可點卡片 `.ui-card--clickable` 滑過時網點變密，不位移。`.ui-card--inverse` 是一整塊墨色，左下一道第二墨錯位。卡片自己不要再用 `::after`，也不要設 `overflow: hidden`（會裁掉網點影；需要裁切時用 `overflow: clip`，質地已放寬裁切邊）。
- **表格**：一律用 `lib-data-table`；外框 1.5px 主墨線，表頭是主墨 9% 平網＋一條主墨線，列與列之間是主墨 22% 細線，滑過的列換第二墨平網。表格是資料密集的表面：**不放網點、不做錯位**。數字欄給 `align: 'end'`（`.ui-text-numeric`，IBM Plex Mono）。 表格內直接編輯：目前的格子是 2px 主墨線（不做網點、不做錯位），已修改是主墨的角落三角（第二墨對淡底不到 3:1）＋第二墨 10% 平網。
- **日曆**：`lib-calendar` 只設 `--lib-cal-*`（CONTRACT.md「共用日曆」）。外框主墨線、格線主墨 22%；活動是類別色平網＋實墨色條（字不錯位），今天是主墨圓章、色塊外帶套色錯位，拖曳中帶錯位影。
- **表單**：欄位是白紙填寫格、1.5px 欄位邊界（配色層的 `--app-field-border`）、3px 圓角；滑過邊界換文字墨，聚焦換主色並加粗到 2px。相連欄位用 `.ui-field-group`。欄位上不放網點。
- **空狀態**：卡片內一張便條——紙底、1.5px 主墨虛線框（`--app-empty-*`），裡面置中圖示、說明、動作按鈕。
- **對話框**：主墨 10% 平網的紙、1.5px 主墨線、8px 圓角，影子是兩墨疊印（level 4）；標題 24px Bricolage Grotesque 700，標題列與動作列各一條 `--riso-rule`。遮罩用配色的 `--app-scrim`。
- **chip／徽章**：`.ui-chip` + tone，999px 膠囊、tone 色底、粗體小字、實心圓點；狀態不可只靠顏色表達，文字一定要寫出來。

## Do / Don't

**Do**

- 前後關係用墨的覆蓋率表達：紙 → 稀網點 → 平網 → 兩墨疊印（`--riso-paper/-card/-raised/-overlay`、`--mat-sys-level*`）。
- 網點只畫在沒有字的地方（卡片外側的影子、頁面大標下半截）；大標下的網點用 `--riso-ink-b-tint`，不要用第二墨原色。
- 套色錯位只放在色塊與按鈕上（`--riso-misreg`），按下時歸零。
- 線框一律是主墨（`--riso-line`），細分隔是 `--riso-rule`。
- 新的可點色塊照抄按鈕的三段錯位（靜止 2px、滑過 3px、按下 0）。

**Don't**

- 在文字上做任何錯位、`text-shadow` 或疊網點；文字永遠是單一實色墨。
- 在表格、欄位、內文段落、徽章底下放網點或顆粒。
- 把顆粒加到卡片、側欄或浮層上（只在頁面底層）。
- 用影子長短表示前後（那是 Grid、Brutal）；這個質地的偏移固定 8px。
- 用模糊陰影或透明度表示前後（那是 Material／Frosted）。
- 把這個質地配單色墨或深色配色（相容清單已排除：只有一種墨就沒有疊印，深色下紙和網點都不成立）。

## 相容配色

見 [`theme.token.ts`](../../../theme/theme.token.ts) 的 `TEXTURE_COMPATIBILITY.riso`。
