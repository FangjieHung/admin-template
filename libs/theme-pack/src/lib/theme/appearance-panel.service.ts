import { Injectable, signal } from '@angular/core';

// ticket 03（外觀浮動面板）：設定頁的開關與每一頁角落的按鈕要共用同一份狀態，
// 不管是哪個進來改（設定頁的 checkbox 或未來別處），兩邊都要立刻同步，所以狀態放在
// 共用的 theme-pack service，而不是各自在元件裡讀 localStorage。
export const APPEARANCE_PANEL_KEY = 'app.appearancePanel';

@Injectable({ providedIn: 'root' })
export class AppearancePanelService {
  // localStorage 同步讀取即可（不像 ThemeService 還要碰 dataset，沒有 FOUC 疑慮），
  // 不需要額外的 init()：field initializer 在第一次注入時就會跑。
  readonly visible = signal(localStorage.getItem(APPEARANCE_PANEL_KEY) === '1');

  setVisible(value: boolean): void {
    this.visible.set(value);
    localStorage.setItem(APPEARANCE_PANEL_KEY, value ? '1' : '0');
  }
}
