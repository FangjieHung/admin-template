# ADR 0008：語意用途變數的三層覆寫（預設 → 質地/配色 → 組合）

- 狀態：已決策、第一批（畫面不變）已實作（2026-09-27）；第二批（會改變畫面）待辦
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
