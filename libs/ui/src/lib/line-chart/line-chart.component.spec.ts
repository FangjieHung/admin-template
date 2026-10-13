import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CHART_LABELS } from '../chart-core/chart-labels';
import { ChartSeries } from '../chart-core/chart.types';
import { FakeResizeObserver, TEST_CHART_LABELS } from '../chart-core/testing';
import { LineChartComponent } from './line-chart.component';

const DAYS = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 8 + i));
const SERIES: ChartSeries[] = [
  { id: 'created', label: '新增', values: [4, 7, 3, 9, 6, 5, 8] },
  { id: 'closed', label: '結案', values: [2, 5, null, 6, 7, 4, 9] },
];

@Component({
  imports: [LineChartComponent],
  template: `
    <lib-line-chart
      [categories]="categories()"
      [series]="series()"
      [area]="area()"
      [loading]="loading()"
      [integer]="true"
      [(hiddenSeries)]="hidden"
    />
  `,
})
class HostComponent {
  readonly categories = signal<readonly (Date | string)[]>(DAYS);
  readonly series = signal<readonly ChartSeries[]>(SERIES);
  readonly area = signal(false);
  readonly loading = signal(false);
  readonly hidden = signal<readonly string[]>([]);
}

describe('LineChartComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;
  const original = globalThis.ResizeObserver;

  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const svg = () => el.querySelector('svg.lib-chart__svg') as SVGSVGElement;
  const hits = () => Array.from(el.querySelectorAll<SVGRectElement>('rect.lib-chart__hit'));
  const key = (target: Element, k: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

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

  it('每個系列一條線；缺值的地方斷開；刻度是整數', () => {
    const lines = el.querySelectorAll('.lc-line');
    expect(lines).toHaveLength(2);
    expect(lines[1].getAttribute('d')!.match(/M/g)).toHaveLength(2);
    const ticks = Array.from(el.querySelectorAll('text.lib-chart__tick:not([data-axis])')).map((t) => t.textContent!.trim());
    expect(ticks).toEqual(['0', '2', '4', '6', '8', '10']);
  });

  it('figure 有給報讀器的摘要；每個 x 是一個可聚焦的資料點（roving tabindex）', () => {
    expect(el.querySelector('figcaption')!.textContent).toContain('折線圖，2 個系列（新增、結案）');
    expect(hits()).toHaveLength(7);
    expect(hits().map((h) => h.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1', '-1', '-1']);
    expect(hits()[2].getAttribute('aria-label')).toMatch(/新增 3、結案 —$/);
  });

  it('鍵盤：方向鍵移動資料點、Home／End 到兩端，提示框顯示該 x 的各系列數值', async () => {
    hits()[0].dispatchEvent(new FocusEvent('focus'));
    await render();
    key(hits()[0], 'ArrowRight');
    await render();
    expect(hits()[1].getAttribute('tabindex')).toBe('0');
    expect(hits()[0].getAttribute('tabindex')).toBe('-1');
    const tip = el.querySelector('[data-chart-tooltip]')!;
    expect(tip.textContent).toContain('新增');
    expect(tip.textContent).toContain('7');
    expect(tip.textContent).toContain('5');

    key(hits()[1], 'End');
    await render();
    expect(hits()[6].getAttribute('tabindex')).toBe('0');
    key(hits()[6], 'ArrowRight');
    await render();
    expect(hits()[6].getAttribute('tabindex')).toBe('0');
    key(hits()[6], 'Home');
    await render();
    expect(hits()[0].getAttribute('tabindex')).toBe('0');
    key(hits()[0], 'Escape');
    await render();
    expect(el.querySelector('[data-chart-tooltip]')).toBeNull();
  });

  it('圖例切換系列：被關掉的線不畫、aria-pressed 變 false，並寫回 hiddenSeries', async () => {
    const legend = el.querySelector<HTMLButtonElement>('[data-legend="closed"]')!;
    expect(legend.getAttribute('aria-pressed')).toBe('true');
    legend.click();
    await render();
    expect(host.hidden()).toEqual(['closed']);
    expect(el.querySelectorAll('.lc-line')).toHaveLength(1);
    expect(el.querySelector('[data-legend="closed"]')!.getAttribute('aria-pressed')).toBe('false');
    el.querySelector<HTMLButtonElement>('[data-legend="closed"]')!.click();
    await render();
    expect(host.hidden()).toEqual([]);
    expect(el.querySelectorAll('.lc-line')).toHaveLength(2);
  });

  it('以表格檢視：同一份資料換成表格，按鈕是 aria-pressed', async () => {
    const toggle = el.querySelector<HTMLButtonElement>('[data-chart-toggle]')!;
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    toggle.click();
    await render();
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('.lib-chart__plot')!.classList).toContain('lib-chart__plot--off');
    const rows = el.querySelectorAll('lib-chart-table tbody tr');
    expect(rows).toHaveLength(7);
    expect(rows[2].textContent).toContain('—');
    expect(el.querySelector('lib-chart-table thead')!.textContent).toContain('結案');
  });

  it('依容器寬度重算（ResizeObserver）', async () => {
    expect(svg().getAttribute('viewBox')).toBe('0 0 640 240');
    const before = el.querySelectorAll('text[data-axis="x"]').length;
    FakeResizeObserver.resizeAll(220);
    await render();
    expect(svg().getAttribute('viewBox')).toBe('0 0 220 240');
    expect(el.querySelectorAll('text[data-axis="x"]').length).toBeLessThan(before);
  });

  it('面積：每條線多一塊填色', async () => {
    host.area.set(true);
    await render();
    expect(el.querySelectorAll('.lc-area')).toHaveLength(2);
  });

  it('空資料顯示空狀態；載入中顯示骨架', async () => {
    host.series.set([{ id: 'x', label: 'X', values: [null, null] }]);
    await render();
    expect(el.querySelector('lib-empty-state')!.textContent).toContain('沒有資料');
    expect(svg()).toBeNull();
    host.loading.set(true);
    await render();
    expect(el.querySelector('lib-chart-skeleton')!.textContent).toContain('載入中');
    expect(el.querySelector('figure')!.getAttribute('aria-busy')).toBe('true');
  });

  it('沒有提供 CHART_LABELS 時丟出明確的錯誤', () => {
    TestBed.resetTestingModule();
    expect(() => TestBed.createComponent(HostComponent).detectChanges()).toThrow(/CHART_LABELS/);
  });
});
