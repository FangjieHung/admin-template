# ADR 0005：Editorial 質地與 Mist Ink 配色

- 狀態：已實作
- 日期：2026-09-25

## 決策

依使用者提供的極簡工作台參考圖，新增 `editorial` 質地與 `mist-ink` 配色，沿用 Admin 的雙軸設定頁。Editorial 使用 Helvetica Neue／Noto Sans TC、4–12px 圓角、1px 語意邊線及低於 0.05 alpha 的陰影；既有卡片、按鈕、欄位、表格、側欄與徽章沿用同一組 recipe。Mist Ink 提供霧藍畫布、白色表面、炭黑主要操作色與低彩度狀態色。明暗值與業務狀態仍由配色 token 控制，質地不寫入特定色板。

參考圖有卡片插畫、非對稱網格與外層藍色留白。本次依先前約定保留 Admin 的資訊布局與 template，不新增插畫、網格結構或滾動監聽器；以現有介面的留白、白色側欄、平面卡片和細線呈現視覺語言。Material Symbols 沿用專案現有圖示系統。焦點保持可見，互動目標至少 44px；動效僅限短暫 hover／press，並尊重 `prefers-reduced-motion`。

## 驗證

- 設定頁切換 6 × 7 共 42 種組合；檢查選取值與底色。
- 視覺檢查 Editorial／Mist Ink 的設定頁與訂單列表、Editorial／Midnight 的深色畫面，以及 Material／Mist Ink。
- Mist Ink 的一般文字、次要文字、主色按鈕和五種狀態徽章文字／底色均超過 4.5:1。
- `lint:theme`、theme-pack 7 項及 Admin 802 項測試、Admin production build 通過。初始 bundle 為 757.59 kB，高於 720 kB 警示門檻、低於 850 kB 錯誤門檻；主題持續增加時應評估按需載入 CSS。
