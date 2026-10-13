# 雙軸主題術語表（草案）

| 術語 | 本專案意義 | 目前實作 |
| --- | --- | --- |
| 質地（texture / paradigm） | 與配色分離的造型軸，控制圓角、陰影、字體、背景紋理及元件 recipe | `data-paradigm`、`styles/texture/*`；Material、Linen、Grid、Soft UI、Clay、Editorial、Frosted、Aero、Ledger、Cockpit、Brutal、Riso、Sketch |
| 配色（color-theme） | 與質地分離的色彩軸，提供語意化的介面色、狀態色和圖表色 | `data-theme`、`styles/color-themes/*`；Verdant、Midnight、Sandstone、Azure、Cool Grey、Candy、Mist Ink、Glacier Blue、Graphite、OLED、Signal、Riso 雙色（Midnight、Graphite、OLED 為深色配色；Signal 為高彩度淺色配色；Riso 雙色為兩種孔版特別色的淺色配色） |
| recipe | 某種質地對共用 `ui-*` class 與 Material 元件的具體造型規則 | card、form、datepicker、buttons、table、status、typography |
| 語意 token | 元件可引用的顏色或造型變數；名稱表達用途而非特定色階 | `--mat-sys-*`、`--app-*`、字體變數 |
| 底層色階 | 配色包內部組色的私有變數，不讓元件直接使用 | 例如 `--_sage-600` |
| 組合矩陣 | 每種質地與每種配色的笛卡兒積；只有「相容」的格子保證能正常呈現與閱讀 | 13 × 12，共 156 格；目前 91 組相容（Ledger 的 7 組、Cockpit 的 3 組與 Graphite、OLED 進入既有質地的 13 組於 2026-10-13 由使用者定案，見 ADR 0011、0012；Brutal 的 4 組與 Signal 進入既有質地的 2 組（Material、Editorial）、Riso 的 4 組與 Riso 雙色進入既有質地的 3 組、Sketch 的 8 組，於 2026-10-13 由使用者定案，見 ADR 0014、0015、0016；Grid × Signal 依美感排除，因為太像 Brutal） |
| 相容配色 | 某個質地允許搭配的配色清單（白名單）；不在清單內的配色不會出現在該質地的選項中。新增配色時預設不相容，需逐一加入。質地是主軸：質地選項永遠全部顯示，配色依質地過濾（見 ADR 0007） | `theme.token.ts` 的 `TEXTURE_COMPATIBILITY`（2026-09-27 定案，見 ADR 0007） |
| 預設配色 | 每個質地指定的一個相容配色；切換質地時若目前配色不相容，或載入時已存的組合不相容，就改用它 | 同上（`defaultThemeId`）；`ThemeService` 切換與載入時自動校正 |
| 質地準則（design guideline） | 每個質地的設計準則文件，說明該質地的造型語言與禁忌；新增頁面或元件時必須參照 | `styles/texture/<id>/design-guideline.md`，13 份齊全；模板見 `styles/texture/README.md` |
| 套用範圍 | 哪些 app 載入主題 CSS、提供選項並允許執行期切換 | 展示 app（`apps/admin`）完整切換；新專案若加入只用一種外觀的 app，在它的 `styles.scss` 只 `@use` 一個質地與一套配色，`index.html` 寫死 `data-paradigm`／`data-theme` |
| 常駐質地／按需質地 | 常駐質地隨 app 一打開就載入，是預設外觀，也是其他質地載入失敗時的退路；按需質地只在使用者第一次切到它（或打開外觀面板）時才下載樣式 | 展示 app（ADR 0010）：Material 常駐（編進主樣式），其餘質地各自編成 `texture-<id>.css`（`apps/admin/project.json` 的 `inject: false` 入口）；`index.html` 開機腳本讓已存的質地在第一次繪製前就載入，`ThemeService` 切換時等新樣式載入完才換、失敗退回 Material；配色同理，見下一列 |
| 常駐配色／按需配色 | 比照常駐質地／按需質地：常駐配色隨 app 一打開就載入，是預設配色，也是其他配色載入失敗時的退路；按需配色只在使用者第一次切到它（或打開外觀面板）時才下載樣式 | 展示 app（ADR 0013）：Verdant 常駐（編進主樣式），其餘配色各自編成 `color-<id>.css`（`apps/admin/project.json` 的 `inject: false` 入口）；開機腳本把已存的配色跟質地一起在第一次繪製前載入（質地在前、配色在後）；組合覆寫（`_combos.scss`）跟著各自的配色輸出；失敗退回 Verdant 並提示「配色載入失敗，暫時使用預設配色」 |
| 外觀浮動面板 | 在設定頁（或展示 app 的外觀面板頁）開啟後，於每一頁常駐的可拖曳小按鈕，展開後可即時切換質地與配色；位置會被記住 | 展示 app；`FloatingAppearancePanelComponent`，開關未開時不載入 |
| 背景紋理 | 質地軸的一種造型，例如低對比紙感或網格；不能承載狀態意義或降低文字可讀性 | Linen 紙感、Grid 網格只作用於頁面底層；Cockpit 只有畫布四周一圈極淡的暗角；Brutal 沒有紋理（畫布本身就是一塊素色色塊）；Riso 的紙張顆粒只在頁面底層（`body::before`，文字墨 9% 的雜訊遮罩），卡片、側欄、浮層都是不透明實色蓋住它，高對比與減少透明度時拿掉；Riso 的網點只畫在沒有文字的地方（卡片外側的影子、頁面大標下半截），套色錯位只在色塊與按鈕上、不在文字上（ADR 0015）；Sketch 的點格（筆記本）只在頁面底層（`body` 背景，文字墨 6%，畫布上 12px 小字壓在點上仍 ≥ 4.5:1），高對比時拿掉（ADR 0016） |
| 深色優先質地 | 層次手段只在深色畫布上成立的質地，相容清單只放深色配色（即使淺色配色對比合格也排除） | Cockpit（層次靠發光，ADR 0012）：只相容 Midnight、Graphite、OLED |
| 視覺密度 | 元件內距、列高與內容容納量；不改業務資料或資訊順序 | 視覺密度屬於質地，不是第三個切換軸（ADR 0011）。Ledger 是高密度質地：按鈕 32px、欄位 48px、資料表列約 35px、內文 13px（下限 12px），透過 Material 密度 token、`--dt-*` 與 Tailwind `--spacing` 實作；Grid 只調元件內距和表格列高 |
| 用途變數 | 一種 `--app-*` token，名稱表達「這是什麼用途」（例如焦點框顏色）而非「這是什麼顏色/數值」；讓 7 個質地不必各自用 `color-mix()`／寫死值重複實作同一種造型或互動邏輯，改一處即可調整全站 | `styles/_semantic.scss` 定義（第 1 層），質地/配色的 `_tokens.scss` 依現值覆寫（第 2 層）；例：`--app-focus-ring`、`--app-border-emphasis`、`--app-state-hover`、`--app-shadow-tint`、`--app-z-*`。見 CONTRACT.md「用途變數」一節、ADR 0008 |
| 組合覆寫 | 用途變數的第 3 層：只有某一格「質地 × 配色」需要跟該質地/該配色的典型值都不同時，才在這一層寫規則；同一個變數不可以同時在質地層與配色層各寫一半（權重相同，看載入順序決定），需要兩者都例外時改走這一層 | `styles/_combos.scss`（`:root[data-paradigm='x'][data-theme='y']`，0-3-0）；目前為空，見 ADR 0008 |
