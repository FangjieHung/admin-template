# admin-template

可以整個複製的後台元件範本：`libs/ui`（通用元件）、`libs/theme-pack`（質地 × 配色主題）、`apps/admin`（元件展示 app）。不寫業務邏輯；示範資料一律中性（工單、專案、聯絡人）。術語見 `CONTEXT.md`。

## 元件與展示頁的樣式規則

新增或修改 `libs/ui` 的元件、`apps/admin` 的展示頁或殼層之前，先讀完：

- 10 份質地準則：`libs/theme-pack/src/lib/styles/texture/{material,linen,grid,soft-ui,clay,editorial,frosted,aero,ledger,cockpit}/design-guideline.md`
- 術語：`docs/design-system/theme-glossary.md`
- 可用 token 與 `ui-*` class：`libs/theme-pack/src/lib/styles/CONTRACT.md`

寫樣式時：

1. 顏色、圓角、陰影、字體只用語意 token（`--mat-sys-*`、`--app-*`、`--font-*`）與 CONTRACT.md 的 `ui-*` class；造型差異交給質地的 recipe。改完跑 `npm run lint:theme`，必須通過。
2. 新元件或新展示頁至少在 **Material、Grid、Editorial** 三種質地下各截一張圖確認（三者分別以陰影、框線、字級分層，最容易露出寫死的樣式）；動到質地或共用樣式時，另外截「Material 元件總覽」（`/components/material`）。
3. 質地與配色的相容清單只存在 `libs/theme-pack/src/lib/theme/theme.token.ts` 的 `TEXTURE_COMPATIBILITY`（ADR 0007：`docs/adr/0007-texture-color-compatibility.md`）。要改相容性就改那裡；文件只連結它。
4. 字型：不提供字型檔；中文一律用裝置字型（`--font-zh`），英文網頁字只在風格明顯不同時從 Google Fonts 載入（CONTRACT.md「字體」）。

## 新增元件

1. 元件放 `libs/ui/src/lib/<name>/`，selector 用 `lib-` 前綴，從 `libs/ui/src/index.ts` 匯出；畫面文字用 InjectionToken 或 input 由使用端提供，不內建字串；附 spec。
2. 展示頁：`apps/admin/src/app/showcase/showcase-registry.ts` 與 `showcase-catalog.ts` 各加一筆，頁面放 `apps/admin/src/app/features/<id>/`，用 `app-showcase-page`＋`app-demo-block`，含用法程式碼與輸入輸出表；從 `showcase-catalog.ts` 的 `PLANNED_ITEMS` 移除對應的規劃中項目。
3. 根層（`app.config.ts`）不要 import `@admin-template/ui`：整個 barrel 會進 Initial bundle。元件需要的文字由展示頁自己的 `providers` 提供（`apps/admin/src/app/shared/ui/*`）。
   殼層（`app.ts`、`layout/`）同理：esbuild 以檔案為單位分 chunk，殼層 import 的套件檔案會連同展示頁用到的部分整個進 Initial bundle；殼層的 icon button 用 `apps/admin/src/vendor/mat-icon-button`，不要 import `@angular/material/button`（見 `apps/admin/src/vendor/mat-icon-button/index.mjs`）。
