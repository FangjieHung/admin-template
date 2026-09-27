# 交接信：主題相容、浮動面板與質地準則（2026-09-26）

給下一個 session。使用者是 UI 設計師，用中文、以設計師語言（Figma 類比）溝通，不要丟工程術語。

## 一句話現況

計畫 `docs/plans/2026-09-26-theme-compat-panel-guidelines.md` 的工作**只剩 ticket 09「定案相容清單」**，而且這一步是**使用者的決策**，不是實作問題：等他挑好每個質地的相容配色與預設配色，你把清單寫進程式、驗證即可。其他全部已合併進 `main`（未 push；此機器沒有 `gh` CLI）。

## 先讀這些

- `docs/adr/0007-texture-color-compatibility.md`：白名單相容、質地為主軸、不相容配色直接隱藏
- `docs/design-system/theme-glossary.md`：術語（質地、配色、相容配色、預設配色、質地準則、外觀浮動面板）
- repo 根目錄 `CLAUDE.md`：改 Admin 頁面前必讀 7 份質地準則
- 本機 tickets：`.scratch/theme-compat-panel/issues/01`–`15`（`.scratch/` 被 gitignore，只在這台機器上）

## 要做的事：ticket 09

1. **請使用者挑選。** 挑選頁：`.scratch/theme-compat-panel/reports/09b/picker.html`（7 質地 × 8 配色，每格有儀表板／訂單列表／對話框縮圖）。
   - 頁面上有 10 格紅標（側欄收合箭頭、Cool Grey 的「已登入」），**已被 ticket 15 修好**，最新數據是 `reports/15/contrast-matrix.json`：56 格 0 不合格。告訴使用者只看美感。
   - 請他用這個格式回覆：`<質地>: 排除 <配色…>；預設 <配色>`。
   - Soft UI 目前暫定排除 Sandstone、Verdant。當初排除的原因（陰影灰藍、側欄白字）已由 ticket 13、15 解決，要不要加回來由他決定。
2. **寫進程式。** 只改 `libs/theme-pack/src/lib/theme/theme.token.ts` 的 `TEXTURE_COMPATIBILITY`（每個質地的 `compatibleThemeIds`、`defaultThemeId`），清單只存在這一處。更新 `theme-compatibility.spec.ts` 的期望值。
3. **驗證。** `npx nx test theme-pack`、`npx nx test admin`（以 exit code 判定）；起 dev server 後跑 `npm run contrast:theme -- --base-url=http://localhost:<port>`，確認所有**相容**組合 0 不合格；在 Admin 設定頁與浮動面板實測隱藏與預設配色 fallback。
4. **收尾。** ADR 0007 狀態改為「清單已定案」並記下結果；術語表「相容配色」那列拿掉「暫定清單」字樣。

## 已完成（本 session）

| Ticket | 內容 | Commit |
| --- | --- | --- |
| 01 | 對比掃描腳本 `scripts/contrast-report.mjs`（`npm run contrast:theme`） | `52fb1b9` |
| 02 | 相容配色＋預設配色機制（`ThemeService.compatibleThemes`、切換／載入校正） | `3b43490` |
| 03 | 外觀浮動面板：可拖曳、位置記憶、Alt/Shift＋方向鍵移動、「重設位置」 | `4332f43`…`9d0b8a2` |
| 04／08 | 7 份質地準則＋模板 `styles/texture/README.md`、repo `CLAUDE.md` | `9490cb5`、`06447f7`、`6675f0b` |
| 05／06／07 | Linen／Grid／Editorial 改版 | `413d8ff`、`5ccc96e`、`7ac28c6` |
| 10 | Verdant 主色加深（`#4a8656`→`#457c50`） | `3400c7a` |
| 11 | Material 鍵盤焦點框 | `77a196c` |
| 12 | 側欄圓角改吃質地 token | `163644d` |
| 13 | Soft UI／Clay／Frosted 陰影改語意 token、表格、焦點、Soft UI 側欄文字 | `164664c` |
| 14 | 浮動面板 `@defer`，首次載入 843→787 kB | `41836cf` |
| 15 | 側欄收合箭頭與 Cool Grey 次要文字對比 | `a8e2a87` |

## 踩過的坑（直接影響你）

- **Node 版本**：`.nvmrc` 是 24，預設 shell 是 22。跑 nx／npm 前先 `export PATH=~/.nvm/versions/node/v24.18.0/bin:$PATH`。
- **worktree 起點可能是舊 commit**：用 Agent 的 `isolation: "worktree"` 派工時，第一步要求 `git merge --ff-only main` 並 grep 一個新 commit 才有的符號確認。
- **對比腳本**：需要自己起 admin dev server 並傳 `--base-url`。`ThemeService.init()` 會校正不相容組合，腳本已在載入後強制覆寫 data 屬性（`020cd3b`），所以 56 格都量得到。`playwright-core` 在 `package.json` 裡，但主 checkout 的 `node_modules` 是手動複製進去的；若缺就 `npm install` 或從任一 agent worktree 複製。
- **挑選頁產生器沒有進 repo**，只有產出的 HTML。若要重產，參考 `reports/09b/picker.html` 的結構重寫。
- **收到「修正後截圖」一定自己打開看**：本 session 有 agent 附了修正途中拍的截圖，數字與畫面對不上。

## 已知但未處理（不在這次範圍，可提給使用者）

- ~~Admin 首次載入 787 kB，仍超出 720 kB 預算約 67 kB~~ **已處理（commit 46511cf、e5b2cd2）**：主題改版後一度到 807 kB；拆出殼層字串 `zh-tw-shell.ts`、domain 改走 `@car-rental/domain/repositories` 子路徑、snack-bar 動態載入、`provideNativeDateAdapter` 移到用日期選擇器的兩個元件，降到 711.78 kB（2026-09-28）。只剩約 8 kB 餘裕，後續選項見 ADR 0008 之外的 session 紀錄：seed-data 動態載入（16 kB）、使用者選單 `@defer`（23.6 kB，行為會變）。
- ~~Grid 的等寬數字沒套到建單表單的金額~~ **已處理（commit 67e1955）**：共用 class `.ui-text-numeric`，Grid 換 `--font-mono`（見 ADR 0008「遺留項目收尾」）。
- ~~Soft UI／Clay／Frosted 的 `.dt-table` 規則用了 `!important`~~ **已處理（commit ab4d5d3）**：data-table 以 `--dt-*` 變數暴露外觀，質地只設變數；另發現 Grid 表頭加強線從未生效，保留現狀待看圖決定（Grid 準則「已知限制」）。
- **已處理（commit b6a690c）**：關鍵影格動畫時長改用 `--app-motion-*`（新增 `--app-motion-loop`），`lint:theme` 擋 `animation` 寫死時長。
- `.claude/worktrees/agent-*` 留有 16 個已合併的 agent worktree，可請使用者同意後清掉（先 `git worktree list` 確認，只移除對應分支已併入 main 的）。
