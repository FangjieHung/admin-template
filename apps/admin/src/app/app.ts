import { Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { ConnectedPosition } from '@angular/cdk/overlay';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { AppearancePanelService } from '@admin-template/theme-pack';
import { AccessService, rerunGuardsOnAccessChange } from '@admin-template/access';
// 面板元件單獨走這條深路徑（不經過 barrel），讓 @defer 能把它與
// @angular/cdk/drag-drop 拆進獨立 chunk——barrel（index.ts）同時匯出 AppearancePanelService，
// 若跟它共用同一個 import 語句／模組，AppearancePanelService 的 eager 使用會拖著整個 barrel
// （含面板元件）一起被主 bundle 靜態引入，defer 就無法把它轉成動態 import。
import { FloatingAppearancePanelComponent } from '@admin-template/theme-pack/floating-appearance-panel';
import { ZH_TW_SHELL } from './core/i18n/zh-tw-shell';
import { SideNavComponent } from './layout/side-nav/side-nav.component';
import { NavEntry, NavGroup, filterNav, isNavGroup } from './layout/side-nav/nav-item.model';
import { HeaderComponent } from './layout/header/header.component';
import { HeaderTitleData } from './layout/header/header-title';
import { FooterComponent } from './layout/footer/footer.component';
import { isFillPageRoute } from './layout/fill-page';
import { SHOWCASE_ENTRIES, SHOWCASE_GROUPS, showcaseRoute } from './showcase/showcase-registry';

function buildNavItems(): NavEntry[] {
  const t = ZH_TW_SHELL.nav;
  return SHOWCASE_GROUPS.map((group) => ({
    label: group.label,
    icon: group.icon,
    children: [
      ...(group.id === 'overview' ? [{ route: '/', label: t.home, icon: 'home' }] : []),
      ...SHOWCASE_ENTRIES.filter((entry) => entry.group === group.id).map((entry) => ({
        route: showcaseRoute(entry),
        label: entry.title,
        icon: entry.icon,
        ...(entry.access ? { access: entry.access } : {}),
      })),
      // 還沒做的頁面樣板列在 /templates。
      ...(group.id === 'templates' ? [{ route: '/templates', label: t.plannedTemplates, icon: 'pending' }] : []),
    ],
  }));
}

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    MatSidenav,
    MatSidenavContainer,
    MatSidenavContent,
    SideNavComponent,
    HeaderComponent,
    FooterComponent,
    FloatingAppearancePanelComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly t = ZH_TW_SHELL;

  private readonly access = inject(AccessService);
  private readonly allNavItems: NavEntry[] = buildNavItems();

  /**
   * 側欄：總覽群組（首頁＋展示目錄的 overview 項目）、各元件群組，頁面樣板群組最後是規劃中的樣板。
   * 目前身分沒有「檢視」權限的頁面不列出（libs/access），換身分時自動更新。
   */
  protected readonly navItems = computed(() => filterNav(this.allNavItems, (check) => this.access.can(check)));

  // 目前位置（頁首標題、側欄亮哪一項）用完整清單比對，跟權限過濾無關。
  private readonly navLeaves = this.allNavItems.flatMap((entry) =>
    isNavGroup(entry) ? entry.children : [entry],
  );

  protected isMobile = false;
  protected isSidenavOpen = true;
  // 頁首的預設標題／麵包屑：由側欄選單算出，頁面可以用 provideHeaderTitle() 覆寫（header-title.ts）。
  protected defaultTitle: HeaderTitleData = { title: String(this.t.nav.home), breadcrumbs: [] };
  // 側欄群組的 active 樣式仍需要知道目前群組是誰，跟頁首的麵包屑分開維護。
  protected currentGroupLabel: string | null = null;
  protected openGroupLabel: string | null = null;
  protected collapsed = false;
  /**
   * 目前頁面對應的選單項目（含 matchPrefixes 的歸屬）。
   * 側欄用它標示目前位置——單靠 routerLinkActive 的完全比對，子頁面時側欄不會亮任何一項。
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
  // 面板開關的 signal 讓 app.html 的 @defer 決定要不要載入面板本身（含拖曳模組）。
  protected readonly appearancePanel = inject(AppearancePanelService);

  constructor() {
    // 換身分或改角色後重新檢查目前這一頁的權限（沒有權限 ↔ 原頁面）。
    rerunGuardsOnAccessChange();
  }

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
        // 比對時去掉 query／fragment，帶參數的網址才對得到選單項目。
        map(() => this.router.url.split(/[?#]/)[0]),
      )
      .subscribe((url) => {
        const active =
          this.navLeaves.find((item) => item.route === url) ??
          this.navLeaves
            .filter((item) => item.route !== '/' && url.startsWith(`${item.route}/`))
            .sort((a, b) => b.route.length - a.route.length)[0] ??
          this.navLeaves.find((item) => item.matchPrefixes?.some((p) => url.startsWith(p)));

        const activeGroup = active
          ? this.allNavItems.find(
              (entry): entry is NavGroup => isNavGroup(entry) && entry.children.includes(active),
            )
          : undefined;
        this.currentGroupLabel = activeGroup?.label ?? null;
        this.activeRoute.set(active?.route ?? null);

        if (activeGroup) {
          this.openGroupLabel = activeGroup.label;
        }

        // 找不到選單對應時不退回「首頁」（會誤導）。沒有選單對應的路由（登入、設定）
        // 都會用 provideHeaderTitle() 蓋過這個預設值，這裡只是沒有任何一方覆寫時的保底。
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
