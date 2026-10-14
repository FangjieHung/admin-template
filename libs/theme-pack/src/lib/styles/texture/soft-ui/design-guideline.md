# Soft UI 浮雕質地準則

> 模板與術語見 [`../README.md`](../README.md)。Soft UI 目前**不排改版**，本文件描述**現行實作**（`_tokens.scss`、`recipes.scss`，決策見 [ADR 0003](../../../../../../../docs/adr/0003-soft-ui-theme.md)）；「現況 → 目標」欄全部是「—」。實作與規則不一致的地方列在文末「已知問題」，不在此處自訂目標。

## 一句話個性

一整塊同色的軟塑膠板：卡片、按鈕從底板**凸出來**，輸入框、選中項**壓進去**，所有東西和畫布是同一個顏色。

## 造型規格

顏色一律用語意 token（`--mat-sys-*`、`--app-*`），顏色由配色軸決定；本質地不指定任何色碼。例外：浮雕的亮／暗兩道陰影目前寫死在 `_tokens.scss`（`--soft-shadow-*`，冷灰藍調，以 `light-dark()` 切明暗），見「已知問題」。

| 項目 | Token | 目前值 | 用在 | 現況 → 目標 |
| --- | --- | --- | --- | --- |
| 圓角 small | `--mat-sys-corner-small` | 12px | Material 預設吃 small 的元件（mat-checkbox 容器等；原生勾選框取 `min(4px, corner-small)`＝4px） | — |
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
| 字體 display | `--font-display` | Plus Jakarta Sans ＋ 系統中文字（`--font-zh`） | 大數字、頁面標題（`.ui-text-display`／`-title`） | — |
| 字體 body | `--font-body` | DM Sans → Inter ＋ 系統中文字（`--font-zh`） | 內文、小節標、表單 | — |
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
- **日曆**：`lib-calendar` 只設 `--lib-cal-*`（CONTRACT.md「共用日曆」）。標題列底色是背景色；格線 outline 22%，今天的標記微微浮起，選取的時段是內凹。
- **表單**：Material filled 欄位，16px 圓角、無底線、內凹（`--soft-inset`），外加 1px inset 細框 `--app-field-border`（填色與畫布同色、內陰影太柔，單靠浮雕對底色不到 3:1；用 inset box-shadow 不改尺寸，錯誤時細框換 error 色）。相連欄位用 `.ui-field-group`（中間接縫改直角）。
- **勾選框／單選鈕**：原生控制項由全域 `_choice-controls.scss` 重畫（外框 `--app-field-border`、勾選底 `--mat-sys-primary`、記號 `--mat-sys-on-primary`）；本質地只在未勾選時加 `--soft-inset-small` 小內凹（欄位的 6px 內凹放不進 18px 方塊），勾選後是主色實心、不內凹。
- **空狀態**：卡片內置中：一個圖示、一行 `.ui-text-subtitle`、一行 `.ui-text-caption`、一顆主要按鈕（凸起的膠囊）。可把整塊放進一個淺內凹的區域，當作「空的凹槽」。
- **對話框**：32px 圓角、與畫布同色、無框、level3 凸起。
- **chip／徽章**：`.ui-chip` ＋ `.ui-chip--{tone}`，16px 圓角（不是膠囊）、輕微內凹，底色與字色來自 `--app-{tone}-bg/fg`。

## 語意用途變數（2026-09-27 第二批）

- **停用**：按鈕與膠囊停用（`:disabled`、`.is-disabled`、`[aria-disabled='true']`）統一吃 `--app-disabled-fg`／`--app-disabled-bg`、`box-shadow: none`（停用的按鈕不再浮起）、`cursor: not-allowed`。
- **動態**：轉場時長只用 `--app-motion-fast`（150ms）／`-base`（200ms）／`-slow`（400ms），easing 用 `--app-ease-standard`；`prefers-reduced-motion` 時三檔由 `_semantic.scss` 歸零，本質地不必再寫 `transition: none`。

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

見 [`theme.token.ts`](../../../theme/theme.token.ts) 中 `TEXTURE_COMPATIBILITY['soft-ui']` 的 `compatibleThemeIds` 與 `defaultThemeId`（唯一來源，此處不列清單；2026-09-27 定案，見 ADR 0007）。

## 已知問題（2026-09-26 依現況盤點；2026-09-26 ticket 13 更新狀態）

- **陰影色寫死（已解決）**：`--soft-shadow-*` 改用 `color-mix(in srgb, var(--mat-sys-on-surface) …%, transparent)` 調暗影、`color-mix(in srgb, var(--mat-sys-surface-container-lowest/-highest) …%, transparent)` 調亮影，深色配色（暗影方向找不到比 background 更暗的面）退回中性黑，理由與做法見 `_tokens.scss` 註解。實測 Verdant、Midnight、Sandstone、Candy 下浮雕陰影都跟著配色調性走，不再是單一冷灰藍。Sandstone／Verdant 在 2026-09-27 定案時仍依美感排除，但截圖比對此次修復前後，色偏已明顯改善，不再發灰顯髒。
- **`.ui-card--inverse` 不是反白（已解決）**：改成獨立規則，`--mat-sys-inverse-surface` 底、`--mat-sys-inverse-on-surface` 字、`box-shadow: none`，符合 [`CONTRACT.md`](../../CONTRACT.md)「深色 hero 卡、無邊框無陰影」。目前 Admin 模板尚未有頁面使用這個 class，以合成節點驗證規則本身正確。
- **表格 recipe 打不到 Admin 的表格（已解決）**：共用元件 `libs/ui/data-table` 的樣式經 Angular 封裝後，每段選擇器都多一個 `[_ngcontent-*]`（`.dt-table tbody tr` 是 0-4-2），全域 recipe 蓋不過，原本靠 `!important`。2026-09-28 起元件以 CSS 變數暴露外觀（清單見 CONTRACT.md「共用元件的外觀變數」），這裡只在 `.dt-table` 上設 `--dt-cell-padding-block: 1rem`（列高）與 `--dt-row-border-color: color-mix(in srgb, var(--mat-sys-outline) 22%, transparent)`（列間極淡的線），不再用 `!important`；表格本來就透明（元件不設底色），原本的 `background: transparent` 是多餘的，已刪。改前／改後計算樣式比對 0 差異。保留 `.mat-mdc-table`／`.mat-mdc-row` 規則以防未來真的用到 `mat-table`。
- **可點卡片沒有鍵盤焦點框（已解決）**：`:focus-visible` 規則加入 `.ui-card--clickable`，套用 `libs/theme-pack/src/lib/styles/texture/material/buttons.scss` 同一組 outline 寫法。
- **側欄文字對比（ticket 13 新發現並修復）**：Soft UI 把 `.app-sidenav` 底色換成跟畫布同色（`--mat-sys-background`）後，配色包預設給深色側欄用的白字 token（`--app-shell-on`／`-muted`）沒有跟著換，導致品牌名、導覽項目、使用者卡文字在淺色底板上幾乎看不見。修法：在 soft-ui 範圍內把品牌名／使用者卡姓名改綁 `--mat-sys-on-surface`、導覽項目與說明文字改綁 `--mat-sys-on-surface-variant`（含 hover 狀態），全部 `!important`（同樣是為了蓋過元件執行期插入的樣式，不能賭插入順序）。已用 WCAG 對比比對 8 種配色，全數 ≥ 4.5:1（最低為 Cool Grey 的導覽項目 4.54:1）。
