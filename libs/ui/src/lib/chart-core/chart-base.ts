import { DestroyRef, Directive, ElementRef, afterNextRender, computed, inject, input, model, signal } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { CHART_LABELS, assertChartLabels } from './chart-labels';
import { ChartCategory } from './chart.types';

/** 還沒量到寬度（第一次繪製前、測試環境沒有版面）時用的寬度。 */
export const CHART_FALLBACK_WIDTH = 640;
/** 軸文字的字級（px），用來估算軸標寬度；畫面上的字級由 `--lib-chart-axis-size` 決定，兩者要一致。 */
export const CHART_AXIS_FONT = 12;

let nextId = 0;

/**
 * 折線、長條、圓環共用的狀態：畫面文字、數字與日期格式、容器寬度（ResizeObserver）、
 * 「以表格檢視」切換、目前指著的資料點（滑鼠或鍵盤）與鍵盤移動。
 */
@Directive()
export abstract class ChartBase {
  /** 載入中：顯示依圖表形狀的骨架。 */
  readonly loading = input(false);
  /** 給報讀器的摘要；不給時依資料自動產生（CHART_LABELS 的摘要句）。 */
  readonly summary = input('');
  /** 數值的格式（Intl.NumberFormat 選項，語言跟著 I18nService）。 */
  readonly valueFormat = input<Intl.NumberFormatOptions>({ maximumFractionDigits: 1 });
  /** 日期類別的格式（Intl.DateTimeFormat 選項）。 */
  readonly dateFormat = input<Intl.DateTimeFormatOptions>({ month: 'numeric', day: 'numeric' });

  protected readonly labels = assertChartLabels(inject(CHART_LABELS, { optional: true }));
  protected readonly i18n = inject(I18nService);
  protected readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  protected readonly uid = `lib-chart-${nextId++}`;

  /** 顯示圖表或表格（「以表格檢視」按鈕切換；可以 `[(view)]`）。 */
  readonly view = model<'chart' | 'table'>('chart');
  protected readonly tableView = computed(() => this.view() === 'table');
  /** 容器寬度（px）；0 代表還沒量到。 */
  protected readonly measuredWidth = signal(0);
  protected readonly width = computed(() => this.measuredWidth() || CHART_FALLBACK_WIDTH);
  /** 滑鼠指著或鍵盤聚焦的資料點（x 的索引、圓環的第幾類）；null 是沒有。 */
  protected readonly active = signal<number | null>(null);
  /** 鍵盤 Tab 進來時停在哪一個資料點（roving tabindex）。 */
  protected readonly focusIndex = signal(0);
  /** 目前的焦點是鍵盤造成的（才畫焦點樣式）。 */
  protected readonly keyboardFocus = signal(false);

  protected readonly numberFormat = computed(() => new Intl.NumberFormat(this.i18n.current().intl, this.valueFormat()));
  private readonly dateFormatter = computed(() => new Intl.DateTimeFormat(this.i18n.current().intl, this.dateFormat()));
  private readonly fullDateFormatter = computed(
    () => new Intl.DateTimeFormat(this.i18n.current().intl, { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' }),
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.host.nativeElement;
      const read = () => this.measuredWidth.set(Math.round(el.getBoundingClientRect().width));
      read();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width;
        this.measuredWidth.set(Math.round(width ?? el.getBoundingClientRect().width));
      });
      observer.observe(el);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected formatValue(value: number | null | undefined): string {
    return value == null || !Number.isFinite(value) ? '—' : this.numberFormat().format(value);
  }

  /** 軸標用的短格式。 */
  protected formatCategory(category: ChartCategory): string {
    return category instanceof Date ? this.dateFormatter().format(category) : category;
  }

  /** 提示框、表格、報讀用的完整格式。 */
  protected formatCategoryFull(category: ChartCategory): string {
    return category instanceof Date ? this.fullDateFormatter().format(category) : category;
  }

  protected toggleTable(): void {
    this.view.set(this.tableView() ? 'chart' : 'table');
    this.active.set(null);
  }

  // ---- 資料點的鍵盤與滑鼠 ----

  protected onPointFocus(index: number, event: FocusEvent): void {
    const target = event.target as Element | null;
    let visible = true;
    try {
      visible = !!target?.matches(':focus-visible');
    } catch {
      // 不支援 :focus-visible 的環境（舊瀏覽器、jsdom）一律當成鍵盤焦點：寧可多畫焦點樣式。
    }
    this.keyboardFocus.set(visible);
    this.focusIndex.set(index);
    this.active.set(index);
  }

  protected onPointBlur(): void {
    this.keyboardFocus.set(false);
    this.active.set(null);
  }

  /**
   * 方向鍵在資料點之間移動（往前：← ↑，往後：→ ↓），Home／End 到兩端，Esc 收起提示框。
   * 資料點元素要有 `data-point="<索引>"`，焦點直接移到那個元素上（tabindex 跟著換）。
   */
  protected onPointKeydown(event: KeyboardEvent, index: number, count: number): void {
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = Math.min(count - 1, index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = Math.max(0, index - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      case 'Escape':
        this.active.set(null);
        return;
      default:
        return;
    }
    event.preventDefault();
    this.focusIndex.set(next);
    this.active.set(next);
    this.keyboardFocus.set(true);
    this.host.nativeElement.querySelector<SVGElement | HTMLElement>(`[data-point="${next}"]`)?.focus();
  }
}
