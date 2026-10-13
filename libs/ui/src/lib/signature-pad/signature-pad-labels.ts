import { InjectionToken } from '@angular/core';

/** 簽名板的畫面文字。libs/ui 不內建使用者可見字串，由使用端提供。 */
export interface SignaturePadLabels {
  /** 模式切換：手寫，例：「手寫簽名」。 */
  drawTab: string;
  /** 模式切換：打字，例：「打字簽名」。 */
  typeTab: string;
  /** 畫布的無障礙名稱，例：「簽名畫布」。 */
  canvasAriaLabel: string;
  /** 畫布還沒有筆畫時的提示，例：「請在框內用滑鼠或手指簽名」。 */
  emptyDrawHint: string;
  /** 打字模式的欄位標籤，例：「簽署人姓名」。 */
  typedNameLabel: string;
  /** 打字模式的 placeholder，例：「請輸入姓名」。 */
  typedNamePlaceholder: string;
  /** 例：「清除重寫」。 */
  clear: string;
  /** 確認勾選框的文字，例：「我確認以上內容無誤」。`requireAcknowledge` 為 false 時不顯示。 */
  acknowledge: string;
  /** 自帶確認鈕的文字，例：「確認簽署」。 */
  confirmSign: string;
  /** 存檔中的按鈕文字，例：「處理中…」。 */
  signing: string;
  /** 選填：簽名區下方的附註（例如「示範用，不具法律效力」）；空字串或未提供就不顯示。 */
  notice?: string;
}

/**
 * 刻意沒有預設值（同 DUAL_MONTH_RANGE_PICKER_LABELS）：忘了提供時開發期直接報 NG0201，
 * 不會默默顯示某一種語言的文字。在使用簽名板的父元件 `providers` 裡提供即可。
 */
export const SIGNATURE_PAD_LABELS = new InjectionToken<SignaturePadLabels>('SIGNATURE_PAD_LABELS');
