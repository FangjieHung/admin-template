import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

/** 捲到離邊緣 1px 以內就算「到頭／到底」，吸收小數像素與縮放造成的誤差。 */
const EDGE_TOLERANCE_PX = 1;

export const SCROLL_SHADOW_ABOVE_CLASS = 'has-more-above';
export const SCROLL_SHADOW_BELOW_CLASS = 'has-more-below';

/**
 * 捲動陰影的「開關」：依捲動容器實際的捲動位置，在容器上切換 `has-more-above`／`has-more-below`，
 * 陰影本身由使用端的 CSS 畫（建議用容器的 `::before`／`::after` + `position: sticky`，畫在內容之上）。
 *
 * 為什麼要 JS：純 CSS 的 `background-attachment: local/scroll` 陰影畫在容器的背景，會被不透明的內容
 * （卡片、表格、輸入框）整片蓋掉，在長表單裡完全看不到。
 *
 * 用法：`<mat-stepper libScrollShadow=".mat-horizontal-content-container">`——值是 host 內部捲動容器的
 * CSS 選擇器；留空就是 host 本身。內部節點若被第三方元件換掉（例如步驟導覽橫直切換），會自動重新綁定。
 * 監聽：容器 `scroll`（passive）、容器與其直接子節點的尺寸（ResizeObserver，涵蓋切換步驟與內容增減）。
 */
@Directive({ selector: '[libScrollShadow]' })
export class ScrollShadowDirective {
  /** host 內部捲動容器的 CSS 選擇器；空字串代表 host 本身。 */
  readonly libScrollShadow = input<string>('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private target: HTMLElement | null = null;
  private observedChildren = new Set<Element>();
  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;
  private readonly onScroll = () => this.update();

  constructor() {
    afterNextRender(() => {
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.update());
      }
      // 第三方元件（mat-stepper）可能重建內部節點，或新增／移除步驟內容：重新找容器、補觀察新的子節點。
      if (typeof MutationObserver !== 'undefined') {
        this.mutationObserver = new MutationObserver(() => this.bind());
        this.mutationObserver.observe(this.host, { childList: true, subtree: true });
      }
      this.bind();
    });
    inject(DestroyRef).onDestroy(() => this.teardown());
  }

  /** 重新計算並切換 class；公開給需要主動觸發的情境（例如程式捲動後）。 */
  update(): void {
    const el = this.target;
    if (!el) return;
    const above = el.scrollTop > EDGE_TOLERANCE_PX;
    const below = el.scrollHeight - el.clientHeight - el.scrollTop > EDGE_TOLERANCE_PX;
    el.classList.toggle(SCROLL_SHADOW_ABOVE_CLASS, above);
    el.classList.toggle(SCROLL_SHADOW_BELOW_CLASS, below);
  }

  private resolveTarget(): HTMLElement | null {
    const selector = this.libScrollShadow().trim();
    return selector ? this.host.querySelector<HTMLElement>(selector) : this.host;
  }

  private bind(): void {
    const next = this.resolveTarget();
    if (next !== this.target) {
      this.unbindTarget();
      this.target = next;
      if (next) {
        next.addEventListener('scroll', this.onScroll, { passive: true });
        this.resizeObserver?.observe(next);
      }
    }
    this.syncObservedChildren();
    this.update();
  }

  /** 觀察容器的直接子節點（mat-stepper 的各步驟內容）：切換步驟或內容長高時容器本身尺寸不變，只有它們會變。 */
  private syncObservedChildren(): void {
    const ro = this.resizeObserver;
    if (!ro) return;
    const current = new Set<Element>(this.target ? Array.from(this.target.children) : []);
    for (const child of this.observedChildren) {
      if (!current.has(child)) ro.unobserve(child);
    }
    for (const child of current) {
      if (!this.observedChildren.has(child)) ro.observe(child);
    }
    this.observedChildren = current;
  }

  private unbindTarget(): void {
    const el = this.target;
    if (!el) return;
    el.removeEventListener('scroll', this.onScroll);
    this.resizeObserver?.unobserve(el);
    for (const child of this.observedChildren) this.resizeObserver?.unobserve(child);
    this.observedChildren.clear();
    el.classList.remove(SCROLL_SHADOW_ABOVE_CLASS, SCROLL_SHADOW_BELOW_CLASS);
    this.target = null;
  }

  private teardown(): void {
    this.unbindTarget();
    this.mutationObserver?.disconnect();
    this.resizeObserver?.disconnect();
    this.mutationObserver = undefined;
    this.resizeObserver = undefined;
  }
}
