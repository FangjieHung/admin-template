import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  TemplateRef,
  computed,
  contentChild,
  inject,
  input,
  output,
} from '@angular/core';
import { EmptyStateComponent, EmptyStateKind } from './empty-state.component';
import { ErrorStateComponent } from './error-state.component';
import { FEEDBACK_STATE_LABELS } from './feedback-state-labels';
import { SkeletonComponent, SkeletonVariant } from './skeleton.component';

/** 一塊非同步內容目前的狀態。`ready`＝有資料，顯示投影進來的內容。 */
export type AsyncStatus = 'loading' | 'empty' | 'error' | 'ready';

/** 自訂載入畫面：`<ng-template libAsyncLoading>…</ng-template>`（例如頁面自己組的骨架）。 */
@Directive({ selector: 'ng-template[libAsyncLoading]' })
export class AsyncStateLoadingDirective {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/** 自訂空狀態：`<ng-template libAsyncEmpty>…</ng-template>`。 */
@Directive({ selector: 'ng-template[libAsyncEmpty]' })
export class AsyncStateEmptyDirective {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/** 自訂錯誤畫面：`<ng-template libAsyncError>…</ng-template>`。 */
@Directive({ selector: 'ng-template[libAsyncError]' })
export class AsyncStateErrorDirective {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/**
 * 依 `status` 在骨架、空狀態、錯誤與內容之間切換，頁面不必自己寫一串 `@if`。
 * 預設畫面用 `lib-skeleton`、`lib-empty-state`、`lib-error-state`，三者都可以用 ng-template 換掉。
 *
 * 內容（ng-content）只在 `ready` 時放進畫面；外框在載入中 `aria-busy="true"`，
 * 並有一段常駐的 polite live region：切到載入中、空狀態時念出狀態文字（錯誤本身是 role="alert"）。
 */
@Component({
  selector: 'lib-async-state',
  imports: [NgTemplateOutlet, SkeletonComponent, EmptyStateComponent, ErrorStateComponent],
  templateUrl: './async-state.component.html',
  styles: `
    :host {
      position: relative;
      display: block;
      min-width: 0;
    }

    .lib-async-state__live {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      white-space: nowrap;
      clip-path: inset(50%);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lib-async-state',
    '[attr.aria-busy]': "status() === 'loading' ? 'true' : null",
    '[attr.data-status]': 'status()',
  },
})
export class AsyncStateComponent {
  readonly status = input.required<AsyncStatus>();

  // ---- 載入中（預設骨架）----
  readonly skeleton = input<SkeletonVariant>('text');
  readonly skeletonCount = input<number | null>(null);
  readonly skeletonColumns = input(4);

  // ---- 空狀態 ----
  readonly emptyMessage = input('');
  readonly emptyDetail = input('');
  readonly emptyKind = input<EmptyStateKind>('no-data');
  readonly emptyIcon = input('');
  readonly emptyActionLabel = input('');

  // ---- 錯誤 ----
  readonly errorMessage = input('');
  readonly errorHint = input('');
  readonly errorDetail = input('');
  readonly retryable = input(true);

  /** 放在小卡片、表格裡時縮小空狀態與錯誤的留白。 */
  readonly compact = input(false);

  readonly retry = output<void>();
  readonly emptyAction = output<void>();

  protected readonly loadingTpl = contentChild(AsyncStateLoadingDirective);
  protected readonly emptyTpl = contentChild(AsyncStateEmptyDirective);
  protected readonly errorTpl = contentChild(AsyncStateErrorDirective);

  private readonly labels = inject(FEEDBACK_STATE_LABELS, { optional: true });

  protected readonly announcement = computed(() => {
    switch (this.status()) {
      case 'loading':
        return this.labels?.loading ?? '';
      case 'empty':
        return this.emptyTpl() ? '' : this.emptyMessage();
      default:
        return '';
    }
  });
}
