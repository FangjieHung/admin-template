# ADR 0012：Cockpit 儀表艙質地與 Graphite、OLED 兩套深色配色

- 狀態：已實作；相容清單已定案（2026-10-13，使用者核可）
- 日期：2026-10-13

## 背景

範本只有一套深色配色（Midnight），而且 9 個質地都是為淺色畫布設計、深色只是「也能用」。監控、調度、營運儀表板這類後台常整天開在深色畫面上，使用者想要一種「飛航儀表艙」個性的外觀：深色優先、數字像刻度、狀態一眼看出亮暗；同時要多兩套深色配色可選——一套暖的石墨灰配琥珀橘（像儀表指示燈），一套純黑配冷調亮色（OLED 螢幕省電、不刺眼）。

## 決策

1. **新增按需質地 `cockpit`（「Cockpit 儀表艙」）**，照 ADR 0010 的步驟登錄：`texture/cockpit/{_fonts,_tokens,recipes,_index}.scss`、`apps/admin/project.json` 的 `texture-cockpit` 入口、開機腳本的 `onDemandTextures`、`theme.token.ts` 的 `texture` 與 `TEXTURE_COMPATIBILITY`、`contrast-report.mjs` 的 `TEXTURES`。
2. **層次手段：發光（亮度）。** 越前面的表面越亮一階（畫布 `background` → 卡片 `surface` → 滑過的卡片 `surface-container` → 選單／日期選擇器 `-high` → 對話框 `-highest`），外面多一圈主色的柔光；靜止的卡片只有一條帶主色的 1px 髮絲亮邊（`--cockpit-edge`），沒有往下投的影子。`--mat-sys-level1` 只有亮邊，`level2–4` 是亮邊加上 12／20／36px、primary 22／28／34% 的光暈；box-shadow 一律零偏移，所以是光不是影。啟用、選取、焦點、勾選再加一圈小而亮的光（`--cockpit-glow-active`，primary 50%），狀態徽章的圓點是會發光的 LED（中性不亮）。畫布四周一圈極淡的暗角（`--app-shadow-tint` 35%），沒有雜訊或紋理。所有光的顏色都從 `--mat-sys-primary` 以 `color-mix()` 調出。和現有質地都不同：Material 是往下投的模糊陰影、Linen 是紙張色階、Grid 是硬邊偏移影子、Soft UI／Clay 是浮雕與體積、Editorial 是字級與留白、Frosted／Aero 是透光玻璃、Ledger 是斑馬紋與分隔線。
3. **字型：只多載一個標題用的窄體 Barlow Condensed（500／600／700）**，放在 `cockpit/_fonts.scss`，跟著 `texture-cockpit.css` 按需下載。候選是 Rajdhani 與 Barlow Condensed，選後者：
   - Barlow 系列的原型是路牌與車牌的標示字，和飛航儀表板上的面板標示（DIN 一路的窄體無襯線）同源，一眼是「儀表」而不是「科幻」；Rajdhani 的方角造型偏 HUD／遊戲介面。
   - Barlow Condensed 的筆畫粗細和蘋方、微軟正黑接近，中英混排的標題（「Material 元件總覽」）不會一邊細一邊粗；Rajdhani 在 600 以下明顯偏細。
   - 風格和 Noto Sans／系統無襯線差很多（窄、高、直），符合「只在風格明顯不同時才載英文網頁字」的規則。

   用在頁面大標、`.ui-text-title`／`-subtitle`／`-caption`、表頭、對話框標題與 Material 的 display／headline／title-large 字階。英文內文用裝置無襯線（Helvetica Neue／Segoe UI／Roboto／Arial，不放 `system-ui` 以免中文被系統字搶走），中文接 `--font-zh`；數字用全站已載入的 IBM Plex Mono：`.ui-text-numeric`、`.ui-text-display`、數字輸入，`body` 全面 `tabular-nums`。`.ui-text-display` 另有主色微光與底下一排 0.25em 間距的刻度線，像儀表讀數。
4. **深色優先：Cockpit 只相容深色配色。** 淺色配色的對比其實多半合格（見下表，只有 Cool Grey 的欄位邊界 2.83:1 不合格），仍全部排除：主色光暈在淺色底上讀不出來，看起來像髒污，層次手段失效。
5. **Graphite 石墨橘（`graphite`）**：中性色是帶一點暖（色相約 40°）的石墨灰，畫布 `#191816`、卡片 `#211f1d`、對話框 `#3a3834`，不是純黑；側欄更深（`#121110`）。主色是儀表指示燈的琥珀橘 `#ff9a3c`（色相 29°）。琥珀和「警示」最容易混淆，所以把警示推到檸檬黃（圓點 `#e8cf2e`，色相 52°）、危險推到帶粉的紅（`#ff7b84`，色相 356°）；CIEDE2000 色差主色對警示圓點 25.3、對警示文字 26.0、對危險 28.0（≥ 20 視為並排一眼分得開）。
6. **OLED 純黑（`oled`）**：畫布與側欄都是 `#000`，表面每階只往上墊 1–2% 亮度（相對亮度 0 → 0.0033 → 0.006 → 0.0096 → 0.0143），主色是冷調的電光青 `#35d3f2`。為了不出現大面積亮色，反轉表面（提示訊息、inverse 卡）也是深色（`#222831`），不是 M3 預設的淺色；資訊狀態用靛藍 `#8394ff`，不和主色撞色（色差 28.8）。
7. **兩套深色配色的 token 範圍**：Midnight 有的全部（`--mat-sys-*` 顏色、`--app-*` 狀態／圖表／側欄／topbar／日曆範圍色、`--app-shadow-tint`、`--app-scrim`、`color-scheme: dark`），再加上 Midnight 沒蓋、但建置產物裡真的有元件引用的 `mat.theme()` 缺口。抽取方法：production build 後取 `styles-*.css` 的 `html{…}` 裡所有 `--mat-sys-*`（顏色 49 個），再到主樣式其餘部分、所有 JS chunk、所有 `texture-*.css` 找 `var(--mat-sys-x)`。有引用而 Midnight 沒蓋的有 5 個：`inverse-primary`（提示訊息的動作鈕）、`on-background`、`tertiary-container`、`neutral10`（下拉選單停用選項文字的基底）、`neutral-variant20`（側欄遮罩）。這 5 個加上 `tertiary`／`on-tertiary`／`on-tertiary-container` 寫進兩套配色；fixed 系列、`surface-dim/bright/tint`、`shadow`、`scrim` 等沒有任何元件引用的不寫（每個 token 都算進常駐的初始 bundle）。`mat.theme()` 輸出的是 `light-dark(淺, 深)`，沒蓋到的 token 會露出綠色調色盤的深色值，所以新元件開始引用某個沒蓋的 token 時要補上。
8. **測試**：新增 `scripts/dark-palette.spec.mjs`，直接讀兩套配色的色碼，檢查 `color-scheme: dark` 與上述 5 個缺口、文字 4.5:1 與欄位邊界／主色 3:1（對畫布與每一階表面）、成對前景／底色 4.5:1、主色對每個狀態色與狀態色彼此的 CIEDE2000 ≥ 20、圖表 4 色彼此 ≥ 20 且對表面 ≥ 3:1。

## 相容配色（定案：2026-10-13，使用者核可）

對比掃描（`contrast-report.mjs`，一般文字 4.5:1、欄位／UI 邊界 3:1，每格 25 組 pair）：Cockpit × 10 套配色、Graphite／OLED × 10 個質地，共 28 格（Cockpit × Graphite／OLED 重疊），**只有 Cockpit × Cool Grey 不合格**（欄位邊界 2.83:1，本來就排除）。

**Cockpit × 每套配色**

| 配色 | 最低 pair（比值／門檻） | 結果 |
| --- | --- | --- |
| Midnight | 資訊徽章 4.52／4.5、選取文字 4.52／4.5 | 相容 |
| Graphite | 欄位邊界 3.24／3 | 相容，**預設** |
| OLED | 欄位邊界 3.52／3 | 相容 |
| Verdant、Sandstone、Azure、Candy、Mist Ink、Glacier Blue | 全數合格（最低 Verdant 欄位邊界 3.01／3） | **排除**（淺色配色，光暈讀不出來） |
| Cool Grey | 欄位邊界 2.83／3（不合格） | **排除** |

**Graphite／OLED × 每個質地**（20 格全數合格）

| 質地 | Graphite 最低 | OLED 最低 | 結果 |
| --- | --- | --- | --- |
| Material | 欄位邊界 4.55 | 欄位邊界 4.24 | 兩者相容 |
| Linen | 4.55 | 4.24 | Graphite 相容；**OLED 排除**（紙張色階在純黑上幾乎沒有差，紙感消失） |
| Grid | 4.55 | 4.24 | 兩者相容 |
| Soft UI | 4.91 | 4.53 | Graphite 相容；**OLED 排除**（純黑上暗面陰影看不見，浮雕消失、卡片和畫布分不開） |
| Clay | 4.55 | 4.24 | Graphite 相容；**OLED 排除**（環境陰影在純黑上看不見，體積感消失） |
| Editorial | 4.55 | 4.24 | 兩者相容 |
| Frosted | 勾選框外框 4.56 | 4.25 | 兩者相容 |
| Aero | 選取文字 5.93／4.5 | 勾選框外框 4.28 | **兩者排除**（和 Midnight 同理：高亮度雲霧玻璃只搭淺色畫布） |
| Ledger | 4.55 | 4.24 | 兩者相容 |
| Cockpit | 3.24 | 3.52 | 兩者相容 |

除了 Aero、OLED 另排除的三個，比照 Midnight 現有的相容範圍；Clay 原本只相容 Midnight、Cool Grey，這次多加 Graphite（暖灰上的黏土光影成立）。白名單已寫進 `TEXTURE_COMPATIBILITY`（逐一列出）；2026-10-13 使用者核可、照原樣定案，之後以那裡為準。

## 後果

- 組合矩陣 10 × 10 = 100 格，相容 70 組（原 54 組＋Cockpit 3＋Graphite 進 8 個既有質地＋OLED 進 5 個既有質地）。
- Bundle：`texture-cockpit.css` 17.17 kB／gzip 3.07 kB（和 Ledger 的 17.07 kB 相當）。Admin 初始 bundle 650.77 → 656.79 kB（+6.02 kB）：`styles.css` 61.43 → 67.09 kB（+5.67 kB，全部是兩套配色的 token，Graphite 2.39 kB、OLED 2.36 kB，另有兩者 `color-mix()` 的 `@supports` 備援），`main.js` 589.34 → 589.69 kB（+0.35 kB，`theme.token.ts` 的選項與白名單）。配色全部常駐（ADR 0010），所以兩套配色的成本由每個使用者負擔；仍在 659 kB 警告線內，剩約 2.2 kB。其他 8 個按需質地的 CSS 逐位元組不變。
- Midnight 有同樣的 5 個缺口（例如提示訊息的動作鈕在 Midnight 下其實是 `mat.theme()` 綠色調色盤的深色值），本 ADR 不動 Midnight，列為後續工作。
- 驗收截圖：Material 元件總覽（Cockpit × Midnight／Graphite／OLED）、資料表、載入／空白／錯誤、角色與權限頁（Cockpit × Graphite），以及 Material × Graphite、Material × OLED、Grid × OLED、Ledger × Graphite 的元件總覽。
