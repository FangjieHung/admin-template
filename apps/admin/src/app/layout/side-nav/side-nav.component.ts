import { Component, computed, inject, input, output } from '@angular/core';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { AccessService, IdentitySwitcherService } from '@admin-template/access';
import { AuthService } from '../../core/auth/auth.service';
import { IdentitySwitcherSlotComponent } from '../identity-switcher/identity-switcher-slot.component';
import { ZH_TW_SHELL } from '../../core/i18n/zh-tw-shell';
import { NavEntry, NavGroup, NavLeaf, isNavGroup } from './nav-item.model';

@Component({
  selector: 'app-side-nav',
  imports: [
    RouterLink,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    OverlayModule,
    IdentitySwitcherSlotComponent,
  ],
  templateUrl: './side-nav.component.html',
  styleUrl: './side-nav.component.scss',
})
export class SideNavComponent {
  protected readonly t = ZH_TW_SHELL;
  protected readonly isNavGroup = isNavGroup;
  protected readonly auth = inject(AuthService);
  private readonly access = inject(AccessService);
  protected readonly identitySwitcher = inject(IdentitySwitcherService);

  /** 使用者卡片：目前身分的名字與角色（libs/access）。 */
  protected readonly currentName = computed(() => this.access.currentUser()?.name ?? this.t.layout.signedOut);
  protected readonly currentRoles = computed(() =>
    this.access.currentUser() ? this.access.currentRoles().map((r) => r.name).join('、') || this.t.layout.noRoles : '',
  );
  protected readonly initial = computed(() => this.currentName().slice(0, 1));

  readonly navItems = input.required<NavEntry[]>();
  readonly collapsed = input.required<boolean>();
  readonly isMobile = input.required<boolean>();
  readonly openGroupLabel = input.required<string | null>();
  readonly currentGroupLabel = input.required<string | null>();
  /**
   * 目前頁面對應的選單項目路徑，由 App 依網址算出（含 matchPrefixes：子頁面也歸屬某個選單項目）。
   * 取代 routerLinkActive 的完全比對——那樣子頁面時側欄一項都不會亮。
   */
  readonly activeRoute = input<string | null>(null);
  readonly flyoutPositions = input.required<ConnectedPosition[]>();

  readonly toggleCollapse = output<void>();
  readonly toggleGroup = output<string>();
  readonly navClick = output<void>();
  readonly groupDetach = output<void>();

  protected isGroupActive(group: NavGroup): boolean {
    return this.currentGroupLabel() === group.label;
  }

  protected isActive(leaf: NavLeaf): boolean {
    return this.activeRoute() === leaf.route;
  }
}
