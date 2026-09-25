# ADR 0004：Clay 質地與 Candy 配色

- 狀態：已實作
- 日期：2026-09-25

## 決策

沿用 Admin 的質地 × 配色雙軸架構，新增 `clay` 質地與 `candy` 配色。Clay 的造型 token 定義 20／32／48px 圓角、四層陰影、內凹狀態與 Nunito／DM Sans 字體；recipe 套用既有 `ui-*` 與 Angular Material 元件。背景光暈由 CSS 偽元素繪製，不新增 template 或互動邏輯。Candy 提供淡薰衣草底色及紫、粉、藍、綠、琥珀語意色，並可搭配任一質地。

字體透過 Admin 樣式表中的 Google Fonts CSS 載入，使用 `display=swap`；網路不可用時回退既有字體。狀態色文字以較深色階顯示，Candy 的一般文字／底色、主色按鈕與狀態徽章配對皆超過 4.5:1。深色組合以 `color-scheme` 切換陰影的明暗值。動效尊重 `prefers-reduced-motion`，按鈕與主題選項保留可見的鍵盤焦點。

不套用描述中的 hero、bento、定價卡與導覽改版，因 Admin 沒有這些版面且既定範圍不修改 HTML 或資訊布局。此決策保留與其他 29 種組合相同的設定入口。

## 驗證

- Admin 設定頁切換 5 × 6 共 30 種組合，確認執行期選取值、背景色與卡片陰影；另以畫面檢查 Clay／Candy、Clay／Midnight，以及 Clay／Candy 的訂單列表。
- `lint:theme`、theme-pack 7 項與 Admin 802 項測試、Admin production build 通過。
- 初始 bundle 為 744.47 kB，高於現有 720 kB 警示門檻 24.47 kB，仍低於 850 kB 錯誤門檻。隨主題數增加，可評估按需載入樣式。
