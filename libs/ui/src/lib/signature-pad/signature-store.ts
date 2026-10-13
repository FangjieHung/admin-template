import { InjectionToken } from '@angular/core';

/**
 * 一筆已存檔的簽名：不透明的 asset ID 與可直接顯示的 URL。
 * `url` 是儲存實作在當下 session 產生的顯示用位址（例如 blob: URL），不是可持久化的資料；
 * 要保存的只有 `assetId`。
 */
export interface SignatureAsset {
  assetId: string;
  url: string;
}

/**
 * 簽名板需要的最小儲存介面：把簽名內容（畫布 PNG 或打字姓名的文字檔）存成 Blob，回傳不透明的資產紀錄。
 * 簽名內容本身不經由元件 output 外流，只交給這個 store。正式專案換成上傳到後端的實作。
 */
export interface SignatureStore {
  store(file: Blob, filename: string): Promise<SignatureAsset>;
}

/**
 * 預設實作：只存在記憶體，用 `URL.createObjectURL` 產生顯示用網址，重新整理就消失。
 * 適合示範與原型；正式專案在 `providers` 換成自己的 `SignatureStore`。
 */
export class ObjectUrlSignatureStore implements SignatureStore {
  private counter = 0;

  store(file: Blob): Promise<SignatureAsset> {
    this.counter += 1;
    const url = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '';
    return Promise.resolve({ assetId: `signature-${Date.now()}-${this.counter}`, url });
  }
}

/** 簽名儲存的注入點；沒有提供時用 `ObjectUrlSignatureStore`（只存在記憶體）。 */
export const SIGNATURE_STORE = new InjectionToken<SignatureStore>('SIGNATURE_STORE', {
  providedIn: 'root',
  factory: () => new ObjectUrlSignatureStore(),
});
