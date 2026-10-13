import { Injectable, signal } from '@angular/core';

/** 每隔多久更新一次「現在」（毫秒）。相對時間只到分鐘，一分鐘一次就夠。 */
export const MINUTE_CLOCK_INTERVAL = 60_000;

/**
 * 全站共用的分鐘時鐘：所有活動紀錄（相對時間、今天／昨天分組）讀同一個 `now` signal，只有一支計時器。
 * 第一個使用者 `acquire()` 時才啟動，最後一個釋放時清掉，頁面上沒有時間軸就不會有計時器在跑。
 */
@Injectable({ providedIn: 'root' })
export class MinuteClock {
  private readonly _now = signal(Date.now());
  /** 現在時間（毫秒）；每分鐘更新。 */
  readonly now = this._now.asReadonly();

  private users = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  /** 計時器是否正在跑（測試與除錯用）。 */
  get running(): boolean {
    return this.timer !== null;
  }

  /** 開始使用；回傳「不用了」的函式（重複呼叫無害）。 */
  acquire(): () => void {
    this.users += 1;
    this._now.set(Date.now());
    if (!this.timer) {
      this.timer = setInterval(() => this._now.set(Date.now()), MINUTE_CLOCK_INTERVAL);
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.users -= 1;
      if (this.users === 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  }
}
