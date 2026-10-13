# ADR 0010：按需載入質地樣式（常駐質地／按需質地）

- 狀態：已實作
- 日期：2026-10-13

## 背景

Admin 把 8 個質地全部編進 `apps/admin/src/styles.scss`：`styles.css` 152.91 kB，初始 bundle 708.53 kB，離 720 kB 警示門檻只剩 11 kB。之後還要再加 5 個質地，每個約 8–14 kB，照原本的做法一定超標。但一位使用者同一時間只會用到一個質地，其餘質地的 CSS 每次都白白下載。

術語見 [`theme-glossary.md`](../design-system/theme-glossary.md)「常駐質地／按需質地」。

## 決策

1. **常駐**（永遠在主樣式裡）：Material 質地、全部 8 套配色、共用規則（`_semantic.scss`、`component.scss`、`_choice-controls.scss`、`_combos.scss`）、`mat.theme()` 的輸出，以及 `texture/material/buttons.scss` 末段那條不分質地的按鈕排版規則。Material 是預設外觀，也是按需質地載入失敗時的退路。
2. **按需**：Linen、Grid、Soft UI、Clay、Editorial、Frosted、Aero，以及之後新增的每個質地。每個質地有自己的入口 `texture/<id>/_index.scss`，在 `apps/admin/project.json` 的 `styles` 以 `{ "input": …, "bundleName": "texture-<id>", "inject": false }` 編成獨立的 `texture-<id>.css`。Clay、Editorial 的 Google Fonts `@import` 跟著搬進各自的檔案；Soft UI、Aero 的 `--font-body` 用 DM Sans，以前是「順便」跟著 Clay 的字型 CSS 載入的，現在各自用 `_fonts.scss` 載入。IBM Plex Mono 是 Material 的 `--font-mono`，維持在三個 app 的 `index.html`（booking、affiliate 也用到）。
3. **檔名不帶 hash**：`@angular/build:application` 對 `inject: false` 的樣式固定輸出 `[name].css`（`outputHashing: all` 也一樣，見 `@angular/build/src/tools/esbuild/global-styles.js`），所以執行期直接用 `texture-<id>.css`（相對於 `<base href>`，部署在 `/bbd-car-rental/` 底下也成立），不需要 manifest。`nx serve admin` 也用同一個網址。
4. **第一次載入不閃 Material**：`apps/admin/src/index.html` 在 `<base>` 之後、任何樣式表之前放一段同步的開機腳本（`#cr-texture-boot`）。它讀 localStorage 的 `cr.paradigm`／`cr.theme`，對照已知 id 後設定 `<html>` 的 `data-paradigm`／`data-theme`；存的是按需質地時，用 `document.write` 寫入 `<link rel="stylesheet" data-texture-css="<id>">`。由解析器插入的樣式表會擋住首次繪製，也會擋住後面 `main.js` 的執行，所以第一個畫面就是該質地。不認得的 id 維持 Material，殘值由 `ThemeService.init()` 覆寫；配色與質地的相容校正仍由 `init()` 負責（開機腳本不重抄相容清單）。
5. **切換時保留舊外觀直到新樣式載入完成**：`ThemeService.setParadigm()` 先由 `TextureStylesheetLoader` 下載新質地，`load` 之後才在同一個步驟切換 `data-paradigm`（以及必要的配色校正），然後移除舊質地的 `<link>`（Clay 有 body 層的光暈與 keyframes，留著沒有意義）。下載期間 `pendingParadigm` 是新的 id、`paradigm` 仍是舊的。連點兩個質地時只套用最後一個。
6. **插入位置固定在主樣式之前**（開機腳本後面）。以前所有質地都編在主樣式裡，排在配色、`component.scss`、組合層之前，也排在 Angular 執行期插入的元件 `<style>` 之前。放在同一個相對位置，同權重規則的勝負就跟以前一樣；若 append 到 `<head>` 最後，會排到已經存在的元件樣式後面，同權重時反過來蓋掉元件樣式。
7. **預先下載**：外觀浮動面板打開時（以及進入設定頁時），`ThemeService.prefetchTextures()` 為每個尚未載入的按需質地放一個 `<link rel="prefetch" as="style">`，之後點選時多半直接用 HTTP 快取。
8. **載入失敗**：退回 Material，校正 localStorage 與 dataset，並提示「外觀載入失敗，暫時使用預設外觀」。theme-pack 不依賴任何 app 的提示元件：`ThemeService` 呼叫可選的 `TEXTURE_FALLBACK_NOTIFIER`，admin 在 `app.config.ts` 提供它，失敗時才動態載入 `MatSnackBar` 顯示 3 秒。開機時的失敗由開機腳本的 `onerror` 處理（退回 Material、在 `<html data-texture-fallback>` 留下 id），`init()` 在第一次渲染後提示。

## 考慮過的替代方案

- **先畫 Material、樣式到了再換（flash-then-swap）**：實作最簡單（不用開機腳本），但存了其他質地的使用者每次開頁都會看到圓角、陰影、字體跳一次，Clay、Editorial 這類字型不同的質地還會讓整頁重排。否決。
- **連配色也按需載入**：配色只有 8 套、每套主要是一組變數，全部常駐的成本小；按需載入配色要在開機腳本再擋一次渲染，而且配色和質地的組合層（`_combos.scss`）要拆成更多檔。收益不值得增加的複雜度。否決。
- **維持全部編進主樣式**：再加 5 個質地後初始 bundle 會超過 720 kB 警示門檻，而且每個使用者都要下載所有沒用到的質地。否決。
- **帶 hash 的檔名＋建置後產生 manifest**：快取最理想，但要多一個建置後步驟，開機腳本還要先拿到 manifest。目前部署在 GitHub Pages（回應帶 `max-age=600`），不帶 hash 的代價只是部署後最多約 10 分鐘可能拿到舊版質地樣式。之後若改用長期快取的主機，再改成 manifest。

## 後果

- 初始 bundle：708.53 kB → 621.81 kB（main 555.63 → 558.56 kB，多了 loader 與開機流程；`styles.css` 152.91 → 63.25 kB，gzip 19.19 → 11.61 kB）。Admin 的 `initial` 警示門檻改為 642 kB（實測 + 20 kB），錯誤門檻維持 850 kB。
- 按需質地檔案（raw／gzip）：Linen 7.61／1.72 kB、Grid 9.67／1.95、Soft UI 12.85／2.43、Clay 13.47／2.88、Editorial 11.30／2.18、Frosted 12.88／2.44、Aero 12.86／2.56。使用者實際多下載的只有自己選的那一個。
- booking、affiliate 只用 Material，`styles.css` 與初始 bundle 逐位元組不變（411.11 kB／397.11 kB）。
- 按需質地的檔案不經過 Tailwind 的 PostCSS 處理（入口裡沒有 Tailwind），所以不再輸出 `@supports (color: color-mix(...))` 的退路規則。主題系統本來就依賴 `light-dark()`（Material 的 `mat.theme()` 輸出也是），支援 `light-dark()` 的瀏覽器都支援 `color-mix()`，畫面不受影響。
- 新增質地的步驟變成：建立 `texture/<id>/` 的 `_tokens.scss`、`recipes.scss`、`_index.scss`（需要字型就加 `_fonts.scss` 並在 `_index.scss` 第一行 `@forward`），在 `apps/admin/project.json` 的 `styles` 加一筆 `texture-<id>` 入口，在 `theme.token.ts` 的 `texture` 加一筆，在 `index.html` 開機腳本的 `onDemandTextures` 加上 id。`texture/_registry.scss` 已刪除。`scripts/texture-registration.spec.mjs` 會比對這幾處，並實際執行開機腳本。
- 開機腳本有一份質地與配色的 id 清單，是 `theme.token.ts` 以外的第二份（跟 `contrast-report.mjs` 一樣是非 TS 檔，無法 import）；不一致時上述 spec 會失敗。
- `scripts/contrast-report.mjs` 改 dataset 之前，會先確認該質地的 `<link>` 已載入完成（沒有就插入並等待）；報告格式不變。
- 驗收：base（`b86b46f`）與本次 build 以真實開機流程（localStorage 設組合後整頁載入）對 47 組「質地 × 相容配色」× 3 頁（儀表板、訂單列表、建單頁）、約 7 萬個元素、301 萬個欄位逐欄比對計算樣式。base 比 base 0 差異；第一次 base 比 head 抓到 Soft UI／Aero 徽章與表格文字寬 0.9px（上面的 DM Sans），補上後 0 差異。另以 Playwright 確認：存 Clay 時，texture-clay.css 延遲 2 秒回應期間沒有任何繪製、app 尚未渲染，first-paint 晚於該檔下載完成；切換時新樣式下載完成前 `data-paradigm` 不變、套用後才移除舊 `<link>`；回 404 時退回 Material 並顯示提示。
