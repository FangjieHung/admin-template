// 殼層（頁首、側欄）只用到 mat-icon-button，但 `@angular/material/button` 的 button.mjs 同時放著
// MatButton、MatFab 等（含樣式字串）。esbuild 以「檔案」為單位分 chunk：殼層一 import 那個檔案，
// 展示頁用到的部分（約 52 kB）就全進 Initial bundle。MatIconButton 其實住在另一個檔案，
// 這裡直接從那個檔案拿，button.mjs 就留在展示頁的 lazy chunk。
//
// 這是 Angular Material 的內部檔名（升級可能改名）：改名時 build 會報「Could not resolve」，
// 屆時找出 MatIconButton 新的所在檔案改這一行；找不到就把殼層改回 `@angular/material/button`（只是多 52 kB）。
// index.spec.ts 檢查拿到的確實是 icon button；正式 build 的 stats 裡這個檔案只會出現一次（與 button.mjs 共用）。
export { MatIconButton } from '../../../../../node_modules/@angular/material/fesm2022/_icon-button-chunk.mjs';
