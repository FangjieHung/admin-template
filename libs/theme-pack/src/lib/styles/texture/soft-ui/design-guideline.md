# Soft UI 浮雕質地準則

> 模板與術語見 [`../README.md`](../README.md)。Soft UI 目前**不排改版**，本文件描述**現行實作**（`_tokens.scss`、`recipes.scss`，決策見 [ADR 0003](../../../../../../../docs/adr/0003-soft-ui-theme.md)）；「現況 → 目標」欄全部是「—」。實作與規則不一致的地方列在文末「已知問題」，不在此處自訂目標。

## 一句話個性

一整塊同色的軟塑膠板：卡片、按鈕從底板**凸出來**，輸入框、選中項**壓進去**，所有東西和畫布是同一個顏色。

## 造型規格

顏色一律用語意 token（`--mat-sys-*`、`--app-*`），顏色由配色軸決定；本質地不指定任何色碼。例外：浮雕的亮／暗兩道陰影目前寫死在 `_tokens.scss`（`--soft-shadow-*`，冷灰藍調，以 `light-dark()` 切明暗），見「已知問題」。

| 項目 | Token | 目前值 | 用在 | 現況 → 目標 |
| --- | --- | --- | --- | --- |
| 圓角 small | `--mat-sys-corner-small` | 12px | Material 預設吃 small 的元件（checkbox 容器等） | — |
| 圓角 medium | `--mat-sys-corner-medium` | 16px | 按鈕、導覽膠囊、輸入框、狀態徽章、snackbar | — |
| 圓角 large | `--mat-sys-corner-large` | 32px | 卡片、對話框、選單、日期選擇器 | — |
| 圓角 extra-large | `--mat-sys-corner-extra-large` | 32px | （recipe 未直接使用，對話框走 large） | — |
| 圓角 full | `--mat-sys-corner-full` | 999px（膠囊） | 徽章上的狀態點 | — |
| 陰影 level1 | `--mat-sys-level1` | 右下暗影＋左上亮影各 5px、模糊 10px | 按鈕、導覽膠囊、品牌標、頭像 | — |
| 陰影 level2 | `--mat-sys-level2` | 同上 9px／16px | 卡片、側欄、snackbar | — |
| 陰影 level3 | `--mat-sys-level3` | 同上 12px／20px，稍深 | 卡片與按鈕 hover、對話框、選單、日期選擇器 | — |
| 陰影 level4 | `--mat-sys-level4` | 同上 16px／28px | （recipe 未直接使用） | — |
| 內凹陰影 | `--soft-inset-small`／`--soft-inset`／`--soft-inset-deep` | 3／6／10px 的內陰影（暗在左上、亮在右下） | 按下、選中的膠囊與導覽、狀態徽章／輸入框／聚焦中的輸入框 | — |
| 邊線 | — | **無**（所有卡片、按鈕、對話框 `border: 0`）；表格列之間 1px `--mat-sys-outline` 22% | 表格列線 | — |
| 字體 display | `--font-display` | Plus Jakarta Sans ＋ Noto Sans TC | 大數字、頁面標題（`.ui-text-display`／`-title`） | — |
| 字體 body | `--font-body` | DM Sans → Inter ＋ Noto Sans TC | 內文、小節標、表單 | — |
| 字體 mono | `--font-mono` | IBM Plex Mono | 代碼類資料 | — |
| 視覺密度 | `--mat-table-row-item-container-height` | 52px（見已知問題：目前沒作用到 Admin 表格） | 表格 | — |
| 背景紋理 | — | 無；畫布、側欄、卡片全部是 `--mat-sys-background` 同一色 | — | — |

## 層次表現

**用「凸起 vs. 壓入」的浮雕方向分層，所有表面同一個顏色。** 每個元件都和畫布同色（`--mat-sys-background`），唯一的差別是光怎麼打在它上面：左上一道亮影、右下一道暗影＝凸出來（卡片、按鈕、側欄）；反過來的內陰影＝壓進去（輸入框、選中的導覽、按下中的按鈕、狀態徽章）。凸得越高（level1 → 3）越前面；hover 再凸一點並上移 1–2px，按下就從凸變凹。

和其他質地的差別：Material 是白色卡片投影到灰畫布上（**有**底色差）；Soft UI 沒有底色差，也沒有框，只剩光影方向。

像 Figma 裡所有 frame 共用同一個 fill，只靠一組「drop shadow 亮＋暗」和「inner shadow 亮＋暗」的 effect style 切換凸凹。

## 鍵盤焦點

- 焦點框：`outline: 2px solid var(--mat-sys-primary)`、`outline-offset: 2px`，只在 `:focus-visible` 出現。
- 涵蓋：按鈕（`.mat-mdc-button-base` 全部變體）、導覽膠囊（`.ui-nav-pill`、`.theme-pill`）、卡片分頁標籤（`.ui-card-titleNav__item`）、側欄項目（`.nav-link`、`.nav-sublink`、`.nav-group-trigger`）。
- 輸入框聚焦時（`:focus-within`）改成更深的內凹＋同一條 2px primary 外框。
- **未涵蓋**：可點卡片 `.ui-card--clickable`（Material 質地有），見已知問題。

## 新增頁面規則

- **卡片**：`.ui-card`，與畫布同色、無框、32px 圓角、level2 凸起。可點的加 `.ui-card--clickable`（hover 升到 level3、上移 2px）。卡片內要分區，用一塊內凹（`--soft-inset-small`）的區域，不要再疊一張凸起的卡片。
- **表格**：放在 `.ui-card` 裡，表格本身透明，列之間只有一條極淡的線；不要替列或表頭另加凸起效果。
- **表單**：Material filled 欄位，16px 圓角、無底線、內凹（`--soft-inset`）。相連欄位用 `.ui-field-group`（中間接縫改直角）。
- **空狀態**：卡片內置中：一個圖示、一行 `.ui-text-subtitle`、一行 `.ui-text-caption`、一顆主要按鈕（凸起的膠囊）。可把整塊放進一個淺內凹的區域，當作「空的凹槽」。
- **對話框**：32px 圓角、與畫布同色、無框、level3 凸起。
- **chip／徽章**：`.ui-chip` ＋ `.ui-chip--{tone}`，16px 圓角（不是膠囊）、輕微內凹，底色與字色來自 `--app-{tone}-bg/fg`。

## Do / Don't

**Do**
- 讓卡片、按鈕、側欄和畫布保持同一個底色，只用亮／暗雙陰影表現凸起。
- 「輸入」「已選取」「按下」一律用內凹，讓使用者一眼分出能按的（凸）和已填入／已選的（凹）。
- 大圓角一致：卡片／對話框 32、按鈕／欄位／徽章 16。
- 陰影一律用 `--mat-sys-level*` 或 `--soft-inset*`，不自己寫 `box-shadow` 數值。

**Don't**
- 替卡片或按鈕加邊框（邊框會把浮雕切成貼紙，那是 Grid、Linen 的語言）。
- 讓卡片換成比畫布亮的白底（那就變回 Material）。
- 用單邊、單色的投影——Soft UI 的陰影一定是亮暗成對。
- 在凸起的卡片裡再放凸起的卡片（兩層浮雕會糊成一團）；內層改用內凹。

## 相容配色

見 [`theme.token.ts`](../../../theme/theme.token.ts) 中 `TEXTURE_COMPATIBILITY['soft-ui']` 的 `compatibleThemeIds` 與 `defaultThemeId`（唯一來源，此處不列清單）。目前是暫定版：排除 Sandstone 與 Verdant、預設 Cool Grey，定案見 ticket 09。

## 已知問題（2026-09-26 依現況盤點，未修）

- **陰影色寫死**：`--soft-shadow-*` 是固定的冷灰藍 `rgb(163 177 198 …)`／白色，沒有從語意 token 調出，違反 [`../README.md`](../README.md)「陰影顏色也要由語意 token 調出」。暖色或亮綠配色上陰影會發灰、顯髒——這正是目前排除 Sandstone、Verdant 的原因。
- **`.ui-card--inverse` 不是反白**：recipe 把它設成與一般卡片相同的 `--mat-sys-background` 底、`--mat-sys-on-surface` 字、level2 凸起；[`CONTRACT.md`](../../CONTRACT.md) 定義它是「深色 hero 卡、無邊框無陰影」。在 Soft UI 下重點數字卡失去強調。
- **表格 recipe 打不到 Admin 的表格**：列高 52px 與列線寫在 `.mat-mdc-table`／`.mat-mdc-row`，但 Admin 的表格是共用元件 `libs/ui/data-table`（`.dt-table` 原生 `<table>`），Admin 模板裡沒有 `mat-table`，所以這兩條規則目前沒有作用。
- **可點卡片沒有鍵盤焦點框**：`:focus-visible` 規則未包含 `.ui-card--clickable`。
