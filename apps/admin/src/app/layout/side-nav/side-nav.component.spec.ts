import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SideNavComponent } from './side-nav.component';
import { NavEntry } from './nav-item.model';

describe('SideNavComponent', () => {
  const navItems: NavEntry[] = [
    { route: '/', label: '首頁', icon: 'home' },
    {
      label: '資料呈現',
      icon: 'table_view',
      children: [{ route: '/components/data-table', label: '資料表', icon: 'table' }],
    },
  ];

  function setup() {
    const fixture = TestBed.createComponent(SideNavComponent);
    fixture.componentRef.setInput('navItems', navItems);
    fixture.componentRef.setInput('collapsed', false);
    fixture.componentRef.setInput('isMobile', false);
    fixture.componentRef.setInput('openGroupLabel', null);
    fixture.componentRef.setInput('currentGroupLabel', null);
    fixture.componentRef.setInput('flyoutPositions', []);
    return fixture;
  }

  function openUserMenu(fixture: ReturnType<typeof setup>): HTMLElement {
    const userCard = fixture.nativeElement.querySelector('.user-card') as HTMLButtonElement;
    userCard.click();
    fixture.detectChanges();
    return document.body;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SideNavComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { logout: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('渲染導覽項目與群組', () => {
    const fixture = setup();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('首頁');
    expect(text).toContain('資料呈現');
  });

  it('側欄品牌不是 h1（頁面唯一的 h1 是頁首的大標題），但品牌文字仍顯示', () => {
    const fixture = setup();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('h1')).toHaveLength(0);
    expect(el.querySelector('.brand')?.textContent).toContain('Admin Template');
  });

  it('點擊群組觸發 toggleGroup 事件', () => {
    const fixture = setup();
    fixture.detectChanges();
    let emitted: string | undefined;
    fixture.componentInstance.toggleGroup.subscribe((label: string) => (emitted = label));
    const trigger = (fixture.nativeElement as HTMLElement).querySelector(
      '.nav-group-trigger',
    ) as HTMLButtonElement;
    trigger.click();
    expect(emitted).toBe('資料呈現');
  });

  it('currentGroupLabel 命中時群組按鈕加上 active class', () => {
    const fixture = setup();
    fixture.componentRef.setInput('currentGroupLabel', '資料呈現');
    fixture.detectChanges();
    const trigger = (fixture.nativeElement as HTMLElement).querySelector('.nav-group-trigger');
    expect(trigger?.classList.contains('active')).toBe(true);
  });

  it('activeRoute 對到的選單項目亮起並標 aria-current="page"——含群組內的子項目；其他項目不亮', () => {
    const fixture = setup();
    fixture.componentRef.setInput('openGroupLabel', '資料呈現');
    fixture.componentRef.setInput('activeRoute', '/components/data-table');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const sublink = el.querySelector('.nav-sublink');
    expect(sublink?.classList.contains('active')).toBe(true);
    expect(sublink?.getAttribute('aria-current')).toBe('page');
    const home = el.querySelector('a.nav-link');
    expect(home?.classList.contains('active')).toBe(false);
    expect(home?.hasAttribute('aria-current')).toBe(false);

    fixture.componentRef.setInput('activeRoute', '/');
    fixture.detectChanges();
    expect(el.querySelector('a.nav-link')?.classList.contains('active')).toBe(true);
    expect(el.querySelector('.nav-sublink')?.classList.contains('active')).toBe(false);
  });

  it('沒有對應的選單項目（例如設定頁）時一項都不亮', () => {
    const fixture = setup();
    fixture.componentRef.setInput('openGroupLabel', '資料呈現');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.active')).toHaveLength(0);
  });

  it('使用者選單顯示設定與登出', () => {
    const fixture = setup();
    fixture.detectChanges();
    const text = openUserMenu(fixture).textContent ?? '';

    expect(text).toContain('設定');
    expect(text).toContain('登出');
    expect(text).not.toContain('Item 1');
    expect(text).not.toContain('Item 2');
  });

  it('設定選單項目連結到設定頁', () => {
    const fixture = setup();
    fixture.detectChanges();
    const settings = openUserMenu(fixture).querySelector(
      '[data-menu-action="settings"]',
    );

    expect(settings?.getAttribute('href')).toBe('/settings');
  });

  it('點擊登出選單項目呼叫 AuthService.logout', () => {
    const fixture = setup();
    fixture.detectChanges();
    const auth = TestBed.inject(AuthService);
    const logout = vi.mocked(auth.logout);
    const logoutButton = openUserMenu(fixture).querySelector(
      '[data-menu-action="logout"]',
    ) as HTMLButtonElement;

    logoutButton.click();

    expect(logout).toHaveBeenCalledOnce();
  });
});
