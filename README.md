# Admin Template

可以整個複製的 Angular 後台元件範本。不含任何業務邏輯：只有一組做好、寫好文件、會跟著主題變化的元件，以及一個把每個元件各種狀態排出來的**展示 app**。

- `libs/ui`：通用元件（資料表、頁首工具列、進階篩選、已儲存檢視、雙月日期區間、響應式側板、狀態標籤、確認對話框、簽名板、語言切換、捲動陰影）。
- `libs/theme-pack`：「質地 × 配色」雙軸主題（8 種質地、8 套配色）、外觀浮動面板、`ui-*` class 契約。
- `apps/admin`：展示 app。殼層（側欄、頁首、頁尾、外觀面板、設定頁）＋每個元件一頁（`/components/<id>`），首頁列出全部元件與規劃中的項目。
- `libs/assets`：共用的 Tailwind 基準與 favicon。

技術：Angular 22（standalone、signals、zoneless）、Angular Material 22（M3）、Tailwind CSS 4、Nx 23、Vitest。

## 開始一個新專案

範本不發佈成 npm 套件；用法是**整個 repo 複製**成新專案，再刪掉不要的東西。

1. **複製**：把這個 repo 複製成新專案（新的 git 歷史或保留都可以）。之後的修改直接在新專案裡做，沒有「升級範本」這條路。
2. **改名**：
   - 根目錄 `package.json` 的 `name`（以及 `package-lock.json` 開頭的兩處）。
   - `tsconfig.base.json` 的路徑別名 `@admin-template/*`（全域取代 import）；`libs/*/package.json` 的 `name`。
   - `apps/admin/project.json` 的 `outputPath`（`dist/admin-template`）與 `package.json` 的 `deploy` 指令（目前 base href 仍是 `/bbd-car-rental/`）。
   - 側欄與頁尾的品牌文字：`apps/admin/src/app/core/i18n/zh-tw-shell.ts`；`apps/admin/src/index.html` 的 `<title>`。
3. **刪減**：照 [`docs/guides/theme-pruning.md`](./docs/guides/theme-pruning.md) 刪掉用不到的質地、配色、外觀面板與元件（含展示頁）。
4. **開始做**：新頁面直接用 `libs/ui` 的元件、`theme-pack` 的 `ui-*` class 與語意 token；展示頁就是用法範例。

術語見 [`CONTEXT.md`](./CONTEXT.md)（範本術語）與 [`docs/design-system/theme-glossary.md`](./docs/design-system/theme-glossary.md)（主題術語）。

## 執行

需要 Node 24（`.nvmrc`）：

```bash
nvm use
npm install
npm start          # nx serve admin → http://localhost:4200/
```

| 指令 | 做什麼 |
| --- | --- |
| `npm start` | 啟動展示 app（開發模式） |
| `npm run build` | 建置 admin production 版，輸出到 `dist/admin-template` |
| `npx nx test admin`／`ui`／`theme-pack` | 各專案的單元測試（Vitest） |
| `npx nx lint admin`／`ui`／`theme-pack` | ESLint |
| `npm run lint:theme` | 擋寫死的顏色、轉場時間與底層色階變數（掃 `libs/theme-pack`、`libs/*/src`、有套主題的 app） |
| `npx vitest run scripts --exclude '.claude/**' --exclude '**/node_modules/**'` | 主題工具本身的測試（含質地登錄四處一致的檢查） |
| `npm run contrast:theme -- --base-url=http://localhost:4200` | 每個「質地 × 配色」在 Material 元件總覽等頁的 WCAG 對比報告 |
| `npm run deploy` | 建置並發布到 GitHub Pages |

## 展示 app

- 側欄、路由、首頁的元件表都由 `apps/admin/src/app/showcase/showcase-registry.ts` 產生；說明文字在 `showcase-catalog.ts`。新增一頁只要在兩處各加一筆，並建立 `features/<id>/` 頁面元件。
- 每頁固定骨架（`app-showcase-page`）：用途與何時使用 → 示範（`app-demo-block`）→ 用法程式碼 → 輸入與輸出表。示範資料一律中性（工單、專案、聯絡人），放在 `showcase/demo-data.ts`。
- **Material 元件總覽**（`/components/material`）是質地的測試台：範本支援的每個 Material 控制項與 `ui-*` class 在各種狀態下都排在這頁。新增或修改質地時，每個 recipe 都應該在這頁看得到效果。
- 登入頁（`/login`）只是示範：不驗證，按下按鈕就進入；接上身分驗證時換掉 `AuthService`。
- 頁面樣板（列表、詳情、表單、儀表板、錯誤頁…）與其餘元件都還在規劃中，清單在首頁與 `docs/plans/2026-10-13-template-pivot.md`。

## 雙軸主題系統

**質地**管造型（圓角、陰影、字體、背景紋理、元件 recipe），**配色**管顏色；兩者各自切換。目前有 Material、Linen、Grid、Soft UI、Clay、Editorial、Frosted、Aero 八種質地，Verdant、Midnight、Sandstone、Azure、Cool Grey、Candy、Mist Ink、Glacier Blue 八套配色。每個質地只開放相容的配色，清單只存在 `libs/theme-pack/src/lib/theme/theme.token.ts` 的 `TEXTURE_COMPATIBILITY`（ADR 0007）。

- Material 是常駐質地，其餘質地是按需質地：各自編成 `texture-<id>.css`，切換時才下載（ADR 0010）。
- 字型：專案不提供字型檔；中文一律用裝置的系統字，英文網頁字只在風格明顯不同時才從 Google Fonts 載入（CONTRACT.md「字體」）。
- 寫樣式的規則（只用語意 token 與 `ui-*` class、改完跑 `npm run lint:theme`、新頁面三種質地截圖）見根目錄 [`CLAUDE.md`](./CLAUDE.md) 與 [`CONTRACT.md`](./libs/theme-pack/src/lib/styles/CONTRACT.md)。
- 新增質地：[`texture/README.md`](./libs/theme-pack/src/lib/styles/texture/README.md)「新增一種質地」；每個質地的設計準則在 `texture/<id>/design-guideline.md`。
- 新增配色：複製 `color-themes/verdant/` 改 token → `color-themes/_registry.scss` 加 `@forward` → `theme.token.ts` 的 `COLOR_THEMES` 與 `TEXTURE_COMPATIBILITY` 加入 → admin `index.html` 開機腳本的 `colorThemes` 加上 id。
- 設計決策紀錄：`docs/adr/0002`–`0010`。

## 參考

這個範本是從一個租車後台參考產品清空而來；原本的業務頁面、預約流程、調度日曆與時間軸、證件拍照擷取等都保存在 git 標籤 `car-rental-reference-2026-10-13`，之後要通用化成元件時從那裡取回。
