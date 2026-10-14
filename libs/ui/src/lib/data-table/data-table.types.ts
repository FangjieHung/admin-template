import type { RelationSource } from '../relation-select/relation-source';

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
  /** 表格內直接編輯：給了就能在儲存格裡改 row[key]（見 DataTableEditor）。 */
  editor?: DataTableEditor<T>;
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
  /**
   * 虛擬欄也能編輯，但要用 `field` 指明改的是哪個屬性（例：顯示負責人名字的欄，改的是 `assigneeId`）。
   * 畫面照舊用 value／dtCell 顯示，編輯器讀寫 row[field]。
   */
  editor?: DataTableEditor<T> & { field: DataTableKey<T> };
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
  /** 任何一欄有 editor（表格內直接編輯）時必填。 */
  editing?: DataTableEditingLabels;
}

export type DataTableMobileMode = 'cards' | 'scroll';

// ---- 表格內直接編輯 ----

/** 編輯器的種類：文字、數字、下拉選項、日期（YYYY-MM-DD）、關聯（relation-select）、開關（布林）。 */
export type DataTableEditorType = 'text' | 'number' | 'select' | 'date' | 'relation' | 'toggle';

/** 下拉選項（`type: 'select'`）的一個選項。貼上時比對 label 或 value 的文字。 */
export interface DataTableEditorOption {
  value: string | number | boolean | null;
  label: string;
}

interface DataTableEditorBase<T> {
  /** 不能是空的（空字串、null）。訊息用 labels.editing.required。 */
  required?: boolean;
  /**
   * 額外的檢查：回傳要顯示的錯誤訊息，或 null（通過）。`value` 是轉換後的值（數字欄是 number、日期是 'YYYY-MM-DD'），
   * `row` 是改之前的那一列。即時儲存時有錯就留在編輯狀態；批次修改時標成錯誤、擋下「儲存全部」。
   */
  validate?(value: unknown, row: T): string | null;
  /** 這一列能不能改（例：已結案、沒有權限）。不能改的格子 aria-readonly，沒有編輯提示。 */
  canEdit?(row: T): boolean;
  /** 把輸入或貼上的文字轉成值（取代預設轉換）。丟出 Error 時，它的 message 就是這一格的錯誤訊息。 */
  parse?(text: string): unknown;
  /** 把值轉成編輯器裡的文字（預設 String(value)）。 */
  format?(value: unknown): string;
  /** 編輯器的提示文字。 */
  placeholder?: string;
}

/** 欄位的編輯器設定（欄位層級開啟，沒給的欄位維持唯讀）。 */
export type DataTableEditor<T> =
  | (DataTableEditorBase<T> & { type: 'text' | 'number' | 'date' | 'toggle' })
  | (DataTableEditorBase<T> & { type: 'select'; options: readonly DataTableEditorOption[] })
  | (DataTableEditorBase<T> & {
      type: 'relation';
      /** relation-select 的資料來源；值是 `idOf(item)`。 */
      source: RelationSource<unknown>;
      /** 選項與輸入框顯示的文字（也用來比對貼上的文字）。 */
      displayWith(item: unknown): string;
      /** 選項第二行的灰字。 */
      secondaryWith?(item: unknown): string;
    });

/**
 * 儲存方式：
 * - `instant`：改一格存一格（`onCellSave`），失敗時還原並提示重試；成功後提示可以復原。
 * - `batch`：改過的格子先標成「已修改」，按「儲存全部」才一次送出（`onBatchSave`）；可以從 Excel 貼上一整塊。
 */
export type DataTableEditMode = 'instant' | 'batch';

/** 改了一格：哪一列、哪個屬性、新值與原本的值。 */
export interface DataTableCellChange<T> {
  row: T;
  key: DataTableKey<T>;
  value: unknown;
  previous: unknown;
}

/**
 * 即時儲存一格：存好就 resolve（可以回傳存好的那一列，表格會先顯示它，直到 rows 更新）；失敗就 reject
 * （reject 一個字串時，那句話會顯示在格子裡；其他錯誤顯示 labels.editing.saveFailed）。
 * 同一格又改了時，上一次的 `signal` 會 abort。
 */
export type DataTableCellSaveFn<T> = (row: T, key: DataTableKey<T>, value: unknown, signal: AbortSignal) => Promise<void | T>;

/** 批次儲存：resolve 後清掉「已修改」標記；reject 時修改保留，提示儲存失敗。 */
export type DataTableBatchSaveFn<T> = (changes: readonly DataTableCellChange<T>[]) => Promise<void>;

/**
 * 表格內直接編輯的畫面文字（任何一欄有 editor 時必填，少一句會丟出錯誤）。
 * `{column}` 換成欄位名稱、`{row}` 換成這一列的識別（第一欄的文字）、`{count}` 換成數量、`{text}` 換成輸入的文字。
 */
export interface DataTableEditingLabels {
  /** 編輯器的無障礙名稱，例：「修改{row}的{column}」。 */
  editCell: string;
  /** 在不能改的格子按 Enter 時念的話，例：「這一格不能修改」。 */
  readOnly: string;
  /** 例：「必填」。 */
  required: string;
  /** 例：「請輸入數字」。 */
  invalidNumber: string;
  /** 例：「請輸入日期，例如 2026-10-14」。 */
  invalidDate: string;
  /** 貼上的文字不是任何一個選項，例：「「{text}」不是可選的值」。 */
  invalidOption: string;
  /** 貼上的文字找不到對應的資料（關聯欄），例：「找不到「{text}」」。 */
  notFound: string;
  /** 開關欄的兩個狀態，例：「是」、「否」。 */
  toggleOn: string;
  toggleOff: string;
  /** 即時儲存中，例：「儲存中」。 */
  saving: string;
  /** 存好了（提示訊息與報讀器），例：「已儲存{column}」。 */
  saved: string;
  /** 格子裡的失敗說明，例：「儲存失敗，已還原」。 */
  saveFailed: string;
  /** 失敗的提示訊息，例：「{column}儲存失敗」。 */
  saveFailedToast: string;
  /** 例：「重試」。 */
  retry: string;
  /** 例：「復原」。 */
  undo: string;
  /** 例：「已復原{column}」。 */
  undone: string;
  /** 已修改的格子給報讀器的說明（畫面上是角落的標記），例：「已修改」。 */
  dirty: string;
  /** 批次列，例：「已修改 {count} 格」。 */
  dirtyCount: string;
  /** 批次列，例：「有 {count} 個錯誤」。 */
  errorCount: string;
  /** 例：「捨棄」。 */
  discard: string;
  /** 例：「儲存全部」。 */
  saveAll: string;
  /** 例：「跳到下一個錯誤」。 */
  nextError: string;
  /** 批次列的無障礙名稱，例：「未儲存的修改」。 */
  barLabel: string;
  /** 例：「已儲存 {count} 格」。 */
  batchSaved: string;
  /** 例：「儲存失敗，修改的內容還在」。 */
  batchSaveFailed: string;
  /** 例：「已捨棄修改」。 */
  discarded: string;
  /** 例：「已貼上 {count} 格」。 */
  pasted: string;
  /** 接在 pasted 後面，例：「{count} 格有錯誤」。 */
  pasteErrors: string;
  /** 接在 pasted 後面，例：「{count} 格不能修改，已略過」。 */
  pasteSkipped: string;
  /** 手機卡片的編輯鈕，例：「編輯」；無障礙名稱用 editRowLabel，例：「編輯{row}」。 */
  editRow: string;
  editRowLabel: string;
  /** 手機編輯表單，例：「儲存」、「取消」。 */
  save: string;
  cancel: string;
}
