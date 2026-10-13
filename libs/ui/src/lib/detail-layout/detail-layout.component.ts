import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  contentChild,
  contentChildren,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { map, switchMap } from 'rxjs';
import { DETAIL_LAYOUT_LABELS, assertDetailLayoutLabels } from './detail-layout-labels';
import {
  DETAIL_LAYOUT_STATE,
  DetailActionDirective,
  DetailActionsDirective,
  DetailAsideDirective,
  DetailLayoutState,
  DetailMenuItem,
  DetailTitleDirective,
  readActionDisabled,
  readActionLabel,
  toMenuItem,
} from './detail-layout-slots';

/** 摘要欄移到頁首下方的斷點（同 lib-responsive-panel 的窄螢幕）：再窄，主內容放不下 320px 的摘要欄。 */
export const DETAIL_LAYOUT_STACK_QUERY = '(max-width: 1280px)';
/** 頁首動作收合成「第一個主要動作＋更多」的斷點（同展示 app 殼層切換手機版側欄的斷點）。 */
export const DETAIL_LAYOUT_COLLAPSE_QUERY = '(max-width: 900px)';

/**
 * 詳情頁版型：打開一筆資料（工單、專案、聯絡人）的整頁骨架。只用內容投影的插槽組成，不綁資料型別：
 *
 * - `[libDetailBack]` 返回連結／麵包屑、`[libDetailTitle]` 標題、`[libDetailMeta]` 編號與狀態等一列小資訊、
 *   `[libDetailActions]` 主要動作（裡面的按鈕可標 `libDetailSecondary`／`libDetailOverflow`）、
 *   `[libDetailTabs]` 分頁列、預設內容是主內容區、`[libDetailAside]` 摘要側欄。
 * - 寬螢幕：主內容＋右側固定寬度的摘要欄；`stackQuery` 以下摘要欄移到頁首下方、分頁上方（摘要最常被看）。
 *   沒放摘要欄時主內容占滿寬度。
 * - `collapseQuery` 以下頁首只留沒有標記的主要動作，`libDetailSecondary` 收進「更多」選單；分頁列可水平捲動。
 * - 頁首捲出畫面後，捲動容器頂端出現精簡列（標題＋第一個主要動作＋更多），不搶焦點；減少動態時不做轉場。
 * - `loading` 時頁首與摘要欄顯示骨架；錯誤、找不到交給使用端（包 `lib-async-state` 或 `lib-error-state`）。
 */
@Component({
  selector: 'lib-detail-layout',
  imports: [MatButtonModule, MatMenuModule],
  templateUrl: './detail-layout.component.html',
  styleUrl: './detail-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: DETAIL_LAYOUT_STATE, useExisting: forwardRef(() => DetailLayoutComponent) }],
  host: {
    class: 'lib-detail-layout',
    '[class.lib-detail-layout--stacked]': 'stacked()',
    '[class.lib-detail-layout--collapsed]': 'actionsCollapsed()',
    '[class.lib-detail-layout--with-aside]': 'hasAside()',
    '[class.lib-detail-layout--loading]': 'loading()',
    '[attr.aria-busy]': "loading() ? 'true' : null",
    '[style.--lib-detail-aside-width]': 'asideWidth()',
    '[style.--lib-detail-sticky-top]': 'stickyTop()',
  },
})
export class DetailLayoutComponent implements DetailLayoutState {
  /** 載入中：頁首（標題、資訊列、動作）與摘要欄換成骨架。 */
  readonly loading = input(false);
  /** 摘要欄寬度（CSS 長度）。 */
  readonly asideWidth = input('20rem');
  /** 摘要欄的無障礙名稱（`<aside aria-label>`），例：「摘要」。 */
  readonly asideLabel = input('');
  /** 精簡頁首的標題；不給時取 `[libDetailTitle]` 的文字。 */
  readonly compactTitle = input('');
  /** 精簡頁首距離捲動容器頂端多遠（捲動容器上方有固定的頁首時設它的高度）。 */
  readonly stickyTop = input('0px');
  /** false：不顯示捲動時的精簡頁首。 */
  readonly compactHeader = input(true);
  readonly stackQuery = input(DETAIL_LAYOUT_STACK_QUERY);
  readonly collapseQuery = input(DETAIL_LAYOUT_COLLAPSE_QUERY);

  protected readonly labels = assertDetailLayoutLabels(inject(DETAIL_LAYOUT_LABELS, { optional: true }));

  private readonly breakpoints = inject(BreakpointObserver);
  private readonly title = contentChild(DetailTitleDirective);
  private readonly actions = contentChild(DetailActionsDirective);
  private readonly aside = contentChild(DetailAsideDirective);
  private readonly actionDirectives = contentChildren(DetailActionDirective, { descendants: true });
  private readonly headerRef = viewChild.required<ElementRef<HTMLElement>>('header');
  private readonly stickyRef = viewChild.required<ElementRef<HTMLElement>>('sticky');

  private readonly matches = toSignal(
    toObservable(computed(() => [this.stackQuery(), this.collapseQuery()] as const)).pipe(
      switchMap(([stackMedia, collapseMedia]) =>
        this.breakpoints.observe([stackMedia, collapseMedia]).pipe(
          map((state) => ({ stacked: !!state.breakpoints[stackMedia], collapsed: !!state.breakpoints[collapseMedia] })),
        ),
      ),
    ),
    { initialValue: { stacked: false, collapsed: false } },
  );

  /** 摘要欄移到頁首下方。 */
  readonly stacked = computed(() => this.matches().stacked);
  /** 頁首動作收合（DetailLayoutState）。 */
  readonly actionsCollapsed = computed(() => this.matches().collapsed);

  protected readonly hasAside = computed(() => !!this.aside());

  /** 頁首整個捲出畫面（精簡頁首出現）。 */
  protected readonly scrolledPast = signal(false);
  protected readonly compactVisible = computed(() => this.compactHeader() && this.scrolledPast() && !this.loading());
  private readonly titleText = signal('');
  protected readonly compactTitleText = computed(() => this.compactTitle() || this.titleText());

  protected readonly headerMenuVisible = computed(() => this.headerMenuItems().length > 0);
  protected readonly compactMenuVisible = computed(() => this.compactMenuItems().length > 0);
  /** 精簡頁首顯示的主要動作（`[libDetailActions]` 裡第一個沒有標記的按鈕或連結）。 */
  protected readonly primaryAction = signal<DetailMenuItem | null>(null);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.refreshCompactContent();
      if (typeof IntersectionObserver === 'undefined') return;
      const offset = this.stickyOffsetPx();
      const header = this.headerRef().nativeElement;
      const root = scrollParentOf(header);
      const observer = new IntersectionObserver(
        ([entry]) => {
          const rootTop = entry.rootBounds?.top ?? (root ? root.getBoundingClientRect().top : 0) + offset;
          // 只有「往上捲出去」才算；頁首在畫面下方（還沒捲到）不算。
          const past = !entry.isIntersecting && entry.boundingClientRect.bottom <= rootTop + 1;
          if (past) this.refreshCompactContent();
          this.scrolledPast.set(past);
        },
        // root 是捲動容器（展示 app 是 mat-sidenav-content），往下多延伸一大段：頁首在畫面下方也算「相交」，
        // 這樣一口氣從下方捲到上方（鍵盤 End、錨點跳轉）也會跨過門檻、觸發一次。上方扣掉 stickyTop。
        { root, threshold: 0, rootMargin: `-${offset}px 0px 100000px 0px` },
      );
      observer.observe(this.headerRef().nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /** 每個標記過的按鈕對應一個選單項目（文字、圖示在這裡讀一次 DOM；停用狀態在畫面上每次重讀）。 */
  private readonly menuEntries = computed(() =>
    this.actionDirectives().map((d) => ({ overflow: d.overflow, item: toMenuItem(d.element.nativeElement) })),
  );
  /** 頁首「更多」的項目：一律放的 overflow，加上收合時的 secondary。 */
  protected readonly headerMenuItems = computed(() => {
    const collapsed = this.actionsCollapsed();
    return this.menuEntries()
      .filter((e) => e.overflow || collapsed)
      .map((e) => e.item);
  });
  /** 精簡頁首「更多」的項目：除了第一個主要動作以外的全部。 */
  protected readonly compactMenuItems = computed(() => this.menuEntries().map((e) => e.item));

  protected isDisabled(item: DetailMenuItem): boolean {
    return readActionDisabled(item.element);
  }

  /** 按下選單項目或精簡頁首的動作＝按下原按鈕。 */
  protected activate(item: DetailMenuItem): void {
    item.element.click();
  }

  /** 精簡頁首外框的 `top`（stickyTop 換算成 px）。 */
  private stickyOffsetPx(): number {
    return Number.parseFloat(getComputedStyle(this.stickyRef().nativeElement).top) || 0;
  }

  private refreshCompactContent(): void {
    const title = this.title()?.element.nativeElement;
    this.titleText.set(title ? (title.textContent ?? '').replace(/\s+/g, ' ').trim() : '');
    const container = this.actions()?.element.nativeElement;
    const first = container
      ? Array.from(container.querySelectorAll<HTMLElement>('button, a[href]')).find(
          (el) => !el.hasAttribute('libDetailSecondary') && !el.hasAttribute('libDetailOverflow') && readActionLabel(el),
        )
      : undefined;
    this.primaryAction.set(first ? toMenuItem(first) : null);
  }
}

/** 最近的捲動容器（overflow-y 是 auto／scroll）；沒有就是 null（整頁捲動）。 */
function scrollParentOf(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}
