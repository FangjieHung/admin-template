# Sketch 手繪質地準則

> 模板與術語見 [`../README.md`](../README.md)。顏色只用語意 token（`--mat-sys-*`、`--app-*`），由配色軸提供；筆是文字墨 `--mat-sys-on-surface`、螢光筆是主色 `--mat-sys-primary`，所有表面都是同一張紙 `--mat-sys-surface`（`_tokens.scss` 的 `--sketch-*`）。決策紀錄與可讀性規則見 [ADR 0016](../../../../../../../docs/adr/0016-sketch-texture.md)。

## 一句話個性

手繪草稿／白板筆記：用筆在點格筆記本上畫出來的介面，線條有點抖、角有點歪，適合原型、活動頁、內部工具的輕鬆感——但表格和欄位照樣用尺畫，字照樣印得清楚。

## 造型規格

| 項目 | Token | 值 | 用在 | 現況 → 目標 |
| --- | --- | --- | --- | --- |
| 一般圓角 small / medium / large / extra-large | `--mat-sys-corner-*` | 4 / 8 / 12 / 16px | 「要直線」的地方：欄位、勾選框、日曆、表格；以及高對比時取代手繪圓角 | — |
| 圓角 full | `--mat-sys-corner-full` | 999px | 圖示按鈕、FAB、開關軌道、狀態圓點 | — |
| 手繪圓角 | `--sketch-wobble-xs` / `-sm` / `-md` / `-lg` / `-xl`（`-sm-alt`、`-lg-alt` 是滑過時重畫的形狀） | 每個角一長一短的橢圓：長的一邊用 %（跟著元件長）、短的一邊 4–12px（彎的深度固定） | 狀態徽章 / 按鈕、導覽膠囊、篩選 chip、選單項目、提示訊息 / 選單、下拉、日期選擇器、展開面板 / 卡片、mat-card / 對話框 | — |
| 抖動的筆線 | `--sketch-jitter` | SVG 雜訊（feTurbulence）＋位移（feDisplacementMap），把框線推歪約 ±2px | 只在卡片的 `::before`、對話框外層的 `::after`（不含文字的偽元素） | — |
| 筆 | `--sketch-pen` / `--sketch-ink` | 鋼筆：文字墨 80%、1.5px / 麥克筆：文字墨 100%、2px（對話框 2.5px） | 卡片、按鈕外框、導覽膠囊 / 選單、下拉、日期選擇器、展開中的面板、對話框 | — |
| 再描一次 | `--sketch-retrace` / `-pressed` | 同一個形狀往右下錯開 3px 的第二道 1.5px 線（兩層 box-shadow：紙色＋墨色）／按下時收回 | 浮起的面板、對話框、實心與 tonal 按鈕、浮起按鈕、FAB、啟用的導覽膠囊、反轉卡片、滑過的可點卡片 | — |
| 鉛筆排線 | `--sketch-hatch` | 文字墨 38%、45° 斜線、5px 間距，偏移 7px，裁成 L 形 | 只在對話框右下外側 | — |
| 細分隔 | `--sketch-rule` | 1px 文字墨 28%（直線） | 卡片標題列、對話框標題列與動作列、展開面板標題 | — |
| 陰影 | `--mat-sys-level1–4` | 沒有模糊陰影；level 1 是 none，level 2–4 都是「再描一次」 | Material 元件內建的浮起樣式 | — |
| 欄位邊界 | `--app-field-border` | 1.5px 直線、4px 規則圓角；滑過換文字墨，聚焦換主色並加粗到 2px | Material 欄位 | — |
| 表格 | `--dt-frame` / `--dt-head-border-color` | 1px `outline` 直線外框 / 表頭下緣 1px 文字墨；列線用預設 `outline-variant` | `lib-data-table`、mat-table | — |
| 焦點框 | `--app-focus-ring-*` | 2px 主色實線、離 2px（預設值）；外框跟著手繪圓角走 | 全部可聚焦元件 | — |
| 字體 | `--font-display` / `--font-body` / `--font-mono` | Kalam 700 接 `--font-zh` / 裝置無襯線（Helvetica Neue／Segoe UI／Roboto／Arial）接 `--font-zh` / IBM Plex Mono | 20px 以上的標題：頁面大標、`.ui-text-title`、`.ui-text-display`、對話框標題與 Material 的 display／headline／title-large / 內文、小節標、Material 元件 / 數字輸入、`.ui-text-numeric` | — |
| 視覺密度 | — | 與 Material 相同（不改元件尺寸） | — | — |
| 動態 | `--app-motion-fast` | 滑過時形狀「重畫」（換成 `-alt` 圓角）、描線出現；不位移、不旋轉；減少動態時不重畫 | 按鈕、導覽膠囊、可點卡片 | — |
| 背景紋理 | `--sketch-dot-grid` | 文字墨 10% 的點、22px 一格（筆記本點格）；高對比時拿掉 | 只在頁面底層（`body`） | — |
| 大標底線 | `--sketch-underline-mask` | 主色的手繪雙筆底線（SVG 遮罩，拉滿標題寬度、筆畫不變粗）；高對比時拿掉 | 只在頁面大標下方，不壓字 | — |

## 層次表現

**用手繪線條分層：越前面的層，筆越粗、描得越多。** 畫布是點格紙；卡片是一道 1.5px 的鋼筆線（有點抖、角有點歪）；浮起的面板（選單、下拉、日期選擇器、展開中的面板、滑過的可點卡片）換成 2px 麥克筆，再往右下錯開 3px 描一次；對話框是最粗的 2.5px 麥克筆、描兩次，右下再塗一小片鉛筆排線。

所有表面都是同一張紙（`surface`），沒有模糊陰影、沒有色塊分層；拿掉線條，畫面只剩一疊同色的紙。「再描一次」的偏移固定 3px，前後不看影子多長，只看筆畫的粗細與次數。

和其他質地的差別：Material 是模糊陰影的高度；Grid 是規則的 1px 灰框、越前面越長的硬影、格紋背景；Brutal 是飽和色塊與越來越長的墨影；Riso 是網點與平網的墨量；Editorial 是字級與髮絲線；Ledger 是斑馬紋。Sketch 的線**不規則**（圓角每個角都不一樣、線本身會抖），而且前後只看線，不看影子或底色。Linen 是紙張色階、Soft UI／Clay 是體積、Frosted／Aero 是透光、Cockpit 是發光。

像 Figma 裡所有 frame 共用一個紙色 fill、沒有任何 effect，只換 stroke：卡片是一條手繪筆刷 1.5px，浮層換成 2px 的麥克筆刷並複製一份往右下推 3px，對話框再加一塊斜線圖樣的形狀。

## 新增頁面規則

- **卡片**：`.ui-card`，紙底、手繪圓角（`--sketch-wobble-lg`），抖動的鋼筆線由質地畫在卡片的 `::before`。可點卡片 `.ui-card--clickable` 滑過時形狀重畫並再描一次，不位移。卡片自己不要再用 `::before`，也不要設 `overflow: hidden`（會裁掉抖出框外的線；需要裁切時用 `overflow: clip`，質地已放寬裁切邊）。
- **表格**：一律用 `lib-data-table`。**表格線永遠是直的**：1px 外框、表頭下緣一條文字墨直線、列線是預設的淡線；不放手繪圓角、不抖、不描兩次。卡片的框可以抖，裡面的表格不抖。數字欄給 `align: 'end'`（`.ui-text-numeric`，IBM Plex Mono）。
- **表單**：欄位是白紙填寫格、1.5px 直線欄位邊界（配色層的 `--app-field-border`）、4px 規則圓角；滑過換文字墨，聚焦換主色並加粗到 2px。勾選框、單選鈕、開關、日曆格子都是規則形狀。相連欄位用 `.ui-field-group`。
- **空狀態**：卡片內一張便利貼——紙底、1.5px 文字墨虛線框（`--app-empty-*`），裡面置中圖示、說明、動作按鈕。
- **對話框**：紙底、手繪圓角（`--sketch-wobble-xl`），2.5px 抖動的麥克筆線＋再描一次＋右下鉛筆排線（都畫在 `.mat-mdc-dialog-inner-container` 的偽元素上，對話框本體會捲動，自己的偽元素會被裁掉）；標題 24px，英文與數字是 Kalam、中文是裝置字；標題列與動作列各一條 `--sketch-rule`。遮罩用配色的 `--app-scrim`。
- **chip／徽章**：`.ui-chip` + tone，手繪的小圓框（`--sketch-wobble-xs`）、tone 色底、粗體小字、實心圓點；狀態不可只靠顏色表達，文字一定要寫出來。

## Do / Don't

**Do**

- 前後關係用筆畫表達：鋼筆 1.5px → 麥克筆 2px＋再描一次 → 2.5px＋再描一次＋排線（`--sketch-pen`、`--sketch-ink`、`--sketch-retrace`）。
- 新的可點元件用手繪圓角（`--sketch-wobble-sm`），滑過換 `-sm-alt`，實心的再加 `--sketch-retrace`、按下用 `--sketch-retrace-pressed`。
- 要抖的線畫在不含文字的偽元素上，再套 `--sketch-jitter`。
- 手寫字只給 20px 以上的英文與數字標題；小節標（約 17px）、內文、按鈕、表格一律用 `--font-body`。
- 表格、欄位、表單控制項用直線與規則圓角（`--mat-sys-corner-*`）。

**Don't**

- 把 `filter`、`transform`（旋轉、歪斜）、`text-shadow` 用在含文字的元素上——字永遠不變形。
- 在表格、欄位框、勾選框、日曆上用手繪圓角或抖動。
- 把手寫字用在中文、內文或 20px 以下的字（中文手寫網頁字動輒數 MB，專案也不載中文網頁字）。
- 用模糊陰影或越來越長的硬影表示前後（那是 Material、Grid、Brutal）。
- 用不同底色表示前後（那是 Linen、Brutal、Riso）；這個質地的表面全是同一張紙。
- 把點格加到卡片、側欄或浮層上（只在頁面底層）。

## 相容配色

見 [`theme.token.ts`](../../../theme/theme.token.ts) 的 `TEXTURE_COMPATIBILITY.sketch`。
