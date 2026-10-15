import type { Observable } from 'rxjs';
import type { DataTableCellValue, DataTableKey } from '../data-table/data-table.types';

/** 節點的唯一鍵（展開、勾選、目前項目都用它記）。 */
export type TreeKey = string | number;

/**
 * 選取模式：
 * - `none`：只能展開收合；點擊或 Enter 仍會送出 `(activate)`。
 * - `single`：「目前項目」——點擊、Enter 或空白鍵讓節點成為目前項目（`currentKey`）並送出 `(activate)`。
 * - `multiple`：每個節點前有勾選框，父節點三態（全勾、半勾、未勾），見 `TreeComponent` 的勾選規則。
 */
export type TreeSelectionMode = 'none' | 'single' | 'multiple';

/** 勾選框的三種狀態；`mixed` 是「部分子孫有勾」的半勾。 */
export type TreeCheckState = 'checked' | 'unchecked' | 'mixed';

/** 延遲載入子節點：回傳 Promise 或 Observable（取第一個值）。丟出錯誤或 reject 時，節點下方顯示錯誤與「重試」。 */
export type TreeLoadChildren<T> = (node: T) => Promise<readonly T[]> | Observable<readonly T[]>;

/** 搜尋用的謂詞：回 true 的節點保留（它的祖先也保留並自動展開）。 */
export type TreeFilter<T> = (node: T) => boolean;

/**
 * 伺服器端搜尋的一筆結果：符合的節點，加上從第一層到它的父節點的鍵（不含它自己；第一層的節點給空陣列）。
 * 元件照這條路徑一層一層呼叫 loadChildren，讓還沒載入的結果也出現在樹裡。
 */
export interface TreeSearchMatch {
  key: TreeKey;
  ancestors: readonly TreeKey[];
}

/**
 * 伺服器端搜尋（使用端實作）：回傳符合 query 的節點與它們的祖先路徑。Promise 或 Observable（取第一個值）。
 * 搜尋字換了，上一次還沒回來的結果會被丟掉；Observable 會被取消訂閱。
 */
export type TreeServerSearch = (query: string) => Promise<readonly TreeSearchMatch[]> | Observable<readonly TreeSearchMatch[]>;

/** `expandAll()` 的選項（延遲載入的樹才用得到）。 */
export interface TreeExpandAllOptions {
  /** 這一次最多載入幾個延遲節點（成功＋失敗），預設 50；到了就停，其餘維持收合。 */
  maxLoads?: number;
  /** 同時最多幾個載入請求，預設 3。 */
  concurrency?: number;
}

/** `expandAll()` 進行中的進度（`expandAllProgress()`）。 */
export interface TreeExpandAllProgress {
  /** 載入成功的節點數。 */
  loaded: number;
  /** 載入失敗的節點數（它們展開並顯示錯誤與重試）。 */
  failed: number;
  /** 正在等回應的請求數。 */
  pending: number;
  /** 已經到了 maxLoads，還有沒載入的節點。 */
  limitReached: boolean;
}

/** `expandAll()` 完成（或停止）時的結果。 */
export interface TreeExpandAllResult {
  loaded: number;
  failed: number;
  limitReached: boolean;
  /** 被 `cancelExpandAll()`（或再呼叫一次 expandAll、元件銷毀）停掉。 */
  cancelled: boolean;
}

interface TreeTableColumnBase {
  /** 欄位標題。 */
  label: string;
  align?: 'start' | 'end';
  /** 欄寬（CSS 長度，例如 `'8rem'`）；不給就依內容。 */
  width?: string;
}

/** 一般欄位：key 必須是資料列的屬性（同 data-table 的 `DataTableFieldColumn`）；`value` 可以改寫顯示文字。 */
export interface TreeTableFieldColumn<T> extends TreeTableColumnBase {
  key: DataTableKey<T>;
  virtual?: false;
  value?: (row: T) => DataTableCellValue;
}

/** 虛擬欄（計算欄）：key 只是欄位識別，顯示文字由 `value` 或 `dtCell` 範本提供。 */
export interface TreeTableVirtualColumn<T> extends TreeTableColumnBase {
  key: string;
  virtual: true;
  value?: (row: T) => DataTableCellValue;
}

/**
 * 樹狀表的欄位定義：寫法沿用 data-table（key 綁資料列的屬性、`<ng-template dtCell="key" let-row>` 自訂儲存格）。
 * 第一欄自動帶縮排與展開鈕。樹狀表不做排序、分頁、固定欄設定、欄位選擇與表格內編輯，所以沒有那些欄位屬性。
 */
export type TreeTableColumn<T> = TreeTableFieldColumn<T> | TreeTableVirtualColumn<T>;
