import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { FEEDBACK_STATE_LABELS, missingFeedbackLabel } from './feedback-state-labels';

let nextId = 0;

/**
 * 錯誤狀態：說明什麼失敗了、一顆「重試」，選填可展開的詳細資訊（錯誤代碼、請求編號）。
 * 說明文字在 `role="alert"` 裡：從載入中切到錯誤時報讀器會立刻念出來。
 */
@Component({
  selector: 'lib-error-state',
  imports: [MatButtonModule],
  templateUrl: './error-state.component.html',
  styleUrl: './feedback-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lib-error-state lib-feedback-panel',
    '[class.lib-feedback-panel--compact]': 'compact()',
  },
})
export class ErrorStateComponent {
  /** 什麼失敗了，寫成一句話，例：「工單清單載入失敗」。 */
  readonly message = input.required<string>();
  /** 選填的補充說明（給一般使用者看，例：「請確認網路連線後再試一次」）。 */
  readonly hint = input('');
  /** 選填的技術細節（錯誤代碼、請求編號）；有值時出現「顯示詳細資訊」切換鈕。 */
  readonly detail = input('');
  /** Material Symbols 圖示名稱。 */
  readonly icon = input('error');
  /** false：不顯示重試鈕（例如沒有權限，重試也沒用）。 */
  readonly retryable = input(true);
  readonly retryLabel = input('');
  readonly compact = input(false);

  readonly retry = output<void>();

  private readonly labels = inject(FEEDBACK_STATE_LABELS, { optional: true });
  protected readonly detailId = `lib-error-state-detail-${nextId++}`;
  protected readonly detailOpen = signal(false);

  protected readonly retryText = computed(
    () => this.retryLabel() || this.labels?.retry || missingFeedbackLabel('ErrorState', 'retry'),
  );
  protected readonly toggleText = computed(() =>
    this.detailOpen()
      ? (this.labels?.hideDetails ?? missingFeedbackLabel('ErrorState', 'hideDetails'))
      : (this.labels?.showDetails ?? missingFeedbackLabel('ErrorState', 'showDetails')),
  );

  protected toggleDetail(): void {
    this.detailOpen.update((open) => !open);
  }
}
