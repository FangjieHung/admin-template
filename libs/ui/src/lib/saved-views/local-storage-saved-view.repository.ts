import { ListViewState, SavedView, SavedViewRepository, SavedViewWriteResult } from './saved-view.types';

export interface LocalStorageSavedViewRepositoryOptions {
  /** 目前使用者的識別；每位使用者的檢視分開存（key 裡含這個值）。 */
  userId: () => string;
  /** localStorage key 的前綴，預設 'app.savedViews'。 */
  prefix?: string;
  /** 測試用：換掉 storage。取用本身丟錯（隱私模式、封鎖網站資料）也會被接住。 */
  storage?: () => Storage;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isState(v: unknown): v is ListViewState {
  return (
    isObject(v) &&
    Array.isArray(v['filters']) &&
    typeof v['pageSize'] === 'number' &&
    (v['sort'] === null || isObject(v['sort'])) &&
    (v['columns'] === null || isObject(v['columns']))
  );
}

/** 讀回來的資料可能是舊版或被手動改壞：不合格的項目直接略過，保留的欄位補齊預設。 */
function parseViews(raw: string | null, listId: string): SavedView[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.flatMap((item): SavedView[] => {
    if (!isObject(item) || typeof item['id'] !== 'string' || typeof item['name'] !== 'string' || !isState(item['state'])) {
      return [];
    }
    return [
      {
        id: item['id'],
        listId,
        name: item['name'],
        state: item['state'],
        createdAt: typeof item['createdAt'] === 'string' ? item['createdAt'] : '',
        updatedAt: typeof item['updatedAt'] === 'string' ? item['updatedAt'] : '',
        visibility: 'private',
        sharedWith: [],
      },
    ];
  });
}

/**
 * 把檢視存在瀏覽器的 localStorage（每位使用者、每份清單一個 key）。
 * 所有存取都包在 try/catch：讀不到就當沒有檢視；寫不進去時仍保留在記憶體裡（這次開著的頁面照常可用），
 * 並回傳 persisted: false 讓畫面提示使用者。
 */
export class LocalStorageSavedViewRepository implements SavedViewRepository {
  private readonly cache = new Map<string, SavedView[]>();
  private readonly prefix: string;

  constructor(private readonly options: LocalStorageSavedViewRepositoryOptions) {
    this.prefix = options.prefix ?? 'app.savedViews';
  }

  private key(listId: string): string {
    return `${this.prefix}.${this.options.userId()}.${listId}`;
  }

  private storage(): Storage | null {
    try {
      return this.options.storage ? this.options.storage() : globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  }

  private read(listId: string): SavedView[] {
    const key = this.key(listId);
    const cached = this.cache.get(key);
    if (cached) return cached;
    let raw: string | null = null;
    try {
      raw = this.storage()?.getItem(key) ?? null;
    } catch {
      raw = null;
    }
    const views = parseViews(raw, listId);
    this.cache.set(key, views);
    return views;
  }

  private write(listId: string, views: SavedView[]): SavedViewWriteResult {
    const key = this.key(listId);
    this.cache.set(key, views);
    try {
      const storage = this.storage();
      if (!storage) return { persisted: false };
      storage.setItem(key, JSON.stringify(views));
      return { persisted: true };
    } catch {
      return { persisted: false };
    }
  }

  list(listId: string): Promise<SavedView[]> {
    return Promise.resolve([...this.read(listId)]);
  }

  save(view: SavedView): Promise<SavedViewWriteResult> {
    const views = this.read(view.listId);
    const index = views.findIndex((v) => v.id === view.id);
    const next = index === -1 ? [...views, view] : views.map((v, i) => (i === index ? view : v));
    return Promise.resolve(this.write(view.listId, next));
  }

  remove(listId: string, id: string): Promise<SavedViewWriteResult> {
    return Promise.resolve(this.write(listId, this.read(listId).filter((v) => v.id !== id)));
  }
}
