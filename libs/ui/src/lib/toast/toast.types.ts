import { InjectionToken } from '@angular/core';

/** 提示訊息的 4 種類型。 */
export type ToastType = 'success' | 'info' | 'warning' | 'error';

/**
 * 每種類型顯示多久（毫秒）；null＝不會自己消失，要使用者按關閉。
 * - 成功、資訊 4 秒：一句話的確認，讀完就走。
 * - 警告 6 秒：通常要多讀一句後果（例：「外觀載入失敗，暫時使用預設外觀」），比成功多給 2 秒。
 * - 錯誤不自動消失：使用者可能正在看別處，錯過就不知道要重做。
 * 滑鼠移入或鍵盤聚焦在提示上時暫停計時，移開後重新計時（WCAG 2.2.1）。
 */
export const TOAST_DURATIONS: Readonly<Record<ToastType, number | null>> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: null,
};

export interface ToastOptions {
  /** 唯一一個動作鈕的文字，例：「復原」。按下時 `ToastRef.actionClicked` 會 resolve 成 true。 */
  action?: string;
}

/** `ToastService` 每次顯示回傳的控制柄。 */
export interface ToastRef {
  /** 按了動作鈕 → true；自動消失、按關閉、被下一則提示取代 → false。 */
  readonly actionClicked: Promise<boolean>;
  /** 提示從畫面上消失後 resolve（不論原因）。 */
  readonly afterDismissed: Promise<void>;
  /** 用程式關掉這則提示。 */
  dismiss(): void;
}

/** 提示訊息的內建文字。libs/ui 不內建使用者可見字串，由使用端提供（`provideToast(labels)`）。 */
export interface ToastLabels {
  /** 錯誤提示的關閉鈕無障礙名稱，例：「關閉」。 */
  close: string;
}

export const TOAST_LABELS = new InjectionToken<ToastLabels>('TOAST_LABELS');

/** 傳給提示元件的資料（內部用）。 */
export interface ToastData {
  type: ToastType;
  message: string;
  action: string | null;
  closeLabel: string | null;
  duration: number | null;
}
