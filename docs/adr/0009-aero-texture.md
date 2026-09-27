# ADR 0009：Aero 雲霧玻璃質地

- 狀態：已實作
- 日期：2026-09-28

## 決策

依使用者提供的工作台參考圖，新增 `aero` 質地。其特徵是高亮度的冷色雲霧背景、64% 透明面板、清楚的頂部亮邊、短而淡的投影，以及半透明淡色側欄。它與 `frosted` 的差異在於：Frosted 偏向磨砂金融面板與主色上方光暈；Aero 讓多個低彩度雲光穿過較透明的面板，形成更開闊、接近作業系統工作台的感受。

質地只定義圓角、層次、透明度、背景模糊、字體與元件 recipe；所有顏色從既有語意 token 取得。`prefers-reduced-transparency` 時面板回到實色並停用背景模糊，欄位邊界仍使用 `--app-field-border`，焦點與動態維持 ADR 0008 的用途變數規則。

## 相容配色

只開放 Azure、Cool Grey、Mist Ink、Glacier Blue，預設 Glacier Blue。這四組都有冷調、明亮的畫布，能保留雲霧玻璃的透光與文字對比；Verdant、Midnight、Sandstone、Candy 不出現在 Aero 的選項中。白名單唯一來源為 `TEXTURE_COMPATIBILITY.aero`。

## 驗收範圍

- 儀表板、訂單列表、建單表單、日曆與對話框各以四個相容配色檢查。
- 欄位邊界、一般與次要文字、焦點框、控制項維持現有可及性 token。
