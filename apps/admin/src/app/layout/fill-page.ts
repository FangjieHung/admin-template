import { ActivatedRouteSnapshot } from '@angular/router';

/**
 * 路由 data 的「滿版頁」標記（例如長表單頁：內容區自己捲動、操作列釘在底部）。有這個標記時，外框（app.html）把主內容區變成
 * 撐滿頁首與頁尾之間剩餘高度的 flex 欄；頁面再決定內部哪一塊自己捲動、操作列釘在哪裡。
 * 其他頁面維持原本「整頁一起捲動」的排版，不受影響。
 * 生效條件（視窗夠寬也夠高）寫在同目錄的 `_fill-page.scss`，外框與頁面共用同一個條件。
 */
export const FILL_PAGE_DATA_KEY = 'fillPage';

/** 目前路由（最深的那一層，資料會從無路徑的父層繼承下來）是否標記為滿版頁。 */
export function isFillPageRoute(root: ActivatedRouteSnapshot): boolean {
  let route = root;
  while (route.firstChild) route = route.firstChild;
  return route.data[FILL_PAGE_DATA_KEY] === true;
}
