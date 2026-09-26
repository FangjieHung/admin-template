import { Component, inject, OnInit, signal, ViewChild } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { ConnectedPosition } from '@angular/cdk/overlay';
import { MatSidenavContainer, MatSidenavModule } from '@angular/material/sidenav';
import { Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { ZH_TW } from './core/i18n/zh-tw';
import { SideNavComponent } from './layout/side-nav/side-nav.component';
import { NavEntry, NavGroup, isNavGroup } from './layout/side-nav/nav-item.model';
import { HeaderComponent } from './layout/header/header.component';
import { HeaderTitleData } from './layout/header/header-title';
import { FooterComponent } from './layout/footer/footer.component';
import { isFillPageRoute } from './layout/fill-page';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    MatSidenavModule,
    SideNavComponent,
    HeaderComponent,
    FooterComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly t = ZH_TW;

  protected readonly navItems: NavEntry[] = [
    { route: '/dashboard', label: this.t.nav.dashboard, icon: 'dashboard' },
    {
      label: this.t.nav.productGroup,
      icon: 'inventory_2',
      children: [
        { route: '/vehicles', label: this.t.nav.vehicles, icon: 'directions_car' },
        { route: '/add-ons', label: this.t.nav.addOns, icon: 'extension' },
      ],
    },
    // 4.5：「訂單管理」改成群組，會員不再藏在訂單列表的工具列裡。建單（/orders/new）與
    // 訂單詳情（/orders/:id）歸在「訂單列表」底下：側欄亮它、頁首預設標題也算它。
    {
      label: this.t.nav.orders,
      icon: 'calendar_month',
      children: [
        {
          route: '/orders',
          label: this.t.nav.orderList,
          icon: 'calendar_month',
          matchPrefixes: ['/orders/'],
        },
        { route: '/orders/members', label: this.t.nav.members, icon: 'group' },
      ],
    },
    {
      label: this.t.nav.pricingGroup,
      icon: 'payments',
      children: [
        { route: '/pricing', label: this.t.nav.pricing, icon: 'payments' },
        { route: '/pricing/calendar', label: this.t.nav.pricingCalendar, icon: 'event' },
        { route: '/coupons', label: this.t.nav.coupons, icon: 'sell' },
      ],
    },
    {
      label: this.t.nav.partnerGroup,
      icon: 'handshake',
      children: [
        { route: '/partners', label: this.t.nav.partners, icon: 'handshake' },
        { route: '/commission', label: this.t.nav.commission, icon: 'percent' },
      ],
    },
  ];

  private readonly navLeaves = this.navItems.flatMap((entry) =>
    isNavGroup(entry) ? entry.children : [entry],
  );

  protected isMobile = false;
  protected isSidenavOpen = true;
  // 頁首的預設標題／麵包屑：由側欄選單算出，頁面可以用 provideHeaderTitle() 覆寫
  // （header-title.ts；訂單詳情、車輛詳情等標題含動態資料的頁面都是這樣做）。
  protected defaultTitle: HeaderTitleData = { title: String(this.t.nav.dashboard), breadcrumbs: [] };
  // 側欄群組的 active 樣式仍需要知道目前群組是誰，跟頁首的麵包屑分開維護。
  protected currentGroupLabel: string | null = null;
  protected openGroupLabel: string | null = null;
  protected collapsed = false;
  /**
   * 目前頁面對應的選單項目（含 matchPrefixes 的歸屬，例如 /orders/new → 訂單列表）。
   * 側欄用它標示目前位置——單靠 routerLinkActive 的完全比對，建單與訂單詳情時側欄不會亮任何一項。
   */
  protected readonly activeRoute = signal<string | null>(null);
  /** 目前頁面是「滿版頁」（路由 data 標記，見 layout/fill-page.ts）：主內容區撐滿頁首與頁尾之間的高度。 */
  protected readonly fillPage = signal(false);

  protected readonly flyoutPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top', offsetX: 8 },
    { originX: 'end', originY: 'bottom', overlayX: 'start', overlayY: 'bottom', offsetX: 8 },
  ];

  @ViewChild(MatSidenavContainer) private sidenavContainer?: MatSidenavContainer;

  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.breakpointObserver.observe(['(max-width: 900px)']).subscribe((result) => {
      this.isMobile = result.matches;
      this.isSidenavOpen = !result.matches;
      if (this.isMobile) {
        this.collapsed = false;
      }
    });

    this.router.events
      .pipe(
        filter((event) => event.type === 1),
        // 比對時去掉 query／fragment，`/orders/new?vehicleId=…` 這類帶參數的網址才對得到選單項目。
        map(() => this.router.url.split(/[?#]/)[0]),
      )
      .subscribe((url) => {
        const active =
          this.navLeaves.find((item) => item.route === url) ??
          this.navLeaves
            .filter((item) => url.startsWith(`${item.route}/`))
            .sort((a, b) => b.route.length - a.route.length)[0] ??
          this.navLeaves.find((item) => item.matchPrefixes?.some((p) => url.startsWith(p)));

        const activeGroup = active
          ? this.navItems.find(
              (entry): entry is NavGroup => isNavGroup(entry) && entry.children.includes(active),
            )
          : undefined;
        this.currentGroupLabel = activeGroup?.label ?? null;
        this.activeRoute.set(active?.route ?? null);

        if (activeGroup) {
          this.openGroupLabel = activeGroup.label;
        }

        // 2.1：找不到選單對應時不再退回「總覽」（會誤導，例如原本的設定頁）。
        // 目前每個沒有選單對應的路由（登入、設定）都會用 provideHeaderTitle() 蓋過這個預設值，
        // 這裡只是沒有任何一方覆寫時的保底，避免顯示錯誤的標題。
        this.defaultTitle = {
          title: active?.label ?? '',
          breadcrumbs: activeGroup ? [{ label: activeGroup.label }] : [],
        };
        this.fillPage.set(isFillPageRoute(this.router.routerState.snapshot.root));
      });
  }

  protected toggleSidenav(): void {
    this.isSidenavOpen = !this.isSidenavOpen;
  }

  protected toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    this.openGroupLabel = null;
  }

  protected onSidenavTransitionEnd(): void {
    this.sidenavContainer?.updateContentMargins();
  }

  protected onNavClick(): void {
    if (this.isMobile) {
      this.isSidenavOpen = false;
    }
  }

  protected toggleGroup(label: string): void {
    this.openGroupLabel = this.openGroupLabel === label ? null : label;
  }
}
