# Frosted 霧光玻璃質地準則

> 模板與術語見 [`../README.md`](../README.md)。Frosted 目前**不排改版**，本文件描述**現行實作**（`_tokens.scss`、`recipes.scss`，決策見 [ADR 0006](../../../../../../../docs/adr/0006-frosted-theme.md)）；「現況 → 目標」欄全部是「—」。實作與規則不一致的地方列在文末「已知問題」，不在此處自訂目標。

## 一句話個性

清晨結霜的玻璃桌面：頁面頂端透進一團主色的光，上面疊著**半透明、磨砂**的面板，邊緣有一條細細的亮線，冷靜、精密、輕盈。

## 造型規格

顏色一律用語意 token（`--mat-sys-*`、`--app-*`），顏色由配色軸決定；本質地不指定任何色碼。面板色、霧邊、背景光暈都由語意 token 以 `color-mix` 調出；例外是陰影與頂部亮邊（`--frost-shadow*`、`--frost-highlight`）寫死在 `_tokens.scss`，見「已知問題」。

| 項目 | Token | 目前值 | 用在 | 現況 → 目標 |
| --- | --- | --- | --- | --- |
| 圓角 small | `--mat-sys-corner-small` | 12px | Material 預設吃 small 的元件 | — |
| 圓角 medium | `--mat-sys-corner-medium` | 16px | 輸入框、snackbar | — |
| 圓角 large | `--mat-sys-corner-large` | 24px | 卡片、對話框、選單、日期選擇器、使用者卡、側欄 flyout | — |
| 圓角 extra-large | `--mat-sys-corner-extra-large` | 32px | （recipe 未直接使用，對話框走 large，見已知問題） | — |
| 圓角 full | `--mat-sys-corner-full` | 999px（膠囊） | **所有按鈕**、導覽膠囊、狀態徽章、品牌標、頭像 | — |
| 陰影 level1 | `--mat-sys-level1` | `0 4px 12px` 淡影 ＋ 頂部 1px 亮邊 | 按鈕、側欄、品牌標、頭像 | — |
| 陰影 level2 | `--mat-sys-level2` | `0 16px 36px` | 卡片、按鈕 hover、snackbar | — |
| 陰影 level3 | `--mat-sys-level3` | `0 22px 48px`，稍深 | 卡片 hover、側欄 flyout | — |
| 陰影 level4 | `--mat-sys-level4` | `0 30px 60px` | 對話框、選單、日期選擇器 | — |
| 內凹 | `--frost-well` | 上方內陰影 ＋ 1px 亮線 | 輸入框、按下中的按鈕 | — |
| 面板色 | `--frost-panel` | `--mat-sys-surface` 88% 透明 | 卡片、對話框、選單、次要按鈕 | — |
| 邊線 | `--frost-border` | 1px，`--mat-sys-outline-variant` 45% 混 surface（極淡的霧邊） | 卡片、對話框、選單、欄位、次要按鈕、側欄右緣 | — |
| 背景模糊 | `backdrop-filter` | 卡片 `blur(20px) saturate(1.08)`、側欄 18px、對話框／選單 20px | 所有面板 | — |
| 字體 display | `--font-display` | Plus Jakarta Sans ＋ Noto Sans TC（字距 -0.035em） | 頁面大標、`.ui-text-display`／`-title` | — |
| 字體 body | `--font-body` | Plus Jakarta Sans ＋ Noto Sans TC（與 display 同字族） | 內文、小節標、表單 | — |
| 字體 mono | `--font-mono` | IBM Plex Mono | 代碼類資料 | — |
| 視覺密度 | `--mat-table-row-item-container-height` | 54px（見已知問題：目前沒作用到 Admin 表格）；按鈕與圖示按鈕最小 44px | 表格、按鈕 | — |
| 背景紋理 | `.app-shell` 背景 | 無紋理；頂端中央一團 `--mat-sys-primary` 42% 的橢圓光暈，右上一團 `--app-viz-2` 12% 的淡光，底色 `--mat-sys-background` | 頁面底層 | — |

## 層次表現

**用「透光度」分層：玻璃疊在光上。** 畫布有一團主色環境光，面板是 88% 不透明的磨砂玻璃，透過背景模糊把後面的光暈柔化成一片霧色。前後關係靠：面板本身有多透（霧邊＋頂部 1px 亮線勾出玻璃的邊緣），以及投影有多寬多淡（level1 → 4 越往前影子越大、越散）。按下時玻璃變成內凹的井（`--frost-well`）。

和 Material 的差別：Material 是不透明白卡投影在素色畫布上；Frosted 的面板**看得到後面**，而且畫布本身有光，拿掉光暈與模糊，Frosted 就會退化成 Material。

像 Figma 裡 fill 設 88% 透明度、加一個 Background blur effect，再疊一道 1px 的頂部 inner shadow 當亮邊。

## 鍵盤焦點

- 焦點框：`outline: 2px solid var(--mat-sys-primary)`、`outline-offset: 3px`（多留 1px，避免貼著膠囊按鈕的霧邊），只在 `:focus-visible` 出現。
- 涵蓋：按鈕（`.mat-mdc-button-base` 全部變體）、導覽膠囊（`.ui-nav-pill`、`.theme-pill`）、卡片分頁標籤（`.ui-card-titleNav__item`）、側欄項目（`.nav-link`、`.nav-sublink`、`.nav-group-trigger`）。
- 輸入框聚焦時（`:focus-within`）加 2px primary 外框。
- **未涵蓋**：可點卡片 `.ui-card--clickable`、側欄 flyout 項目 `.nav-flyout-item`，見已知問題。

## 新增頁面規則

- **卡片**：`.ui-card`，`--frost-panel` 底＋背景模糊、1px `--frost-border` 霧邊、24px 圓角、level2。可點的加 `.ui-card--clickable`（hover 上移 2px、升到 level3）。重點數字卡用 `.ui-card--inverse`（深色漸層玻璃）。卡片內分區用留白，不再疊一層玻璃——兩層模糊會變髒。
- **表格**：放在 `.ui-card` 裡，表格本身透明，讓卡片的玻璃透上來；不替表頭另加不透明底色。
- **表單**：Material filled 欄位，16px 圓角、`--mat-sys-surface-container-high` 80% 透明、1px 霧邊、淺內凹（`--frost-well`）、無底線。相連欄位用 `.ui-field-group`。
- **空狀態**：卡片內置中：一個圖示、一行 `.ui-text-subtitle`、一行 `.ui-text-caption`、一顆主色膠囊按鈕。留白充足，不另加色塊。
- **對話框**：24px 圓角、`--frost-panel` 底＋背景模糊、1px 霧邊、level4。
- **chip／徽章**：`.ui-chip` ＋ `.ui-chip--{tone}`，膠囊形、無陰影、前面一顆狀態圓點（`.ui-chip__dot`），顏色來自 `--app-{tone}-bg/fg/dot`。

## Do / Don't

**Do**
- 面板一律用 `--frost-panel` ＋ `backdrop-filter`，讓後面的光透上來。
- 每個面板都有 1px `--frost-border` 霧邊，界定玻璃的邊緣。
- 按鈕一律膠囊形；主要操作用實心 `--mat-sys-primary`，次要用半透明玻璃＋霧邊。
- 主色只用在主要操作、光暈與數據重點；其他資訊交給灰階文字。

**Don't**
- 使用不透明的白卡（那是 Material）或多階不透明色塊分層（那是 Linen）。
- 在玻璃面板裡再疊一層有模糊的玻璃。
- 用硬邊偏移影、粗框或直角（那是 Grid、Editorial）。
- 把光暈畫進卡片、表格、欄位內部，或讓光暈壓低文字對比；光暈只在 `.app-shell` 底層。

## 相容配色

見 [`theme.token.ts`](../../../theme/theme.token.ts) 中 `TEXTURE_COMPATIBILITY.frosted` 的 `compatibleThemeIds` 與 `defaultThemeId`（唯一來源，此處不列清單；暫定版，定案見 ticket 09）。

## 已知問題（2026-09-26 依現況盤點；2026-09-26 ticket 13 更新狀態）

- **陰影色寫死（已解決）**：`--frost-shadow`、`--frost-shadow-hover` 改用 `color-mix(in srgb, var(--mat-sys-on-surface) …%, transparent)`（暗側，深色配色退回中性黑）；`--frost-highlight` 改用 `color-mix(in srgb, var(--mat-sys-surface-container-lowest/-highest) …%, transparent)`（亮側），理由與做法同 Soft UI／Clay，見 `_tokens.scss` 註解。
- **對話框沒用 extra-large 圓角（已解決）**：對話框、選單、日期選擇器改用 `--mat-sys-corner-extra-large`（32px）。
- **`.ui-card--inverse` 有框有影（已解決）**：改成 `border: 0; box-shadow: none;`，保留漸層背景與圓角，符合 [`CONTRACT.md`](../../CONTRACT.md)「無邊框無陰影」。
- **表格 recipe 打不到 Admin 的表格（已解決）**：新增 `.dt-table` 規則，表格透明、列高改用 `padding-block: 1.0625rem !important`（≈17px，對應 54px 列高目標），表頭不加不透明底色。`!important` 原因同 Soft UI／Clay。
- **焦點框缺口（已解決）**：`:focus-visible` 規則加入 `.ui-card--clickable` 與 `.nav-flyout-item`。
- **側欄收合選單對比（ticket 13 新發現並修復）**：`.nav-flyout` 背景換成 `--frost-panel`（跟隨配色的淺色玻璃）後，文字仍沿用 `side-nav.component.scss` 給深色側欄用的 `--app-shell-on`／`-muted`，在淺色配色（如 Verdant、Sandstone）下收合選單裡的項目幾乎看不見；主側欄本身背景仍是 `--app-shell-bg`（深色）沒有這個問題。修法：`.nav-flyout`／`.nav-flyout-item` 改綁 `--mat-sys-on-surface`／`-variant`（含 hover／active），全部 `!important`（原因同上）。實測 Frosted × Verdant 收合選單文字對比 5.56:1，通過 4.5:1 門檻；截圖見 `reports/13/frosted_verdant_flyout.png`。
