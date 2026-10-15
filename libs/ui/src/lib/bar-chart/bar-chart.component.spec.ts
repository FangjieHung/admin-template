import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CHART_LABELS } from '../chart-core/chart-labels';
import { ChartSeries } from '../chart-core/chart.types';
import { FakeResizeObserver, TEST_CHART_LABELS } from '../chart-core/testing';
import { BarChartComponent } from './bar-chart.component';

const CATEGORIES = ['硬體', '軟體', '帳號權限與群組信箱的申請', '網路'];
const SERIES: ChartSeries[] = [
  { id: 'open', label: '未結案', values: [5, 3, 8, 2] },
  { id: 'done', label: '已結案', values: [4, 6, 1, 0] },
];

@Component({
  imports: [BarChartComponent],
  template: `
    <lib-bar-chart
      [categories]="categories"
      [series]="series()"
      [orientation]="orientation()"
      [stacked]="stacked()"
      [showValues]="showValues()"
      [integer]="true"
      [(hiddenSeries)]="hidden"
    />
  `,
})
class HostComponent {
  readonly categories = CATEGORIES;
  readonly series = signal<readonly ChartSeries[]>(SERIES);
  readonly orientation = signal<'vertical' | 'horizontal'>('vertical');
  readonly stacked = signal(false);
  readonly showValues = signal(false);
  readonly hidden = signal<readonly string[]>([]);
}

describe('BarChartComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;
  const original = globalThis.ResizeObserver;

  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const bars = (series?: string) =>
    Array.from(el.querySelectorAll<SVGRectElement>(`rect.bc-rect${series ? `[data-series="${series}"]` : ''}`));
  const hits = () => Array.from(el.querySelectorAll<SVGRectElement>('rect.lib-chart__hit'));

  beforeEach(async () => {
    FakeResizeObserver.instances = [];
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    TestBed.configureTestingModule({ providers: [{ provide: CHART_LABELS, useValue: TEST_CHART_LABELS }] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    await render();
  });

  afterEach(() => {
    globalThis.ResizeObserver = original;
  });

  it('分組：每個類別每個系列一根，0 的那根沒有高度', () => {
    expect(bars('open')).toHaveLength(4);
    expect(bars('done')).toHaveLength(4);
    expect(Number(bars('done')[3].getAttribute('height'))).toBe(0);
    // 同一類別的兩根並排、不重疊。
    const [a, b] = [bars('open')[0], bars('done')[0]];
    expect(Number(b.getAttribute('x'))).toBeGreaterThanOrEqual(Number(a.getAttribute('x')) + Number(a.getAttribute('width')));
  });

  it('堆疊：同一類別的段首尾相接，提示框與表格多一個總計', async () => {
    host.stacked.set(true);
    await render();
    const [open, done] = [bars('open')[0], bars('done')[0]];
    const openTop = Number(open.getAttribute('y'));
    const doneBottom = Number(done.getAttribute('y')) + Number(done.getAttribute('height'));
    expect(doneBottom).toBeCloseTo(openTop, 5);
    expect(open.getAttribute('x')).toBe(done.getAttribute('x'));

    hits()[0].dispatchEvent(new FocusEvent('focus'));
    await render();
    const tip = el.querySelector('[data-chart-tooltip]')!;
    expect(tip.textContent).toContain('總計');
    expect(tip.textContent).toContain('9');

    el.querySelector<HTMLButtonElement>('[data-chart-toggle]')!.click();
    await render();
    expect(el.querySelector('lib-chart-table thead')!.textContent).toContain('總計');
    expect(el.querySelectorAll('lib-chart-table tbody tr')[0].textContent).toContain('9');
  });

  it('數值標註：堆疊時標總計', async () => {
    host.stacked.set(true);
    host.showValues.set(true);
    await render();
    expect(Array.from(el.querySelectorAll('.bc-value')).map((t) => t.textContent!.trim())).toEqual(['9', '9', '9', '2']);
  });

  it('橫式：太長的類別截斷，完整文字放在 <title>', async () => {
    host.orientation.set('horizontal');
    FakeResizeObserver.resizeAll(360);
    await render();
    const labels = Array.from(el.querySelectorAll('text[data-axis="category"]'));
    expect(labels).toHaveLength(4);
    const long = labels[2];
    expect(long.textContent).toContain('…');
    expect(long.querySelector('title')!.textContent).toBe('帳號權限與群組信箱的申請');
    expect(labels[0].querySelector('title')).toBeNull();
  });

  it('格線、數值軸文字、基準線依方向畫：直式是橫線＋左側文字，橫式是直線＋下方文字', async () => {
    const attrs = (node: Element, names: string[]) => names.map((n) => node.getAttribute(n));
    const grid = () => Array.from(el.querySelectorAll('.lib-chart__grid line'));
    const valueTicks = () => Array.from(el.querySelectorAll('text.lib-chart__tick:not([data-axis])'));
    const baseline = () => el.querySelector('.lib-chart__baseline')!;
    FakeResizeObserver.resizeAll(480);
    await render();
    expect(grid().length).toBeGreaterThan(2);
    for (const line of grid()) {
      const [x1, x2, y1, y2] = attrs(line, ['x1', 'x2', 'y1', 'y2']);
      expect(y1).toBe(y2);
      expect(x1).not.toBe(x2);
    }
    expect(valueTicks().map((t) => attrs(t, ['dy', 'text-anchor']))).toEqual(valueTicks().map(() => ['0.32em', 'end']));
    expect(baseline().getAttribute('y1')).toBe(baseline().getAttribute('y2'));

    host.orientation.set('horizontal');
    await render();
    for (const line of grid()) {
      const [x1, x2, y1, y2] = attrs(line, ['x1', 'x2', 'y1', 'y2']);
      expect(x1).toBe(x2);
      expect(y1).not.toBe(y2);
    }
    expect(valueTicks().map((t) => attrs(t, ['dy', 'text-anchor']))).toEqual(valueTicks().map(() => [null, 'middle']));
    expect(baseline().getAttribute('x1')).toBe(baseline().getAttribute('x2'));
  });

  it('直式：類別放不下時旋轉', async () => {
    FakeResizeObserver.resizeAll(260);
    await render();
    const label = el.querySelector('text[data-axis="category"]')!;
    expect(label.getAttribute('transform')).toMatch(/^rotate\(-40 /);
  });

  it('鍵盤在類別之間移動；圖例關掉一個系列', async () => {
    hits()[0].dispatchEvent(new FocusEvent('focus'));
    await render();
    hits()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await render();
    expect(hits()[1].getAttribute('tabindex')).toBe('0');
    expect(hits()[1].getAttribute('aria-label')).toBe('軟體：未結案 3、已結案 6');

    el.querySelector<HTMLButtonElement>('[data-legend="open"]')!.click();
    await render();
    expect(bars('open')).toHaveLength(0);
    expect(host.hidden()).toEqual(['open']);
  });

  it('只有一個系列時不顯示圖例', async () => {
    host.series.set([SERIES[0]]);
    await render();
    expect(el.querySelector('lib-chart-legend')).toBeNull();
  });
});
