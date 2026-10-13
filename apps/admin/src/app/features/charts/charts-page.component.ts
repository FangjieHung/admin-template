import { Component, DOCUMENT, afterNextRender, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BarChartComponent, ChartSeries, DonutChartComponent, LineChartComponent, StatCardComponent } from '@admin-template/ui';
import { CHART_LABEL_PROVIDERS } from '../../shared/ui/chart-labels';
import { FEEDBACK_STATE_LABEL_PROVIDERS } from '../../shared/ui/component-label-providers';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';
import { makeChartsDemoData } from './charts-demo-data';
import { PaletteSwatch, loadPaletteSwatches } from './palette-swatches';

const ENTRY = detailOf('charts');

/**
 * 數字小卡與圖表展示頁（/components/charts）：4 種元件、空資料、載入中、以表格檢視，
 * 以及 12 套配色的 6 個類別色（直接讀各配色的樣式檔）。
 */
@Component({
  selector: 'app-charts-page',
  imports: [
    RouterLink,
    StatCardComponent,
    LineChartComponent,
    BarChartComponent,
    DonutChartComponent,
    ShowcasePageComponent,
    DemoBlockComponent,
  ],
  providers: [...CHART_LABEL_PROVIDERS, ...FEEDBACK_STATE_LABEL_PROVIDERS],
  templateUrl: './charts-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './charts-page.component.scss'],
})
export class ChartsPageComponent {
  protected readonly entry = ENTRY;
  protected readonly data = makeChartsDemoData(new Date());
  protected readonly integerFormat: Intl.NumberFormatOptions = { maximumFractionDigits: 0 };
  protected readonly weekFormat: Intl.DateTimeFormatOptions = { month: 'numeric', day: 'numeric' };

  /** 空資料與載入中的示範開關。 */
  protected readonly stateMode = signal<'loading' | 'empty' | 'ready'>('loading');
  protected readonly stateSeries = computed<ChartSeries[]>(() =>
    this.stateMode() === 'empty' ? [] : this.data.sources.slice(0, 2),
  );

  /** 12 套配色的圖表色：null 是全部並排。 */
  protected readonly swatches = signal<PaletteSwatch[]>([]);
  protected readonly swatchState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly swatchFocus = signal<string | null>(null);
  protected readonly shownSwatches = computed(() => {
    const id = this.swatchFocus();
    return id ? this.swatches().filter((s) => s.id === id) : this.swatches();
  });

  constructor() {
    const doc = inject(DOCUMENT);
    afterNextRender(() => {
      loadPaletteSwatches(doc)
        .then((list) => {
          this.swatches.set(list);
          this.swatchState.set(list.length ? 'ready' : 'error');
        })
        .catch(() => this.swatchState.set('error'));
    });
  }

  protected setStateMode(mode: 'loading' | 'empty' | 'ready'): void {
    this.stateMode.set(mode);
  }

  protected contrastText(value: number): string {
    return value ? `${value.toFixed(2)}:1` : '—';
  }

  protected readonly whenToUse = [
    '儀表板與報表：一個指標的現況與變化（數字小卡）、趨勢（折線）、分類比較（長條）、占比（圓環）。',
    '幾十到幾百個資料點、6 個以內的系列；顏色、線寬、圓角要跟著質地與配色換。',
    '需要鍵盤與報讀器也讀得到數值：每張圖都能切成表格、資料點可以用方向鍵逐一聚焦。',
  ];
  protected readonly avoid = [
    '上萬個點、需要縮放或刷選、地圖、熱圖、雙軸：改用 ECharts 等函式庫（ADR 0017）。',
    '要精確比對每一個數字：直接用資料表（lib-data-table）。',
    '超過 6 類的占比：圓環會把小項併成「其他」，需要看全部時改用橫式長條。',
  ];

  protected readonly usage = `// 頁面的 providers：畫面文字（libs/ui 不內建字串，缺字時直接丟錯）
providers: [{ provide: CHART_LABELS, useValue: {
  viewAsTable: '以表格檢視', noData: '沒有資料', loading: '載入中', other: '其他', total: '總計',
  category: '項目', share: '占比', legend: '圖例', lineChart: '折線圖', barChart: '長條圖', donutChart: '圓環圖',
  seriesSummary: '{type}，{count} 個系列（{names}），{first} 到 {last}', donutSummary: '{type}，{count} 類，{total}',
  pointLabel: '{x}：{values}', keyboardHint: '用方向鍵切換資料點，Esc 收起提示',
  comparison: '較{period} {change}', better: '表現變好', worse: '表現變差', sparkline: '{name}的趨勢，{first} 到 {last}',
} }]

<!-- 數字小卡：整張卡要可點就寫成 <a lib-stat-card routerLink="…"> -->
<lib-stat-card label="逾期" unit="件" period="上週" [value]="12" [previous]="9" [positiveIsGood]="false" />
<a lib-stat-card routerLink="/templates/tickets" label="本週新增" [value]="48" [previous]="41"
   period="上週" [sparkline]="[5, 8, 6, 9, 7, 6, 7]"></a>

<!-- 折線：categories 是日期或文字，series 的 values 依序對到 categories（缺值給 null） -->
<lib-line-chart [categories]="days" [series]="[{ id: 'created', label: '新增', values: created }]"
  [area]="true" [integer]="true" [(hiddenSeries)]="hidden" />

<!-- 長條：直式／橫式、分組／堆疊、直接標註數值 -->
<lib-bar-chart [categories]="teams" [series]="load" orientation="horizontal" [showValues]="true" />
<lib-bar-chart [categories]="weeks" [series]="byPriority" [stacked]="true" />

<!-- 圓環：超過 6 類自動併成「其他」 -->
<lib-donut-chart [slices]="byTopic" [(selected)]="topic" />`;

  protected readonly api: ApiSection[] = [
    {
      title: '共通（lib-line-chart、lib-bar-chart、lib-donut-chart）',
      rows: [
        { name: '[loading]', type: 'boolean', default: 'false', description: '顯示依圖表形狀的骨架（aria-busy）。' },
        { name: '[summary]', type: 'string', default: '自動', description: '給報讀器的摘要（figcaption）；不給時依資料用 CHART_LABELS 的摘要句產生。' },
        { name: '[valueFormat]', type: 'Intl.NumberFormatOptions', default: '最多 1 位小數', description: '數值格式，語言跟著 I18nService。' },
        { name: '[dateFormat]', type: 'Intl.DateTimeFormatOptions', default: '月／日', description: '日期類別在軸上的格式（提示框與表格用完整日期）。' },
        { name: '[(view)]', type: "'chart' | 'table'", default: "'chart'", description: '顯示圖表或表格（「以表格檢視」按鈕切換）；列印時表格一定印出。' },
        { name: 'CHART_LABELS', type: 'InjectionToken<ChartLabels>', default: '必填', description: '畫面文字；少了任何一句時丟錯並列出缺的名稱。' },
      ],
    },
    {
      title: 'lib-line-chart',
      rows: [
        { name: '[categories]', type: 'readonly (string | Date)[]', default: '必填', description: 'x 軸。' },
        { name: '[series]', type: 'readonly ChartSeries[]', default: '必填', description: '{ id, label, values, color? }；values 對到 categories，缺值給 null（線斷開）；color 是 1–6，不給依順序。' },
        { name: '[area]', type: 'boolean', default: 'false', description: '線下填色。' },
        { name: '[height]', type: 'number', default: '240', description: '繪圖區高度（px，含 x 軸標）；寬度跟著容器（ResizeObserver）。' },
        { name: '[zeroBaseline]', type: 'boolean', default: 'true', description: 'y 軸從 0 開始。' },
        { name: '[integer]', type: 'boolean', default: 'false', description: '只出整數刻度（件數）。' },
        { name: '[(hiddenSeries)]', type: 'readonly string[]', default: '[]', description: '被圖例關掉的系列 id。' },
      ],
    },
    {
      title: 'lib-bar-chart',
      rows: [
        { name: '[categories]／[series]', type: '同折線', default: '必填', description: '類別與系列。' },
        { name: '[orientation]', type: "'vertical' | 'horizontal'", default: "'vertical'", description: '直式或橫式；橫式的長類別名截斷並把完整文字放在 <title>，直式先旋轉再截斷。' },
        { name: '[stacked]', type: 'boolean', default: 'false', description: '多個系列時堆疊（提示框與表格多一個總計）。' },
        { name: '[showValues]', type: 'boolean', default: 'false', description: '直接標註數值（堆疊時標總計）。' },
        { name: '[height]', type: 'number | null', default: '直式 240、橫式每列 34', description: '繪圖區高度（px）。' },
        { name: '[integer]／[(hiddenSeries)]', type: '同折線', default: '—', description: '整數刻度、圖例切換。' },
      ],
    },
    {
      title: 'lib-donut-chart',
      rows: [
        { name: '[slices]', type: 'readonly DonutSlice[]', default: '必填', description: '{ id, label, value, color? }。' },
        { name: '[maxSlices]', type: 'number', default: '6', description: '超過就保留最大的 maxSlices − 1 類，其餘併成「其他」（id 是 DONUT_OTHER_ID）。' },
        { name: '[size]', type: 'number', default: '200', description: '直徑（px）；寬的時候圖例在右、窄的時候在下。' },
        { name: '[centerLabel]', type: 'string', default: 'CHART_LABELS.total', description: '中心的標題。' },
        { name: '[percentDecimals]', type: 'number', default: '0', description: '百分比小數位數；四捨五入後加總剛好 100。' },
        { name: '[(selected)]', type: 'string | null', default: 'null', description: '選取中的類別（點圖例或扇形、Enter／空白鍵）；中心改顯示那一類。' },
      ],
    },
    {
      title: 'lib-stat-card（也可以寫成 a[lib-stat-card]、button[lib-stat-card]）',
      rows: [
        { name: '[label]', type: 'string', default: '必填', description: '指標名稱。' },
        { name: '[value]', type: 'string | number | null', default: 'null', description: '格式化好的字串，或數字（依 [format]）。' },
        { name: '[format]', type: 'Intl.NumberFormatOptions', default: '最多 1 位小數', description: '數字格式。' },
        { name: '[unit]', type: 'string', default: "''", description: '單位，例：件、小時。' },
        { name: '[previous]', type: 'number | null', default: 'null', description: '比較值；不給就不顯示變化。' },
        { name: '[numericValue]', type: 'number | null', default: 'null', description: 'value 是字串時用來算變化的數字。' },
        { name: '[period]', type: 'string', default: "''", description: '比較區間，例：上週 →「較上週 +12.5%」。' },
        { name: '[positiveIsGood]', type: 'boolean', default: 'true', description: '上升是好事；逾期數、處理時間設 false。' },
        { name: '[changeMode]', type: "'percent' | 'delta'", default: "'percent'", description: '百分比或差值（比較值是 0 時一律差值）。' },
        { name: '[sparkline]', type: 'readonly number[]', default: '[]', description: '迷你趨勢（role="img"＋摘要）；少於 2 點不畫。' },
        { name: '[sparklineColor]', type: '1–6', default: '1', description: '迷你趨勢用第幾個類別色。' },
        { name: '[loading]', type: 'boolean', default: 'false', description: '骨架。' },
      ],
    },
  ];
}
