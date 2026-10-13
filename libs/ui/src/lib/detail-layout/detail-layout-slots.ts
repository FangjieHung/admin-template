import { Directive, ElementRef, HostAttributeToken, InjectionToken, Signal, computed, inject } from '@angular/core';

/** 版型提供給動作指令的狀態（避免指令與元件互相 import）。 */
export interface DetailLayoutState {
  /** 頁首動作是否收合（窄螢幕）：`libDetailSecondary` 的按鈕藏起來、改放進「更多」選單。 */
  readonly actionsCollapsed: Signal<boolean>;
}

export const DETAIL_LAYOUT_STATE = new InjectionToken<DetailLayoutState>('DETAIL_LAYOUT_STATE');

/** 標題插槽：`<h2 libDetailTitle class="ui-text-title">…</h2>`。精簡頁首沒有指定 `compactTitle` 時取它的文字。 */
@Directive({ selector: '[libDetailTitle]' })
export class DetailTitleDirective {
  readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
}

/** 主要動作插槽（一個容器，裡面放按鈕）：`<div libDetailActions>…</div>`。 */
@Directive({ selector: '[libDetailActions]' })
export class DetailActionsDirective {
  readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
}

/** 摘要側欄插槽：`<section libDetailAside>…</section>`。沒有放時主內容占滿寬度。 */
@Directive({ selector: '[libDetailAside]' })
export class DetailAsideDirective {}

/**
 * 標在 `[libDetailActions]` 裡的按鈕或連結上：
 * - `libDetailSecondary`：寬螢幕照常顯示，窄螢幕收進「更多」選單。
 * - `libDetailOverflow`：一律放在「更多」選單（畫面上的原按鈕不顯示）。
 *
 * 選單項目是版型自己畫的 `mat-menu-item`，文字取原按鈕的 `aria-label` 或文字（不含 `aria-hidden` 的圖示），
 * 圖示取原按鈕裡 `aria-hidden` 的 Material Symbols；按下選單項目等於按下原按鈕（`click()`），
 * 所以 `(click)`、`routerLink`、停用狀態、`*libCan` 都照原樣運作。
 */
@Directive({
  selector: '[libDetailSecondary], [libDetailOverflow]',
  host: {
    '[style.display]': "hidden() ? 'none' : null",
  },
})
export class DetailActionDirective {
  readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  /** true：一律在「更多」選單；false：窄螢幕才收進去。 */
  readonly overflow = inject(new HostAttributeToken('libDetailOverflow'), { optional: true }) !== null;
  private readonly state = inject(DETAIL_LAYOUT_STATE, { optional: true });

  protected readonly hidden = computed(() => this.overflow || (this.state?.actionsCollapsed() ?? false));
}

/** 選單裡的一個項目（版型讀原按鈕的 DOM 組出來）。 */
export interface DetailMenuItem {
  label: string;
  icon: string;
  disabled: boolean;
  element: HTMLElement;
}

/** 讀按鈕的顯示文字：aria-label 優先，否則是去掉 aria-hidden 節點後的文字。 */
export function readActionLabel(element: HTMLElement): string {
  const aria = element.getAttribute('aria-label');
  if (aria) return aria.trim();
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** 讀按鈕裡的 Material Symbols 圖示名稱（aria-hidden 的那個）；沒有就是空字串。 */
export function readActionIcon(element: HTMLElement): string {
  const icon = element.querySelector('[aria-hidden="true"][class*="material-symbols"], mat-icon');
  return (icon?.textContent ?? '').trim();
}

export function readActionDisabled(element: HTMLElement): boolean {
  return (element as HTMLButtonElement).disabled === true || element.getAttribute('aria-disabled') === 'true';
}

export function toMenuItem(element: HTMLElement): DetailMenuItem {
  return { label: readActionLabel(element), icon: readActionIcon(element), disabled: readActionDisabled(element), element };
}
