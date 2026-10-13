import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CHART_LABELS } from '../chart-core/chart-labels';
import { DonutSlice } from '../chart-core/chart.types';
import { FakeResizeObserver, TEST_CHART_LABELS } from '../chart-core/testing';
import { DonutChartComponent } from './donut-chart.component';

const EIGHT: DonutSlice[] = [
  { id: 'a', label: '待處理', value: 31 },
  { id: 'b', label: '處理中', value: 27 },
  { id: 'c', label: '等待回覆', value: 14 },
  { id: 'd', label: '已完成', value: 12 },
  { id: 'e', label: '已關閉', value: 9 },
  { id: 'f', label: '退回', value: 4 },
  { id: 'g', label: '重複', value: 2 },
  { id: 'h', label: '取消', value: 1 },
];

@Component({
  imports: [DonutChartComponent],
  template: `<lib-donut-chart [slices]="slices()" [(selected)]="selected" />`,
})
class HostComponent {
  readonly slices = signal<readonly DonutSlice[]>(EIGHT);
  readonly selected = signal<string | null>(null);
}

describe('DonutChartComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;
  const original = globalThis.ResizeObserver;

  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const slices = () => Array.from(el.querySelectorAll<SVGPathElement>('path.dc-slice'));
  const legend = () => Array.from(el.querySelectorAll<HTMLButtonElement>('lib-chart-legend button'));
  const center = () =>
    Array.from(el.querySelectorAll('.dc-center > span'))
      .map((s) => s.textContent!.trim())
      .join(' ');

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

  it('超過 6 類時保留最大的 5 類，其餘併成「其他」（文字由 labels 提供）', () => {
    expect(slices()).toHaveLength(6);
    const names = legend().map((b) => b.querySelector('.lg__label')!.textContent);
    expect(names).toEqual(['待處理', '處理中', '等待回覆', '已完成', '已關閉', '其他']);
    expect(legend()[5].textContent).toContain('7');
  });

  it('圖例附百分比，加總剛好 100%', () => {
    const pcts = legend().map((b) => Number(b.querySelector('.lg__detail')!.textContent!.match(/（(\d+)%）/)![1]));
    expect(pcts.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('中心預設是總計；點圖例選取一類，中心改顯示那一類，再點一次取消', async () => {
    expect(center()).toBe('總計 100');
    legend()[1].click();
    await render();
    expect(host.selected()).toBe('b');
    expect(center()).toBe('處理中 27 27%');
    expect(legend()[1].getAttribute('aria-pressed')).toBe('true');
    legend()[1].click();
    await render();
    expect(host.selected()).toBeNull();
    expect(center()).toBe('總計 100');
  });

  it('鍵盤：方向鍵在扇形之間移動，Enter 選取', async () => {
    slices()[0].dispatchEvent(new FocusEvent('focus'));
    await render();
    expect(center()).toContain('待處理');
    slices()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await render();
    expect(slices()[1].getAttribute('tabindex')).toBe('0');
    expect(center()).toContain('處理中');
    slices()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await render();
    expect(host.selected()).toBe('b');
    expect(slices()[1].getAttribute('aria-label')).toBe('處理中：27（27%）');
  });

  it('以表格檢視：每類一列，最後一列是總計', async () => {
    el.querySelector<HTMLButtonElement>('[data-chart-toggle]')!.click();
    await render();
    const rows = el.querySelectorAll('lib-chart-table tbody tr');
    expect(rows).toHaveLength(6);
    expect(el.querySelector('lib-chart-table tfoot')!.textContent).toContain('100');
  });

  it('總和是 0 或沒有資料時顯示空狀態', async () => {
    host.slices.set([{ id: 'a', label: 'A', value: 0 }]);
    await render();
    expect(el.querySelector('lib-empty-state')!.textContent).toContain('沒有資料');
    host.slices.set([]);
    await render();
    expect(el.querySelector('lib-empty-state')).not.toBeNull();
  });
});
