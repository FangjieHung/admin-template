import { InjectionToken } from '@angular/core';
import { DataTableColumnPrefs, DataTableSort } from '../data-table/data-table.types';
import { FilterCondition } from '../filter/filter.types';

/** 一份清單目前的檢視狀態：排序＋篩選＋顯示欄位與順序＋每頁筆數。整份可直接 JSON 化。 */
export interface ListViewState {
  sort: DataTableSort | null;
  filters: FilterCondition[];
  /** null＝預設欄位。 */
  columns: DataTableColumnPrefs | null;
  pageSize: number;
}

/** 目前只有 private；shared 是替日後「分享給同事」保留的值，現在沒有任何地方會用到。 */
export type SavedViewVisibility = 'private' | 'shared';

/** 一個已儲存的檢視（例如「今天待交車」）。 */
export interface SavedView {
  id: string;
  /** 屬於哪一份清單（例如 'orders'）。 */
  listId: string;
  name: string;
  state: ListViewState;
  /** ISO 時間字串。 */
  createdAt: string;
  updatedAt: string;
  /** 保留欄位（未使用）：一律 'private'。 */
  visibility: SavedViewVisibility;
  /** 保留欄位（未使用）：分享對象的使用者或角色 id，一律空陣列。 */
  sharedWith: string[];
}

export interface SavedViewWriteResult {
  /** false：只存在記憶體裡（例如瀏覽器封鎖儲存空間），關閉頁面後會遺失。 */
  persisted: boolean;
}

/**
 * 檢視的存放處。現在的實作存在瀏覽器（LocalStorageSavedViewRepository，每位使用者分開）；
 * 日後換成後端 API 只要實作同一個介面（全部是非同步的，就是為了這一天）。
 */
export interface SavedViewRepository {
  list(listId: string): Promise<SavedView[]>;
  save(view: SavedView): Promise<SavedViewWriteResult>;
  remove(listId: string, id: string): Promise<SavedViewWriteResult>;
}

/** 刻意沒有預設值：使用端決定存哪裡、以哪位使用者區分。 */
export const SAVED_VIEW_REPOSITORY = new InjectionToken<SavedViewRepository>('SAVED_VIEW_REPOSITORY');

/** 檢視切換器的文字。`{name}` 會換成檢視名稱。 */
export interface SavedViewsLabels {
  /** 觸發鈕的無障礙名稱，例：「檢視：{name}」。 */
  trigger: string;
  /** 面板標題與清單名稱，例：「檢視」。 */
  title: string;
  /** 例：「預設檢視」。 */
  defaultView: string;
  /** 例：「已修改」。 */
  modified: string;
  /** 覆寫目前的檢視，例：「儲存檢視」。 */
  save: string;
  /** 例：「另存新檢視」。 */
  saveAs: string;
  /** 放棄修改、回到檢視原本的設定，例：「還原」。 */
  discard: string;
  /** 例：「重新命名」。 */
  rename: string;
  /** 例：「刪除檢視」。 */
  remove: string;
  /** 名稱欄位，例：「檢視名稱」。 */
  name: string;
  /** 送出名稱，例：「儲存」。 */
  confirm: string;
  cancel: string;
  close: string;
  /** 例：「確定刪除「{name}」？」。 */
  removeConfirm: string;
  /** 確認刪除的按鈕，例：「刪除」。 */
  removeAction: string;
  /** 例：「請輸入名稱」。 */
  nameRequired: string;
  /** 例：「已有同名的檢視」。 */
  nameTaken: string;
  /** 例：「無法存到這台裝置，關閉頁面後會遺失」。 */
  notPersisted: string;
}
