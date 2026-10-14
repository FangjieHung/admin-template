import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { MatSidenav } from '@angular/material/sidenav';
import { AccessService, provideAccess } from '@admin-template/access';
import { App } from './app';
import { DEMO_ACCESS_CONFIG } from './core/access/demo-access';
import { FILL_PAGE_DATA_KEY } from './layout/fill-page';
import { NavEntry, NavGroup, isNavGroup } from './layout/side-nav/nav-item.model';
import { SHOWCASE_ENTRIES, SHOWCASE_GROUPS, showcaseRoute } from './showcase/showcase-registry';

@Component({ template: '' })
class BlankComponent {}

describe('App（展示 app 的殼層）', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideAccess(DEMO_ACCESS_CONFIG),
        provideRouter([
          { path: '', pathMatch: 'full', component: BlankComponent },
          ...SHOWCASE_ENTRIES.map((e) => ({ path: showcaseRoute(e).slice(1), component: BlankComponent })),
          { path: 'templates', component: BlankComponent },
          { path: 'templates/tickets/:id', component: BlankComponent },
          { path: 'settings', component: BlankComponent },
          { path: 'fill', component: BlankComponent, data: { [FILL_PAGE_DATA_KEY]: true } },
        ]),
      ],
    }).compileComponents();
  });

  function groupOf(navItems: NavEntry[], label: string): NavGroup | undefined {
    return navItems.find((entry): entry is NavGroup => isNavGroup(entry) && entry.label === label);
  }

  /** 側欄目前亮起的子項目名稱（去掉圖示字型的 ligature 文字）。 */
  function activeSublinkLabels(root: HTMLElement): (string | undefined)[] {
    return Array.from(root.querySelectorAll('.nav-sublink.active')).map((a) =>
      a.querySelector('span:not(.nav-icon)')?.textContent?.trim(),
    );
  }

  it('側欄品牌是 Admin Template／元件範本', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const brand = (fixture.nativeElement as HTMLElement).querySelector('.brand')?.textContent ?? '';
    expect(brand).toContain('Admin Template');
    expect(brand).toContain('元件範本');
  });

  it('側欄：每個展示分組一個群組；頁面樣板群組最後一項是規劃中的樣板', () => {
    const navItems: NavEntry[] = TestBed.createComponent(App).componentInstance['navItems']();

    expect(navItems.map((entry) => entry.label)).toEqual(SHOWCASE_GROUPS.map((g) => g.label));
    expect(groupOf(navItems, '總覽')?.children.map((c) => c.route)).toEqual(['/', '/components/material']);
    expect(groupOf(navItems, '頁面樣板')?.children.at(-1)).toEqual({ route: '/templates', label: '規劃中的樣板', icon: 'pending' });
    // 每個展示頁都出現在側欄裡（系統管理員看得到全部），而且只出現一次。
    const routes = navItems.flatMap((e) => (isNavGroup(e) ? e.children : [e])).map((l) => l.route);
    for (const entry of SHOWCASE_ENTRIES) {
      expect(routes.filter((r) => r === showcaseRoute(entry))).toHaveLength(1);
    }
    // 頁面樣板（儀表板、工單三頁、登入、設定頁、全部通知、空白頁）連到自己的網址，不在 /components 底下。
    expect(groupOf(navItems, '頁面樣板')?.children.map((c) => c.route)).toEqual([
      '/components/roles',
      '/components/error-pages',
      '/templates/dashboard',
      '/templates/tickets',
      '/templates/tickets/TK-2048',
      '/templates/tickets/TK-2048/edit',
      '/login',
      '/templates/settings',
      '/templates/notifications',
      '/templates/blank',
      '/templates',
    ]);
  });

  it('側欄依權限過濾：沒有「設定・檢視」的主管、成員看不到「角色與權限」，換身分立刻更新', async () => {
    const fixture = TestBed.createComponent(App);
    const access = TestBed.inject(AccessService);
    await fixture.whenStable();
    const templateChildren = () =>
      groupOf(fixture.componentInstance['navItems'](), '頁面樣板')?.children.map((c) => c.label) ?? [];

    expect(templateChildren()).toContain('角色與權限');
    access.signIn('u-manager');
    expect(templateChildren()).not.toContain('角色與權限');
    expect(templateChildren()).toContain('錯誤頁');
    access.signIn('u-viewer');
    expect(templateChildren()).toContain('角色與權限');

    access.signIn('u-member');
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.user-card')?.textContent).toContain('王小明');
    expect(el.querySelector('.user-card')?.textContent).toContain('成員');
  });

  it('首頁：頁首標題「首頁」、麵包屑「總覽」，側欄亮「首頁」', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const router = TestBed.inject(Router);
    await fixture.whenStable();

    await router.navigateByUrl('/');
    fixture.detectChanges();

    expect(app['defaultTitle']).toEqual({ title: '首頁', breadcrumbs: [{ label: '總覽' }] });
    expect(activeSublinkLabels(fixture.nativeElement as HTMLElement)).toEqual(['首頁']);
  });

  it('元件頁：頁首「分組 › 元件名稱」，整個殼只有一個 h1，側欄群組展開並亮起該項', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const router = TestBed.inject(Router);
    await fixture.whenStable();

    await router.navigateByUrl('/components/data-table?q=x');
    fixture.detectChanges();

    expect(app['defaultTitle']).toEqual({ title: '資料表', breadcrumbs: [{ label: '資料呈現' }] });
    expect(app['openGroupLabel']).toBe('資料呈現');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(el.querySelector('h1')?.textContent).toBe('資料表');
    expect(activeSublinkLabels(el)).toEqual(['資料表']);
    expect(el.querySelector('.nav-sublink.active')?.getAttribute('aria-current')).toBe('page');
  });

  it('找不到選單對應的路由：標題留空（由頁面自己的 provideHeaderTitle 覆寫）', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const router = TestBed.inject(Router);
    await fixture.whenStable();

    await router.navigateByUrl('/settings');
    expect(app['defaultTitle']).toEqual({ title: '', breadcrumbs: [] });
    expect(app['currentGroupLabel']).toBeNull();
  });

  it('登入頁不套殼層：側欄收起、頁首與頁尾不顯示；離開登入頁後殼層回來（router-outlet 始終是同一個）', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const sidenav = () => fixture.debugElement.query(By.directive(MatSidenav)).componentInstance as MatSidenav;
    const hidden = (selector: string) => (el.querySelector(selector) as HTMLElement).style.display === 'none';
    const outlet = el.querySelector('router-outlet');

    await router.navigateByUrl('/login?returnUrl=%2F');
    fixture.detectChanges();
    expect([sidenav().opened, hidden('app-header'), hidden('app-footer')]).toEqual([false, true, true]);
    expect(el.querySelector('router-outlet')).toBe(outlet);

    await router.navigateByUrl('/');
    fixture.detectChanges();
    expect([sidenav().opened, hidden('app-header'), hidden('app-footer')]).toEqual([true, false, false]);
  });

  it('工單詳情（側欄沒有完全相同的網址）：亮最接近的「列表頁」；表單頁亮「表單頁」', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    await router.navigateByUrl('/templates/tickets/TK-2050');
    fixture.detectChanges();
    expect(activeSublinkLabels(el)).toEqual(['列表頁']);

    await router.navigateByUrl('/templates/tickets/TK-2048/edit');
    fixture.detectChanges();
    expect(activeSublinkLabels(el)).toEqual(['表單頁']);
  });

  it('標記為滿版頁的路由：主內容區加上 page-shell--fill；其他頁面沒有', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await fixture.whenStable();
    const shell = () => (fixture.nativeElement as HTMLElement).querySelector('.page-shell') as HTMLElement;

    await router.navigateByUrl('/fill');
    fixture.detectChanges();
    expect(shell().classList.contains('page-shell--fill')).toBe(true);

    await router.navigateByUrl('/');
    fixture.detectChanges();
    expect(shell().classList.contains('page-shell--fill')).toBe(false);
  });
});
