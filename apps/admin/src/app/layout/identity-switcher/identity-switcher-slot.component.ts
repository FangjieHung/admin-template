import { Component, input } from '@angular/core';
import { IdentitySwitcherComponent, IdentitySwitcherLabels } from '@admin-template/access/identity-switcher';

/**
 * 側欄裡的「切換身分」：只在開關打開時由 @defer 載入（見 side-nav.component.html），
 * 小工具本身與這裡的畫面文字都不進 Initial bundle。
 */
@Component({
  selector: 'app-identity-switcher-slot',
  imports: [IdentitySwitcherComponent],
  template: `<lib-identity-switcher tone="shell" [compact]="compact()" [labels]="labels" />`,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class IdentitySwitcherSlotComponent {
  readonly compact = input(false);

  protected readonly labels: IdentitySwitcherLabels = {
    trigger: '切換身分',
    menuTitle: '示範帳號（點一下立刻換身分）',
    signedOut: '未登入',
    noRoles: '沒有角色',
    separator: '、',
  };
}
