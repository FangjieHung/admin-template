# ADR 0002：擴充雙軸主題（草案）

- 狀態：已決策、已實作並完成瀏覽器驗收
- 日期：2026-09-25

## 背景

`theme-pack` 目前用 `data-paradigm` 選質地、`data-theme` 選配色。質地只有 Material；配色有 Verdant 與 Midnight。Admin 載入完整 registry 並提供兩軸切換；Booking 與 Affiliate 各自只載入一種配色，初始 HTML 也固定其值。現有設定儲存在 `cr.paradigm` 和 `cr.theme`。

質地包有造型 token，並分別實作 card、form、datepicker、buttons、table、status、typography 的 recipe。配色包提供 Material 系統色、狀態 tone、圖表、側欄、topbar 與日曆範圍色。兩軸各自作用於 CSS 變數與選擇器，新增選項需同時更新 registry 和 `theme.token.ts`。

## 已確認的決策

1. 第一批只在 Admin 提供執行期切換；Booking / Affiliate 維持目前固定配色。
2. 新增兩種質地及兩種配色，與既有選項形成 3 × 4 共 12 種組合。
3. 質地可加入紙張／網格等背景紋理，也可調整視覺密度；不修改元件邏輯、HTML 或業務流程。
4. 視覺方向沿用建議：一種輕紙感的編輯風質地，一種細網格的高密度工作台質地；配色採暖沙與清亮藍。色值以實際畫面及對比驗證決定。
5. 所有 12 種組合均須在關鍵畫面保持可讀、可操作，否則不符合「自由組合」。

6. 唯一允許變更的 TypeScript 是 `theme.token.ts` 選項清單，以便 Admin 設定頁列出新主題。
7. 密度只調整元件內距與表格列高，維持頁面資訊布局。

## 已知設計約束

- 配色與質地獨立；元件只用語意 token，不使用寫死色碼。`npm run lint:theme` 是現有檢查。
- 每個質地需完整覆蓋現有 `ui-*` 契約與相關 Material 元件 recipe，避免切換後退回不一致的預設造型。
- 每個配色需提供現有完整 token 集，並分別確認一般文字、狀態文字、焦點與邊界的對比。
- 資料表、表單、日曆與狀態徽章是 Admin 的關鍵檢查畫面；官網若納入則須另檢查預約流程。
- ui-ux-pro-max 對營運儀表板推薦低成本、高可讀性的資料密集造型；對汽車服務有深色中性色搭配紅色動作色的範例。這些是設計參考，不直接決定本專案色碼。

## 決策

新增 `linen` 與 `grid` 質地、`sandstone` 與 `azure` 配色。兩套新質地以 SCSS recipe 實作既有 class 與 Material 元件契約；Grid 使用 Material 表格高度 token 維持 44px 資料列。配色包包含與現有 Verdant 同一組語意 token。`component.scss` 的 `color-scheme` 改為繼承，以便 Midnight 搭配任意質地時保留暗色原生控制項。

Admin 設定頁由既有選項清單自動呈現新增項目；Booking / Affiliate 的固定配色載入方式不變。

## 驗證

- Sass 編譯、`lint:theme`、theme-pack 測試通過。
- 新增配色的主要文字／背景、按鈕文字／背景、狀態徽章文字／背景配對均達 4.5:1 以上。
- Angular builder 的本機異常終止來自 LMDB 原生快取模組；四個 app 關閉 Angular 持久快取後，development 與 production 建置均通過。
- Admin、Booking、Affiliate 的 production 建置停用 Google Fonts 內嵌，避免建置時依賴外部網路；瀏覽器仍依原有連結載入字型。
- Admin 設定頁在瀏覽器逐一切換 12 種組合，確認選取狀態、表面色與背景紋理；另檢查訂單表格與 375px 寬的設定頁。Midnight 主色按鈕文字改用深色墨色，以維持可讀對比。
