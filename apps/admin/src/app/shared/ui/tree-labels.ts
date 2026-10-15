import { Provider } from '@angular/core';
import { TREE_LABELS, TreeLabels } from '@admin-template/ui';

/**
 * 樹狀選單（lib-tree）與樹狀表（lib-tree-table）的畫面文字。用到它們的頁面在自己的 `providers` 加上這組；
 * 不放 app.config 根層，理由同 component-label-providers.ts。
 *
 * 文字直接寫在這裡、不放 core/i18n/zh-tw.ts：那份字典被殼層 import，整份在 Initial bundle 裡，
 * 這幾句只有用到樹的頁面（lazy chunk）需要。
 */
export const ZH_TW_TREE: TreeLabels = {
  loading: '載入中',
  loadFailed: '無法載入「{name}」的內容',
  retry: '重試',
  retryHint: '，按右方向鍵重試',
  noResults: '找不到符合「{query}」的項目',
  noRows: '沒有資料',
  searchLoadedOnly: '只搜尋已載入的項目；還沒展開過的資料夾裡的檔案不會出現',
  searching: '正在搜尋未載入的項目…',
  searchFailed: '無法搜尋未載入的項目，只顯示已載入的結果',
};

export const TREE_LABEL_PROVIDERS: Provider[] = [{ provide: TREE_LABELS, useValue: ZH_TW_TREE }];
