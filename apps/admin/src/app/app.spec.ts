import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { FILL_PAGE_DATA_KEY } from './layout/fill-page';
import { NavEntry, NavGroup, isNavGroup } from './layout/side-nav/nav-item.model';
import { SHOWCASE_ENTRIES, SHOWCASE_GROUPS } from './showcase/showcase-registry';

@Component({ template: '' })
class BlankComponent {}

describe('App（展示 app 的殼層）', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: '', pathMatch: 'full', component: BlankComponent },
          ...SHOWCASE_ENTRIES.map((e) => ({ path: `components/${e.id}`, component: BlankComponent })),
          { path: 'templates', component: BlankComponent },
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

  it('側欄：每個展示分組一個群組，最後是標「規劃中」的頁面樣板', () => {
    const navItems: NavEntry[] = TestBed.createComponent(App).componentInstance['navItems'];

    expect(navItems.map((entry) => entry.label)).toEqual([...SHOWCASE_GROUPS.map((g) => g.label), '頁面樣板']);
    expect(groupOf(navItems, '總覽')?.children.map((c) => c.route)).toEqual(['/', '/components/material']);
    expect(navItems.at(-1)).toEqual({ route: '/templates', label: '頁面樣板', icon: 'web', badge: '規劃中' });
    // 每個展示頁都出現在側欄裡，而且只出現一次。
    const routes = navItems.flatMap((e) => (isNavGroup(e) ? e.children : [e])).map((l) => l.route);
    for (const entry of SHOWCASE_ENTRIES) {
      expect(routes.filter((r) => r === `/components/${entry.id}`)).toHaveLength(1);
    }
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
