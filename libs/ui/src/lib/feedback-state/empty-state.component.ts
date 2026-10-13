import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

/**
 * - `no-data`：這裡本來就還沒有資料（主要動作通常是「新增」）。
 * - `no-results`：有資料，但篩選或搜尋後沒有符合的（動作通常是「清除篩選」）。
 */
export type EmptyStateKind = 'no-data' | 'no-results';

const DEFAULT_ICON: Record<EmptyStateKind, string> = { 'no-data': 'inbox', 'no-results': 'search_off' };

/**
 * 空狀態：一個圖示、一行說明、選填的補充文字與一個動作。不用插圖（插圖在不同質地下很難都好看）。
 * 底色、框線由質地決定（`--app-empty-*`，見 CONTRACT.md）。
 */
@Component({
  selector: 'lib-empty-state',
  imports: [MatButtonModule],
  templateUrl: './empty-state.component.html',
  styleUrl: './feedback-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lib-empty-state lib-feedback-panel',
    '[attr.data-kind]': 'kind()',
    '[class.lib-feedback-panel--compact]': 'compact()',
  },
})
export class EmptyStateComponent {
  /** 一行說明，例：「還沒有工單」「沒有符合條件的工單」。 */
  readonly message = input.required<string>();
  /** 選填的補充文字，例：「建立第一張工單後會出現在這裡」。 */
  readonly detail = input('');
  readonly kind = input<EmptyStateKind>('no-data');
  /** Material Symbols 圖示名稱；不給時 no-data 用 inbox、no-results 用 search_off。 */
  readonly icon = input('');
  /** 動作鈕文字（例：「新增工單」「清除篩選」）；不給就不顯示按鈕。no-data 是實心主要鈕，no-results 是外框鈕。 */
  readonly actionLabel = input('');
  /** 放在表格、小卡片裡時用：留白與圖示縮小。 */
  readonly compact = input(false);

  readonly action = output<void>();

  protected readonly resolvedIcon = computed(() => this.icon() || DEFAULT_ICON[this.kind()]);
  protected readonly buttonAppearance = computed(() => (this.kind() === 'no-results' ? 'outlined' : 'filled'));
}
