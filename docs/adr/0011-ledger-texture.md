# ADR 0011：Ledger 帳冊質地（高密度）

- 狀態：已實作；相容清單為提案，待使用者定案
- 日期：2026-10-13

## 背景

後台最常見的畫面是長清單與數字報表，但現有 8 個質地都是「舒適」密度：Material 的資料表一列 69px（含勾選欄），1440×900 下表頭捲到頂也只看得到 12 列。使用者需要一種「帳冊／試算表／金融終端機」個性的外觀：一頁塞得下最多資料、一眼對得齊數字。

術語表原本把「視覺密度」記為規劃中，並寫明「Ledger 為高密度質地，密度暫不獨立成第三個切換軸」。

## 決策

1. **新增按需質地 `ledger`（「Ledger 帳冊」）**，照 ADR 0010 的步驟登錄：`texture/ledger/{_tokens,recipes,_index}.scss`、`apps/admin/project.json` 的 `texture-ledger` 入口、開機腳本的 `onDemandTextures`、`theme.token.ts` 的 `texture` 與 `TEXTURE_COMPATIBILITY`、`contrast-report.mjs` 的 `TEXTURES`。
2. **層次手段：斑馬紋＋分隔線。** 畫布素色、卡片是 1px outline-variant 框且不浮起；資料列之間一條細線、偶數列疊 on-surface 6% 的淡底；表頭再深一階（on-surface 9%）並以一條 outline 實線和內容分開。沒有陰影、模糊、背景紋理；`--mat-sys-level1–4` 改成 `0 0 0 1px` 細框，Material 各元件自己的 `--mat-*-elevation-shadow` 逐一指向細框或 `none`（這些 token 沒設時用 M2 固定陰影，不吃 level token）。和現有質地都不同：Linen 換表面色階、Editorial 靠字級與留白、Grid 靠框線粗細與硬邊偏移影子。
3. **密度屬於質地，不是第三個切換軸。** 理由：密度和造型綁在一起才好看（2px 圓角配 32px 按鈕；Clay 的厚圓角配 32px 按鈕會很怪），另開一軸會讓組合矩陣從 72 格變成 144 格、每格都要對比與目視驗收；而「想要更密」的使用者幾乎都同時要「更冷靜、數字對齊」的造型。實作手段只用既有掛勾：
   - Material 密度 token（等同 density -2／-3）：按鈕與圖示按鈕 32px、勾選／單選狀態層 32px、chip 28px、清單列 40px、分頁籤 40px、`mat-table` 列 34px；隱形 48px 觸控熱區關閉。
   - 欄位 48px（Material 56px）：`--mat-form-field-container-height` 與 filled 的上下內距；浮動標籤位置照 Material 公式自動跟著移動，不另覆寫。
   - 資料表：libs/ui data-table 新增 5 個外觀變數（`--dt-font-size`、`--dt-cell-padding-inline`、`--dt-row-stripe-bg`、`--dt-selection-control-size`、`--dt-selection-padding-block`），預設值等於元件原值，其他質地畫面不變（Material 列高量測仍是 69px）。斑馬紋畫成 `background-image`，疊在滑過、提醒列的底色之上；手機卡片版不畫。Ledger 的列約 35px、表頭約 33px、字級 13px。
   - 內文 13px、Material 字階往下收一階，`label-small` 由 11px 提到 12px：**全站字級下限 12px**。欄位內文維持 16px（浮動標籤縮 0.75 倍＝12px；也避開 iOS 聚焦時放大整頁）。
   - Tailwind 間距單位 `--spacing` 4px → 3px（卡片 `p-4 sm:p-6` 變 12／18px）。admin 只有約 30 個間距工具 class、1 個尺寸 class（`w-20`），影響可控。
   - 動態：`--app-motion-base`／`-slow` 指向 `--app-motion-fast`，不位移、不縮放；減少動態時 fast 歸零，兩者跟著歸零。
4. **字型：不載入任何網頁字。** 英文內文用裝置無襯線（Helvetica Neue／Segoe UI／Roboto／Arial，不放 `system-ui` 以免中文被系統字搶走），中文接 `--font-zh`；Material 元件的 `--mat-sys-*-font` 一併指向內文字（否則會是 `mat.theme()` 的 Inter）。數字與等寬用全站 `index.html` 已載入的 IBM Plex Mono：`.ui-text-numeric`、`.ui-text-display`、數字輸入；`body` 全面 `tabular-nums`。所以沒有 `_fonts.scss`。
5. **觸控尺寸**：互動元件可見尺寸全部 ≥ 24px（WCAG 2.5.8 AA）；按鈕、圖示按鈕、勾選欄、權限矩陣格子、選單項目 32–36px，未達 44px（2.5.5 AAA），記在質地準則。觸控為主的專案不建議預設用這個質地。

## 相容配色（提案，待使用者定案）

對比掃描（`contrast-report.mjs --textures=ledger`，一般文字 4.5:1、欄位／UI 邊界 3:1，每格 25 組 pair）**8 格全數合格**。第一次掃描時 Verdant、Cool Grey 不合格（資料表偶數列上的勾選框外框 2.98／2.77:1，斑馬紋讓底色變深），已在表格內就地把 `--app-field-border` 改成 `--mat-sys-on-surface-variant` 修正（只限 `.dt-table`／`.mat-mdc-table`／`.pm`）。另量了掃描腳本沒涵蓋的表格文字：表頭字對表頭底最低 4.67:1（Verdant），內文對斑馬紋最低 6.75:1（Cool Grey），勾選框對斑馬紋最低 4.95:1。

| 配色 | 最低 pair（比值／門檻） | 提案 |
| --- | --- | --- |
| Verdant | 欄位邊界 3.26／3 | 相容 |
| Midnight | 勾選底 3.69／3、選取文字 4.52／4.5 | 相容（深色終端機感） |
| Sandstone | 欄位邊界 4.62／3 | 相容 |
| Azure | 欄位邊界 3.99／3 | 相容，**預設** |
| Cool Grey | 勾選框外框 3.17／3 | 相容 |
| Candy | 欄位邊界 3.84／3 | **排除**（美感：高彩度糖果色與帳冊的冷靜數字感衝突） |
| Mist Ink | 欄位邊界 3.94／3 | 相容 |
| Glacier Blue | 欄位邊界 3.42／3 | 相容 |

白名單已寫進 `TEXTURE_COMPATIBILITY.ledger`（逐一列出 7 個）讓展示 app 先看得到；定案以那裡為準。

## 後果

- 1440×900、資料表頁、表頭捲到視窗頂端：完整可見的列數 Material 12 列 → Ledger 24 列（初始畫面 1 → 5 列）；Ledger 的 9 欄也不再需要橫向捲動。
- Bundle：`texture-ledger.css` 17.07 kB／gzip 3.13 kB（按需質地中最大，主因是逐一列出的 Material 字階與密度 token）。Admin 初始 bundle 650.59 → 650.77 kB（+0.18 kB，`theme.token.ts` 多一筆；`styles.css` 61.43 kB 不變），在 ±0.5 kB 內。其他 7 個按需質地的 CSS 逐位元組不變。
- 組合矩陣 9 × 8 = 72 格，相容 54 組。
- 驗收截圖：Material 元件總覽、資料表、載入／空白／錯誤、角色與權限頁（Ledger × Azure），元件總覽 × 其餘 6 個相容配色，對話框，以及資料表 Material 對 Ledger 的密度對照。
