/** 一般欄位只能用資料列真的有的屬性名稱：打錯字（`'vehicleld'`）在編譯期就擋下，不會默默變成空白欄。 */
export type DataTableKey<T> = Extract<keyof T, string>;

/** 儲存格的預設顯示值與虛擬欄的 `value` 回傳型別。 */
export type DataTableCellValue = string | number | null | undefined;

/** 匯出到 Excel 的值：數字保留成數字（可加總），其餘一律字串。 */
export type DataTableExportValue = string | number;

/** 排序用的值。null／undefined／空字串永遠排在最後（不論遞增或遞減）。 */
export type DataTableSortValue = string | number | boolean | Date | null | undefined;

interface DataTableColumnBase {
  label: string;
  /** 手機版卡片收合時仍顯示。整份 columns 都沒標時，第一欄自動視為 primary。 */
  primary?: boolean;
  align?: 'start' | 'end';
  /** 不納入匯出（actions 欄用）。 */
  exportSkip?: boolean;
  /**
   * 固定在左側：橫向捲動時不跟著捲（識別欄，例如單號）。只有排在最前面的那一個 frozen 欄有效，
   * 它在欄位選擇面板裡不能隱藏、不能移動。
   */
  frozen?: boolean;
  /** false：欄位選擇面板裡不能隱藏這一欄（frozen 欄一律不能隱藏）。 */
  hideable?: boolean;
}

/**
 * 一般欄位：key 必須是資料列的屬性。未提供 exportValue 時匯出取 row[key]；
 * 排序（開啟 [sortable] 時）預設也取 row[key]，畫面顯示與原始值不同（例如 id 顯示成名稱）時要給 sortValue。
 */
export interface DataTableFieldColumn<T, K extends DataTableKey<T> = DataTableKey<T>>
  extends DataTableColumnBase {
  key: K;
  virtual?: false;
  exportValue?: (row: T) => DataTableExportValue;
  /** false：此欄不能排序。一般欄位預設可排序。 */
  sortable?: boolean;
  sortValue?: (row: T) => DataTableSortValue;
}

/** 虛擬欄的取值：要嘛給 value（畫面預設文字，也是匯出的預設值），要嘛給 exportValue，要嘛整欄不匯出。 */
type DataTableVirtualValue<T> =
  | { value: (row: T) => DataTableCellValue; exportValue?: (row: T) => DataTableExportValue }
  | { value?: (row: T) => DataTableCellValue; exportValue: (row: T) => DataTableExportValue }
  | {
      value?: (row: T) => DataTableCellValue;
      exportValue?: (row: T) => DataTableExportValue;
      exportSkip: true;
    };

/** 虛擬欄沒有原始值可排，要排序就一定要給 sortValue（`sortable: true` 卻沒給 sortValue 會編譯失敗）。 */
type DataTableVirtualSort<T> =
  | { sortable?: false; sortValue?: undefined }
  | { sortable?: boolean; sortValue: (row: T) => DataTableSortValue };

/**
 * 虛擬欄（計算欄、操作欄）：key 不是資料列的屬性，只是欄位識別（dtCell、欄位偏好、排序都用它）。
 * 必須寫 `virtual: true`，並提供 value／exportValue（或 exportSkip）。
 */
export type DataTableVirtualColumn<T> = DataTableColumnBase & {
  key: string;
  virtual: true;
} & DataTableVirtualValue<T> &
  DataTableVirtualSort<T>;

/** 標準模式的欄位定義。label 是欄位標題的唯一來源，元件會自動寫進 td 的 data-label。 */
export type DataTableColumn<T> = DataTableFieldColumn<T> | DataTableVirtualColumn<T>;

export type DataTableSortDirection = 'asc' | 'desc';

/** 單欄排序（不做多欄排序）。key 是欄位的 key。 */
export interface DataTableSort {
  key: string;
  direction: DataTableSortDirection;
}

/**
 * 使用者對欄位的偏好：順序與隱藏的欄位（都用欄位 key）。null＝預設（columns 的原始順序、全部顯示）。
 * 只記使用者動過的結果；新增的欄位不在 order 裡時排在最後並顯示，已移除的 key 直接忽略。
 */
export interface DataTableColumnPrefs {
  order: string[];
  hidden: string[];
}

/**
 * 資料查詢契約：日後改成伺服器端分頁時，後端吃這個、回 DataTablePage；
 * 目前一律用 `applyClientQuery()`（data-table-query.ts）在前端做同一件事。
 * filters 的型別由使用端決定（advanced-filter 的 FilterCondition[]）。
 */
export interface DataTableQuery<F = unknown> {
  /** 從 0 起算。 */
  page: number;
  pageSize: number;
  sort: DataTableSort | null;
  filters: F;
}

export interface DataTablePage<T> {
  /** 這一頁的資料列。 */
  rows: readonly T[];
  /** 篩選後的總筆數（不是這一頁的筆數）。 */
  total: number;
}

/** 資料來源：前端版本見 `createClientDataSource()`；後端版本實作同一個介面即可替換。 */
export interface DataTableDataSource<T, F = unknown> {
  query(query: DataTableQuery<F>): Promise<DataTablePage<T>>;
  /** 匯出用：篩選＋排序後的完整資料（不分頁）。 */
  queryAll(query: Omit<DataTableQuery<F>, 'page' | 'pageSize'>): Promise<readonly T[]>;
}

/** 分頁列的文字。`{from}`、`{to}`、`{total}`、`{size}`、`{shown}`、`{page}`、`{pages}` 會換成數字。 */
export interface DataTablePagingLabels {
  /** 分頁區塊的無障礙名稱，例：「分頁」。 */
  nav: string;
  /** 每頁筆數下拉的名稱，例：「每頁筆數」。 */
  pageSizeLabel: string;
  /** 每個選項的文字，例：「每頁 {size} 筆」。 */
  pageSizeOption: string;
  /** 例：「第 {from}–{to} 筆，共 {total} 筆」。 */
  range: string;
  /** 例：「第 {page} / {pages} 頁」。 */
  pageOf: string;
  firstPage: string;
  prevPage: string;
  nextPage: string;
  lastPage: string;
  /** 手機卡片版取代分頁鈕，例：「載入更多」。 */
  loadMore: string;
  /** 例：「已顯示 {shown} / {total} 筆」。 */
  shownOf: string;
}

/** 欄位選擇面板的文字。`{label}` 會換成欄位名稱。 */
export interface DataTableColumnChooserLabels {
  /** 開面板的按鈕，例：「顯示欄位」。 */
  trigger: string;
  /** 面板標題，例：「顯示欄位」。 */
  title: string;
  /** 例：「恢復預設」。 */
  reset: string;
  /** 例：「上移{label}」。 */
  moveUp: string;
  /** 例：「下移{label}」。 */
  moveDown: string;
  /** 拖曳把手的無障礙名稱，例：「拖曳調整{label}的順序」。 */
  dragHandle: string;
  /** 固定欄的說明，例：「固定欄」。 */
  frozen: string;
  /** 例：「關閉」。 */
  close: string;
}

/** 元件本身不內建字串，全部由使用端傳入。 */
export interface DataTableLabels {
  exportExcel: string;
  selectAll: string;
  deselectAll: string;
  selectRow: string;
  batchDelete: string;
  selectedCount: string;
  exportSelected: string;
  expandRow: string;
  collapseRow: string;
  /**
   * 匯出失敗時要顯示給使用者看的文案（例如 xlsx 這個 lazy chunk 載入失敗）。
   * 元件本身不使用這個欄位——它只透過 exportFailed 把原始 Error 丟給使用端，
   * 由使用端的 onExportFailed 從這裡取用文案顯示，避免把 e.message 這種內部
   * 錯誤字串（甚至是英文的 dynamic import 失敗訊息）直接餵給使用者。
   */
  exportFailedText: string;
  /** 開啟 [loading] 時報讀器念的文字，例：「載入中」（畫面上看不到）。沒給時只標 aria-busy。 */
  loading?: string;
  /** 開啟 [pageable] 時必填。 */
  paging?: DataTablePagingLabels;
  /** 開啟 [columnChooser] 時必填。 */
  columnChooser?: DataTableColumnChooserLabels;
}

export type DataTableMobileMode = 'cards' | 'scroll';
