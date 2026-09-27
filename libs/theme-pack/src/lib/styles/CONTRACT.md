# 樣式契約（Style Contract）

> 純文件，**不參與編譯**。列出共用 `ui-` class 契約與可用 token，供開發者查閱。
> 兩軸主題（質地 × 配色）的概觀見 `docs/architecture/02-libs.md`。

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
| `--app-state-hover` / `-pressed` / `-selected` | `color-mix(in srgb, var(--mat-sys-on-surface) 8%/12%/16%, transparent)` | 滑過／按下／選取的底色疊加 | hover：soft-ui、frosted；pressed：卡片分頁標籤按下、可點表格列按下（疊在 hover 底上）；selected：卡片分頁標籤目前項目（`app.scss`） |
| `--app-shadow-tint` | `var(--mat-sys-on-surface)` | Material 陰影色調 | 已套用（material 質地的 `--mat-sys-level*`）；Midnight 配色層改近黑，`_combos.scss` 放大 material × midnight 的透明度 |
| `--app-shell-hairline` / `-scrollbar` / `-hover` / `-subtle` | `color-mix(in srgb, var(--app-shell-on) 16%/24%/12%/8%, transparent)` | 深色側欄的細線、捲軸、滑過、淡底 | 已套用（`side-nav.component.scss`）；editorial 7%、frosted 9% 在質地層覆寫 `-hover` |
| `--app-scrim` / `-blur` | `color-mix(in srgb, var(--mat-sys-inverse-surface) 45%, transparent)` / `0px` | 對話框、抽屜背後的遮罩 | 已套用（CDK `.cdk-overlay-dark-backdrop`、`libs/ui` responsive-panel 背板）；Midnight 改近黑 45%；frosted 霧化 6px（減少透明度時 0） |
| `--app-motion-fast` / `-base` / `-slow` / `--app-ease-standard` | `150ms` / `200ms` / `400ms` / `cubic-bezier(0.2, 0, 0, 1)` | 轉場時長／easing | 已套用（全站元件 scss 的 transition；`lint:theme` 擋寫死 ms/s）；`prefers-reduced-motion` 時三檔歸零 |
| `--app-disabled-fg` / `-bg` / `-opacity` | on-surface 38% / 12% / `0.38` | 停用狀態 | fg／bg 已套用（soft-ui、clay、frosted、editorial 的按鈕與膠囊）；material 等維持 Material 原生；`-opacity` 未使用 |
| `--app-selection-bg` / `-fg` | `var(--mat-sys-primary-container)` / `var(--mat-sys-on-primary-container)` | 選取文字 | 已套用（`component.scss` 全域 `::selection`；深色側欄內改 shell-on 28% 底＋shell-on 字） |
| `--app-z-drawer` / `--app-z-floating` | `101` / `500` | 跨元件圖層順序（值不變） | 已套用（`responsive-panel`、`floating-appearance-panel`）；CDK overlay 的 `1000` 只記錄於註解 |

第二批（2026-09-27，會改變畫面）的決定與改前／改後對照見 ADR 0008「第二批」一節。
另外：圓角一律用 `--mat-sys-corner-*`（`999px` 膠囊、`50%` 圓形、`0` 除外）；轉場時長一律用 `--app-motion-*`。

### 字體（質地包提供，中英分軌）

`--font-zh`（中文固定 Noto）、`--font-en`（英文依質地）、`--font-display`、`--font-body`、`--font-mono`

### 間距

不使用 CSS 變數——一律用 Tailwind 間距工具（`p-4`、`gap-3`…）。
