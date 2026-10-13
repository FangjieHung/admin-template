import { Directive, EmbeddedViewRef, TemplateRef, ViewContainerRef, effect, inject, input, untracked } from '@angular/core';
import { AccessCheck } from './access.model';
import { AccessService } from './access.service';

/**
 * 依權限顯示或隱藏（預設做法：使用者沒有權限的按鈕直接不出現）。
 *
 * ```html
 * <button *libCan="'project:create'">新增專案</button>
 * <button *libCan="'project:delete'; else noDelete">刪除</button>
 * <ng-template #noDelete><span>（唯讀）</span></ng-template>
 * ```
 * 身分或角色改變時會立刻重新判斷。
 */
@Directive({ selector: '[libCan]' })
export class CanDirective {
  /** 需要的權限：`'project:edit'`、`{ feature, action }`，或陣列（全部都要有）。 */
  readonly libCan = input.required<AccessCheck>();
  /** 沒有權限時改顯示的 template（選填）。 */
  readonly libCanElse = input<TemplateRef<unknown> | null>(null);

  private readonly access = inject(AccessService);
  private readonly vcr = inject(ViewContainerRef);
  private readonly then = inject(TemplateRef<unknown>);

  constructor() {
    let current: TemplateRef<unknown> | null = null;
    let view: EmbeddedViewRef<unknown> | null = null;
    effect(() => {
      const next = this.access.can(this.libCan()) ? this.then : this.libCanElse();
      if (next === current && view) return;
      untracked(() => {
        this.vcr.clear();
        current = next;
        view = next ? this.vcr.createEmbeddedView(next) : null;
      });
    });
  }
}
