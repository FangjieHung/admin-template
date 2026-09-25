# 雙軸主題術語表（草案）

| 術語 | 本專案意義 | 目前實作 |
| --- | --- | --- |
| 質地（texture / paradigm） | 與配色分離的造型軸，控制圓角、陰影、字體、背景紋理及元件 recipe | `data-paradigm`、`styles/texture/*`；Material、Linen、Grid、Soft UI、Clay、Editorial、Frosted |
| 配色（color-theme） | 與質地分離的色彩軸，提供語意化的介面色、狀態色和圖表色 | `data-theme`、`styles/color-themes/*`；Verdant、Midnight、Sandstone、Azure、Cool Grey、Candy、Mist Ink、Glacier Blue |
| recipe | 某種質地對共用 `ui-*` class 與 Material 元件的具體造型規則 | card、form、datepicker、buttons、table、status、typography |
| 語意 token | 元件可引用的顏色或造型變數；名稱表達用途而非特定色階 | `--mat-sys-*`、`--app-*`、字體變數 |
| 底層色階 | 配色包內部組色的私有變數，不讓元件直接使用 | 例如 `--_sage-600` |
| 組合矩陣 | 每種質地與每種配色的笛卡兒積；只有「相容」的格子保證能正常呈現與閱讀 | 7 × 8，共 56 種 |
| 相容配色 | 某個質地允許搭配的配色清單（白名單）；不在清單內的配色不會出現在該質地的選項中。新增配色時預設不相容，需逐一加入。質地是主軸：質地選項永遠全部顯示，配色依質地過濾（見 ADR 0007） | 規劃中 |
| 預設配色 | 每個質地指定的一個相容配色；切換質地時若目前配色不相容，或載入時已存的組合不相容，就改用它 | 規劃中 |
| 質地準則（design guideline） | 每個質地的設計準則文件，說明該質地的造型語言與禁忌；新增頁面或元件時必須參照 | 規劃中 |
| 套用範圍 | 哪些 app 載入主題 CSS、提供選項並允許執行期切換 | Admin 完整切換；Booking / Affiliate 固定配色 |
| 外觀浮動面板 | 在設定頁開啟後，於每一頁角落常駐的小面板，可即時切換質地與配色 | 規劃中；先接 Admin |
| 背景紋理 | 質地軸的一種造型，例如低對比紙感或網格；不能承載狀態意義或降低文字可讀性 | Linen 紙感、Grid 網格只作用於頁面底層 |
| 視覺密度 | 元件內距、列高與內容容納量；不改業務資料或資訊順序 | Grid 只調元件內距和表格列高 |
