# 雙軸主題術語表（草案）

| 術語 | 本專案意義 | 目前實作 |
| --- | --- | --- |
| 質地（texture / paradigm） | 與配色分離的造型軸，控制圓角、陰影、字體、背景紋理及元件 recipe | `data-paradigm`、`styles/texture/*`；Material、Linen、Grid、Soft UI、Clay、Editorial、Frosted、Aero |
| 配色（color-theme） | 與質地分離的色彩軸，提供語意化的介面色、狀態色和圖表色 | `data-theme`、`styles/color-themes/*`；Verdant、Midnight、Sandstone、Azure、Cool Grey、Candy、Mist Ink、Glacier Blue |
| recipe | 某種質地對共用 `ui-*` class 與 Material 元件的具體造型規則 | card、form、datepicker、buttons、table、status、typography |
| 語意 token | 元件可引用的顏色或造型變數；名稱表達用途而非特定色階 | `--mat-sys-*`、`--app-*`、字體變數 |
| 底層色階 | 配色包內部組色的私有變數，不讓元件直接使用 | 例如 `--_sage-600` |
| 組合矩陣 | 每種質地與每種配色的笛卡兒積；只有「相容」的格子保證能正常呈現與閱讀 | 8 × 8，共 64 格；目前 47 組相容 |
| 相容配色 | 某個質地允許搭配的配色清單（白名單）；不在清單內的配色不會出現在該質地的選項中。新增配色時預設不相容，需逐一加入。質地是主軸：質地選項永遠全部顯示，配色依質地過濾（見 ADR 0007） | `theme.token.ts` 的 `TEXTURE_COMPATIBILITY`（2026-09-27 定案，見 ADR 0007） |
| 預設配色 | 每個質地指定的一個相容配色；切換質地時若目前配色不相容，或載入時已存的組合不相容，就改用它 | 同上（`defaultThemeId`）；`ThemeService` 切換與載入時自動校正 |
| 質地準則（design guideline） | 每個質地的設計準則文件，說明該質地的造型語言與禁忌；新增頁面或元件時必須參照 | `styles/texture/<id>/design-guideline.md`，7 份齊全；模板見 `styles/texture/README.md` |
| 套用範圍 | 哪些 app 載入主題 CSS、提供選項並允許執行期切換 | Admin 完整切換；Booking / Affiliate 固定配色 |
| 常駐質地／按需質地 | 常駐質地隨 app 一打開就載入，是預設外觀，也是其他質地載入失敗時的退路；按需質地只在使用者第一次切到它（或打開外觀面板）時才下載樣式 | Admin（ADR 0010）：Material 常駐（編進主樣式），其餘質地各自編成 `texture-<id>.css`（`apps/admin/project.json` 的 `inject: false` 入口）；`index.html` 開機腳本讓已存的質地在第一次繪製前就載入，`ThemeService` 切換時等新樣式載入完才換、失敗退回 Material；配色全部常駐 |
| 外觀浮動面板 | 在設定頁開啟後，於每一頁常駐的可拖曳小按鈕，展開後可即時切換質地與配色；位置會被記住 | Admin；`FloatingAppearancePanelComponent`，開關未開時不載入 |
| 背景紋理 | 質地軸的一種造型，例如低對比紙感或網格；不能承載狀態意義或降低文字可讀性 | Linen 紙感、Grid 網格只作用於頁面底層 |
| 視覺密度 | 元件內距、列高與內容容納量；不改業務資料或資訊順序 | Grid 只調元件內距和表格列高；規劃中（2026-10-13）：Ledger 為高密度質地，密度暫不獨立成第三個切換軸 |
| 用途變數 | 一種 `--app-*` token，名稱表達「這是什麼用途」（例如焦點框顏色）而非「這是什麼顏色/數值」；讓 7 個質地不必各自用 `color-mix()`／寫死值重複實作同一種造型或互動邏輯，改一處即可調整全站 | `styles/_semantic.scss` 定義（第 1 層），質地/配色的 `_tokens.scss` 依現值覆寫（第 2 層）；例：`--app-focus-ring`、`--app-border-emphasis`、`--app-state-hover`、`--app-shadow-tint`、`--app-z-*`。見 CONTRACT.md「用途變數」一節、ADR 0008 |
| 組合覆寫 | 用途變數的第 3 層：只有某一格「質地 × 配色」需要跟該質地/該配色的典型值都不同時，才在這一層寫規則；同一個變數不可以同時在質地層與配色層各寫一半（權重相同，看載入順序決定），需要兩者都例外時改走這一層 | `styles/_combos.scss`（`:root[data-paradigm='x'][data-theme='y']`，0-3-0）；目前為空，見 ADR 0008 |
