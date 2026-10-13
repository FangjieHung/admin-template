import { Component } from '@angular/core';
import { provideHeaderTitle } from '../../layout/header/header-title';
import { ErrorPageComponent } from './error-page.component';

/** 找不到頁面（`**` 路由）：網址打錯或頁面已移除。 */
@Component({
  selector: 'app-not-found-page',
  imports: [ErrorPageComponent],
  template: `
    <app-error-page
      icon="travel_explore"
      code="404"
      heading="找不到這一頁"
      message="網址可能打錯了，或這一頁已經移除。請確認網址，或回首頁從側欄重新找。"
    />
  `,
})
export class NotFoundPageComponent {
  constructor() {
    provideHeaderTitle(() => ({ title: '找不到頁面', breadcrumbs: [] }));
  }
}
