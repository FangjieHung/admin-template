# 樣式契約（Style Contract）

> 純文件，**不參與編譯**。列出共用 `ui-` class 契約與可用 token，供開發者查閱。
> 兩軸主題（質地 × 配色）的概觀見根目錄 `README.md`「雙軸主題系統」。

元件與 template **只能**使用下列 `--mat-sys-*` 與 `--app-*` token；
禁止寫死色碼或直接引用底層色板變數（`--primary-500` 等）——`npm run lint:theme` 會擋。

---

## Class 契約（`ui-*` / `is-*`）

骨架 HTML 使用這組固定 class，每個質地包（`src/styles/texture/*`）負責實作它們。

| Class                           | 說明                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `.ui-card`                      | 白底卡片：hairline 邊、近隱形陰影、大圓角                                         |
| `.ui-card--inverse`             | 深色 hero 卡：無邊框無陰影（原 `.v-card-dark`）                                   |
| `.ui-card--clickable`           | 游標提示可點擊                                                                    |
| `.ui-nav-pill`                  | 導覽膠囊；啟用態疊加 `.is-active`（原 `.v-nav-pill + .active`）                   |
| `.ui-text-display`              | 大數字（StatCard 的 hero number，原 `.v-stat-number`）                            |
| `.ui-text-title`                | 頁面大標（原 `.v-page-title`）                                                    |
| `.ui-text-subtitle`             | 卡片與表單的小節標題（字級、字重由質地包提供）                                    |
| `.ui-text-caption`              | 卡片內小節標／quiet label（原 `.v-card-label`）                                   |
| `.ui-text-numeric`              | 數字文字（金額、日期、時間、數量、單號）：預設 `tabular-nums`；Grid、Ledger、Cockpit 另換 `--font-mono`（中文接 `--font-zh`）。元件不要自己寫 `font-variant-numeric`，在 template 加這個 class（`component.scss`）；data-table 的 `align: 'end'` 欄自動掛上 |
| `.ui-chip` + `.ui-chip--{tone}` | 狀態徽章 + tone 變體（tone：`positive`/`info`/`neutral`/`warning`/`danger`）      |
| `.ui-btn`                       | 按鈕（未來擴充：`--sm`/`--md`/`--lg` × `--solid`/`--outline`/`--ghost`/`--text`） |
| `.ui-table`                     | 表格（未來擴充）                                                                  |
| `.ui-field-group`               | 相連欄位群組：中間圓角歸零、接縫補 hairline divider（僅 `appearance="fill"`）     |

暫時狀態一律用 `is-` 前綴：`.is-active`、`.is-disabled`、`.is-loading`、`.is-selected`…

---

## 可用 token

### Material 3 系統 token（`--mat-sys-*`）

顏色值由**配色包**（`color-themes/*`）提供；造型值由**質地包**（`texture/*/_tokens.scss`）提供。

| 類別 | Token                                                                                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------- |
| 表面 | `--mat-sys-background`、`--mat-sys-surface`、`--mat-sys-surface-container-low/high`、`--mat-sys-inverse-surface` |
| 文字 | `--mat-sys-on-surface`、`--mat-sys-on-surface-variant`、`--mat-sys-on-primary`、`--mat-sys-inverse-on-surface`   |
| 主色 | `--mat-sys-primary`                                                                                              |
| 邊線 | `--mat-sys-outline`、`--mat-sys-outline-variant`                                                                 |
| 狀態 | `--mat-sys-error`、`--mat-sys-error-container`、`--mat-sys-on-error-container`                                   |
| 圓角 | `--mat-sys-corner-small` / `-medium` / `-large` / `-extra-large` / `-full`                                       |
| 陰影 | `--mat-sys-level1` / `-level2` / `-level3` / `-level4`                                                           |

### 專案自訂 token（`--app-*`，M3 缺口的必要擴充）

| 用途         | Token                                                      |
| ------------ | ---------------------------------------------------------- |
| 狀態 tone    | `--app-{positive,info,neutral,warning,danger}-{bg,fg,dot}` |
| 圖表／時間軸 | `--app-viz-1` … `--app-viz-4`                              |
| 深色側欄     | `--app-shell-bg`、`--app-shell-on`、`--app-shell-on-muted` |
| 日曆範圍底色 | `--app-calendar-range-fill`                                |

### 用途變數（`--app-*`，第二類：跨質地重複的造型/狀態邏輯）

上面那組 `--app-*` 是「配色缺口」（狀態色、shell 色）；這組是「造型/互動邏輯缺口」——
7 個質地包各自用 `color-mix()`／寫死值重複實作同一種用途（焦點框、強調邊框、
hover/active 疊加、Material 陰影色調、圖層順序…），沒有單一調整點。
ticket：`docs/plans/2026-09-27-semantic-tokens.md`；分層決策見 `docs/adr/0008-semantic-token-layers.md`。

#### 分層規則

| 層 | 選擇器 | 權重 | 放什麼 | 檔案 |
| --- | --- | --- | --- | --- |
| 1. 預設 | `:root` | 0-1-0 | 每個 `--app-*` 用途變數的預設值 | `styles/_semantic.scss` |
| 2. 質地 | `:root[data-paradigm='x']` | 0-2-0 | 造型相關的例外（邊框濃淡、狀態層濃度、陰影、寬度） | 各質地 `texture/*/_tokens.scss` |
| 2. 配色 | `:root[data-theme='x']` | 0-2-0 | 顏色本身需要例外（Midnight 的陰影色調、遮罩改近黑） | 各配色 `color-themes/*/_tokens.scss` |
| 3. 組合 | `:root[data-paradigm='x'][data-theme='y']` | 0-3-0 | 只有某一格「質地 × 配色」需要例外 | `styles/_combos.scss`（目前 1 條：material × midnight 陰影透明度） |

**同一個變數不可以同時在質地層與配色層定義**（兩者權重相同，會變成看載入順序決定勝負）；
兩者都要改同一個變數時改用組合層。個別 DOM 選擇器若需要與該層典型值不同的數值（例如
某個按鈕的 `outline-offset` 跟同質地其他按鈕不同），可以在該選擇器規則內就地覆寫變數
（等同一次性的「實例覆寫」），不算破壞分層——只是不寫進共用檔案。

#### 目前的用途變數

| 變數 | 預設（層 1） | 用途 | 目前狀態 |
| --- | --- | --- | --- |
| `--app-focus-ring` | `var(--mat-sys-primary)` | 焦點框顏色 | 已套用（全站 25 處） |
| `--app-focus-ring-width` / `-offset` | `2px` / `2px` | 焦點框粗細／距離；各處現值不同時就地覆寫 | 已套用（clay 的 3px 只寫在 clay 自己的按鈕／輸入框規則內） |
| `--app-border-emphasis` | `color-mix(in srgb, var(--mat-sys-outline-variant) 35%, transparent)` | 強調邊框／分隔線 | 已套用（linen；grid 的裝飾格線因公式形狀不同未收編，見 ADR 0008） |
| `--app-field-border` | `var(--mat-sys-outline)`（Verdant 配色層：`color-mix(in srgb, var(--mat-sys-on-surface-variant) 68%, var(--mat-sys-outline))`） | 輸入欄位的可見邊界色，對欄位外側底色 ≥ 3:1（WCAG 1.4.11） | 已套用：material／linen 的 1px 底線、grid／editorial／frosted 的邊框、soft-ui／clay 與 page-toolbar 搜尋膠囊的 1px inset 細框、outlined 欄位外框（`component.scss`）；錯誤改 `--mat-sys-error`、停用改 `--app-disabled-bg`（`component.scss` 就地覆寫）；`lint:theme` 擋欄位邊框用其他顏色 |
| （原生勾選框／單選鈕） | — | `input[type=checkbox\|radio]` 的外觀（第四批，`styles/_choice-controls.scss`，`appearance: none` 保留原生 input） | 未勾選外框 `--app-field-border`、底 `--mat-sys-surface`；滑過外框 `--mat-sys-on-surface`；勾選／半選底與外框 `--mat-sys-primary`、勾號／橫線／圓點 `--mat-sys-on-primary`；焦點 `--app-focus-ring`（`-width`／`-offset`）；錯誤外框 `--mat-sys-error`（`aria-invalid` 或 `ng-invalid.ng-touched`）；停用 `--app-disabled-fg`、勾號 `--mat-sys-surface`。尺寸 ≥ 18px、圓角 `min(4px, var(--mat-sys-corner-small))`（單選鈕 50%）；`forced-colors` 時退回原生外觀。mat-checkbox／mat-radio 的 MDC 顏色 token 指向同一組變數。soft-ui／clay 只在質地 recipe 加小內凹陰影。`lint:theme` 擋寫死顏色 |
| `--app-state-hover` / `-pressed` / `-selected` | `color-mix(in srgb, var(--mat-sys-on-surface) 8%/12%/16%, transparent)` | 滑過／按下／選取的底色疊加 | hover：soft-ui、frosted；pressed：卡片分頁標籤按下、可點表格列按下（疊在 hover 底上）；selected：卡片分頁標籤目前項目（`app.scss`） |
| `--app-shadow-tint` | `var(--mat-sys-on-surface)` | Material 陰影色調 | 已套用（material 質地的 `--mat-sys-level*`）；Midnight 配色層改近黑，`_combos.scss` 放大 material × midnight 的透明度 |
| `--app-shell-hairline` / `-scrollbar` / `-hover` / `-subtle` | `color-mix(in srgb, var(--app-shell-on) 16%/24%/12%/8%, transparent)` | 深色側欄的細線、捲軸、滑過、淡底 | 已套用（`side-nav.component.scss`）；editorial 7%、frosted 9% 在質地層覆寫 `-hover` |
| `--app-scrim` / `-blur` | `color-mix(in srgb, var(--mat-sys-inverse-surface) 45%, transparent)` / `0px` | 對話框、抽屜背後的遮罩 | 已套用（CDK `.cdk-overlay-dark-backdrop`、`libs/ui` responsive-panel 背板）；Midnight 改近黑 45%；frosted 霧化 6px（減少透明度時 0） |
| `--app-motion-fast` / `-base` / `-slow` / `--app-ease-standard` | `150ms` / `200ms` / `400ms` / `cubic-bezier(0.2, 0, 0, 1)` | 轉場與一次性進場動畫的時長／easing | 已套用（全站元件 scss 的 transition；`libs/ui` responsive-panel、dual-month-range-picker 的滑入動畫；`lint:theme` 擋 transition／animation 寫死 ms/s）；`prefers-reduced-motion` 時三檔歸零 |
| `--app-motion-loop` | `8s` | 無限循環的裝飾動畫（時長本身是節奏，不套三檔） | 已套用（clay 背景光暈：`8s`、另一顆 `× 1.25`＝10s、起跑 `× -0.25`＝-2s）；`prefers-reduced-motion` 時歸零，用到的 recipe 另寫 `animation: none` 停掉 |
| `--app-disabled-fg` / `-bg` / `-opacity` | on-surface 38% / 12% / `0.38` | 停用狀態 | fg／bg 已套用（soft-ui、clay、frosted、editorial 的按鈕與膠囊）；material 等維持 Material 原生；`-opacity` 未使用 |
| `--app-selection-bg` / `-fg` | `var(--mat-sys-primary-container)` / `var(--mat-sys-on-primary-container)` | 選取文字 | 已套用（`component.scss` 全域 `::selection`；深色側欄內改 shell-on 28% 底＋shell-on 字） |
| `--app-skeleton-bg` / `-shine` / `-radius` / `-duration` | on-surface 8% / surface 60% / `var(--mat-sys-corner-small)` / `calc(var(--app-motion-loop) / 5)`（1.6s） | 載入骨架的色塊底色、閃光亮帶、圓角、閃光循環時長 | 已套用（`libs/ui` 的 `lib-skeleton`、`lib-data-table` 的載入列，共用 `feedback-state/_skeleton-block.scss`）；圓角跟著質地的 corner-small，目前沒有質地需要覆寫；Cockpit 在質地層把閃光改成 primary 12% 的掃描光；`prefers-reduced-motion` 時 loop 歸零，元件另寫 `animation: none` 停成純底色 |
| `--app-empty-bg` / `-frame` / `-shadow` | `transparent` / `0 solid transparent` / `none` | 空狀態與錯誤狀態（`lib-empty-state`、`lib-error-state`）的外框：底色、框線（border 簡寫）、陰影 | 已套用；質地層覆寫：Linen 底色 `--mat-sys-surface-container-low`、Grid 框線 `1px dashed var(--mat-sys-outline-variant)`、Soft UI 陰影 `var(--soft-inset-small)`（各準則「空狀態」）；其餘質地維持「卡片內置中、不加色塊或框」 |
| `--app-z-sticky` / `--app-z-drawer` / `--app-z-floating` | `20` / `101` / `500` | 跨元件圖層順序（值不變） | 已套用（`responsive-panel`、`floating-appearance-panel`；`--app-z-sticky` 給頁內釘底的列）；CDK overlay 的 `1000` 只記錄於註解 |

第二批（2026-09-27，會改變畫面）的決定與改前／改後對照見 ADR 0008「第二批」一節。
另外：圓角一律用 `--mat-sys-corner-*`（`999px` 膠囊、`50%` 圓形、`0` 除外）；轉場與關鍵影格動畫時長一律用 `--app-motion-*`。

### 共用元件的外觀變數（`--dt-*`，data-table）

`libs/ui` 的 data-table 樣式經 Angular 封裝後權重比質地 recipe 高（`.dt-table tbody tr` 是 0-4-2，
`:root[data-paradigm] .dt-table tbody tr` 是 0-3-2），質地要改外觀時**只在 `.dt-table` 上設下列變數**，
不直接覆寫屬性、不用 `!important`。變數沒設時用元件內 `var()` 的 fallback（= 元件原值）。

| 變數 | 預設 | 用途 | 目前設定的質地 |
| --- | --- | --- | --- |
| `--dt-frame` | `0 solid`（無外框） | 表格外框（border 簡寫） | Grid：`1px solid var(--mat-sys-outline)` |
| `--dt-head-border-color` | `var(--mat-sys-outline-variant)` | 表頭與內容的分隔線顏色 | Cockpit：`var(--cockpit-edge-strong)`；Ledger：`var(--mat-sys-outline)`（Grid 準則寫的 outline 加強從未生效，維持現狀，見 Grid 準則） |
| `--dt-row-border-color` | `var(--mat-sys-outline-variant)` | 列與列之間的分隔線（手機卡片版的下緣也吃它） | Soft UI：`color-mix(in srgb, var(--mat-sys-outline) 22%, transparent)`；Ledger：`var(--mat-sys-outline-variant)` |
| `--dt-col-divider` | `0 solid`（無欄線） | 欄線（儲存格右側 border 簡寫，最後一欄永遠沒有） | Grid：`1px solid var(--mat-sys-outline-variant)` |
| `--dt-cell-padding-block` | `0.75rem`（手機卡片版 `0.3125rem`） | 儲存格上下留白，決定列高 | Soft UI `1rem`、Frosted `1.0625rem`、Clay `1.125rem`、Ledger `0.375rem`（手機卡片版一樣吃這個值） |
| `--dt-header-bg` | `transparent` | 表頭列底色 | Ledger：on-surface 9% 混進 surface；Cockpit：`var(--mat-sys-surface-container)` |
| `--dt-row-hover-bg` | `var(--mat-sys-surface-container-high)` | 可點列滑過／按下的底色（按下另疊 `--app-state-pressed`） | Ledger：primary 8% 混進 surface；Cockpit：primary 10% 混進 surface |
| `--dt-font-size` | `0.875rem` | 表格字級 | Ledger `0.8125rem`（13px） |
| `--dt-cell-padding-inline` | `1rem` | 儲存格左右留白（勾選欄另計） | Ledger `0.625rem` |
| `--dt-row-stripe-bg` | `transparent` | 斑馬紋：偶數列疊一層的底色（畫成 background-image，疊在滑過、提醒列的底色之上；按下時拿掉；固定欄捲動時一樣疊上；手機卡片版不畫） | Ledger：on-surface 6% |
| `--dt-selection-control-size` | `2.75rem` | 勾選欄點擊熱區的邊長 | Ledger `2rem`（32px，≥ 24px，WCAG 2.5.8） |
| `--dt-selection-padding-block` | 同 `--dt-cell-padding-block` | 勾選欄上下留白（熱區已夠高時歸零，避免撐高列） | Ledger `0` |
| `--dt-frozen-bg` | `var(--mat-sys-surface)` | 固定欄（columns 的 `frozen`）與勾選欄在**橫向捲過時**的底色，要等於卡片底色才看不出接縫；沒捲時固定欄照常透明 | Editorial：`var(--mat-sys-surface-container-low)`；Soft UI：`var(--mat-sys-background)`（兩者的卡片底色）。Clay／Frosted／Aero 的卡片是半透明，維持預設（捲動時固定欄是不透明 surface） |
| `--dt-frozen-edge` | `1px 0 0 0 var(--mat-sys-outline-variant)` | 固定欄右緣的分界（box-shadow 值，套在固定格右緣 1px 寬的偽元素上；border-collapse 的儲存格本身畫不出 box-shadow），同樣只在橫向捲過時出現 | （無） |

`--dt-frozen-offset` 是元件內部用的（量勾選欄實際寬度後寫在 `.dt-table` 上，讓固定欄貼在勾選欄右邊），質地不要設。

#### 其他 libs/ui 清單元件

分頁列（`.dt-pager`）、欄位選擇面板、進階篩選面板（`lib-advanced-filter`）、已儲存檢視（`lib-saved-views`）的浮層都只用上面的語意 token：
面板底 `--mat-sys-surface-container-high`、hairline `--mat-sys-outline-variant`、圓角 `--mat-sys-corner-medium`、陰影 `--mat-sys-level3`（與 dual-month-range-picker 同一組），
原生欄位邊界 `--app-field-border`、滑過 `--app-state-hover`、目前項目 `--app-state-selected`、焦點 `--app-focus-ring`、停用 `--app-disabled-fg`；
條件 chips 用 `.ui-chip.ui-chip--neutral`、「已修改」用 `.ui-chip.ui-chip--info`，外觀交給各質地的 chip recipe。沒有新增質地要設的變數。

#### 三態與提示訊息（`libs/ui` feedback-state、toast）

- 骨架、空狀態、錯誤只用上面的 `--app-skeleton-*`、`--app-empty-*` 與語意 token；說明文字用 `.ui-text-subtitle`、補充文字用 `.ui-text-caption`，字體交給質地 recipe。圖示是 Material Symbols，空狀態 `--mat-sys-on-surface-variant`、錯誤 `--mat-sys-error`。
- 提示訊息（`ToastService`）的外框就是 MatSnackBar：底色 inverse-surface、圓角與陰影吃各質地既有的 snackbar recipe（`.mat-mdc-snack-bar-container .mdc-snackbar__surface`）。類型徽章用狀態語意一對：成功 `--app-positive-bg/-fg`、資訊 `--app-info-*`、警告 `--app-warning-*`、錯誤 `--app-danger-*`；關閉鈕 `--mat-sys-inverse-on-surface`，動作鈕沿用 snackbar 的 `--mat-sys-inverse-primary`。沒有新增質地要設的變數。

### 字體（質地包提供，中英分軌）

`--font-zh`（中文，裝置的系統字）、`--font-en`（英文依質地）、`--font-display`、`--font-body`、`--font-mono`

字型規則（每個質地都一樣）：

- **專案不提供任何字型檔**（不放 `.woff2`／`.ttf`，也不用 `@font-face` 指向本地檔案）。
- **中文一律用裝置自己的字型**：`--font-zh: 'PingFang TC', 'Microsoft JhengHei', 'Noto Sans CJK TC', system-ui, sans-serif`（macOS／iOS 蘋方、Windows 微軟正黑、Linux／Android 思源黑體）。不從 Google Fonts 載入 Noto Sans TC 等中文網頁字。`apps/admin/src/styles.scss` 的 `mat.theme()` `plain-family`／`brand-family` 用同一組中文字。
- **英文網頁字只從 Google Fonts 載入，而且只在風格明顯不同於 Noto Sans／系統無襯線時才載**（例如 Editorial 的 Lora、Clay 的 Nunito）。按需質地的英文字放在該質地的 `_fonts.scss`，跟著 `texture-<id>.css` 一起下載；Material 常駐用的 Inter、Plus Jakarta Sans、IBM Plex Mono 在 admin `index.html` 的 `<link>`。
- 寫字體時先放英文字族、再接 `var(--font-zh)`，例：`--font-body: 'Inter', var(--font-zh);`。

### 間距

不使用 CSS 變數——一律用 Tailwind 間距工具（`p-4`、`gap-3`…）。
