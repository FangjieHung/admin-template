# ADR 0014：Brutal 新粗野質地與 Signal 訊號色配色

- 狀態：已實作；相容清單 2026-10-13 由使用者定案
- 日期：2026-10-13

## 背景

現有 10 個質地都在「收斂」：細框、柔影、透光、發光，層次做得越來越安靜。使用者想要一種反方向的個性——新粗野主義（neo-brutalism）：粗黑框、飽和色塊、刻意不對稱，像海報與貼紙，適合活動後台、創作者工具這類想讓介面本身有態度的產品。這種外觀需要一套高彩度、墨黑框線的配色才撐得起來，所以同時新增一套淺色的 Signal 訊號色。

難點是和 Grid 分開：Grid 已經用直角、實線框和硬邊偏移影子。Brutal 必須一眼看得出不是 Grid。

## 決策

1. **新增按需質地 `brutal`（「Brutal 新粗野」）**，照 ADR 0010 的步驟登錄：`texture/brutal/{_fonts,_tokens,recipes,_index}.scss`、`apps/admin/project.json` 的 `texture-brutal` 入口、開機腳本的 `onDemandTextures`、`theme.token.ts` 的 `texture` 與 `TEXTURE_COMPATIBILITY`、`contrast-report.mjs` 的 `TEXTURES`。
2. **層次手段：色塊。** 每一層是一塊不同顏色的實心紙：畫布 `background` → 卡片 `surface` → 浮起的面板（選單、下拉、日期選擇器、展開中的面板標題、滑過的表格列）`secondary-container` → 對話框 `primary-container`；表頭是一條 `primary-container` 色塊，選取（`--app-state-selected`）也是實心的 `primary-container`。每塊色紙都有 2–3px 的墨框（`--mat-sys-on-surface`），右下一道墨色、0 模糊的硬影當貼紙厚度（按鈕 3px、卡片 5px、`--mat-sys-level1–4` 為 4／6／7／8px）。滑過往左上翹 2px、影子變長；按下影子收成 0、往右下壓平；減少動態時不位移。直角（`corner-*` 全部 0，連 `corner-full` 也是），膠囊只留給狀態徽章與篩選 chip。頁面大標下半截墊一條 `primary-container` 的螢光筆色塊（偏下、不對稱）。
   - **和 Grid 的差別**（並排截圖：`grid-vs-brutal__*.png`）：Grid 所有表面同一種白、1px `outline` 灰框、`outline` 色 2–6px 硬影、細格紋背景、標題用 IBM Plex Mono；Brutal 的表面彼此是不同顏色、2–3px 墨框、更重的墨影、沒有紋理、標題用粗黑體。和其他質地：Material 用模糊陰影、Linen 用同色系紙張明暗、Soft UI／Clay 用體積、Editorial 用字級、Frosted／Aero 用透光、Ledger 用斑馬紋、Cockpit 用發光。
3. **字型：只多載一個標題用的 Space Grotesk 700**，放在 `brutal/_fonts.scss`，跟著 `texture-brutal.css` 按需下載。候選是 Archivo Black 與 Space Grotesk，選後者：
   - Space Grotesk 從 Space Mono 改出來，a、G、R、y 的造型帶怪趣味，是新粗野海報常見的字感，和 Noto Sans／系統無襯線明顯不同。
   - Archivo Black 只有一個字重（400，但字面是 900 的黑度）：標題宣告 400 時，混排的中文會落到蘋方、微軟正黑的**細**字重，「Material 元件總覽」會一半極粗、一半細。Space Grotesk 700 和中文粗體同一個字重。
   - 只載入 700：本質地的大標、小節標、表頭、對話框標題、`.ui-text-display` 都是粗體。英文內文用裝置無襯線（同 Cockpit：Helvetica Neue／Segoe UI／Roboto／Arial，不放 `system-ui`），中文接 `--font-zh`，數字輸入用全站已載入的 IBM Plex Mono；Material 的 title／label 字階一律 700。
4. **欄位邊界在 Brutal 是墨線。** 配色層的 `--app-field-border` 是為白底與淡底算的，疊在飽和色塊上（對話框的 `primary-container`、表頭色塊裡的勾選框）會掉到 3:1 以下：第一輪掃描 Brutal × Verdant／Cool Grey／Glacier Blue 的對話框欄位只有 2.98／2.71／2.98。改成在 Material 欄位與勾選控制項本身就地覆寫 `--app-field-border: var(--mat-sys-on-surface)`（CONTRACT.md 的「實例覆寫」，不動配色層、不在質地層重定義同一個變數）；錯誤／停用仍由 `component.scss` 在更內層覆寫。墨色對每塊色塊都遠超過 3:1，也正好是這個質地的框線。
5. **Signal 訊號色（`signal`，淺色）**：暖紙畫布 `#fbf2dc`、白卡片、墨黑文字與框線 `#141414`（次要文字 `#4a4438`）、墨黑側欄。**主色是訊號藍 `#2438e8`，不是訊號黃或訊號紅**：主色同時是焦點框、勾選框、連結與文字按鈕的顏色，要對每一階表面 ≥ 3:1——黃色在淺底上做不到（`#ffd60a` 對白只有 1.41:1；訊號藍對畫布 6.71:1），紅色又會和「危險」撞色。訊號黃 `#ffd60a` 改當面積最大的色塊 `primary-container`（對話框、選取、目前項目、表頭、螢光筆），粉紅 `#ffb3df` 是 `secondary-container`（選單、下拉、日期選擇器），薄荷 `#8deadf` 是 `tertiary-container`。狀態色：正向綠（圓點 `#13a14b`）、資訊青綠（`#0898a8`，避開主色的藍）、警示橘（`#ff8a00`，避開黃色色塊）、危險紅（`#ee2b24`）；`error` 加深到 `#a8000c`，放在三塊色塊上都 ≥ 4.5:1。CIEDE2000：主色對各狀態圓點與文字最低 26.8（資訊文字），狀態圓點彼此最低 26.2（警示對危險），三塊色塊彼此、色塊對畫布／卡片最低 23.3，圖表 4 色彼此最低 23.3。token 範圍比照 Graphite：一般淺色配色有的全部，加上 ADR 0012 列出的 5 個 `mat.theme()` 缺口與 tertiary 一組，`color-scheme: light`。
6. **測試**：新增 `scripts/signal-palette.spec.mjs`（比照 `dark-palette.spec.mjs`）：文字 4.5:1、欄位邊界與主色 3:1 對畫布、每一階表面**與三塊色塊**都要成立；成對前景／底色 4.5:1；主色對狀態色、狀態色彼此、色塊彼此、圖表色彼此 CIEDE2000 ≥ 20。兩支 spec 共用的讀色碼與色差函式抽到 `scripts/palette-lib.mjs`。

## 相容配色

對比掃描（`contrast-report.mjs`，一般文字 4.5:1、欄位／UI 邊界 3:1，每格 25 組 pair）：Brutal × 11 套配色、Signal × 11 個質地，共 21 格（Brutal × Signal 重疊），**全數合格**。

**Brutal × 每套配色**

| 配色 | 文字最低（門檻 4.5） | UI 邊界最低（門檻 3） | 結果 |
| --- | --- | --- | --- |
| Signal | 警示 chip 6.70 | 勾選框勾選底 5.30 | 相容，**預設** |
| Candy | 側欄使用者狀態 4.62 | 欄位邊界 3.84 | 相容（紫／粉／淡紫三塊色塊都夠飽和） |
| Sandstone | 側欄選取文字 4.89 | 欄位邊界 4.62 | 相容（陶土橘＋蜜桃＋海藍，復古海報感） |
| Azure | 側欄選取文字 5.90 | 欄位邊界 3.99 | 相容（彩度最低的一套，色塊仍分得出） |
| Verdant | 警示 chip 4.78 | 欄位邊界 3.26 | **排除**（鼠尾草綠與藍灰色塊太淡，層次讀不出來） |
| Cool Grey | 側欄選取文字 4.72 | 欄位邊界 3.17 | **排除**（畫布和卡片同色，第一層就分不開） |
| Mist Ink | 資訊 chip 4.98 | 欄位邊界 3.94 | **排除**（單色墨灰，沒有色塊） |
| Glacier Blue | 側欄使用者狀態 5.31 | 欄位邊界 3.42 | **排除**（冰霧藍色塊太淡） |
| Midnight | 選取文字 4.52 | 勾選框勾選底 3.27 | **排除**（深色：墨線變成淺色線、色塊變成暗色容器，海報感消失） |
| Graphite | 側欄選取文字 6.91 | 欄位邊界 4.91 | **排除**（同上） |
| OLED | 狀態徽章 6.93 | 欄位邊界 4.53 | **排除**（同上） |

**Signal × 每個質地**（文字最低都是警示 chip 6.70）

| 質地 | UI 邊界最低 | 結果 |
| --- | --- | --- |
| Brutal | 勾選框勾選底 5.30 | 相容 |
| Material | 欄位邊界 5.38 | 相容 |
| Grid | 欄位滑過 5.38 | **排除**（使用者定案，2026-10-13：對比合格，但 Grid 的框線加 Signal 的飽和色塊太像 Brutal，留給 Brutal 獨有） |
| Editorial | 勾選框外框 5.76 | 相容（藍黃配墨黑像雜誌版面） |
| Linen | 5.38 | **排除**（同 Candy：飽和色塊蓋掉紙張色階） |
| Soft UI | 5.38 | **排除**（墨黑側欄與飽和色壓過浮雕的柔和光影） |
| Clay | 5.38 | **排除**（Clay 只搭深色與冷灰） |
| Frosted | 5.38 | **排除**（墨黑側欄與飽和色塊讓霧光玻璃失去透光感） |
| Aero | 5.38 | **排除**（高亮度雲霧玻璃只搭冷調淺色） |
| Ledger | 5.38 | **排除**（同 Candy：高彩度和帳冊的冷靜數字感衝突） |
| Cockpit | 欄位邊界 4.60 | **排除**（深色優先質地，淺色配色一律排除） |

相容清單已於 2026-10-13 由使用者定案，並寫進 `TEXTURE_COMPATIBILITY`（逐一列出）與 `theme-compatibility.spec.ts`。

## 後果

- 組合矩陣 11 × 11 = 121 格，相容 77 組（原 70 組＋Brutal 4＋Signal 進 Material、Grid、Editorial 3）；2026-10-13 定案時把 Grid × Signal 拿掉，Signal 只進 Material、Editorial，實際少 1 組。
- Bundle：`texture-brutal.css` 19.13 kB／gzip 3.30 kB（Cockpit 17.17 kB）、`color-signal.css` 2.41 kB／gzip 0.77 kB，都是按需檔案。Admin 初始 bundle 582.84 → 583.05 kB（+0.21 kB）：`main.js` 539.46 → 539.67 kB（`theme.token.ts` 的兩筆選項與白名單），`styles.css` 43.38 kB 不變。其他按需質地與配色的 CSS 逐位元組不變。
- `--app-field-border` 在 Brutal 是實例覆寫（決策 4）：之後新增的 Material 表單元件會自動吃到；自己畫邊框的原生欄位（`libs/ui` 的篩選面板、分頁列等）放在 `surface-container-high` 浮層上，維持配色層的值。
- 驗收截圖：Material 元件總覽（Brutal × Signal／Candy／Sandstone／Azure；Material、Grid、Editorial × Signal；Grid × Signal 於定案時排除）、首頁、資料表、載入／空白／錯誤、角色與權限頁與對話框（Brutal × Signal），以及 Grid × Signal 對 Brutal × Signal 的並排圖。
