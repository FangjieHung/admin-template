# ADR 0008：語意用途變數的三層覆寫（預設 → 質地/配色 → 組合）

- 狀態：已決策；第一批（畫面不變）、第二批（會改變畫面）、第三批（欄位邊界）與第四批（原生勾選框與狀態對比）皆已實作（2026-09-27）；遺留項目收尾（動畫時長、等寬數字、data-table 變數）已實作（2026-09-28）
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

## 原生勾選框與狀態對比（2026-09-27）

背景：第三批留下兩個缺口。① 原生 `input[type=checkbox|radio]`（`libs/ui` data-table 的列選取與全選〔含半選〕、派車「可用車輛」列表的單選、booking-flow 保險方案）只有 `accent-color`，未勾選外框是瀏覽器寫死的灰，不跟配色走（Midnight 上是淺灰框、Candy 上是中性灰），也不吃任何 `--app-*` 狀態變數；app 內的 mat-checkbox／mat-radio（訂單各面板、order-form 保險表、booking 付款方式、合約簽署）則是 Material 預設的 on-surface-variant 外框。② 欄位的滑過、焦點、錯誤狀態只靠截圖確認，不在對比掃描內。

決定：

1. 新 partial `libs/theme-pack/src/lib/styles/_choice-controls.scss`，接在 admin／affiliate／booking 的 `styles.scss`（`component` 之後）。選擇器 `input:where([type='checkbox'], [type='radio']):not(:where(.mdc-checkbox__native-control, .mdc-radio__native-control))`，權重只有 0-0-1：元件 scss 可以就地蓋過，質地 recipe 用 `[data-paradigm='x']` 前綴即可加造型；排除 MDC 的透明原生 input（它是 Material 控制項的點擊熱區，改尺寸會縮小熱區）。
2. `appearance: none` 重畫，但保留原生 `<input>`：Tab、Space、單選群組的方向鍵、表單值與螢幕閱讀器的角色／狀態都不變（實測見下）。顏色：未勾選外框 `--app-field-border`（與欄位邊界同一個變數）、底 `--mat-sys-surface`；勾選／半選底與外框 `--mat-sys-primary`，勾號（右下兩邊旋轉 45°）、半選橫線、單選圓點用 `--mat-sys-on-primary`（`::before` 以 `currentColor` 畫，不用 SVG data URI）；焦點 `outline: var(--app-focus-ring-width) solid var(--app-focus-ring)`；錯誤（`aria-invalid='true'` 或 `ng-invalid.ng-touched`）外框 `--mat-sys-error`；停用外框與勾選底 `--app-disabled-fg`、勾號 `--mat-sys-surface`、`cursor: not-allowed`。尺寸 `max(18px, 1.125rem)`、2px 外框、圓角 `min(4px, var(--mat-sys-corner-small))`（Grid／Editorial 的 2px 維持方角，其餘 4px），單選鈕 50%；點擊熱區由外層 `<label>` 提供，不縮小。
3. 滑過用「外框改 `--mat-sys-on-surface`」，不用 `--app-state-hover` 光暈：與欄位滑過一致；18px 方塊外一圈 8% 疊色幾乎看不見，還會跟列的滑過底色疊在一起。控制項本身或包住它的 `<label>` 被滑過都算（data-table 選取格、可用車輛整列）。
4. 質地風格化只加形狀／陰影、不碰顏色：Soft UI 未勾選時加 `--soft-inset-small`，Clay 未勾選時加 2px 的 `--clay-ambient`／`--clay-highlight` 內陰影（兩者的欄位內凹都太大，放不進 18px）；勾選後是主色實心。其餘質地（含 Frosted：18px 上看不出霧感）不加。
5. `forced-colors: active` 下退回 `appearance: auto`、取消 `::before`，由系統畫原生控制項。
6. mat-checkbox／mat-radio：同一檔案把 MDC 顏色 token 指向同一組變數（未勾選 `--app-field-border`、滑過／焦點 `--mat-sys-on-surface`、勾選 `--mat-sys-primary`、勾號 `--mat-sys-on-primary`、勾選框停用 `--app-disabled-fg`）。形狀維持 Material 原樣（MDC 單選鈕是主色外圈＋圓點、不填底）。
7. 元件層：data-table 的勾選框拿掉寫死的 16px 尺寸、`accent-color` 與重複的焦點框規則；可用車輛單選拿掉尺寸與 `accent-color`，焦點框交給整列（既有的 `:has(.avl__radio:focus-visible)`），單選鈕自己 `outline: none` 避免雙框（決策 4 的實例覆寫）。
8. 對比掃描新增 7 個 pair（UI 3:1），56 格全量，量法沿用「取真正構成邊界的那條線」、轉場凍結量終點、焦點一律真的送 Tab：
   - `field_hover_border`：建單頁、訂單列表篩選列、優惠券對話框每個欄位逐一滑過，量邊界對外側底色。
   - `field_focus_indicator`：建單頁第一個欄位、對話框 Tab 到下一欄；outline、MDC 主色底線（`::after`）與「和靜止時不同」的邊框／細框／outlined 外框中取對比最高者。另記錄它對靜止邊界的比值（不設門檻）。
   - `field_error_border`：對話框必填欄位輸入後清空、Tab 離開。
   - `check_unchecked_border`、`check_checked_fill`、`check_mark`、`check_focus_ring`：data-table 勾選框（未勾選、勾第一列後的勾選與表頭半選、Tab 到勾選框）與可用車輛單選（未勾選、選一台）。原生外觀（`appearance` 不是 `none`）的控制項略過。

   結果：56 格 0 不合格，**不需要調整任何變數值**。43 個相容組合的最低值：滑過 3.17（Cool Grey；Grid 等滑過時邊界不變的質地）、焦點 4.70（Midnight）、錯誤 5.06（Cool Grey）、未勾選外框 3.17（Cool Grey）、勾選底 4.70（Midnight）、記號 4.94（Verdant 單選圓點）、勾選框焦點框 4.70（Midnight）。焦點指示對靜止邊界的比值 1.00～3.16：主色與 `--app-field-border` 常常亮度相近（例如 Midnight 1.01），焦點的可辨識度主要靠色相與粗細（2px 底線、2px outline）而不是亮度差——門檻只看對外側底色，這項只記錄。
9. `lint:theme`：勾選框／單選鈕選擇器（`[type=checkbox|radio]`、`.mat-mdc-checkbox`、`.mat-mdc-radio-button`、`.mdc-checkbox`、`.mdc-radio`）底下的顏色宣告不得寫死顏色（色彩函式、具名色、hex、變數 fallback 裡的寫死色都擋；`currentColor`、`transparent`、`forced-colors` 系統色允許）；`--mat-checkbox-*color`／`--mat-radio-*color` 只能指向 `--app-*`／`--mat-sys-*`；`accent-color` 只能用變數。宣告改成遇到 `;`／`}` 才判斷，單行規則也掃得到。預設掃描範圍納入 `libs/ui`、`libs/booking-flow`、`libs/contract-signing`，冒出的 10 處既有違規全部改掉：range picker 手機版遮罩 `rgb(0 0 0 / 40%)` → `--app-scrim`、booking 方案照片標籤 `rgba(0,0,0,.6)`／白字 → inverse-surface 80%／inverse-on-surface、結帳頁與選車頁 `var(--x, <寫死色>)` 的 fallback 拿掉（token 必定存在）、結帳頁手機版底部摘要的 `z-index: 20` → 新增層 1 變數 `--app-z-sticky: 20`（值不變）。

鍵盤實測（playwright，看 `checked` 值）：data-table Tab 走得到全部 11 個勾選框、Space 勾選／取消（網址不變，列的鍵盤導覽沒有被觸發）、表頭因此變半選、表頭 Space 全選；可用車輛與 booking 保險方案 Tab 進入群組、方向鍵移動並選取。

對照圖只存在執行當時的 scratchpad（`batch4/compare.html`），未進 repo。

## 遺留項目收尾（2026-09-28）

交接信 `docs/plans/2026-09-26-theme-handoff.md` 末段「已知但未處理」的三項樣式問題，加上 booking 前台的截圖驗收。

1. **關鍵影格動畫時長**（`b6a690c`）：全站 scss 只有 4 個 `animation`。一次性的進場動畫（`libs/ui` responsive-panel、dual-month-range-picker 的底部滑入，0.2s ease-out）改用 `var(--app-motion-base) var(--app-ease-standard)`，時長不變。無限循環、時長本身就是節奏的裝飾動畫不塞進三檔，新增層 1 變數 `--app-motion-loop: 8s`（= 目前唯一的循環動畫：clay 背景光暈；另一顆 10s、-2s 起跑寫成 `× 1.25`／`× -0.25`，值不變，easing 維持 ease-in-out 的來回感）。**減少動態的決定**：三檔與 `--app-motion-loop` 在 `prefers-reduced-motion` 一律歸零；用到循環動畫的 recipe 另外明寫 `animation: none` 停掉（clay 已有），歸零只是保底。實測：改前 responsive-panel 在減少動態下仍以 0.2s 滑入，改後 0s；dual-month-range-picker、clay 光暈維持停止。`lint:theme` 的「不得寫死時長」擴充到 `animation`／`animation-duration`／`animation-delay`，並補上負的延遲（`-2s`）。
2. **等寬數字共用 class**（`67e1955`）：新增 `.ui-text-numeric`（`component.scss`，0-1-0：`tabular-nums`）。元件裡 21 處寫死的 `font-variant-numeric: tabular-nums`（admin 派車月曆／時間軸／可用車輛／工作清單明細、備車佇列、訂單摘要、訂單明細金額、待補卡、取消分頁、訂單列表待補徽章，`libs/order-form` 方案表與收款列）全部刪掉，改在 template 加 class；data-table 對 `align: 'end'` 的 th/td 自動加。Grid 質地讓它用 `var(--font-mono), var(--font-zh)`：中文接回 Noto（CONTRACT「中文固定 Noto」，與 Grid 的 `--font-display` 同寫法），取代原本只掛在 `.dt-align-end` 的 `--font-mono`（該處中文原本掉到系統備援字體，這次一併改正）。
3. **data-table 的 `!important`**（`ab4d5d3`）：根因是元件樣式經 Angular 封裝後每段選擇器都多一個屬性（`.dt-table tbody tr` → 0-4-2），全域 recipe（0-3-2）蓋不過。元件改以變數暴露外觀——`--dt-frame`、`--dt-head-border-color`、`--dt-row-border-color`、`--dt-col-divider`、`--dt-cell-padding-block`、`--dt-header-bg`、`--dt-row-hover-bg`，fallback = 原值；質地只在 `.dt-table` 上設變數。Soft UI／Clay／Frosted／元件自己選取欄的 `!important` 全數移除（元件選取欄改用 `.dt-table .dt-selection-*` 提高到 0-4-0）。三個質地原本的 `.dt-table { background: transparent }` 是多餘的（元件本來就不設底色），刪掉。量測發現 Grid 的 `thead tr { border-bottom: 1px solid outline }` 從未生效（表頭分隔線一直是 outline-variant），為了畫面不變沒有補設 `--dt-head-border-color`，留給使用者看圖決定（Grid 準則「已知限制」）。為了畫面不變也保留一個既有怪癖：手機卡片版只有下緣吃 Soft UI 的淡線（以前 `!important` 的 border-bottom-color 蓋到了卡片下緣），其餘三邊仍是 outline-variant。

驗收（改前 = 動任何樣式檔前以 `124dfa2` 編出的 admin，2026-09-27T19:22Z 編譯、19:26–19:37Z 量測；改後 19:37–19:48Z 量測）：43 個相容組合 × 訂單列表（一般、hover 第 2 列、勾選第 1 列、390px 卡片版）、優惠券、車輛三張表，記錄 table／表頭列／th／前 3 列與其 td／最後一列的底色、邊框 4 邊（寬／樣式／色）、陰影、字色、padding、圓角、字體、`font-variant-numeric`、高度，共 280,962 個欄位：0 差異（另 220 個是「兩邊寬度都是 0px」的邊框樣式／顏色，不會畫出來；80 個是 Grid 數字欄的字體，預期）。`tabular-nums` 元素（訂單列表、優惠券、車輛、建單頁、訂單明細總覽與取消分頁、儀表板月曆／時間軸／兩個對話框）17,044 個欄位：`font-variant-numeric` 0 差異；`font-family` 只有 Grid 的 `.ui-text-numeric` 元素與其子元素換成 mono（預期），其他 6 個質地 0 差異。對比掃描 56 格 0 不合格。

booking 前台（第二～四批對 `libs/booking-flow` 的影響，之前只跑過 test／build）：`3bfa52d`（session 開始前）與收尾後各編一份，手機 390／桌面 1280 × 8 個畫面（搜尋空白、搜尋結果、日期面板、方案、訂單、填好的訂單、付款、完成）逐像素比對。差異都在預期內：filled／outlined 欄位邊界（第三批）、方案單選鈕與付款方式 mat-radio（第四批）、手機日期面板遮罩改成 inverse-surface 45%、車卡標籤圓角（第二批）；付款、完成頁 0 差異。對照頁只存在執行當時的 scratchpad（`batch6/booking-compare.html`），未進 repo。
