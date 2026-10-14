import { filterCommands } from './command-match';

/** 項目種類：跳到一個頁面、打開一筆資料、執行一個動作。決定預設圖示，並記在「最近使用」裡。 */
export type CommandKind = 'page' | 'record' | 'action';

/** 指令面板裡的一列。 */
export interface CommandItem {
  /** 在同一個資料來源裡唯一（「最近使用」用它找回項目）。 */
  id: string;
  title: string;
  /** 第二行（所在位置、編號、狀態）；也會被搜尋、標記。 */
  subtitle?: string;
  /** Material Symbols 圖示名稱；不給時依 `kind`（page：description、record：article、action：bolt）。 */
  icon?: string;
  /** 額外的搜尋詞（英文名稱、網址、別名），不顯示。 */
  keywords?: readonly string[];
  /** 這個動作自己的快捷鍵，顯示在列尾（例：「⌘N」）；面板不會幫它綁定。 */
  shortcut?: string;
  kind: CommandKind;
  /** 目前使用中（例：目前的質地）：列尾打勾，報讀器念「目前使用中」。 */
  current?: boolean;
  /**
   * 兩段式動作：選了不執行，改列出這一層的子項目（例：「切換質地」→ 13 種質地），輸入框前面出現麵包屑，
   * 空白時按 Backspace（或 Esc）回上一層。子項目用內建的比對篩選。
   */
  children?: () => readonly CommandItem[] | Promise<readonly CommandItem[]>;
  /** 執行（沒有 `children` 時必填）。面板先送出 `(selected)`（overlay 這時關閉、焦點回到觸發的按鈕）再呼叫它。 */
  run?: () => void | Promise<void>;
}

/** 「最近使用」存下來的樣子：只存顯示用的欄位，執行時交給資料來源的 `resolve()` 換回完整的項目。 */
export interface RecentCommand {
  providerId: string;
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  kind: CommandKind;
}

/** 一組結果的來源（「頁面」「工單」「動作」）。依陣列順序排成分組。 */
export interface CommandProvider {
  id: string;
  /** 分組標題，例：「頁面」。 */
  label: string;
  /**
   * 搜尋。同步來源直接回傳陣列（輸入時立刻顯示，通常用 `filterCommands()` 排序）；
   * 非同步來源（`async: true`）回傳 Promise：面板等使用者停手 150ms 才呼叫，換字時用 `signal` 取消上一次，
   * 等待時這一組顯示「搜尋中…」，失敗時只有這一組顯示錯誤，其他組照常。
   */
  search(query: string, signal: AbortSignal): readonly CommandItem[] | Promise<readonly CommandItem[]>;
  async?: boolean;
  /** 查詢至少幾個字才搜尋這一組，預設 1（空白查詢不搜尋，改顯示最近使用與建議）。 */
  minQueryLength?: number;
  /** 這一組最多顯示幾筆，預設 5。 */
  limit?: number;
  /** 目前能不能用（例：沒有權限時整組不出現）；每次搜尋都會問一次。 */
  enabled?: () => boolean;
  /** 空白查詢時列在這一組底下的建議項目（例：常用動作）。 */
  suggestions?: () => readonly CommandItem[];
  /**
   * 把「最近使用」存下的項目換回可以執行的項目；回 null（已經不存在或沒有權限了）就不顯示。
   * 沒有這個函式的來源，它的項目不會被記進最近使用。
   */
  resolve?: (recent: RecentCommand) => CommandItem | null;
}

/** 「最近使用」的儲存位置（預設的示範放在瀏覽器的 localStorage；可以換成伺服器的使用者偏好）。 */
export interface CommandHistory {
  read(): readonly RecentCommand[];
  write(items: readonly RecentCommand[]): void;
}

function isRecent(value: unknown): value is RecentCommand {
  const v = value as Partial<RecentCommand> | null;
  return !!v && typeof v.providerId === 'string' && typeof v.id === 'string' && typeof v.title === 'string' && typeof v.kind === 'string';
}

/** 存在 localStorage 的最近使用；讀寫失敗（私密瀏覽、停用儲存、內容壞掉）時當作沒有紀錄，不丟錯。 */
export function createLocalStorageCommandHistory(key: string): CommandHistory {
  return {
    read() {
      try {
        const parsed: unknown = JSON.parse(globalThis.localStorage?.getItem(key) ?? '[]');
        return Array.isArray(parsed) ? parsed.filter(isRecent) : [];
      } catch {
        return [];
      }
    },
    write(items) {
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(items));
      } catch {
        // 存不了就只在這次開啟期間有效。
      }
    },
  };
}

/** 只放在記憶體裡的最近使用（測試、展示頁）。 */
export function createMemoryCommandHistory(initial: readonly RecentCommand[] = []): CommandHistory {
  let items = [...initial];
  return {
    read: () => items,
    write: (next) => (items = [...next]),
  };
}

export interface StaticCommandProviderOptions {
  id: string;
  label: string;
  /** 每次搜尋都會呼叫（清單會隨權限、目前外觀改變時，在這裡算）。 */
  items: () => readonly CommandItem[];
  limit?: number;
  enabled?: () => boolean;
  suggestions?: () => readonly CommandItem[];
  /** 預設在 `items()` 裡用 id 找；子項目（兩段式）要能進最近使用時自己提供。 */
  resolve?: (recent: RecentCommand) => CommandItem | null;
}

/** 固定清單的同步來源：用內建的比對篩選、排序，`resolve` 預設依 id 從清單找回。 */
export function createStaticCommandProvider(options: StaticCommandProviderOptions): CommandProvider {
  const { items, limit = 5 } = options;
  return {
    id: options.id,
    label: options.label,
    limit,
    enabled: options.enabled,
    suggestions: options.suggestions,
    search: (query) => filterCommands(query, items(), limit),
    resolve: options.resolve ?? ((recent) => items().find((item) => item.id === recent.id) ?? null),
  };
}
