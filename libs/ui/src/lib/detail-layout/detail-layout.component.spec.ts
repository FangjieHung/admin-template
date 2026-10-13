import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { OverlayContainer } from '@angular/cdk/overlay';
import { BehaviorSubject, map } from 'rxjs';
import { DETAIL_LAYOUT_COLLAPSE_QUERY, DETAIL_LAYOUT_STACK_QUERY, DetailLayoutComponent } from './detail-layout.component';
import { DETAIL_LAYOUT_LABELS, DetailLayoutLabels } from './detail-layout-labels';
import { DetailActionDirective, DetailActionsDirective, DetailAsideDirective, DetailTitleDirective } from './detail-layout-slots';

const LABELS: DetailLayoutLabels = { more: '更多動作', loading: '載入中' };

@Component({
  imports: [DetailLayoutComponent, DetailTitleDirective, DetailActionsDirective, DetailActionDirective, DetailAsideDirective],
  template: `
    <lib-detail-layout [loading]="loading()" asideLabel="摘要">
      <a libDetailBack href="#list">返回清單</a>
      <h2 libDetailTitle>工單 #TK-2048 印表機無法連線</h2>
      <div libDetailMeta><span class="meta-id">TK-2048</span></div>
      <div libDetailActions>
        <button type="button" class="act-edit" (click)="clicks.push('edit')">
          <span class="material-symbols-rounded" aria-hidden="true">edit</span>編輯
        </button>
        <button type="button" class="act-assign" libDetailSecondary (click)="clicks.push('assign')">
          <span class="material-symbols-rounded" aria-hidden="true">person_add</span>指派
        </button>
        <button type="button" class="act-close" libDetailSecondary disabled>關閉工單</button>
        @if (withOverflow()) {
          <button type="button" class="act-print" libDetailOverflow aria-label="列印工單" (click)="clicks.push('print')">列印</button>
        }
      </div>
      <nav libDetailTabs class="tabs">分頁</nav>
      <p class="main-content">主內容</p>
      @if (withAside()) {
        <section libDetailAside class="aside-content">摘要內容</section>
      }
    </lib-detail-layout>
  `,
})
class HostComponent {
  readonly loading = signal(false);
  readonly withAside = signal(true);
  readonly withOverflow = signal(false);
  readonly clicks: string[] = [];
}

/** 由測試決定哪些斷點成立。 */
const active = new BehaviorSubject<ReadonlySet<string>>(new Set());
const fakeBreakpoints = {
  observe: (queries: string[]) =>
    active.pipe(
      map((set) => ({
        matches: queries.some((q) => set.has(q)),
        breakpoints: Object.fromEntries(queries.map((q) => [q, set.has(q)])),
      })),
    ),
  isMatched: (q: string) => active.value.has(q),
};

/** 捕捉 IntersectionObserver 的 callback，由測試決定頁首有沒有捲出去。 */
let ioCallback: ((entries: Partial<IntersectionObserverEntry>[]) => void) | null = null;
class FakeIntersectionObserver {
  constructor(cb: (entries: Partial<IntersectionObserverEntry>[]) => void) {
    ioCallback = cb;
  }
  observe(): void {
    // 測試直接呼叫 callback，不需要真的觀察。
  }
  disconnect(): void {
    // 同上。
  }
}

describe('DetailLayoutComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let el: HTMLElement;
  const original = globalThis.IntersectionObserver;

  beforeEach(() => {
    active.next(new Set());
    ioCallback = null;
    (globalThis as { IntersectionObserver: unknown }).IntersectionObserver = FakeIntersectionObserver;
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: DETAIL_LAYOUT_LABELS, useValue: LABELS },
        { provide: BreakpointObserver, useValue: fakeBreakpoints },
      ],
    });
  });

  afterEach(() => {
    fixture?.destroy();
    (globalThis as { IntersectionObserver: unknown }).IntersectionObserver = original;
  });

  async function render(setup?: (host: HostComponent) => void) {
    fixture = TestBed.createComponent(HostComponent);
    setup?.(fixture.componentInstance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  const layout = () => el.querySelector('lib-detail-layout') as HTMLElement;
  const isShown = (node: Element | null) => !!node && getComputedStyle(node as HTMLElement).display !== 'none';

  async function openMenu(button: HTMLElement): Promise<HTMLElement[]> {
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    return Array.from(overlay.querySelectorAll<HTMLElement>('.mat-mdc-menu-item'));
  }

  it('把各插槽投影到對應的位置', async () => {
    await render();
    expect(el.querySelector('.dl-back a')?.textContent).toBe('返回清單');
    expect(el.querySelector('.dl-title h2')?.textContent).toContain('TK-2048');
    expect(el.querySelector('.dl-meta .meta-id')).not.toBeNull();
    expect(el.querySelector('.dl-actions__slot .act-edit')).not.toBeNull();
    expect(el.querySelector('.dl-tabs .tabs')).not.toBeNull();
    expect(el.querySelector('.dl-main .main-content')).not.toBeNull();
    const aside = el.querySelector('aside.dl-aside');
    expect(aside?.getAttribute('aria-label')).toBe('摘要');
    expect(aside?.querySelector('.aside-content')).not.toBeNull();
    expect(layout().classList).toContain('lib-detail-layout--with-aside');
  });

  it('沒有放摘要欄時沒有 <aside>，也沒有兩欄的 class（主內容占滿寬度）', async () => {
    await render((h) => h.withAside.set(false));
    expect(el.querySelector('aside')).toBeNull();
    expect(layout().classList).not.toContain('lib-detail-layout--with-aside');
  });

  it('寬螢幕：所有主要動作都在，沒有 overflow 時也沒有「更多」', async () => {
    await render();
    expect(isShown(el.querySelector('.act-assign'))).toBe(true);
    expect(el.querySelector('.dl-actions .dl-more')).toBeNull();
    expect(layout().classList).not.toContain('lib-detail-layout--stacked');
  });

  it('窄螢幕切換：摘要欄移到上方（stacked）；動作收合後只留第一個，其餘進「更多」', async () => {
    await render();
    active.next(new Set([DETAIL_LAYOUT_STACK_QUERY]));
    fixture.detectChanges();
    expect(layout().classList).toContain('lib-detail-layout--stacked');
    expect(layout().classList).not.toContain('lib-detail-layout--collapsed');

    active.next(new Set([DETAIL_LAYOUT_STACK_QUERY, DETAIL_LAYOUT_COLLAPSE_QUERY]));
    fixture.detectChanges();
    expect(layout().classList).toContain('lib-detail-layout--collapsed');
    expect(isShown(el.querySelector('.act-edit'))).toBe(true);
    expect(isShown(el.querySelector('.act-assign'))).toBe(false);
    expect(isShown(el.querySelector('.act-close'))).toBe(false);

    const more = el.querySelector('.dl-actions .dl-more') as HTMLElement;
    expect(more.getAttribute('aria-label')).toBe('更多動作');
    const items = await openMenu(more);
    expect(items.map((i) => i.querySelector('.dl-menu-label')?.textContent?.trim())).toEqual(['指派', '關閉工單']);
    expect(items[0].querySelector('.dl-menu-icon')?.textContent?.trim()).toBe('person_add');
    expect((items[1] as HTMLButtonElement).disabled).toBe(true);

    items[0].click();
    expect(fixture.componentInstance.clicks).toEqual(['assign']);

    // 回到寬螢幕：按鈕回來、「更多」消失。
    active.next(new Set());
    fixture.detectChanges();
    expect(isShown(el.querySelector('.act-assign'))).toBe(true);
    expect(el.querySelector('.dl-actions .dl-more')).toBeNull();
  });

  it('libDetailOverflow 一律在「更多」裡（用 aria-label 當文字），原按鈕不顯示', async () => {
    await render((h) => h.withOverflow.set(true));
    expect(isShown(el.querySelector('.act-print'))).toBe(false);
    const items = await openMenu(el.querySelector('.dl-actions .dl-more') as HTMLElement);
    expect(items.map((i) => i.querySelector('.dl-menu-label')?.textContent?.trim())).toEqual(['列印工單']);
    items[0].click();
    expect(fixture.componentInstance.clicks).toEqual(['print']);
  });

  it('頁首捲出畫面後出現精簡頁首（標題＋第一個主要動作），不搶焦點；捲回來就藏起並 inert', async () => {
    await render();
    const compact = el.querySelector('[data-compact-header]') as HTMLElement;
    expect(compact.classList).not.toContain('is-visible');
    expect(compact.hasAttribute('inert')).toBe(true);

    const focused = document.activeElement;
    ioCallback?.([{ isIntersecting: false, boundingClientRect: { bottom: -10 } as DOMRectReadOnly, rootBounds: { top: 0 } as DOMRectReadOnly }]);
    fixture.detectChanges();
    expect(compact.classList).toContain('is-visible');
    expect(compact.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(focused);
    expect(compact.querySelector('.dl-compact__title')?.textContent?.trim()).toBe('工單 #TK-2048 印表機無法連線');
    const primary = compact.querySelector('.dl-compact__primary') as HTMLButtonElement;
    expect(primary.textContent?.trim()).toBe('編輯');
    primary.click();
    expect(fixture.componentInstance.clicks).toEqual(['edit']);
    expect(compact.querySelector('.dl-more')?.getAttribute('aria-label')).toBe('更多動作');

    // 頁首在畫面下方（還沒捲到）不算捲出去。
    ioCallback?.([{ isIntersecting: false, boundingClientRect: { bottom: 900 } as DOMRectReadOnly, rootBounds: { top: 0 } as DOMRectReadOnly }]);
    fixture.detectChanges();
    expect(compact.classList).not.toContain('is-visible');
  });

  it('loading：頁首與摘要欄換成骨架，投影內容藏起來，aria-busy', async () => {
    await render((h) => h.loading.set(true));
    expect(layout().getAttribute('aria-busy')).toBe('true');
    expect(el.querySelector('.dl-skeleton--heading')).not.toBeNull();
    expect(el.querySelector('.dl-skeleton--aside')).not.toBeNull();
    expect(el.querySelector('.dl-sr-only')?.textContent).toBe('載入中');
    expect((el.querySelector('.dl-title') as HTMLElement).hidden).toBe(true);
    expect((el.querySelector('.dl-aside__slot') as HTMLElement).hidden).toBe(true);
    // 主內容與分頁不受影響（交給使用端）。
    expect(el.querySelector('.dl-main .main-content')).not.toBeNull();

    fixture.componentInstance.loading.set(false);
    fixture.detectChanges();
    expect(el.querySelector('.dl-skeleton--heading')).toBeNull();
    expect((el.querySelector('.dl-title') as HTMLElement).hidden).toBe(false);
  });

  it('沒有提供文字、或少了某一句時，建立元件就丟錯並列出缺的名稱', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [{ provide: BreakpointObserver, useValue: fakeBreakpoints }] });
    expect(() => TestBed.createComponent(HostComponent).detectChanges()).toThrow(/DETAIL_LAYOUT_LABELS/);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: DETAIL_LAYOUT_LABELS, useValue: { more: '更多' } },
        { provide: BreakpointObserver, useValue: fakeBreakpoints },
      ],
    });
    expect(() => TestBed.createComponent(HostComponent).detectChanges()).toThrow(/「loading」/);
  });
});
