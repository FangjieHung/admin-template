import { Directive, ElementRef, OnDestroy, computed, effect, inject, input, untracked } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { AccessCheck } from './access.model';
import { AccessService } from './access.service';

/**
 * 沒有權限時停用並說明原因（使用者預期它在的地方用，例如詳情頁的「核准」）。
 * 按鈕仍可聚焦，滑過或聚焦時顯示「需要主管權限」之類的提示；點擊不會觸發。
 *
 * ```html
 * <button matButton="filled" [libDisabledUnless]="'ticket:approve'" (click)="approve()">核准</button>
 * ```
 * 不用原生 `disabled`：停用的按鈕收不到滑鼠與焦點，提示就出不來。改用 `aria-disabled`＋攔截點擊，
 * 外觀用 `--app-disabled-opacity` 淡化。
 */
@Directive({
  selector: '[libDisabledUnless]',
  hostDirectives: [MatTooltip],
  host: {
    '[attr.aria-disabled]': 'denied() ? "true" : null',
    '[attr.data-access-denied]': 'denied() ? "" : null',
    '[style.opacity]': 'denied() ? "var(--app-disabled-opacity)" : null',
    '[style.cursor]': 'denied() ? "not-allowed" : null',
  },
})
export class DisabledUnlessDirective implements OnDestroy {
  /** 需要的權限，寫法同 `*libCan`。 */
  readonly libDisabledUnless = input.required<AccessCheck>();
  /** 自訂提示；不給就用「需要{最低符合的預設角色}權限」。 */
  readonly libDisabledUnlessHint = input('');

  private readonly access = inject(AccessService);
  private readonly tooltip = inject(MatTooltip);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  readonly denied = computed(() => !this.access.can(this.libDisabledUnless()));
  /** 目前的提示文字（有權限時是空字串）。 */
  readonly hint = computed(() =>
    this.denied() ? this.libDisabledUnlessHint() || this.access.hintFor(this.libDisabledUnless()) : '',
  );

  // 捕獲階段、掛在元素自己身上：比元素上的 (click)、routerLink 都早執行，攔下就不會觸發動作。
  private readonly block = (event: Event): void => {
    if (!this.denied()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  constructor() {
    this.el.addEventListener('click', this.block, true);
    effect(() => {
      const hint = this.hint();
      untracked(() => {
        this.tooltip.message = hint;
        this.tooltip.disabled = !hint;
      });
    });
  }

  ngOnDestroy(): void {
    this.el.removeEventListener('click', this.block, true);
  }
}
