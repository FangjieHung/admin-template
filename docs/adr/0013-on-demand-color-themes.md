# ADR 0013：按需載入配色樣式（常駐配色／按需配色）

- 狀態：已實作
- 日期：2026-10-13
- 推翻：ADR 0010「考慮過的替代方案」中「連配色也按需載入」的否決

## 背景

ADR 0010 把質地改成按需載入時，配色維持全部常駐：當時只有 8 套、每套主要是一組變數，按需載入要在開機腳本再擋一次渲染、`_combos.scss` 也要拆檔，判斷收益不值得。之後 ADR 0012 加了 Graphite、OLED，配色變成 10 套，主樣式 `styles.css` 從 61.43 kB 漲到 67.09 kB：每套常駐配色約 2.4 kB（含 Tailwind 為 `color-mix()` 產生的 `@supports` 備援），每個使用者都要下載，但同一時間只會用到一套。之後還會再加配色，照原本的做法每加一套就讓所有人多付約 2.4 kB。

術語見 [`theme-glossary.md`](../design-system/theme-glossary.md)「常駐配色／按需配色」。

## 決策

1. **常駐**：只有預設配色 Verdant（`DEFAULT_THEME`，也是常駐質地 Material 的預設配色）。它是第一次打開時的外觀，也是按需配色載入失敗時的退路。`theme.token.ts` 的 `RESIDENT_COLOR_THEME_IDS` 只放它，admin `styles.scss` 直接 `@use 'color-themes/verdant'`。`color-themes/_registry.scss` 已刪除。
2. **按需**：Midnight、Sandstone、Azure、Cool Grey、Candy、Mist Ink、Glacier Blue、Graphite、OLED，以及之後新增的每套配色。每套配色有自己的入口 `color-themes/<id>/_index.scss`，在 `apps/admin/project.json` 的 `styles` 以 `{ "input": …, "bundleName": "color-<id>", "inject": false }` 編成不帶 hash 的 `color-<id>.css`（理由同 ADR 0010 決策 3）。
3. **第一次載入不閃 Verdant**：`index.html` 的開機腳本（`#app-texture-boot`）存的是按需配色時，跟按需質地一起用 `document.write` 寫入 `<link rel="stylesheet" data-color-css="<id>">`。兩個 `<link>` 在同一次 `document.write` 裡、由解析器插入，同時下載、都會擋住首次繪製與 `main.js`，所以第一個畫面就是存的質地 × 配色。不認得的 id 維持 Verdant；存的組合不相容時由 `ThemeService.init()` 校正（開機腳本仍不重抄相容清單）。
4. **層疊順序不變**：以前主樣式裡的順序是「質地 → 配色 → component／choice-controls → 組合層 → `mat.theme()`」，按需質地排在主樣式之前。按需配色的 `<link>` 排在質地 `<link>` 之後、主樣式之前（開機腳本照這個順序寫；`ColorStylesheetLoader` 插在最後一個配色或質地 `<link>` 後面），所以「質地 recipe」與「配色裡的元件覆寫」（例如 `:root[data-theme='cool-grey'] .avatar`，都是 0-3-0）的勝負不變。配色改排到 Material 質地、component、choice-controls 前面：配色只在 `:root[data-theme='x']`（0-2-0 以上）下定義，主樣式裡沒有同權重又同屬性的規則（ADR 0008：質地層與配色層不定義同一個變數），計算樣式比對 0 差異證實了這點。
5. **組合層跟著配色走**：`_combos.scss` 改成 `@mixin for-color($id)`，每條組合規則放在它那套配色的 `@if` 分支裡，由該配色的入口 `@include`（Verdant 的進主樣式，其他的進 `color-<id>.css`）。組合規則只在 `data-theme` 是該配色時才比對得到，而配色生效時它的檔案一定已經載入，所以跟著配色走保證會生效；用不到的配色不會把它的組合規則帶進主樣式。另一個軸（質地）若是按需的，兩個檔案都要載入規則才比對得到，放哪一邊都成立，統一放配色以免分散。組合層是 0-3-0，勝過質地與配色的 0-2-0，跟載入順序無關。目前唯一一條（material × midnight 陰影透明度）因此從主樣式搬進 `color-midnight.css`。
6. **切換時保留舊外觀直到新樣式載入完成**：`ThemeService.setTheme()` 先由 `ColorStylesheetLoader` 下載，`load` 之後才切換 `data-theme`，再移除舊配色的 `<link>`；期間 `pendingTheme` 是新的 id。`setParadigm()` 若因相容性要換成新質地的預設配色，兩個檔案同時下載、都完成才在同一步切換 `data-paradigm` 與 `data-theme`。質地與配色共用一個請求序號：連點只套用最後一次；配色還在下載時切質地，會沿用剛選的配色（相容的話）。
7. **預先下載**：外觀浮動面板打開時與進入設定頁時，`prefetchColors()` 為每個尚未載入的按需配色放 `<link rel="prefetch" as="style">`，跟 `prefetchTextures()` 一起呼叫。
8. **載入失敗**：退回 Verdant，校正 localStorage 與 dataset，並以警告提示顯示「配色載入失敗，暫時使用預設配色」（`COLOR_FALLBACK_NOTIFIER`，admin 在 `app.config.ts` 提供，跟質地的提示共用同一個動態載入的檔案）。開機時的失敗由開機腳本的 `__appColorFailed` 處理（退回 Verdant、在 `<html data-color-fallback>` 留下 id），`init()` 在第一次渲染後提示。質地切換時若是質地失敗，配色回到切換前的配色（不換成為新質地準備的預設配色）。

## 考慮過的替代方案

- **維持全部常駐**（ADR 0010 的做法）：最簡單，但每加一套配色所有人多下載約 2.4 kB，而且已經有 9 套用不到的配色在主樣式裡。否決。
- **先畫 Verdant、樣式到了再換**：不用改開機腳本，但存了深色配色的使用者每次開頁都會先閃一下淺色畫面。否決。
- **組合規則留在主樣式**：一定生效、不用改 `_combos.scss` 的寫法，但用不到的配色的組合規則照樣進主樣式，配色越多越重。否決。
- **組合規則跟著質地走**：常駐質地 × 按需配色（目前唯一的一條）要寫進主樣式，跟上一條一樣。否決。
- **配色 + 質地合併成一個檔案**（`theme-<質地>-<配色>.css`）：一次請求，但 70 組相容組合就是 70 個檔案，每個都重複質地的 recipe，部署與快取都變差。否決。

## 後果

- 初始 bundle：603.07 kB → 582.84 kB（`styles.css` 67.09 → 43.38 kB，估計傳輸 9.82 → 6.93 kB；`main.js` 535.98 → 539.46 kB，多了配色 loader 與合併切換流程）。Admin 的 `initial` 警示門檻改為 603 kB（實測 + 20 kB 取整），錯誤門檻維持 850 kB。
- 按需配色檔案（raw／gzip）：Midnight 2.77／0.76 kB、Sandstone 2.15／0.68、Azure 2.09／0.67、Cool Grey 2.03／0.66、Candy 2.06／0.73、Mist Ink 2.23／0.75、Glacier Blue 2.27／0.78、Graphite 2.58／0.80、OLED 2.46／0.77。使用者實際多下載的只有自己選的那一套（存的是 Verdant 就完全不用）。
- 跟按需質地一樣，按需配色的檔案不經過 Tailwind 的 PostCSS，不再輸出 `@supports (color: color-mix(...))` 的退路規則（主樣式少了 27 組）；支援 `light-dark()` 的瀏覽器都支援 `color-mix()`，畫面不受影響。
- 配色載入失敗時退回 Verdant，即使目前質地的相容清單不含 Verdant（例如 Cockpit）：Verdant 是唯一保證有樣式的配色，外觀可用、只是不是定案的組合；重新整理時 `init()` 會把組合校正回該質地的預設配色並再試一次。
- 存的組合不相容（例如相容清單改過）時，開機腳本先套存的配色，`init()` 校正後要再下載一次校正後的配色才渲染 app；這段期間可能先畫出空白頁的底色。只發生在相容清單變動後的第一次載入。
- `ThemeService.setTheme()` 改成回傳 `Promise<void>`；新增 `pendingTheme`、`prefetchColors()`、`COLOR_FALLBACK_NOTIFIER`、`COLOR_FALLBACK_MESSAGE`、`ColorStylesheetLoader`。質地與配色的 loader 共用 `OnDemandStylesheetLoader`（下載中被移除的 `<link>` 會 reject，等待的切換不會卡住；`retainOnly()` 在套用後拿掉沒用到的 `<link>`）。
- 開機腳本多一份按需配色 id 清單（`onDemandColors`）。`scripts/texture-registration.spec.mjs` 比對 `theme.token.ts`、`color-themes/` 資料夾、`project.json` 入口、開機腳本四處，並檢查每條組合規則放在自己配色的分支裡。
- `scripts/contrast-report.mjs` 改 dataset 之前，會先確認該配色的 `<link>` 已載入完成（沒有就插入並等待），因為 `init()` 會把不相容組合的配色 `<link>` 拿掉；報告格式不變。
- 驗收：base（`5d3fcd6`）與本次 build 以真實開機流程對 70 組「質地 × 相容配色」× 3 頁（首頁、Material 元件總覽、資料表）逐欄比對計算樣式（210 頁、約 22 萬個元素，每個元素 51 個欄位，外加根元素與 body 的全部自訂屬性與 `color-scheme`，共 1,142 萬個欄位），base 比 base 0 差異、base 比 head 0 差異。另以 Playwright 確認：存 Clay × Midnight、Material × OLED 時 `color-<id>.css` 延遲 2 秒回應期間沒有任何繪製、app 尚未渲染，first-paint 晚於該檔下載完成，`data-theme` 從頭到尾只有存的值；切換配色時新樣式下載完成前 `data-theme` 不變、套用後才移除舊 `<link>`；質地連帶換配色時兩個檔案都到才一起切換；配色檔回 404 時退回 Verdant 並顯示提示。

## 現在怎麼新增一套配色

1. 複製 `color-themes/verdant/` 成 `color-themes/<id>/`，改 `_tokens.scss` 的 token（選擇器 `:root[data-theme='<id>']`）；`_index.scss` 照抄任何一套按需配色（例如 `azure/_index.scss`），把 id 換掉。
2. 在 `apps/admin/project.json` 的 `build.options.styles` 加 `{ "input": "libs/theme-pack/src/lib/styles/color-themes/<id>/_index.scss", "bundleName": "color-<id>", "inject": false }`。**不要**在 `styles.scss` `@use` 它。
3. 在 `theme.token.ts` 的 `COLOR_THEMES` 加一筆，並逐一加進要相容的質地的 `TEXTURE_COMPATIBILITY`（ADR 0007：白名單）。`COLOR_THEMES` 以外不用改任何 TS：不在 `RESIDENT_COLOR_THEME_IDS` 裡的配色自動按需載入。
4. 在 `apps/admin/src/index.html` 開機腳本的 `colorThemes` 與 `onDemandColors` 都加上 id；`scripts/contrast-report.mjs` 的 `COLOR_THEMES` 也加上。
5. 這套配色需要「質地 × 配色」例外時，寫在 `_combos.scss` 的 `@if $id == '<id>'` 分支。
6. 跑 `npx vitest run scripts --exclude '.claude/**' --exclude '**/node_modules/**'`（`texture-registration.spec.mjs` 會檢查第 1–4 步）、`npm run lint:theme`，再跑對比掃描。
