# ADR 0008：語意用途變數的三層覆寫（預設 → 質地/配色 → 組合）

- 狀態：已決策；第一批（畫面不變）、第二批（會改變畫面）與第三批（欄位邊界）皆已實作（2026-09-27）
- 日期：2026-09-27

## 背景

ticket 09 定案 `TEXTURE_COMPATIBILITY` 後，使用者問「某個質地 × 配色想改邊框色、焦點色，好不好維護」。盤點（`docs/plans/2026-09-27-semantic-tokens.md` 附的 `token-gap-audit.md`）發現：8 套配色在 CONTRACT.md 現有規範的 token 上齊備，缺口不在配色，而在 CONTRACT.md 本身缺少「用途變數」——7 個質地包各自用 `color-mix()`、寫死 px/rgba 重複實作同一種用途（焦點框顏色、強調邊框濃度、hover/active 疊加、Material 陰影色調、跨元件圖層順序等），沒有單一調整點；改一處要跑遍 7 個檔案改 21+ 處。

## 決策

1. 新增一組 `--app-*` 用途變數，語意對應「這是什麼用途」而非「這是什麼顏色/數值」（例如 `--app-focus-ring` 而不是又一個顏色 token）。
2. 三層覆寫，權重嚴格遞增，靠 CSS 選擇器特異性天然分層，不用 `!important`：
   - 層 1 預設（`:root`，0-1-0）：`libs/theme-pack/src/lib/styles/_semantic.scss`。
   - 層 2 質地／配色（`:root[data-paradigm='x']` 或 `:root[data-theme='y']`，兩者都是 0-2-0）：各質地/配色自己的 `_tokens.scss`。
   - 層 3 組合（`:root[data-paradigm='x'][data-theme='y']`，0-3-0）：新檔 `_combos.scss`，只在單一格需要例外時才用。
3. **同一個變數不可以同時在質地層與配色層定義**：兩者權重相同（0-2-0），會變成看 Sass `@forward`/`@use` 的載入順序決定最終值，等於隱性耦合。需要同時因質地與配色調整同一個變數時，一律改在組合層寫規則，不在兩個層各寫一半。
4. 個別 DOM 選擇器如果需要跟同質地其他地方不同的數值（例如某個表單欄位的 `outline-offset` 跟同質地其他按鈕不同），允許在該選擇器規則內就地覆寫變數（`--app-focus-ring-offset: 1px;` 寫在該規則塊內），這是「實例覆寫」，不算破壞分層——這類差異本來就是「這一個元件的形狀」而非「這個質地的形狀」，硬要收進質地層或組合層反而失去表達力。
5. 分兩批導入：
   - 第一批（本 ADR 覆蓋的範圍）：只把現有「重複實作」收編成變數，任何組合改前改後**計算後樣式必須完全相同**——這批純粹是重構，不改變視覺。
   - 第二批：真正利用這組變數改變視覺（深色側欄的 rgba、陰影跟配色走、遮罩跟配色走、圓角收斂、轉場時長收斂、disabled 樣式、選取文字色），需要使用者看過截圖才能定案，故分開處理，降低單次變更的風險。

## 考慮過的替代方案

- **每個質地 × 配色另開一份完整覆寫**：56 格全部要手動維護同一種焦點框顏色調整，改一次要動 56 處，維護成本隨組合數線性成長，是目前問題的放大版，直接否決。
- **在元件內直接覆寫**（不建立語意變數，各元件各自決定要不要吃 `--mat-sys-primary` 或自訂值）：等於維持現況，21+ 處各自一份 `outline: Npx solid var(--mat-sys-primary)`，改一次要搜尋所有出現點且容易漏改（審計已證實：`libs/ui`、`libs/booking-flow` 兩處被原始盤點漏掉），否決。
- **只做語意變數不分層**（所有值都寫在 `:root`，質地要例外就用 `!important` 或提高選擇器特異度硬蓋）：`!important` 一旦用開就會處處蔓延，且既有 lint 規則已經在防堵這個模式（focus outline 蓋 MDC 內建樣式的案例就是靠 `:is(...):focus-visible` 特異度取勝，不是 `!important`），故延續現有作法，用選擇器特異度分層而不是優先度旗標。

## 後果

- CONTRACT.md 新增「用途變數」一節，逐一列出目前定義的變數、預設值、套用狀態（已套用／已定義未套用）。
- `lint-theme.mjs` 新增三條規則：擋寫死 `rgb()`/`rgba()`（`_semantic.scss`、質地 `_tokens.scss` 的陰影/色調定義、以及 side-nav 第二批才處理的 7 處半透明白，逐條列在腳本裡的允許清單並附理由）、擋 `outline: ... var(--mat-sys-primary)` 直接寫法（改用 `--app-focus-ring`）、擋元件 scss 裡 ≥10 的 `z-index` 寫死數字。
- 未能在「畫面不變」前提下收編的項目記錄在計畫的 `report.md`：grid 質地的裝飾格線背景（`color-mix(outline-variant, 35%/55%, transparent)`）維持現狀——它是同一質地裡兩種不同濃度的裝飾圖案，不是單一「邊框」語意，強行收進一個 `--app-border-emphasis` 會犧牲其中一個的濃度；frosted 的 `--frost-border`（mix 對象是 `--mat-sys-surface` 不是 `transparent`，公式形狀不同）與 editorial/frosted 的側欄 hover（`color-mix` 對象是 `--app-shell-on`/`--app-shell-bg`，屬於 shell 專用色域，非一般 on-surface 疊加）也維持現狀，留給第二批的 `--app-shell-*` 收編。

## 第一批已收編清單（節錄，完整清單見 `libs/theme-pack/src/lib/styles/CONTRACT.md`「用途變數」表）

- 焦點框顏色：全站（含 `libs/ui`、`libs/booking-flow`）25 處 `outline: Npx solid var(--mat-sys-primary)` → `--app-focus-ring`。
- Material 陰影色調：`texture/material/_tokens.scss` 4 處 `rgba(35, 34, 32, N)` → `color-mix(in srgb, --app-shadow-tint N%, transparent)`。
- 強調邊框：linen 質地的紙感格線（20%）→ `--app-border-emphasis`。
- 互動狀態疊加：soft-ui／frosted 的側欄 hover（8%／9%）→ `--app-state-hover`。
- 跨元件圖層順序：`responsive-panel`（100/101）、`floating-appearance-panel`（500）→ `--app-z-drawer`／`--app-z-floating`。

## 第一批驗收補做（2026-09-27）

第一批上線時沒有做改前／改後比對。補做方式：`4daac0f`（改前）與第一批 HEAD 各編一份 admin，對 7 質地 × 相容配色共 43 組 × 3 頁（儀表板、訂單列表、建單頁）記錄代表元素一般／hover／鍵盤 focus 的計算樣式（125,302 個欄位）並截整頁圖。抓到一個真的差異：clay 把 `--app-focus-ring-width: 3px` 寫在質地層，讓外觀浮動按鈕、搜尋鈕等沒有 clay recipe 的元件從 2px 變 3px；已改成只在 clay 自己兩條規則內就地覆寫（`fix(theme-pack)` commit）。另外 147 個欄位只差序列化（`color-mix()` 的計算值寫成 `color(srgb …)`，數值與原 `rgba()` 相同），Material 陰影因此在截圖上有 ±1 階的量化差，肉眼不可見。

## 第二批決定（2026-09-27）

| 項目 | 決定 | 層 |
| --- | --- | --- |
| 深色側欄 | `side-nav.component.scss` 7 處 `rgba(255,255,255,N)` → `--app-shell-scrollbar`(24%)／`-hairline`(16%)／`-hover`(12%)／`-subtle`(8%)。`--app-shell-on` 是白色的 Verdant／Sandstone／Azure 畫面不變；Midnight（slate-100）幾乎不變；Candy／Cool Grey 的淺色側欄從「白色疊白色、看不見」變成深色墨水疊加；Mist Ink／Glacier Blue 的滑過底色本來就由配色層以實色覆寫，不受影響。editorial（7%）、frosted（9%）的側欄滑過改用 `--app-shell-hover`，濃度在質地層覆寫。 | 1、2（質地） |
| 陰影色調 | 刪掉 material 質地層的 `--app-shadow-tint: rgb(35 34 32)`，改吃預設 `--mat-sys-on-surface`（Verdant 的 on-surface 剛好就是 35 34 32，畫面不變）。只有 Midnight 的 background 是深色（相對亮度 0.008，其餘 ≥ 0.78），在配色層設 `color-mix(in srgb, var(--mat-sys-background) 30%, black)`；同樣 4–10% 的透明度在深底上看不見，所以 material × midnight 在組合層把 level1–4 放大成 16/20/28/40%。 | 2（配色）、3（組合） |
| 遮罩 | 全域 `.cdk-overlay-container .cdk-overlay-dark-backdrop`（0-2-0，蓋過 CDK 執行期插入的 0-1-0）改吃 `--app-scrim` 與 `blur(var(--app-scrim-blur))`；`libs/ui` responsive-panel 的抽屜背板同樣改用。預設改成 `inverse-surface` 45%。只有 Midnight 的 inverse-surface 是淺色（相對亮度 0.834），在配色層改近黑 45%。Frosted 質地層 `--app-scrim-blur: 6px`。 | 1、2 |
| 圓角 | `app.scss` 卡片分頁標籤 2rem → `corner-extra-large`、`.stat-card` 1rem → `corner-medium`、側欄品牌標 14px → `corner-medium`；0.5rem／0.375rem／4px（admin 各面板、`libs/contract-signing`、`libs/booking-flow` 共 25 處）→ `corner-small`。`999px` 膠囊、`50%` 圓形、`10rem`（今日圓點，等同膠囊）、`0` 與 `var(--x, 4px)` 這類 fallback 不改。 | — |
| 動態 | 新增的 3 檔套用到所有 transition：≤160ms → fast、180–220ms → base、≥300ms → slow；ease／ease-out／ease-in-out → `--app-ease-standard`，Material 的 `cubic-bezier(0.4,0,0.2,1)`、側欄的 `cubic-bezier(0.25,0.8,0.25,1)` 保留。page-toolbar 的 90ms 延遲改成 `calc(var(--app-motion-base) * 0.45)`，跟著時長一起縮放。`prefers-reduced-motion` 由第 1 層把三檔歸零；原本只關 transition 的區塊（soft-ui、editorial、page-toolbar）刪掉，clay／frosted 只刪 transition 那一段、保留關動畫與取消位移。`lint:theme` 新規則：元件 scss 的 transition 不得寫死 ms/s（變數定義檔除外、`0s` 允許）。keyframes 動畫（responsive-panel、dual-month-range-picker）不在本次範圍。 | 1 |
| 停用 | soft-ui、clay、frosted、editorial 對自訂造型的按鈕與膠囊加 `:is(:disabled, .is-disabled, [aria-disabled='true'], .mat-mdc-button-disabled)` → `--app-disabled-fg/-bg`、`box-shadow: none`、`cursor: not-allowed`。material、linen、grid 沒有自訂按鈕造型，維持 Material 原生。 | 質地 recipe |
| 選取文字 | 全域 `::selection` 用 `--app-selection-bg/-fg`；`.app-sidenav` 內用 `color-mix(in srgb, var(--app-shell-on) 28%, transparent)` 底、`--app-shell-on` 字。 | 全域樣式 |
| 減少透明度 | Frosted 在 `@media (prefers-reduced-transparency: reduce)` 下關掉所有 `backdrop-filter`，`--frost-panel` 改 `--mat-sys-surface`、側欄改 `--app-shell-bg`、輸入框改 `surface-container-high`、`--app-scrim-blur` 歸零。 | 2（質地）＋ recipe |
| 狀態層 | `--app-state-selected`：卡片分頁標籤的目前項目（取代 `surface-container-highest`）；`--app-state-pressed`：卡片分頁標籤與可點表格列按下（表格列疊在 hover 底色上）。派車「可用車輛」選中列已有主色框線，未改。 | — |

對照圖與差異清單只存在執行當時的 scratchpad（`batch2/compare.html`、`batch2/diff-list.md`），未進 repo；決策摘要以本 ADR 為準。

## 欄位邊界（2026-09-27）

背景：對比掃描的 `input_border_on_surface`（輸入欄位邊界對所在底色，WCAG 1.4.11 的 3:1）56 格有 49 格不合格（相容組合 43 格中 36 格）。Material／Linen／Clay 只靠填色區隔，Soft UI 的填色與頁面同色只靠內凹陰影，Editorial／Frosted 的邊框太淡（outline-variant 髮絲線、`--frost-border` 霧邊），Grid 只有 × Verdant 不合格（1.62）。

決定：

1. 新增層 1 變數 `--app-field-border`，預設 `var(--mat-sys-outline)`。量 8 套配色的 outline 對「欄位實際所在底色」（建單頁卡片、訂單列表 topbar、優惠券對話框）：只有 Verdant（cream-300，外側最低 1.49、對 material 欄位填色 1.37）不合格，其餘最低是 Cool Grey 3.17。Verdant 在**配色層**覆寫成 `color-mix(in srgb, var(--mat-sys-on-surface-variant) 68%, var(--mat-sys-outline))`——68% 是讓 5 個相容質地同時「對外側底色」與「對欄位填色」都 ≥ 3:1 的最小整數（只看外側 62% 就夠；底線疊在填色上，所以取較嚴的 68%）。質地層不定義這個變數（決策 3），目前不需要組合層例外。
2. 「形式」由質地 recipe 決定，顏色一律吃 `--app-field-border`：
   | 質地 | 形式 |
   | --- | --- |
   | Material、Linen | 恢復 MDC 的 filled 底線：`--mat-form-field-filled-active-indicator-height: 1px`、`-color: var(--app-field-border)`、hover `--mat-sys-on-surface`；focus 維持 MDC 的 2px 主色底線，錯誤／停用走 MDC 自己的 token。膠囊圓角處底線被 wrapper 裁掉，只留平直段。 |
   | Grid、Editorial、Frosted | 既有 1px 邊框改用 `--app-field-border`（Grid 的欄位群組分隔線一併）。Frosted 的霧感留給半透明填色與 `--frost-well` 內凹，`--frost-border` 只留給卡片、面板。 |
   | Soft UI、Clay | 保留內凹／按壓陰影，前面加一層 `inset 0 0 0 1px var(--app-field-border)`（box-shadow 第一層畫在最上面）。選 inset 細框而不是 border：不改欄位尺寸，也不會破壞浮雕外輪廓。 |
   | outlined 欄位（booking-flow） | `component.scss` 全域設 `--mat-form-field-outlined-outline-color: var(--app-field-border)`。 |
   | 自訂輸入（admin `page-toolbar` 的 `.search` 膠囊） | 不分質地一律 1px inset 細框；收合時寬度 0，用 border 會留下 2px 殘線，底線在膠囊上會被圓角裁到只剩一小段。 |
3. 錯誤／停用：`component.scss` 在 `.mat-mdc-text-field-wrapper.mdc-text-field--invalid`／`--disabled` 上就地覆寫 `--app-field-border` 為 `--mat-sys-error`／`--app-disabled-bg`（決策 4 的實例覆寫），所有邊框、細框形式跟著換色。停用欄位不受 1.4.11 約束。
4. 對比掃描：`input_border_on_surface` 改量建單頁、訂單列表（展開搜尋＋篩選列）、優惠券新增對話框上所有可見、非停用、非 focus 的欄位，取「真的構成邊界的那條線」（outlined 外框 → 邊框 → inset 細框 → 底線疊在填色上 → 填色）對欄位外側底色，全部取最低值。結果：43 個相容組合最低 3.17（Cool Grey 各質地），56 格全數 ≥ 3:1，其他 pair 維持 0 不合格。
5. `lint:theme`：在輸入欄位選擇器（`input`／`textarea`／`select`／`.mat-mdc-form-field`／`.mat-mdc-text-field-wrapper`／`.mdc-text-field`）底下，`border*`、`--mat-form-field-*-outline-color`、`*-active-indicator-color` 的 `var()` 只能是 `--app-field-border`、`--mat-sys-on-surface`（hover）、`--mat-sys-error`、`--app-disabled-*`、`--app-focus-ring`／`--mat-sys-primary`（focus）。採用完整版規則而不是只擋 `outline-variant`：對現有 theme-pack 與三個 app 的 scss 沒有誤擋（唯一命中的是 hover 的 on-surface，已列入允許），掃描範圍與既有規則相同（不含 `libs/ui`、`libs/booking-flow`，這兩處目前沒有自訂欄位邊框）。

未涵蓋：原生 checkbox／radio（`libs/ui` data-table、派車可用車輛列表、booking-flow 保險方案）用 `accent-color` 的瀏覽器原生外觀，未套 `--app-field-border`；hover、focus、錯誤狀態不在對比掃描內，只以特寫截圖確認。對照圖只存在執行當時的 scratchpad（`batch3/compare.html`），未進 repo。
