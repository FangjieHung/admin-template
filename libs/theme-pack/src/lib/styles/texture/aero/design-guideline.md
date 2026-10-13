# Aero 雲霧玻璃質地準則

> 模板與術語見 [`../README.md`](../README.md)。顏色只用語意 token（`--mat-sys-*`、`--app-*`），由配色軸提供。

## 一句話個性

晨霧中的玻璃桌面：雲光從頁面底層透上來，面板像一層帶亮邊的透明壓克力，輕、亮、安靜。

## 造型規格

| 項目 | Token | 值 | 用在 |
| --- | --- | --- | --- |
| 圓角 small / medium | `--mat-sys-corner-small` / `-medium` | 10px / 16px | 小型控制項、欄位、按鈕 |
| 圓角 large / extra-large | `--mat-sys-corner-large` / `-extra-large` | 22px / 28px | 卡片、對話框、選單 |
| 陰影 level1–4 | `--mat-sys-level1`…`-level4` | 短淡投影＋頂部亮邊，隨層級擴散 | 按鈕、卡片、浮層 |
| 面板 / 側欄 | `--aero-panel` / `--aero-rail` | surface 64% / 72% 透明 | 卡片、表單、導覽 |
| 邊線 | `--aero-edge` | surface 亮邊，1px | 面板、卡片、次要按鈕 |
| 背景模糊 | `backdrop-filter` | 16–26px | 面板；減少透明度時停用 |
| 字體 | `--font-display` / `--font-body` | Plus Jakarta Sans / DM Sans，中文接系統中文字（`--font-zh`） | 標題、內文 |
| 視覺密度 | `--dt-cell-padding-block` | 0.875rem | 資料表 |

## 層次表現

**用透光與雲霧背景分層。** `.app-shell` 的三團低彩度環境光在玻璃下形成遠景；面板以 64% 透明度、亮邊和短投影浮起。不要在卡片內再疊第二層玻璃，區塊以留白和細分隔處理。

## 新增頁面規則

- **卡片**：使用 `.ui-card`，透明面板、1px 亮邊與 level2；可點卡片加 `.ui-card--clickable`。
- **表格**：放在 `.ui-card`，表格維持透明；以列距和卡片玻璃承接層次。
- **表單**：filled 欄位使用半透明 surface、`--aero-well` 與 `--app-field-border`；相連欄位使用 `.ui-field-group`。
- **空狀態**：一個圖示、標題、說明與主操作按鈕，避免加入額外色塊。
- **對話框**：使用 28px 圓角、透明面板、亮邊、level4 與 26px 背景模糊。
- **chip／徽章**：使用 `.ui-chip` 和既有 tone 變體，狀態不可只靠顏色表達。

## Do / Don't

**Do**

- 讓環境光只存在於頁面底層。
- 讓面板保有亮邊、背景模糊和可讀的文字對比。
- 將主要操作維持為不透明主色，保留清楚的操作層級。
- 在 `prefers-reduced-transparency` 下切回實色面板。

**Don't**

- 在面板裡放高飽和漸層或第二層模糊玻璃。
- 用長、重或黑色硬陰影製造層次。
- 讓透明度降低欄位邊界、文字或焦點框的可見性。
- 將背景雲光當作狀態或資訊傳達方式。

## 相容配色

見 [`theme.token.ts`](../../../theme/theme.token.ts) 的 `TEXTURE_COMPATIBILITY.aero`。
