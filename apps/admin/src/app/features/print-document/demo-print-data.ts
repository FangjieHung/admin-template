import type { PrintSummaryRow, PrintTableColumn } from '@admin-template/ui';

/**
 * 列印版面展示頁的示範資料（中性：資訊服務的報價與領料）。金額是整數元，千分位由 formatAmount 處理。
 */

export interface QuoteLine {
  name: string;
  /** 第二行的說明（規格、範圍）。 */
  detail: string;
  qty: number;
  unit: string;
  price: number;
}

export interface PartLine {
  name: string;
  spec: string;
  qty: number;
  unit: string;
}

export function formatAmount(value: number): string {
  return value.toLocaleString('en-US');
}

/** 服務報價單：30 列，A4 直式會跨到第 2 頁。 */
export const QUOTE_LINES: readonly QuoteLine[] = [
  { name: '需求訪談與現況盤點', detail: '兩個辦公室，含網路拓撲與設備清冊', qty: 1, unit: '式', price: 18000 },
  { name: '網路設備巡檢', detail: '交換器、無線基地台、防火牆設定檢查', qty: 12, unit: '台', price: 800 },
  { name: '無線基地台更換', detail: '舊機拆除、新機安裝與訊號調校', qty: 6, unit: '台', price: 4200 },
  { name: '機櫃整線', detail: '標籤、理線、跳線更換', qty: 2, unit: '櫃', price: 6500 },
  { name: '不斷電系統電池更換', detail: '含舊電池回收', qty: 4, unit: '組', price: 3600 },
  { name: '伺服器韌體更新', detail: '停機時段施作，含更新前備份', qty: 3, unit: '台', price: 2500 },
  { name: '備份排程設定', detail: '每日增量、每週完整，保留 30 天', qty: 1, unit: '式', price: 9000 },
  { name: '還原演練', detail: '抽選三份資料實際還原並記錄時間', qty: 1, unit: '次', price: 6000 },
  { name: '筆電健檢', detail: '電池、硬碟健康度、系統更新', qty: 25, unit: '台', price: 450 },
  { name: '筆電電池更換', detail: '原廠規格電池', qty: 5, unit: '顆', price: 2800 },
  { name: '固態硬碟升級', detail: '1 TB，含資料搬移', qty: 8, unit: '台', price: 3900 },
  { name: '記憶體擴充', detail: '16 GB 模組', qty: 10, unit: '條', price: 1600 },
  { name: '作業系統重新安裝', detail: '含驅動程式與常用軟體', qty: 4, unit: '台', price: 1500 },
  { name: '帳號權限盤點', detail: '離職帳號停用、群組權限整理', qty: 1, unit: '式', price: 7500 },
  { name: '多因素驗證導入', detail: '設定與使用者說明', qty: 40, unit: '人', price: 150 },
  { name: '郵件過濾規則調整', detail: '垃圾信與釣魚信規則', qty: 1, unit: '式', price: 4000 },
  { name: '端點防護授權', detail: '一年期', qty: 45, unit: '套', price: 680 },
  { name: '端點防護部署', detail: '遠端派送與例外設定', qty: 45, unit: '台', price: 120 },
  { name: '印表機驅動與佈署', detail: '多功能事務機，含掃描到資料夾', qty: 3, unit: '台', price: 1200 },
  { name: '會議室視訊設備調校', detail: '鏡頭、麥克風、投影切換', qty: 2, unit: '間', price: 3500 },
  { name: '網路線新增佈線', detail: 'Cat 6，含面板與測試報告', qty: 14, unit: '點', price: 1100 },
  { name: '訪客網路隔離', detail: '獨立 VLAN 與頻寬限制', qty: 1, unit: '式', price: 5500 },
  { name: '防火牆規則整理', detail: '移除過期規則、加上說明', qty: 1, unit: '式', price: 8000 },
  { name: '遠端連線設定', detail: 'VPN 帳號與連線說明文件', qty: 20, unit: '人', price: 300 },
  { name: '資產標籤製作', detail: '條碼標籤，含建檔', qty: 120, unit: '張', price: 25 },
  { name: '資產清冊建檔', detail: '型號、序號、保固到期日', qty: 1, unit: '式', price: 6000 },
  { name: '使用者教育訓練', detail: '資安意識，2 小時', qty: 2, unit: '場', price: 7000 },
  { name: '操作手冊撰寫', detail: '備份還原、帳號申請流程', qty: 1, unit: '份', price: 9500 },
  { name: '駐點支援', detail: '每週一天，共四週', qty: 4, unit: '天', price: 6800 },
  { name: '結案報告', detail: '施作紀錄、照片與建議事項', qty: 1, unit: '份', price: 5000 },
];

export const QUOTE_COLUMNS: readonly PrintTableColumn<QuoteLine>[] = [
  { key: 'no', label: '項次', align: 'center', width: '11mm', value: (_row, i) => i + 1 },
  { key: 'name', label: '品項／說明' },
  { key: 'qty', label: '數量', align: 'end', width: '15mm' },
  { key: 'unit', label: '單位', align: 'center', width: '13mm' },
  { key: 'price', label: '單價', align: 'end', width: '22mm', value: (row) => formatAmount(row.price) },
  { key: 'amount', label: '金額', align: 'end', width: '26mm', value: (row) => formatAmount(row.qty * row.price) },
];

/** 小計、5% 營業稅、合計。 */
export function quoteSummary(lines: readonly QuoteLine[]): PrintSummaryRow[] {
  const subtotal = lines.reduce((sum, line) => sum + line.qty * line.price, 0);
  const tax = Math.round(subtotal * 0.05);
  return [
    { label: '小計', value: formatAmount(subtotal) },
    { label: '營業稅（5%）', value: formatAmount(tax) },
    { label: '合計（新臺幣）', value: formatAmount(subtotal + tax), emphasis: true },
  ];
}

/** 零件領用單：只有 3 列的短單據。 */
export const PART_LINES: readonly PartLine[] = [
  { name: '網路線', spec: 'Cat 6，3 公尺', qty: 4, unit: '條' },
  { name: '電源延長線', spec: '六孔，附開關', qty: 2, unit: '條' },
  { name: '無線滑鼠', spec: '2.4 GHz 接收器', qty: 1, unit: '個' },
];

export const PART_COLUMNS: readonly PrintTableColumn<PartLine>[] = [
  { key: 'name', label: '品名' },
  { key: 'spec', label: '規格' },
  { key: 'qty', label: '數量', align: 'end', width: '18mm' },
  { key: 'unit', label: '單位', align: 'center', width: '14mm' },
];

export function partSummary(lines: readonly PartLine[]): PrintSummaryRow[] {
  return [{ label: '合計數量', value: String(lines.reduce((sum, line) => sum + line.qty, 0)), emphasis: true }];
}
