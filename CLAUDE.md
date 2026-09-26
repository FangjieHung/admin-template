# car-rental

## Admin 頁面與元件的樣式規則

新增或修改 `apps/admin` 的頁面、元件（或 `libs/` 裡 Admin 用到的 UI）之前，先讀完：

- 7 份質地準則：`libs/theme-pack/src/lib/styles/texture/{material,linen,grid,soft-ui,clay,editorial,frosted}/design-guideline.md`
- 術語：`docs/design-system/theme-glossary.md`
- 可用 token 與 `ui-*` class：`libs/theme-pack/src/lib/styles/CONTRACT.md`

寫樣式時：

1. 顏色、圓角、陰影、字體只用語意 token（`--mat-sys-*`、`--app-*`、`--font-*`）與 CONTRACT.md 的 `ui-*` class；造型差異交給質地的 recipe。改完跑 `npm run lint:theme`，必須通過。
2. 新頁面至少在 **Material、Grid、Editorial** 三種質地下各截一張圖確認（三者分別以陰影、框線、字級分層，最容易露出寫死的樣式）。
3. 質地與配色的相容清單只存在 `libs/theme-pack/src/lib/theme/theme.token.ts` 的 `TEXTURE_COMPATIBILITY`（ADR 0007：`docs/adr/0007-texture-color-compatibility.md`）。要改相容性就改那裡；文件只連結它。
