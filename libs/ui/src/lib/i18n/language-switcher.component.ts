import { Component, inject, input } from '@angular/core';
import { I18nService } from './i18n.service';

/**
 * 語言切換：一排按鈕，選項名稱一律用各語言自己的寫法（繁體中文／English／日本語），
 * 看不懂目前語言的人才找得到自己的語言。語言清單與目前語言都來自最近的 `I18nService`。
 */
@Component({
  selector: 'lib-language-switcher',
  templateUrl: './language-switcher.component.html',
  styleUrl: './language-switcher.component.scss',
})
export class LanguageSwitcherComponent {
  protected readonly i18n = inject(I18nService);

  /** 整組按鈕的無障礙名稱。建議用多語並列（例：「語言 / Language」），因為切換後這個名稱不會跟著翻譯。 */
  readonly label = input('語言 / Language');

  /** 是否在最前面顯示地球圖示。 */
  readonly showIcon = input(true);
}
