# Clay 立體軟陶質地準則

> 模板與術語見 [`../README.md`](../README.md)。Clay 目前**不排改版**，本文件描述**現行實作**（`_tokens.scss`、`recipes.scss`、`_fonts.scss`，決策見 [ADR 0004](../../../../../../../docs/adr/0004-clay-theme.md)）；「現況 → 目標」欄全部是「—」。實作與規則不一致的地方列在文末「已知問題」，不在此處自訂目標。

## 一句話個性

一桌胖嘟嘟的黏土玩具：超大圓角、每個物件都**有厚度**（外面投影、裡面一圈反光），按鈕按下會被捏扁，背景有慢慢飄動的彩色光暈。

## 造型規格

顏色一律用語意 token（`--mat-sys-*`、`--app-*`），顏色由配色軸決定；本質地不指定任何色碼。例外：環境陰影與高光（`--clay-ambient`、`--clay-highlight`、`--clay-rim`）目前寫死在 `_tokens.scss`，以 `light-dark()` 切明暗，見「已知問題」；按鈕投影與內側回光（`--clay-drop`、`--clay-bounce`）則由 `--mat-sys-primary` 調出。

| 項目 | Token | 目前值 | 用在 | 現況 → 目標 |
| --- | --- | --- | --- | --- |
| 圓角 small | `--mat-sys-corner-small` | 16px | Material 預設吃 small 的元件 | — |
| 圓角 medium | `--mat-sys-corner-medium` | 20px | 按鈕、導覽膠囊、輸入框、品牌標、頭像、側欄選中項、snackbar | — |
| 圓角 large | `--mat-sys-corner-large` | 32px（≤ 639px 的卡片改 24px） | 卡片、對話框、選單、日期選擇器 | — |
| 圓角 extra-large | `--mat-sys-corner-extra-large` | 48px | （recipe 未直接使用，對話框走 large，見已知問題） | — |
| 圓角 full | `--mat-sys-corner-full` | 999px（膠囊） | 狀態徽章 | — |
| 陰影 level1 | `--mat-sys-level1` = `--clay-shadow-small` | 外投影 5/7/14px ＋ 左上高光 ＋ 內側邊光 | 狀態徽章 | — |
| 陰影 level2 | `--mat-sys-level2` = `--clay-shadow-card` | 外投影 16/16/32px ＋ 高光 ＋ 6px 內側回光 | 卡片、snackbar | — |
| 陰影 level3 | `--mat-sys-level3` = `--clay-shadow-card-hover` | 外投影 22/24/40px | 卡片與按鈕 hover | — |
| 陰影 level4 | `--mat-sys-level4` = `--clay-shadow-deep` | 外投影 30/30/60px ＋ 10px 內側回光 | 側欄、對話框、選單、日期選擇器 | — |
| 按鈕陰影 | `--clay-shadow-button` | 帶主色的投影 ＋ 內側邊光 | 所有按鈕、導覽膠囊、品牌標、頭像 | — |
| 按下陰影 | `--clay-shadow-pressed` | 全內陰影 | 按下中的按鈕、輸入框、側欄選中項、使用者卡 | — |
| 邊線 | — | **無**（`border: 0`），邊緣由內側高光描出 | — | — |
| 字體 display | `--font-display` | **Nunito**（700–900，`_fonts.scss` 載入）＋ Noto Sans TC | `h1–h4`、`.section-title`、`.ui-text-*`、`.stat-card__value` | — |
| 字體 body | `--font-body` | **DM Sans**（`_fonts.scss` 載入）→ Inter ＋ Noto Sans TC | 內文、表單 | — |
| 字體 mono | `--font-mono` | IBM Plex Mono | 代碼類資料 | — |
| 字重 | — | 標題 800–900、caption 700，整體偏粗 | 文字樣式 | — |
| 視覺密度 | `--mat-table-row-item-container-height` | 56px（見已知問題：目前沒作用到 Admin 表格）；按鈕與圖示按鈕最小 44px | 表格、按鈕 | — |
| 背景紋理 | `.content-area::before/::after` | 兩團模糊 52px 的漂浮光暈（主色 18%、次色與 `--app-info-dot` 各 14%），8s／10s 緩慢飄動；`prefers-reduced-motion` 時停止 | 頁面底層 | — |

## 層次表現

**用「體積」分層：物件有多厚、浮多高。** 每個卡片、按鈕都是一塊有厚度的黏土——外面一道大而軟的投影，裡面一圈高光與回光，看起來是鼓起來的實心物件，而不是一張紙。越前面的東西越厚、投影越遠：徽章（small）→ 卡片（card）→ hover 中（card-hover，上移 8px）→ 側欄、對話框（deep）。互動也是體積的變化：hover 往上浮 4–8px，按下被捏扁（縮到 92%、陰影變全內凹）。

和 Soft UI 的差別：Soft UI 的元件和畫布是同一塊板子、只做凸凹；Clay 的每個物件是**獨立的一塊**，有自己的底色（半透明白卡、主色漸層按鈕），內側有反光，而且會動。

像 Figma 裡一個 frame 同時疊「drop shadow ＋ 兩道 inner shadow」做出立體感，再配 Smart Animate 的彈跳。

## 鍵盤焦點

- 焦點框：`outline: 3px solid var(--mat-sys-primary)`、`outline-offset: 3px`（比其他質地粗一級，配合大圓角與粗字重），只在 `:focus-visible` 出現。
- 涵蓋：按鈕（`.mat-mdc-button-base` 全部變體）、導覽膠囊（`.ui-nav-pill`、`.theme-pill`）、卡片分頁標籤（`.ui-card-titleNav__item`）、側欄項目（`.nav-link`、`.nav-sublink`、`.nav-group-trigger`）。
- 輸入框聚焦時（`:focus-within`）底色換成 `--mat-sys-surface`，加 3px primary 外框。
- **未涵蓋**：可點卡片 `.ui-card--clickable`，見已知問題。

## 新增頁面規則

- **卡片**：`.ui-card`，`--mat-sys-surface` 78% 半透明＋背景模糊、無框、32px 圓角、`--clay-shadow-card`。可點的加 `.ui-card--clickable`（hover 上移 8px、陰影加深）。重點數字卡用 `.ui-card--inverse`（`--mat-sys-inverse-surface` 底）。卡片內分區靠留白與粗體小標，不再疊卡片。
- **表格**：放在 `.ui-card` 裡，表格本身透明。列高寬鬆（目標 56px），不加欄線。
- **表單**：Material filled 欄位，20px 圓角、`--mat-sys-surface-container-high` 底、全內凹（像在黏土上壓出的凹槽）、無底線，凹槽邊緣加 1px inset 細框 `--app-field-border`（按壓陰影本身對底色不到 3:1；錯誤時換 error 色）。相連欄位用 `.ui-field-group`。
- **空狀態**：卡片內置中：一個大圖示、一行粗體 `.ui-text-subtitle`、一行 `.ui-text-caption`、一顆主色漸層的大按鈕。背景光暈已經提供氛圍，不另加插畫或框。
- **對話框**：32px 圓角、無框、`--clay-shadow-deep`（最厚的一層）。
- **chip／徽章**：`.ui-chip` ＋ `.ui-chip--{tone}`，膠囊形（corner-full）、粗體 700、帶 small 陰影（小顆的黏土豆），顏色來自 `--app-{tone}-bg/fg`。

## 語意用途變數（2026-09-27 第二批）

- **停用**：按鈕與膠囊停用（`:disabled`、`.is-disabled`、`[aria-disabled='true']`）統一吃 `--app-disabled-fg`／`--app-disabled-bg`、`box-shadow: none`（去掉立體陰影與主色漸層）、`cursor: not-allowed`。
- **動態**：轉場時長只用 `--app-motion-fast`（150ms）／`-base`（200ms）／`-slow`（400ms），easing 用 `--app-ease-standard`；`prefers-reduced-motion` 時三檔由 `_semantic.scss` 歸零，本質地的 reduced-motion 區塊只保留「停光暈、取消位移」。
- **焦點框 3px**：只寫在本質地自己的按鈕／膠囊與輸入框規則裡（就地覆寫 `--app-focus-ring-width`），外觀浮動按鈕等其他元件維持全站 2px。

## Do / Don't

**Do**
- 讓每個可點物件看起來「可以捏」：外投影＋內側高光，hover 浮起、按下縮小。
- 主要按鈕用主色漸層（recipe 已處理），次要按鈕用半透明白底，對比一眼可辨。
- 大圓角一致：卡片／對話框 32、按鈕／欄位 20、徽章膠囊。
- 標題用 Nunito 粗體（800–900），讓字也有圓胖感。
- 所有動態都尊重 `prefers-reduced-motion`（光暈停、位移取消）。

**Don't**
- 使用直角、2px 小圓角或細框線（那是 Grid、Editorial）。
- 用平面、無內側高光的單層投影（那是 Material，放在 Clay 裡會顯得扁）。
- 把光暈或漂浮動畫加到卡片、表格、欄位內部；光暈只在頁面底層。
- 在元件裡寫色碼或自己寫 `box-shadow` 數值；一律用 `--mat-sys-level*` 或 `--clay-shadow-*`。

## 相容配色

見 [`theme.token.ts`](../../../theme/theme.token.ts) 中 `TEXTURE_COMPATIBILITY.clay` 的 `compatibleThemeIds` 與 `defaultThemeId`（唯一來源，此處不列清單；2026-09-27 定案，見 ADR 0007）。

## 已知問題（2026-09-26 依現況盤點；2026-09-26 ticket 13 更新狀態）

- **陰影色部分寫死（已解決）**：`--clay-ambient`、`--clay-highlight`、`--clay-rim` 改用 `color-mix(in srgb, var(--mat-sys-on-surface) …%, transparent)`（暗側）與 `color-mix(in srgb, var(--mat-sys-surface-container-lowest/-highest) …%, transparent)`（亮側）調出，深色配色的暗側退回中性黑，理由同 Soft UI，見 `_tokens.scss` 註解。`--clay-bounce`／`--clay-drop`（按鈕投影）本來就已經綁 `--mat-sys-primary`，不受影響。
- **對話框沒用 extra-large 圓角（已解決）**：對話框、選單、日期選擇器改用 `--mat-sys-corner-extra-large`（48px），實測 `getComputedStyle` 回傳 48px。
- **手機卡片圓角寫死（已解決）**：改成 `border-radius: calc(var(--mat-sys-corner-large) * 0.75)`，數值不變（32px × 0.75 = 24px）但改用 token 推導，corner-large 之後若調整會跟著變。
- **`.ui-card--inverse` 有陰影（已解決）**：拆成獨立規則，`box-shadow: none`，其餘（`--mat-sys-inverse-surface` 底、圓角）不變，符合 [`CONTRACT.md`](../../CONTRACT.md)。
- **卡片用了背景模糊（維持現況，不是缺陷）**：`.ui-card` 仍保留 `backdrop-filter: blur(20px)`。準則本來就只是提醒「輔助效果、新元件不要擴大使用」，不是要移除既有效果；拿掉會改變 Clay 卡片目前的視覺個性，此次不動。
- **表格 recipe 打不到 Admin 的表格（已解決）**：新增 `.dt-table` 規則，列高改用 `padding-block: 1.125rem !important`（≈18px，對應 56px 列高目標）。`!important` 是必要的，原因與 Soft UI 相同（共用元件的樣式是元件執行期插入，跟全域規則同特異度時插入順序不保證）。不加欄線，符合「列高寬鬆、不加欄線」的準則。
- **可點卡片沒有鍵盤焦點框（已解決）**：`:focus-visible` 規則加入 `.ui-card--clickable`。
