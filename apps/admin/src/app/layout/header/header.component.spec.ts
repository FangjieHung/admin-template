import { describe, it, expect, vi } from 'vitest';
import { Component, TemplateRef, ViewChild, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HeaderComponent } from './header.component';
import { HeaderTitleData, HeaderTitleSlot } from './header-title';
import { HeaderTitleExtraSlot } from './header-title-extra-slot';
import { HeaderToolbarSlot } from './header-toolbar-slot';
import { NotificationCenterService } from '../../core/notifications/notification-center.service';

function setup(defaultTitle: HeaderTitleData) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(HeaderComponent);
  fixture.componentRef.setInput('defaultTitle', defaultTitle);
  fixture.detectChanges();
  return fixture;
}

describe('HeaderComponent 由選單推得的標題（defaultTitle，沒有頁面覆寫時）', () => {
  it('顯示大標題與麵包屑；麵包屑是可點的連結、大標題是唯一的 h1', () => {
    const fixture = setup({
      title: '資料表',
      breadcrumbs: [{ label: '資料呈現' }],
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(el.querySelector('h1')?.textContent).toBe('資料表');
    expect(el.querySelector('.breadcrumb-text')?.textContent).toBe('資料呈現');
    // 群組本身沒有對應頁面，麵包屑那一層不可點。
    expect(el.querySelector('.breadcrumb-link')).toBeNull();
  });

  it('麵包屑節點有 route 時渲染成可點的連結', () => {
    const fixture = setup({
      title: '聯絡人',
      breadcrumbs: [{ label: '資料呈現', route: '/components' }],
    });
    const link = fixture.nativeElement.querySelector('.breadcrumb-link') as HTMLAnchorElement;
    expect(link.textContent).toBe('資料呈現');
    expect(link.getAttribute('href')).toBe('/components');
  });

  it('沒有上層路徑時不顯示麵包屑，只有大標題', () => {
    const fixture = setup({ title: '首頁', breadcrumbs: [] });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.breadcrumb-link, .breadcrumb-text')).toBeNull();
    expect(el.querySelector('h1')?.textContent).toBe('首頁');
  });

  it('麵包屑自成一列（.topbar-crumbs），大標在下一列；沒有麵包屑時不留空的那一列', () => {
    // nav 是直排：寬度取較寬的那一列，不是麵包屑＋大標相加（手機上短標題不會把右側按鈕擠到下一列）。
    const withCrumbs = setup({ title: '工單 TK-2048', breadcrumbs: [{ label: '頁面樣板' }, { label: '工單' }] });
    const nav = (withCrumbs.nativeElement as HTMLElement).querySelector('.topbar-title') as HTMLElement;
    const rows = Array.from(nav.children).map((c) => c.className);
    expect(rows).toEqual(['topbar-crumbs', 'topbar-heading']);
    expect(nav.querySelectorAll('.topbar-crumbs .breadcrumb-text')).toHaveLength(2);
    // 標題字包在 span 裡：省略號裁的是 span，質地畫在 h1 上的裝飾（偽元素）不受影響。
    expect(nav.querySelector('h1 > span')?.textContent).toBe('工單 TK-2048');
    TestBed.resetTestingModule();

    const noCrumbs = setup({ title: '首頁', breadcrumbs: [] });
    expect((noCrumbs.nativeElement as HTMLElement).querySelector('.topbar-crumbs')).toBeNull();
  });

  it('找不到選單對應時的退回行為：顯示 defaultTitle 給的內容（由 App 算出，不寫死「首頁」）', () => {
    // App 對找不到選單對應的路由算出空標題（不退回「首頁」）；header 單純忠實顯示 defaultTitle。
    const fixture = setup({ title: '', breadcrumbs: [] });
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toBe('');
  });

  it('點擊選單按鈕觸發 menuToggle 事件', () => {
    const fixture = setup({ title: '資料表', breadcrumbs: [] });
    let emitted = false;
    fixture.componentInstance.menuToggle.subscribe(() => (emitted = true));
    (fixture.nativeElement.querySelector('.menu-toggle') as HTMLButtonElement).click();
    expect(emitted).toBe(true);
  });
});

describe('HeaderComponent 頁面覆寫的標題與麵包屑（HeaderTitleSlot）', () => {
  it('HeaderTitleSlot 有登記值時蓋過 defaultTitle，並可帶「← 返回」目的地', () => {
    const fixture = setup({ title: '資料表', breadcrumbs: [{ label: '資料呈現' }] });
    const slot = TestBed.inject(HeaderTitleSlot);
    slot.entry.set({
      owner: {},
      value: { title: '官網改版', breadcrumbs: [{ label: '資料呈現', route: '/components' }], backTo: '/' },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(el.querySelector('h1')?.textContent).toBe('官網改版');
    expect(el.querySelector('.breadcrumb-link')?.textContent).toBe('資料呈現');
    const back = el.querySelector('.topbar-back') as HTMLAnchorElement;
    expect(back).not.toBeNull();
    expect(back.getAttribute('href')).toBe('/');
  });

  it('沒有 backTo 時不顯示返回按鈕', () => {
    const fixture = setup({ title: '聯絡人', breadcrumbs: [] });
    expect(fixture.nativeElement.querySelector('.topbar-back')).toBeNull();
  });
});

@Component({
  template: `<ng-template #tpl><span class="extra-badge">狀態</span></ng-template>`,
})
class ExtraTemplateHost {
  @ViewChild('tpl', { static: true }) tpl!: TemplateRef<unknown>;
}

describe('HeaderComponent 標題旁自訂內容（HeaderTitleExtraSlot）', () => {
  it('插槽登記模板時渲染在大標題旁；沒有登記時不渲染任何東西', () => {
    const fixture = setup({ title: '官網改版', breadcrumbs: [] });
    expect(fixture.nativeElement.querySelector('.extra-badge')).toBeNull();

    const hostFixture = TestBed.createComponent(ExtraTemplateHost);
    hostFixture.detectChanges();
    TestBed.inject(HeaderTitleExtraSlot).template.set(hostFixture.componentInstance.tpl);
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector('.topbar-heading') as HTMLElement;
    expect(heading.querySelector('.extra-badge')?.textContent).toBe('狀態');
  });
});

describe('HeaderComponent 右側 toolbar 插槽（既有行為，維持不變）', () => {
  it('HeaderToolbarSlot 有登記模板時渲染在 .topbar-toolbar', () => {
    const fixture = setup({ title: '資料表', breadcrumbs: [] });
    const hostFixture = TestBed.createComponent(ExtraTemplateHost);
    hostFixture.detectChanges();
    TestBed.inject(HeaderToolbarSlot).template.set(hostFixture.componentInstance.tpl);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.topbar-toolbar .extra-badge')?.textContent).toBe('狀態');
  });
});

describe('HeaderComponent 全站動作一組（全站搜尋＋通知），跟頁面工具列分開', () => {
  // 通知中心換成替身：真的服務會在畫面渲染後動態載入通知資料，載入完成時這個測試檔可能已經結束（EnvironmentTeardownError）。
  function setupGlobal() {
    const center = { unread: signal(0), panelOpen: signal(false), toggle: vi.fn(), load: vi.fn() };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: NotificationCenterService, useValue: center }],
    });
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.componentRef.setInput('defaultTitle', { title: '工單', breadcrumbs: [] });
    fixture.detectChanges();
    return fixture;
  }

  it('全站搜尋與鈴鐺放在同一個 .topbar-global；全站搜尋的名稱讀得出「全站」，保留快捷鍵說明', () => {
    const fixture = setupGlobal();
    const group = fixture.nativeElement.querySelector('.topbar-global') as HTMLElement;
    expect(Array.from(group.children).map((b) => b.classList.contains('topbar-search') || b.classList.contains('topbar-bell'))).toEqual([true, true]);
    const search = group.querySelector('.topbar-search') as HTMLButtonElement;
    // 寬螢幕的「搜尋全站…」是 ::before 的 attr(aria-label)，看得到的字與念出來的名稱是同一個。
    expect(search.getAttribute('aria-label')).toBe('搜尋全站');
    expect(search.getAttribute('aria-keyshortcuts')).toMatch(/^(Meta|Control)\+K \/$/);
    expect(search.dataset['kbd']).toMatch(/^(⌘K|Ctrl K)$/);
    expect(search.textContent?.trim()).toBe('search');
  });

  it('有頁面工具列時，.topbar-toolbar 緊接在全站動作前面（分隔線 .topbar-toolbar + .topbar-global::before 才畫得出來）', () => {
    const fixture = setupGlobal();
    expect(fixture.nativeElement.querySelector('.topbar-toolbar + .topbar-global')).toBeNull();

    const hostFixture = TestBed.createComponent(ExtraTemplateHost);
    hostFixture.detectChanges();
    TestBed.inject(HeaderToolbarSlot).template.set(hostFixture.componentInstance.tpl);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.topbar-toolbar + .topbar-global')).not.toBeNull();
  });
});

describe('HeaderComponent 通知鈴鐺', () => {
  function setupBell() {
    const center = { unread: signal(0), panelOpen: signal(false), toggle: vi.fn(), load: vi.fn() };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: NotificationCenterService, useValue: center }],
    });
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.componentRef.setInput('defaultTitle', { title: '首頁', breadcrumbs: [] });
    fixture.detectChanges();
    const bell = fixture.nativeElement.querySelector('.topbar-bell') as HTMLButtonElement;
    return { fixture, center, bell };
  }

  it('沒有未讀時不顯示徽章（沒有 data-count），名稱是「通知」', () => {
    const { bell } = setupBell();
    expect(bell.hasAttribute('data-count')).toBe(false);
    expect(bell.getAttribute('aria-label')).toBe('通知');
    expect(bell.getAttribute('aria-haspopup')).toBe('dialog');
    expect(bell.getAttribute('aria-expanded')).toBe('false');
    expect(bell.hasAttribute('aria-controls')).toBe(false);
  });

  it('有未讀時顯示數字並念出「N 則未讀」；超過 99 顯示 99+', () => {
    const { fixture, center, bell } = setupBell();
    center.unread.set(3);
    fixture.detectChanges();
    expect(bell.getAttribute('data-count')).toBe('3');
    expect(bell.getAttribute('aria-label')).toBe('通知，3 則未讀');
    center.unread.set(128);
    fixture.detectChanges();
    expect(bell.getAttribute('data-count')).toBe('99+');
    expect(bell.getAttribute('aria-label')).toBe('通知，128 則未讀');
  });

  it('點鈴鐺切換面板；面板開著時 aria-expanded 與 aria-controls 指向面板', () => {
    const { fixture, center, bell } = setupBell();
    bell.click();
    expect(center.toggle).toHaveBeenCalledTimes(1);
    center.panelOpen.set(true);
    fixture.detectChanges();
    expect(bell.getAttribute('aria-expanded')).toBe('true');
    expect(bell.getAttribute('aria-controls')).toBe('app-notification-panel');
  });
});
