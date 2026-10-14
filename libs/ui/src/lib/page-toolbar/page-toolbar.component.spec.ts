import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PAGE_TOOLBAR_LABELS, PageToolbarComponent } from './page-toolbar.component';

const LABELS = {
  search: '搜尋',
  toggleSearch: '搜尋此列表',
  collapseSearch: '收合搜尋',
  clearSearch: '清除搜尋',
  submitSearch: '搜尋',
  clearFilters: '清除篩選',
};

function setup() {
  TestBed.configureTestingModule({ providers: [{ provide: PAGE_TOOLBAR_LABELS, useValue: LABELS }] });
  const fixture = TestBed.createComponent(PageToolbarComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    component: fixture.componentInstance,
    toggleBtn: () => el.querySelector('.search__toggle') as HTMLButtonElement,
    input: () => el.querySelector('.search__input') as HTMLInputElement,
    container: () => el.querySelector('.search') as HTMLElement,
    clearBtn: () => el.querySelector('.search__clear') as HTMLButtonElement | null,
    submitBtn: () => el.querySelector('.search__submit') as HTMLButtonElement | null,
  };
}

describe('PageToolbarComponent 展開收合', () => {
  it('初始為收合狀態', () => {
    const { component, container } = setup();
    expect(component.expanded()).toBe(false);
    expect(container().classList.contains('search--expanded')).toBe(false);
  });

  it('點放大鏡會展開', () => {
    const { fixture, component, toggleBtn, container } = setup();
    toggleBtn().click();
    fixture.detectChanges();
    expect(component.expanded()).toBe(true);
    expect(container().classList.contains('search--expanded')).toBe(true);
  });

  it('展開時點放大鏡會清空文字並收合', () => {
    const { fixture, component, toggleBtn } = setup();
    toggleBtn().click();
    fixture.detectChanges();
    component.query.set('ABC');
    fixture.detectChanges();

    toggleBtn().click();
    fixture.detectChanges();

    expect(component.query()).toBe('');
    expect(component.expanded()).toBe(false);
  });
});

describe('PageToolbarComponent 列表搜尋鈕（跟頁首的全站搜尋分開）', () => {
  it('收合時 aria-label 是 toggleSearch，圖示是 manage_search；展開後改成 collapseSearch', () => {
    const { fixture, toggleBtn } = setup();
    expect(toggleBtn().getAttribute('aria-label')).toBe('搜尋此列表');
    expect(toggleBtn().textContent?.trim()).toBe('manage_search');

    toggleBtn().click();
    fixture.detectChanges();
    expect(toggleBtn().getAttribute('aria-label')).toBe('收合搜尋');
  });

  it('沒給 placeholder 時，搜尋框的 placeholder 仍是 labels.search', () => {
    const { input } = setup();
    expect(input().placeholder).toBe('搜尋');
  });
});

describe('PageToolbarComponent 清除與 Esc', () => {
  it('沒有文字時不顯示清除鈕', () => {
    const { fixture, toggleBtn, clearBtn } = setup();
    toggleBtn().click();
    fixture.detectChanges();
    expect(clearBtn()).toBeNull();
  });

  it('點放大鏡會同步把焦點移到 input（不得跨非同步邊界）', () => {
    const { toggleBtn, input } = setup();
    const el = input();
    toggleBtn().click();
    // 刻意不呼叫 detectChanges：focus 必須在 click 的同步流程中完成。
    expect(document.activeElement).toBe(el);
  });

  it('按 Esc 收合後，焦點回到放大鏡按鈕', () => {
    const { fixture, toggleBtn, input } = setup();
    toggleBtn().click();
    fixture.detectChanges();

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(document.activeElement).toBe(toggleBtn());
  });

  it('點清除鈕會清空文字但維持展開', () => {
    const { fixture, component, toggleBtn, clearBtn } = setup();
    toggleBtn().click();
    fixture.detectChanges();
    component.query.set('ABC');
    fixture.detectChanges();

    clearBtn()!.click();
    fixture.detectChanges();

    expect(component.query()).toBe('');
    expect(component.expanded()).toBe(true);
  });

  it('按 Esc 會清空文字並收合', () => {
    const { fixture, component, toggleBtn, input } = setup();
    toggleBtn().click();
    fixture.detectChanges();
    component.query.set('ABC');
    fixture.detectChanges();

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(component.query()).toBe('');
    expect(component.expanded()).toBe(false);
  });
});

describe('PageToolbarComponent 搜尋送出', () => {
  it('沒有文字時不顯示送出鈕', () => {
    const { fixture, toggleBtn, submitBtn } = setup();
    toggleBtn().click();
    fixture.detectChanges();

    expect(submitBtn()).toBeNull();
  });

  it('有非空白文字時顯示送出鈕', () => {
    const { fixture, component, toggleBtn, submitBtn } = setup();
    toggleBtn().click();
    fixture.detectChanges();
    component.query.set('ABC');
    fixture.detectChanges();

    expect(submitBtn()).not.toBeNull();
  });

  it('點擊送出鈕會送出清除前後空白的搜尋文字', () => {
    const { fixture, component, toggleBtn, submitBtn } = setup();
    const emitted: string[] = [];
    component.searchSubmit.subscribe((query) => emitted.push(query));
    toggleBtn().click();
    fixture.detectChanges();
    component.query.set('  ABC  ');
    fixture.detectChanges();

    submitBtn()!.click();

    expect(emitted).toEqual(['ABC']);
  });

  it('按 Enter 會送出清除前後空白的搜尋文字', () => {
    const { fixture, component, toggleBtn, input } = setup();
    const emitted: string[] = [];
    component.searchSubmit.subscribe((query) => emitted.push(query));
    toggleBtn().click();
    fixture.detectChanges();
    component.query.set('  ABC  ');
    fixture.detectChanges();

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(emitted).toEqual(['ABC']);
  });

  it('只有空白文字時不送出搜尋', () => {
    const { fixture, component, toggleBtn, input } = setup();
    const emitted: string[] = [];
    component.searchSubmit.subscribe((query) => emitted.push(query));
    toggleBtn().click();
    fixture.detectChanges();
    component.query.set('   ');
    fixture.detectChanges();

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(emitted).toEqual([]);
  });
});

describe('PageToolbarComponent 失焦收合', () => {
  it('失焦時若為空白則收合', () => {
    const { fixture, component, toggleBtn, input } = setup();
    toggleBtn().click();
    fixture.detectChanges();

    input().dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();

    expect(component.expanded()).toBe(false);
  });

  it('失焦時若有文字則維持展開', () => {
    const { fixture, component, toggleBtn, input } = setup();
    toggleBtn().click();
    fixture.detectChanges();
    component.query.set('ABC');
    fixture.detectChanges();

    input().dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();

    expect(component.expanded()).toBe(true);
  });

  it('失焦時若只有空白字元則視為空並收合', () => {
    const { fixture, component, toggleBtn, input } = setup();
    toggleBtn().click();
    fixture.detectChanges();
    component.query.set('   ');
    fixture.detectChanges();

    input().dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();

    expect(component.expanded()).toBe(false);
  });
});
