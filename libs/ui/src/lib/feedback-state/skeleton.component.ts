import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MediaMatcher } from '@angular/cdk/layout';
import { FEEDBACK_STATE_LABELS, missingFeedbackLabel } from './feedback-state-labels';

/**
 * 骨架的形狀，照「載入完成後會出現的內容」挑：
 * - `text`：幾行文字（最後一行較短）
 * - `table`：表頭＋n 列 × m 欄
 * - `card`：圖片／媒體區塊＋兩行文字的卡片
 * - `list`：頭像＋兩行文字的清單項目
 * - `kpi`：數字小卡（標籤、大數字、變化）
 */
export type SkeletonVariant = 'text' | 'table' | 'card' | 'list' | 'kpi';

const DEFAULT_COUNT: Record<SkeletonVariant, number> = { text: 3, table: 5, card: 3, list: 3, kpi: 4 };
// 寬度固定輪替（每次載入長得一樣，不用亂數），看起來像長短不一的真實內容。
const LINE_WIDTHS = [100, 94, 97, 88, 92];
const CELL_WIDTHS = [72, 54, 86, 46, 64, 78, 58];

/**
 * 載入中的骨架：依內容形狀畫出淡色色塊，有一道緩慢的閃光；使用者要求減少動態時靜止。
 * 外框 `aria-busy="true"`，色塊 `aria-hidden`，另有一段只給報讀器的「載入中」文字。
 */
@Component({
  selector: 'lib-skeleton',
  templateUrl: './skeleton.component.html',
  styleUrl: './skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lib-skeleton',
    'aria-busy': 'true',
    '[attr.data-variant]': 'variant()',
    '[class.lib-skeleton--static]': 'isStatic()',
  },
})
export class SkeletonComponent {
  readonly variant = input<SkeletonVariant>('text');
  /** 行數（text）、列數（table）、張數（card、kpi）、項目數（list）。不給時依形狀：3／5／3／3／4。 */
  readonly count = input<number | null>(null);
  /** 只有 `table` 用：欄數。 */
  readonly columns = input(4);
  /** false：不要閃光（減少動態時一律靜止，不必設）。 */
  readonly animated = input(true);
  /** 報讀器念的文字；不給時用 FEEDBACK_STATE_LABELS.loading。 */
  readonly label = input('');

  private readonly labels = inject(FEEDBACK_STATE_LABELS, { optional: true });
  // 減少動態：scss 的 @media 會即時生效；這個 class 讓測試與使用端（例如截圖）看得到目前是否靜止。
  private readonly reducedMotion = inject(MediaMatcher).matchMedia('(prefers-reduced-motion: reduce)').matches;

  protected readonly isStatic = computed(() => !this.animated() || this.reducedMotion);
  protected readonly a11yLabel = computed(
    () => this.label() || this.labels?.loading || missingFeedbackLabel('Skeleton', 'loading'),
  );
  protected readonly items = computed(() => range(this.count() ?? DEFAULT_COUNT[this.variant()]));
  protected readonly cols = computed(() => range(this.columns()));

  protected lineWidth(i: number, total: number): string {
    // 多行時最後一行只到 60%，像段落結尾。
    return total > 1 && i === total - 1 ? '60%' : `${LINE_WIDTHS[i % LINE_WIDTHS.length]}%`;
  }

  protected cellWidth(row: number, col: number): string {
    return `${CELL_WIDTHS[(row * 3 + col) % CELL_WIDTHS.length]}%`;
  }
}

function range(n: number): number[] {
  return Array.from({ length: Math.max(1, Math.floor(n)) }, (_, i) => i);
}
