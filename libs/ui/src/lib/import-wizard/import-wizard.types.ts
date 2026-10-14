/**
 * 匯入精靈（lib-import-wizard）的資料契約：要匯入什麼欄位（`ImportSchema`）、匯入到哪裡（`ImportTarget`）、
 * 要不要記住欄位對應（`ImportMappingStore`）。元件只認得這些介面，不認得任何業務資料。
 */

/** 欄位型別：決定預設的檢查與轉換。 */
export type ImportFieldType = 'text' | 'number' | 'date' | 'enum' | 'email' | 'phone';

/** 選項欄位（`type: 'enum'`）的一個選項。 */
export interface ImportFieldOption {
  /** 存進資料的值，例：`vip`。 */
  value: string;
  /** 顯示與範本檔裡寫的文字，例：「VIP」。 */
  label: string;
  /** 檔案裡也接受的寫法（不分大小寫、全形半形），例：`['貴賓', 'V.I.P']`。 */
  synonyms?: readonly string[];
}

/** 要匯入的一個欄位。 */
export interface ImportField {
  /** 資料的屬性名稱，例：`email`。 */
  key: string;
  /** 畫面與範本檔的欄位名稱，例：「Email」。 */
  label: string;
  required?: boolean;
  type: ImportFieldType;
  /** `type: 'enum'` 的選項。 */
  options?: readonly ImportFieldOption[];
  /** 檔案的欄位名稱是這些之一時自動對應（不分大小寫、空白、全形半形），例：`['電子郵件', 'e-mail', 'mail']`。 */
  synonyms?: readonly string[];
  /** 範本檔第一列資料的範例值。 */
  example?: string;
  /**
   * 額外的檢查：回傳給使用者看的錯誤訊息，或 null（通過）。在型別檢查與 `transform` 之後執行，
   * `value` 是轉換後的值，`row` 是同一列所有欄位轉換後的值。
   */
  validate?(value: unknown, row: Readonly<Record<string, unknown>>): string | null;
  /**
   * 把檔案裡的文字轉成資料的值（在型別的預設轉換之後）。丟出 Error 時，它的 message 就是這一格的錯誤訊息
   * （例：負責人找不到這個名字）。
   */
  transform?(value: unknown): unknown;
}

/** 匯入的欄位定義。 */
export interface ImportSchema {
  fields: readonly ImportField[];
  /** 判斷「重複」用的欄位 key（例：`email`）。不給時不檢查重複。 */
  key?: string;
}

/** 重複資料的處理方式：略過、更新現有的、仍然新增一筆。 */
export type ImportDuplicateMode = 'skip' | 'update' | 'create';

/** 交給 `importBatch` 的一列。 */
export interface ImportRecord<T = Record<string, unknown>> {
  /** 檔案裡的列號（從 1 起算，含標題列），錯誤報告與失敗清單用。 */
  row: number;
  /** 依 schema 轉換後的值（只有對應到的欄位）。 */
  value: T;
  /** 新增還是更新（依 `key` 找到現有資料、選了「更新現有」時）。 */
  action: 'create' | 'update';
}

export interface ImportBatchOptions {
  mode: ImportDuplicateMode;
  signal: AbortSignal;
  /** 這一批裡已處理幾筆（選填，有逐筆進度時呼叫）。 */
  onProgress?(done: number): void;
}

/** `importBatch` 的結果：這一批新增、更新、略過幾筆，哪些列失敗（`row` 是 `ImportRecord.row`）。 */
export interface ImportBatchResult {
  created: number;
  updated: number;
  skipped: number;
  failed: readonly { row: number; message: string }[];
}

/**
 * 匯入到哪裡。新專案換成呼叫自己的 API：
 * - `findExisting(keys)`：回傳這些 key 裡已經存在的（判斷重複用）。沒有時只檢查檔案內的重複。
 * - `importBatch(rows)`：精靈分批呼叫（每批 `batchSize` 筆），按「停止匯入」時 abort `signal`；
 *   已經送出的批次算數，之後的不送。
 */
export interface ImportTarget<T = Record<string, unknown>> {
  findExisting?(keys: readonly string[], signal: AbortSignal): Promise<ReadonlySet<string>>;
  importBatch(rows: readonly ImportRecord<T>[], options: ImportBatchOptions): Promise<ImportBatchResult>;
}

/** 欄位對應：schema 欄位 key → 檔案的欄位名稱（標題列的文字）。 */
export type ImportMapping = Readonly<Record<string, string>>;

/** 記住上次的欄位對應（例如存在瀏覽器或使用者設定）。`id` 由頁面決定，例：`contacts`。 */
export interface ImportMappingStore {
  load(id: string): ImportMapping | null;
  save(id: string, mapping: ImportMapping): void;
}

/** 讀進來的一個工作表：每一列是一串文字（標題列也在裡面）。 */
export interface ImportSheet {
  name: string;
  rows: readonly (readonly string[])[];
}

/** 一個檔案讀出來的內容。CSV／TSV 只有一個工作表。 */
export interface ImportWorkbook {
  fileName: string;
  sheets: readonly ImportSheet[];
  /** CSV 用了什麼編碼讀（`utf-8` 或 `big5`）；Excel 是 null。 */
  encoding: 'utf-8' | 'big5' | null;
}

/** 一列的驗證結果（預覽與匯入用）。 */
export interface ImportRow {
  /** 0 起算的資料列索引（不含標題列）。 */
  index: number;
  /** 檔案裡的列號（1 起算，含標題列）。 */
  row: number;
  /** 每個欄位目前的文字（可以在預覽裡直接修改）。 */
  raw: Readonly<Record<string, string>>;
  /** 轉換後的值。 */
  value: Readonly<Record<string, unknown>>;
  /** 每個欄位的錯誤訊息（沒有錯就不在裡面）。 */
  errors: Readonly<Record<string, string>>;
  /** 重複：與檔案裡前面某一列相同（`file`，`firstRow` 是那一列的列號）或與現有資料相同（`existing`）。 */
  duplicate: { kind: 'file'; firstRow: number } | { kind: 'existing' } | null;
}

/** 匯入的最終結果（結果畫面與 `(imported)`）。 */
export interface ImportResult {
  created: number;
  updated: number;
  /** 略過：有問題而略過、重複而略過、`importBatch` 回報略過、停止後沒有送出的。 */
  skipped: number;
  failed: readonly { row: number; message: string }[];
  /** 按了「停止匯入」。 */
  canceled: boolean;
}
