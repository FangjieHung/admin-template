/**
 * 展示目錄的說明文字與規劃中清單。只給展示頁與首頁（lazy chunk）用，不放進 showcase-registry.ts，
 * 免得這些文字進 Initial bundle（esbuild 把非 ASCII 字元輸出成跳脫序列，每個中文字 6 bytes）。
 */

export interface ShowcaseDetail {
  /** 一句話說明用途（首頁元件表也用這句）。 */
  summary: string;
  /** 元件原始碼的位置。 */
  source: string;
}

export const SHOWCASE_DETAILS: Readonly<Record<string, ShowcaseDetail>> = {
  'material': {
    summary: '範本支援的 Angular Material 控制項與 ui-* class，各種狀態排在同一頁；也是質地的測試台。',
    source: 'libs/theme-pack/src/lib/styles',
  },
  'data-table': {
    summary: '清單頁的主體：分頁、排序、欄位選擇與拖曳排序、凍結識別欄、多選、匯出 Excel、手機卡片模式。',
    source: 'libs/ui/src/lib/data-table',
  },
  'page-toolbar': {
    summary: '放在頁首的搜尋框（可收合）與單選下拉篩選，顯示已套用的篩選數並可一鍵清除。',
    source: 'libs/ui/src/lib/page-toolbar、libs/ui/src/lib/filter/filter-select.component.ts',
  },
  'advanced-filter': {
    summary: '多條件 AND 篩選（文字、單選、多選、日期區間、數字區間），套用後以可移除的條件標籤呈現。',
    source: 'libs/ui/src/lib/filter',
  },
  'saved-views': {
    summary: '把排序、篩選、欄位與每頁筆數存成具名檢視，下次一鍵切換；預設存在瀏覽器、只給自己。',
    source: 'libs/ui/src/lib/saved-views',
  },
  'status-chip': {
    summary: '依狀態語意顯示 5 種色調的小標籤；顏色與造型交給配色與質地。',
    source: 'libs/ui/src/lib/status-chip',
  },
  'date-range-picker': {
    summary: '並排兩個月曆選起訖日，滑過時預覽區間；適合跨月的期間選擇。',
    source: 'libs/ui/src/lib/dual-month-range-picker',
  },
  'signature-pad': {
    summary: '手寫或打字簽名，存檔後只回傳不透明的資產代碼；可要求先勾選確認。',
    source: 'libs/ui/src/lib/signature-pad',
  },
  'language-switcher': {
    summary: '切換介面語言（示範繁中、英文、日文），連同日期與數字格式；附輕量的字典機制。',
    source: 'libs/ui/src/lib/i18n',
  },
  'confirm-dialog': {
    summary: '執行刪除等不可復原的動作前，再問一次；回傳使用者是否確認。',
    source: 'libs/ui/src/lib/confirm-dialog',
  },
  'responsive-panel': {
    summary: '寬螢幕是貼在內容旁的側板，窄螢幕自動變成全螢幕對話框；用來看詳情或編輯一筆資料。',
    source: 'libs/ui/src/lib/responsive-panel',
  },
  'scroll-shadow': {
    summary: '捲動容器上下還有內容時加上 class，讓樣式畫出提示陰影。',
    source: 'libs/ui/src/lib/scroll-shadow',
  },
  'appearance-panel': {
    summary: '浮在每一頁角落的面板，即時切換質地與配色；也是設定頁外觀選項的另一個入口。',
    source: 'libs/theme-pack/src/lib/floating-appearance-panel',
  },
};

export function detailOf(id: string): ShowcaseDetail {
  const detail = SHOWCASE_DETAILS[id];
  if (!detail) throw new Error(`showcase-catalog：找不到「${id}」的說明`);
  return detail;
}

export type PlannedKind = '元件' | '頁面樣板';

/** 規劃中的元件與頁面樣板（依 docs/plans/2026-10-13-template-pivot.md 與 ERP／CRM 缺口清單）。 */
export interface PlannedItem {
  title: string;
  kind: PlannedKind;
  priority: 'P0' | 'P1' | 'P2';
  summary: string;
}

export const PLANNED_ITEMS: readonly PlannedItem[] = [
  { title: '載入、空白、錯誤三態', kind: '元件', priority: 'P0', summary: '依內容形狀的骨架、空狀態（圖示＋說明＋主要動作）、錯誤與重試。' },
  { title: '提示訊息', kind: '元件', priority: 'P0', summary: '成功、資訊、警告、錯誤 4 類，底部置中、一次一則，最多一個動作（復原）。' },
  { title: '關聯選擇欄位', kind: '元件', priority: 'P0', summary: '輸入就搜尋，從大量資料裡挑一筆（客戶、專案、負責人）。' },
  { title: '詳情頁版型', kind: '元件', priority: 'P0', summary: '標題＋狀態＋主要動作＋分頁＋摘要側欄。' },
  { title: '權限控制', kind: '元件', priority: 'P0', summary: '路由守門、依權限隱藏或停用按鈕、沒有權限頁、切換身分小工具。' },
  { title: '數字小卡與圖表', kind: '元件', priority: 'P1', summary: '儀表板與報表的折線、長條、圓環。' },
  { title: '活動紀錄', kind: '元件', priority: 'P1', summary: '誰在何時改了什麼的時間軸。' },
  { title: '附件上傳與相機擷取', kind: '元件', priority: 'P1', summary: '拖放、預覽、進度、清單；手機可直接拍照。' },
  { title: '匯入精靈', kind: '元件', priority: 'P1', summary: '上傳 → 欄位對應 → 預覽驗證 → 匯入。' },
  { title: '通知中心', kind: '元件', priority: 'P1', summary: '鈴鐺、未讀數、通知清單。' },
  { title: '全域搜尋與指令面板', kind: '元件', priority: 'P1', summary: '⌘K 找資料、跳頁、執行動作。' },
  { title: '表格內直接編輯', kind: '元件', priority: 'P1', summary: '行內編輯與批次修改。' },
  { title: '共用日曆與排程', kind: '元件', priority: 'P1', summary: '月／週檢視與資源時間軸，含拖曳。' },
  { title: '看板', kind: '元件', priority: 'P1', summary: '卡片拖曳換欄。' },
  { title: '步驟精靈', kind: '元件', priority: 'P1', summary: '多步驟表單共用版：步驟清單、目前、已完成、錯誤。' },
  { title: '樹狀選單與樹狀表', kind: '元件', priority: 'P2', summary: '組織架構、分類。' },
  { title: '列印與 PDF 版面', kind: '元件', priority: 'P2', summary: '單據可列印、可寄送。' },
  { title: '富文字、留言與 @提及', kind: '元件', priority: 'P2', summary: '備註與內部協作。' },
  { title: '登入', kind: '頁面樣板', priority: 'P0', summary: '帳號密碼表單與錯誤狀態（不含真正的驗證）。' },
  { title: '列表頁', kind: '頁面樣板', priority: 'P0', summary: '頁首工具列＋資料表＋進階篩選＋已儲存檢視的組合。' },
  { title: '詳情頁', kind: '頁面樣板', priority: 'P0', summary: '套用詳情頁版型的一筆示範資料。' },
  { title: '表單頁', kind: '頁面樣板', priority: 'P0', summary: '分段表單、驗證與操作列。' },
  { title: '儀表板', kind: '頁面樣板', priority: 'P1', summary: '數字小卡、圖表與待辦清單。' },
  { title: '設定頁', kind: '頁面樣板', priority: 'P1', summary: '分組設定項與儲存提示。' },
  { title: '角色與權限矩陣', kind: '頁面樣板', priority: 'P0', summary: '功能 × 動作（檢視、建立、編輯、刪除、核准）的勾選矩陣。' },
  { title: '空白頁', kind: '頁面樣板', priority: 'P1', summary: '只有殼層的起點。' },
  { title: '錯誤頁（404、沒有權限）', kind: '頁面樣板', priority: 'P0', summary: '找不到頁面與沒有權限的說明與返回動作。' },
];
