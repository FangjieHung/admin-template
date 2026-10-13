import { reflectComponentType } from '@angular/core';
import { MatIconButton } from './index';

// 確認 Material 內部檔案裡拿到的仍是 icon button（升級時檔名沒變、內容換了也會被抓到）。
// 正式 build 裡它與 @angular/material/button 匯出的是同一個 class（同一個檔案，esbuild 只收一份）；
// 測試環境會把 @angular/material 當外部套件載入，這裡拿到的是另一份副本，所以不比對 class 本身。
describe('vendor/mat-icon-button', () => {
  it('re-exports the Material icon button component', () => {
    expect(reflectComponentType(MatIconButton)?.selector).toContain('mat-icon-button');
  });
});
