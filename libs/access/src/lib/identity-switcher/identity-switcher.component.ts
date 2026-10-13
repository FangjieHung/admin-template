import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { AccessService } from '../access.service';

/** 「切換身分」小工具的畫面文字（libs/access 不內建字串）。 */
export interface IdentitySwitcherLabels {
  /** 按鈕的無障礙名稱開頭，例：「切換身分」。 */
  trigger: string;
  /** 選單標題，例：「示範帳號」。 */
  menuTitle: string;
  /** 沒有身分時，例：「未登入」。 */
  signedOut: string;
  /** 沒有任何角色時，例：「沒有角色」。 */
  noRoles: string;
  /** 角色名稱之間的分隔，例：「、」。 */
  separator: string;
}

/**
 * 示範用的「切換身分」：列出 `AccessConfig.users`，點一下立刻換成那個使用者，按鈕上顯示目前的名字與角色。
 * 通常由殼層用 `@defer (when IdentitySwitcherService.visible())` 載入（見 IdentitySwitcherService）。
 * 不是登入：真正接上身分驗證後就不需要它。
 */
@Component({
  selector: 'lib-identity-switcher',
  imports: [MatMenuModule],
  templateUrl: './identity-switcher.component.html',
  styleUrl: './identity-switcher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-tone]': 'tone()', '[class.ids--compact]': 'compact()' },
})
export class IdentitySwitcherComponent {
  readonly labels = input.required<IdentitySwitcherLabels>();
  /** `surface`：放在一般底色上（頁首、卡片）；`shell`：放在深色側欄裡（用 `--app-shell-*`）。 */
  readonly tone = input<'surface' | 'shell'>('surface');
  /** 只顯示圖示（收合的側欄）；名字與角色仍在無障礙名稱與提示裡。 */
  readonly compact = input(false);

  protected readonly access = inject(AccessService);

  protected readonly entries = computed(() =>
    this.access.users().map((user) => ({
      user,
      roles: this.roleNames(user.roleIds),
      current: user.id === this.access.currentUser()?.id,
    })),
  );

  protected readonly currentName = computed(() => this.access.currentUser()?.name ?? this.labels().signedOut);
  protected readonly currentRoles = computed(() =>
    this.access.currentUser() ? this.roleNames(this.access.currentUser()?.roleIds ?? []) : '',
  );

  protected select(userId: string): void {
    this.access.signIn(userId);
  }

  private roleNames(ids: readonly string[]): string {
    const names = this.access.roles().filter((r) => ids.includes(r.id)).map((r) => r.name);
    return names.length ? names.join(this.labels().separator) : this.labels().noRoles;
  }
}
