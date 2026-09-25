# 主題相容、浮動面板與質地準則（計畫）

- 日期：2026-09-26
- 決策依據：ADR 0007、`docs/design-system/theme-glossary.md`
- 範圍：只接 Admin；Booking / Affiliate / POS 不動

## 前置

- 工作區有上個 session 未 commit 的主題擴充（6 質地、6 配色、ADR 0002–0006）。**動工前先 commit 或由使用者確認**，並在 worktree 內執行；派工 prompt 明文禁止 `git checkout -- .` / `git restore` / `git stash`。

## 任務（依相依順序）

### T1 對比掃描腳本
- 產出：一支腳本，列出 7 × 8 組合在關鍵文字／背景 token 配對上的 WCAG 對比值；低於 4.5:1（大字 3:1）標示不合格。質地會改背景（Frosted 半透明、Linen 紙底），所以要算實際渲染後的顏色，不能只拿配色 token 相比。
- 驗收：輸出 56 格表格；抽查 3 格與瀏覽器 `getComputedStyle` 量測一致。
- Skill：`design:accessibility-review`

### T2 決定白名單（使用者決策）
- T1 的結果加上各組合的截圖牆，交給使用者依美感刪減，並替每個質地指定預設配色。

### T3 相容白名單 + ThemeService
- `theme.token.ts`：每個質地加 `compatibleThemes`、`defaultTheme`。
- `ThemeService`：`setParadigm` 遇到不相容配色時改成預設配色；`init()` 校正不相容的已存組合；提供「目前質地的相容配色」signal。
- 設定頁：配色列只顯示相容配色。
- 驗收：單元測試涵蓋切換 fallback、載入校正、清單過濾；`nx test admin`、`nx test theme-pack` 全過。
- Skill：`mattpocock-skills:tdd`

### T4 質地準則（先寫 4 份，當作改版規格）
- `libs/theme-pack/src/lib/styles/texture/README.md`：共用模板與「新增質地」步驟。
- material / linen / grid / editorial 各一份 `design-guideline.md`，章節：一句話個性、造型規格（token）、層次表現、新增頁面規則、Do／Don't、相容配色（連到 registry）。
- 方向：material 維持大圓角＋柔和陰影；linen 8px、無陰影、靠紙底色塊落差、背景織紋加深；grid 0–2px、硬邊偏移陰影、明顯實線、數字用等寬字型；editorial 卡片／面板／對話框 0、按鈕／輸入框／chip 2px。
- **使用者確認後才進 T5。**
- Skill：`engineering:documentation`、`mattpocock-skills:writing-for-agents`

### T5 質地改版
- 依 T4 準則修改 4 個質地的 tokens／recipes；可改圓角、陰影、邊框、字型、背景紋理濃淡。
- 驗收：admin 關鍵頁（儀表板、資料表、建單表單、日曆、對話框）在 4 質地 × 各自相容配色下截圖；`npm run lint:theme` 通過；editorial 的 `border-radius` 實測符合準則。
- Skill：`design:design-system`、`design:design-critique`；參考 `minimalist-ui`（editorial）、`industrial-brutalist-ui`（grid）

### T6 其餘 3 份準則 + 修訂
- soft-ui / clay / frosted 依現況補寫準則；T5 的 4 份依實際成果修訂。
- 新增 repo 根目錄 `CLAUDE.md`：「新增或修改 admin 頁面／元件前，先讀目前支援的 7 份質地準則；新頁面至少在 material、grid、editorial 三種質地下截圖確認。」

### T7 外觀浮動面板（可與 T4–T6 並行，依賴 T3）
- 設定頁加「顯示外觀浮動面板」開關（localStorage）。
- 開啟後每頁角落常駐小按鈕，展開後有質地列＋配色列（沿用 T3 的過濾規則），元件放在 theme-pack 共用。
- a11y：鍵盤可操作、Esc 關閉並把焦點還給按鈕、不遮擋 sticky 操作列與 dialog。
- 驗收：元件測試；在 Admin 三個不同頁面實測開關與切換；390px 寬時不造成橫向溢出。
- Skill：`anthropic-skills:angular-ui-guidelines`、`design:accessibility-review`、`anthropic-skills:ui-acceptance-review`
