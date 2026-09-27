# 指南：複製專案後，只保留 1–2 個質地與配色

適用情境：把 car-rental 複製成新專案，新專案只需要一兩種外觀，其餘的質地（texture）、配色（color theme），以及外觀浮動面板都可以刪掉。

本指南依 2026-09-28 的實際演練寫成：在獨立 worktree 把專案縮成「Material × Verdant、無浮動面板」，4 個 app 的測試、build、`lint:theme`、對比掃描全數通過（演練 commit `544b129`，未合併）。刪完後 admin 的首次載入從 711.78 kB 降到 610.90 kB，`styles.css` 從 138 kB 降到 45 kB。

名詞見 [`theme-glossary.md`](../design-system/theme-glossary.md)；目前有哪些質地與配色，一律以 [`theme.token.ts`](../../libs/theme-pack/src/lib/theme/theme.token.ts) 為準（本指南撰寫後可能又新增了質地，例如 Aero）。

---

## 0. 動手前先決定三件事

| 決定 | 選項 | 建議 |
| --- | --- | --- |
| 留哪幾個質地、哪幾套配色 | 例：只留 Material × Verdant；或 Material + Grid × Verdant + Cool Grey | 留下的組合要在目前的相容清單裡（`TEXTURE_COMPATIBILITY`），否則等於要重新定案 |
| 切換機制要不要保留 | **A. 保留雙軸機制**（清單只剩一兩筆）／B. 把顏色直接寫死在 `:root`、拿掉切換 | **選 A**。之後想加回配色只要 3 步；B 要改每條樣式規則的權重，風險高、收益只有幾十 bytes（見第 6 節） |
| 外觀浮動面板要不要留 | 留／刪 | 只剩一種外觀就刪；留 2×2 時可留可刪 |

另外確認：**affiliate app 固定用 Midnight 配色**（`apps/affiliate/src/styles.scss` 與 `index.html`）。刪掉 Midnight 會讓 affiliate 從深色變淺色，這是產品決策，要先想好。

---

## 1. 盤點：找出所有引用

把 `<id>` 換成要刪的質地或配色 id，逐一執行（zsh 下 `--include` 一定要加引號）：

```bash
grep -rn "<id>" apps libs scripts --include='*.ts' --include='*.scss' --include='*.html' --include='*.mjs'
```

特別要找「帶路徑」的寫法，註解裡指向已刪檔案的路徑只有這樣才抓得到：

```bash
grep -rn "texture/<id>\|color-themes/<id>\|data-theme=\"<id>\"\|data-paradigm=\"<id>\"" apps libs scripts
```

---

## 2. 刪除質地與配色（必做）

依序做，每一步後跑一次 build，錯誤訊息會帶你找到漏掉的地方。

| # | 檔案 | 動作 |
| --- | --- | --- |
| 1 | `libs/theme-pack/src/lib/styles/texture/<id>/` | 不要的質地整個資料夾刪掉（連同它的 `design-guideline.md`） |
| 2 | `libs/theme-pack/src/lib/styles/color-themes/<id>/` | 不要的配色整個資料夾刪掉 |
| 3 | `texture/_registry.scss`、`color-themes/_registry.scss` | 刪掉對應的 `@forward` |
| 4 | `apps/admin/src/styles.scss` | 刪掉已刪質地的字型 `@use`（例如 `texture/clay/fonts`、`texture/editorial/fonts`）。**這通常是第一個 build 錯誤** |
| 5 | `apps/affiliate/src/styles.scss` ＋ `apps/affiliate/src/index.html` | 若刪了 Midnight：scss 的 `color-themes/midnight/tokens` 與 HTML 的 `data-theme="midnight"` **兩處都要改**成保留的配色；只改一處會 build 失敗或整頁沒顏色 |
| 6 | `libs/theme-pack/src/lib/styles/_combos.scss` | 刪掉引用已刪 id 的組合規則。**檔案本身要留著**，三個 app 都 `@use` 它 |
| 7 | 保留的質地／配色 `_tokens.scss` | 刪掉只為已刪配色寫的覆寫（例如 Midnight 的陰影、遮罩，Candy 的側欄淡底），若它們寫在保留的檔案裡 |
| 8 | `libs/theme-pack/src/lib/theme/theme.token.ts` | `texture`、`COLOR_THEMES` 只留要的；`TEXTURE_COMPATIBILITY` 只留保留質地的那幾筆，每筆的 `compatibleThemeIds` 只列保留的配色，`defaultThemeId` 一定要在清單內；確認 `DEFAULT_PARADIGM`、`DEFAULT_THEME` 指向保留的 id |
| 9 | `scripts/contrast-report.mjs` | 這支腳本有**第二份**質地與配色清單（它是 `.mjs`，沒有 import TS），要同步縮減，否則會去量已不存在的組合 |
| 10 | 設定頁 `apps/admin/src/app/features/settings/pages/settings-page.component.{html,ts,scss}` | 見第 4 節 |
| 11 | spec | `theme-compatibility.spec.ts` 的 `DECISIONS` 改成保留的組合；`theme.service.spec.ts`、`settings-page.component.spec.ts` 裡寫死已刪 id（soft-ui、midnight、cool-grey…）的案例要改寫。**建議改成讀清單長度或清單第一筆**，之後增減就不用再改 spec |

⚠️ **build 綠燈不代表刪乾淨**：第 1–7 步做完 build 就會過，但 `theme.token.ts` 若沒改，設定頁會繼續列出已經沒有樣式的選項。TS 清單與 SCSS 資料夾之間沒有編譯期連結，第 8、9 步一定要做。

---

## 3. 刪除外觀浮動面板（可選）

| 檔案 | 動作 |
| --- | --- |
| `libs/theme-pack/src/lib/floating-appearance-panel/` | 整個資料夾刪掉（6 個檔） |
| `libs/theme-pack/src/lib/theme/appearance-panel.service.ts`（含 `.spec.ts`） | 刪掉 |
| `libs/theme-pack/src/index.ts` | 刪掉 service 與 component 兩行 `export` |
| `tsconfig.base.json` | 刪掉 path alias `@car-rental/theme-pack/floating-appearance-panel`。**最容易漏**：當初為了延遲載入另開的深路徑，只刪 barrel export 不會報錯 |
| `apps/admin/src/app/app.ts` | 刪 `AppearancePanelService`、`FloatingAppearancePanelComponent` 的 import、`imports` 陣列那一項、`appearancePanel` 欄位 |
| `apps/admin/src/app/app.html` | 刪掉 `@defer (when appearancePanel.visible()) { <lib-floating-appearance-panel /> }` 區塊 |
| 設定頁 | 刪掉「顯示外觀浮動面板」開關：`MatSlideToggleModule`、`onAppearancePanelToggle`、`.appearance-panel-toggle` 樣式、相關 spec |
| `docs/design-system/theme-glossary.md` | 刪「外觀浮動面板」那一列 |

不用處理：`_semantic.scss` 的 `--app-z-floating` 沒人用了，但留著無害；使用者瀏覽器裡的 `cr.appearancePanel*` 沒有程式會讀。

刪掉面板後 **`ThemeService` 仍然需要**：app 啟動時它負責把瀏覽器裡的舊設定校正回預設（見第 5 節），設定頁也靠它取得相容配色。

---

## 4. 設定頁：隱藏還是刪除

| 做法 | 怎麼改 | 適合 |
| --- | --- | --- |
| **隱藏（建議）** | 質地列包 `@if (texture.length > 1)`、配色列包 `@if (colorThemes().length > 1)`；兩列都隱藏時顯示一行說明（例如「目前只提供一種外觀」）。路由與選單不動 | 之後可能加回配色；加回時選擇列會自動出現，不用碰模板 |
| 刪除整頁 | 刪 `features/settings/`、`app.routes.ts` 的 `settings` 路由、側欄使用者選單的「設定」項與它的 spec 斷言、`app.spec.ts` 的假路由、`zh-tw.ts` 的 `settingsPage` | 確定永遠只有一種外觀，而且設定頁沒有別的用途 |

保留 2 個以上選項時，隱藏寫法會讓選擇列自動顯示，模板不用改。

---

## 5. 瀏覽器裡的舊設定

使用者的瀏覽器可能存著已刪的質地或配色（`localStorage` 的 `cr.paradigm`、`cr.theme`）。

- **配色**：有相容檢查，不在清單內就會退回該質地的預設配色。
- **質地**：2026-09-28 起 `ThemeService` 會經過 `resolveParadigmId()`，不認得的質地一律退回 `DEFAULT_PARADIGM` 並覆寫舊值。在這之前質地沒有任何檢查，**整頁會失去質地樣式（卡片沒圓角、沒陰影），console 卻沒有任何錯誤**。複製專案時確認這個修正已經在裡面：

```bash
grep -n "resolveParadigmId" libs/theme-pack/src/lib/theme/theme.service.ts
```

---

## 6. 為什麼不建議把顏色寫死在 `:root`

保留雙軸機制時，之後加回一套配色只要：新增 `color-themes/<id>/` 資料夾、registry 加一行、`theme.token.ts` 加一筆，設定頁自動出現。

改成寫死要處理：

- 配色與質地的 token 要寫成 `:root:root` 維持原本權重。只寫 `:root` 會跟 `_semantic.scss` 的預設同權重，變成看載入順序決定，這正是 ADR 0008 禁止的。
- Material 的 7 個 recipe 檔以 `[data-paradigm="material"]` 開頭，換成 `:root` 才能維持權重；換成 `html` 或直接拿掉會輸給 Material 自己的樣式。datepicker 的權重註解要重算，data-table、合約簽署對話框的權重假設也要重新確認。
- 刪 `_combos.scss` 與三個 app 的 `@use`、`ThemeService`、app 啟動的初始化、設定頁、三個 `index.html` 的 `data-*` 屬性，並改寫對比掃描與 lint 的說明。
- 等於每條規則的權重都變了，要逐頁截圖加對比掃描重新驗收。

收益只有 CSS 少幾十個 bytes、少一個服務，除非確定永遠不再加回配色，否則不值得。

---

## 7. 保留 2 × 2 時的差異

以 Material + Grid × Verdant + Cool Grey 為例（依 2026-09-27 定案，這 4 格全部相容）：

- 質地刪 5 個、配色刪 6 套；registry 各留 2 組。
- 相容清單：`material: { compatibleThemeIds: ['verdant', 'cool-grey'], defaultThemeId: 'verdant' }`，`grid` 同樣寫法。
- 設定頁用第 4 節的隱藏寫法，兩列會自動顯示。注意舊 spec 有「相容配色數 < 全部配色數」的斷言，全部相容時一定會紅。
- 浮動面板可留可刪。留的話，它的 spec 裡點 midnight、soft-ui、斷言 sandstone 被隱藏的案例要重寫。
- 對比掃描從 56 格變成 4 格。
- Grid 的等寬字型（IBM Plex Mono）已經在 admin 的 `index.html` 載入，不用補。
- repo 根目錄 `CLAUDE.md` 的「Material、Grid、Editorial 各截一張」改成實際保留的質地。

---

## 8. 更新文件

- **要改**：repo 根目錄 `CLAUDE.md`（質地準則清單、截圖規則）、`libs/theme-pack/src/lib/styles/CONTRACT.md`、`docs/design-system/theme-glossary.md`、`README.md`（雙軸主題系統段落）、`docs/architecture/02-libs.md`。
- **留著當歷史**：`docs/adr/0002`–`0008`、`docs/plans/2026-09-2*.md`。它們記錄的是當時的決定，不需要跟著改。
- **可選清理**：註解裡提到已刪 id 的說明（`_semantic.scss`、`_choice-controls.scss`、`component.scss` 等）不影響執行；但**指向已刪檔案路徑**的註解要改掉。

---

## 9. 驗收

每條指令以 exit code 判定（`> log 2>&1; echo "exit=$?"`）。跑之前先切 Node 版本：`export PATH=~/.nvm/versions/node/v24.18.0/bin:$PATH`。

1. 測試：`npx nx test theme-pack`、`admin`、`affiliate`、`booking`、`ui` 全過。
2. build：`npx nx build admin --configuration=production --skip-nx-cache`、`booking`、`affiliate` 都成功，admin 沒有預算警告。
3. `npm run lint:theme` 通過；`npx vitest run scripts --exclude '.claude/**' --exclude '**/node_modules/**'` 通過。
4. 啟動 admin 後跑 `npm run contrast:theme -- --base-url=http://localhost:<port>`，保留的組合全部 0 不合格。
5. 第 1 節的 grep 在程式與 scss 裡 0 殘留（測試用的舊值測資、註解可以例外）。
6. 在瀏覽器存一個已刪的質地與配色（例如 `localStorage.setItem('cr.paradigm', 'clay')`），重新整理後確認退回預設、卡片有正常的圓角和陰影。
7. 開儀表板、訂單列表、設定頁截圖確認正常，console 0 錯誤。

---

## 附錄：演練踩到的坑

1. 只刪 SCSS 資料夾與 registry，build 照樣綠，設定頁卻繼續列出已沒有樣式的選項。
2. affiliate 固定用 Midnight：被刪的配色不只 admin 在用，scss 與 `index.html` 兩處都要改。
3. admin `styles.scss` 開頭的質地字型 `@use` 是第一個 build 錯誤。
4. 瀏覽器裡舊的質地設定不會退回預設（2026-09-28 已修，見第 5 節）。
5. 浮動面板有一條獨立的 tsconfig path alias，只刪 barrel export 會漏。
6. `contrast-report.mjs` 有第二份重複的清單。
7. spec 裡寫死具體 id 的案例會大量變紅；改成讀清單長度，下次就不用再改。
8. 註解裡有指向已刪檔案的路徑，要 grep 帶斜線的寫法才找得到。
