# 質地（texture）資料夾

每個子資料夾是一種**質地**：只管造型（圓角、陰影、邊線、字體、背景紋理、視覺密度），不管顏色。顏色一律來自**配色**軸的語意 token。術語以 [`docs/design-system/theme-glossary.md`](../../../../../../docs/design-system/theme-glossary.md) 為準；可用 token 與 `ui-*` class 見 [`CONTRACT.md`](../CONTRACT.md)。

**新增或修改頁面、元件前，先讀目前質地的 `design-guideline.md`（質地準則）。** 準則寫的是「目標樣子」；若與現行 SCSS 不同，以「現況 → 目標」欄標示，改版前依現況判讀畫面、依目標設計新東西。

## 質地準則模板

每份 `<id>/design-guideline.md` 依序包含下列章節，章節名稱照抄，方便 agent 對照：

| 章節 | 寫什麼 |
| --- | --- |
| 一句話個性 | 一句話說出這個質地「像什麼」。像 Figma 檔封面上的那行描述。 |
| 造型規格 | 表格：圓角（`--mat-sys-corner-small/medium/large/extra-large/full`）、陰影（`--mat-sys-level1–4`）、邊線、字體（`--font-*`）、視覺密度、背景紋理。每列給 token 名稱、目標值、用在哪些元件，以及「現況 → 目標」欄（相同就寫「—」）。 |
| 層次表現 | 這個質地**用什麼**區分前後、主次（陰影高度？表面色階？框線粗細？字級與留白？）。每個質地只能有一種主要手段，且必須和其他質地不同。 |
| 新增頁面規則 | 卡片、表格、表單、空狀態、對話框、chip／徽章各一小節，寫「該用哪個 class／token、長什麼樣」。 |
| Do / Don't | 各 4–6 條，具體到可以對著截圖檢查。 |
| 相容配色 | 只放一行連結到 [`theme.token.ts`](../../theme/theme.token.ts)，**不抄清單**（ADR 0007：清單只存一處）。 |

每份準則都要寫明：**顏色只用語意 token**（`--mat-sys-*`、`--app-*`），質地不指定任何色碼；陰影、紋理的顏色也要由語意 token 調出（例如 `color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent)`）。

## 新增一種質地

1. **造型 token**：建立 `<id>/_tokens.scss`，在 `:root[data-paradigm='<id>']` 下定義全部圓角、陰影、字體 token（清單見 CONTRACT.md「可用 token」）。缺一個就會退回別的質地的值。
2. **recipe**：建立 `<id>/recipes.scss`，用同一個選擇器包住，覆蓋 CONTRACT.md 的全部 `ui-*` class 與 Material 元件（卡片、表單、日期選擇器、按鈕、表格、對話框、狀態徽章、文字樣式）。需要額外字型時仿照 `clay/_fonts.scss`。
3. **登錄**：在 [`_registry.scss`](./_registry.scss) 加上 `@forward '<id>/tokens'` 與 `@forward '<id>/recipes'`。
4. **選項與相容配色**：在 [`theme.token.ts`](../../theme/theme.token.ts) 的 `texture` 加一筆，並填 `compatibleThemes`（白名單）與 `defaultTheme`。新質地預設不相容任何配色，逐一以對比掃描（WCAG 4.5:1）＋目視確認後加入。
5. **質地準則**：依上方模板寫 `<id>/design-guideline.md`；「層次表現」必須和現有質地都不同，否則這個質地不該存在。
6. **截圖驗收**：Admin 的儀表板、資料表、建單表單、日曆、對話框，在新質地 × 每個相容配色下各截一張；`npm run lint:theme` 通過。
7. **文件**：更新 `theme-glossary.md` 的質地列表與根目錄 `README.md`「雙軸主題系統」一節。
