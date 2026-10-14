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
  'activity-log': {
    summary: '「誰在何時改了什麼」的時間軸：依日期分組、相對時間、欄位的舊值與新值、留言、篩選與載入更多。',
    source: 'libs/ui/src/lib/activity-timeline',
  },
  'charts': {
    summary: '儀表板與報表的數字小卡（變化與迷你趨勢）、折線、長條、圓環：自己寫的輕量 SVG，顏色與造型跟著配色與質地；每張圖都能用鍵盤逐點查看、切成表格。',
    source: 'libs/ui/src/lib/stat-card、line-chart、bar-chart、donut-chart、chart-core',
  },
  'detail-layout': {
    summary: '打開一筆資料的整頁骨架：標題、狀態、主要動作、分頁與摘要側欄；窄螢幕自動重排，捲動時頁首縮成精簡列。',
    source: 'libs/ui/src/lib/detail-layout',
  },
  'relation-select': {
    summary: '輸入就搜尋，從大量資料裡挑一筆（負責人、專案、聯絡人）；表單存 id，初始值自動查出名稱，找不到時可以當場建立。',
    source: 'libs/ui/src/lib/relation-select',
  },
  'step-wizard': {
    summary: '把長表單拆成幾步填：線性時下一步先驗證、錯誤時列出要修正的欄位，已完成的步驟可以點回去；窄容器自動收成「步驟 2／4」精簡列。',
    source: 'libs/ui/src/lib/step-wizard',
  },
  'date-range-picker': {
    summary: '並排兩個月曆選起訖日，滑過時預覽區間；適合跨月的期間選擇。',
    source: 'libs/ui/src/lib/dual-month-range-picker',
  },
  'file-upload': {
    summary: '拖放、選擇或貼上檔案，逐一上傳並顯示進度，可以取消、重試、移除；手機直接拍照，桌機用網路攝影機。表單只存已上傳的檔案參照，詳情頁用唯讀模式列出附件。',
    source: 'libs/ui/src/lib/file-upload',
  },
  'signature-pad': {
    summary: '手寫或打字簽名，存檔後只回傳不透明的資產代碼；可要求先勾選確認。',
    source: 'libs/ui/src/lib/signature-pad',
  },
  'language-switcher': {
    summary: '切換介面語言（示範繁中、英文、日文），連同日期與數字格式；附輕量的字典機制。',
    source: 'libs/ui/src/lib/i18n',
  },
  'feedback-states': {
    summary: '資料還沒到、沒有資料、載入失敗時的畫面：依內容形狀的骨架、空狀態（圖示＋說明＋一個動作）、錯誤與重試，以及自動切換三者的外框。',
    source: 'libs/ui/src/lib/feedback-state',
  },
  'toast': {
    summary: '操作後的簡短提示：成功、資訊、警告、錯誤 4 類，底部置中、一次一則，最多一個動作（例如復原）；錯誤要手動關閉。',
    source: 'libs/ui/src/lib/toast',
  },
  'confirm-dialog': {
    summary: '執行刪除等不可復原的動作前，再問一次；影響很大的動作可以要求先輸入確認字樣。回傳使用者是否確認。',
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
  'access-control': {
    summary: '依權限決定畫面：路由守門（直接開網址顯示「沒有權限」）、按鈕依權限隱藏或停用＋提示需要的角色、側欄只列出看得到的頁面。純前端只能隱藏畫面，不是安全防護。',
    source: 'libs/access/src/lib',
  },
  'roles': {
    summary: '角色與權限的管理頁樣板：預設角色唯讀、複製成自訂角色再修改，功能 × 動作的權限矩陣，以及指派角色給使用者。',
    source: 'libs/access/src/lib/permission-matrix、apps/admin/src/app/features/roles',
  },
  'error-pages': {
    summary: '找不到頁面（404）與沒有權限兩個錯誤頁樣板：說明發生什麼事、可以怎麼辦，以及「回首頁」。',
    source: 'libs/access（沒有權限的守門）、apps/admin/src/app/features/errors',
  },
  'dashboard': {
    summary: '儀表板樣板：期間切換（7 天／30 天／本季，寫在網址上）、4 張數字小卡、新增與結案趨勢、依狀態與分類的分布、指派給我的待辦。',
    source: 'libs/ui（stat-card、line-chart、donut-chart、bar-chart）、apps/admin/src/app/features/dashboard',
  },
  'ticket-list': {
    summary: '工單列表樣板：頁首工具列（搜尋、狀態）、進階篩選、已儲存檢視、資料表（分頁、排序、欄位選擇、多選批次操作），篩選與頁碼同步到網址。',
    source: 'libs/ui（data-table、page-toolbar、filter、saved-views）、apps/admin/src/app/features/tickets/ticket-list',
  },
  'ticket-detail': {
    summary: '工單詳情樣板：詳情頁版型、描述清單、活動紀錄，編輯、指派、關閉、刪除都會記進活動紀錄；找不到工單有專屬畫面。',
    source: 'libs/ui（detail-layout、description-list、activity-timeline）、apps/admin/src/app/features/tickets/ticket-detail',
  },
  'ticket-form': {
    summary: '工單表單樣板：分段表單、欄位驗證與錯誤摘要、底部固定的操作列，未存檔離開會先確認；新增與編輯共用。',
    source: 'libs/ui（relation-select、confirm-dialog、toast）、apps/admin/src/app/features/tickets/ticket-form',
  },
  'login': {
    summary: '登入樣板：帳號密碼、顯示密碼、記住我、送出中與錯誤訊息（帳密錯誤、帳號鎖定）；示範帳號登入後切換成對應的身分。',
    source: 'libs/access（示範身分）、apps/admin/src/app/features/auth',
  },
  'settings-template': {
    summary: '設定頁樣板：分組導覽同步到網址（個人資料、通知、安全性、偏好、進階），示範明確存檔（未儲存列、離開前確認）與即時儲存（失敗時還原）兩種模式，以及要輸入確認字樣的刪除帳號。',
    source: 'libs/ui（confirm-dialog、toast）、apps/admin/src/app/features/account-settings',
  },
  'blank-page': {
    summary: '空白頁樣板：只有殼層、頁首與一張空卡片，附上開新頁面的四個步驟與程式碼片段；整個樣板只有一個檔案。',
    source: 'libs/theme-pack（.ui-card）、apps/admin/src/app/features/blank-page',
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
  { title: '匯入精靈', kind: '元件', priority: 'P1', summary: '上傳 → 欄位對應 → 預覽驗證 → 匯入。' },
  { title: '通知中心', kind: '元件', priority: 'P1', summary: '鈴鐺、未讀數、通知清單。' },
  { title: '全域搜尋與指令面板', kind: '元件', priority: 'P1', summary: '⌘K 找資料、跳頁、執行動作。' },
  { title: '表格內直接編輯', kind: '元件', priority: 'P1', summary: '行內編輯與批次修改。' },
  { title: '共用日曆與排程', kind: '元件', priority: 'P1', summary: '月／週檢視與資源時間軸，含拖曳。' },
  { title: '看板', kind: '元件', priority: 'P1', summary: '卡片拖曳換欄。' },
  { title: '樹狀選單與樹狀表', kind: '元件', priority: 'P2', summary: '組織架構、分類。' },
  { title: '列印與 PDF 版面', kind: '元件', priority: 'P2', summary: '單據可列印、可寄送。' },
  { title: '富文字、留言與 @提及', kind: '元件', priority: 'P2', summary: '備註與內部協作。' },
];
