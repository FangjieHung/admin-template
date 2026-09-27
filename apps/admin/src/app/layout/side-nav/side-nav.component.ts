import { Component, inject, input, output } from '@angular/core';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
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
  ],
  templateUrl: './side-nav.component.html',
  styleUrl: './side-nav.component.scss',
})
export class SideNavComponent {
  protected readonly t = ZH_TW_SHELL;
  protected readonly isNavGroup = isNavGroup;
  protected readonly auth = inject(AuthService);

  readonly navItems = input.required<NavEntry[]>();
  readonly collapsed = input.required<boolean>();
  readonly isMobile = input.required<boolean>();
  readonly openGroupLabel = input.required<string | null>();
  readonly currentGroupLabel = input.required<string | null>();
  /**
   * 目前頁面對應的選單項目路徑，由 App 依網址算出（含 matchPrefixes：/orders/new、/orders/:id
   * 都算「訂單列表」）。取代 routerLinkActive 的完全比對——那樣建單、訂單詳情時側欄一項都不會亮。
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
