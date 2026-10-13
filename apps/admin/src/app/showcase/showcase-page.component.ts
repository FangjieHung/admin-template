import { Component, input } from '@angular/core';

/** 輸入與輸出表的一列。 */
export interface ApiRow {
  /** 例：`[pageable]`、`(rowClick)`、`SIGNATURE_STORE`。 */
  name: string;
  /** 型別，例：`boolean`、`DataTableColumn<T>[]`。 */
  type: string;
  /** 預設值；必填的寫「必填」。 */
  default?: string;
  description: string;
}

export interface ApiSection {
  /** 例：「輸入」「輸出」「注入」「函式」。 */
  title: string;
  rows: readonly ApiRow[];
}

/**
 * 元件展示頁的固定骨架：用途與何時使用 → 示範（內容投影）→ 用法 → 輸入與輸出。
 * 每一頁都長一樣，新元件照抄一頁改內容即可。標題在頁首（由側欄選單推得），這裡不重複。
 */
@Component({
  selector: 'app-showcase-page',
  templateUrl: './showcase-page.component.html',
  styleUrl: './showcase-page.component.scss',
})
export class ShowcasePageComponent {
  /** 一兩句話說明這個元件是做什麼的。 */
  readonly summary = input.required<string>();
  /** 適合使用的情境，每項一句。 */
  readonly whenToUse = input<readonly string[]>([]);
  /** 不適合、應改用其他做法的情境，每項一句。 */
  readonly avoid = input<readonly string[]>([]);
  /** 原始碼位置。 */
  readonly source = input('');
  /** 「用法」程式碼片段（純文字）。 */
  readonly usage = input('');
  readonly api = input<readonly ApiSection[]>([]);
}
