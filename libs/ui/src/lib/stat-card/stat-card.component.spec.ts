import { beforeEach, describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CHART_LABELS } from '../chart-core/chart-labels';
import { TEST_CHART_LABELS } from '../chart-core/testing';
import { StatCardComponent, computeStatChange, statChangeTone } from './stat-card.component';

describe('computeStatChange／statChangeTone', () => {
  it('上升、下降、持平；比較值是 0 時沒有百分比', () => {
    expect(computeStatChange(45, 40)).toEqual({ delta: 5, ratio: 0.125, direction: 'up' });
    expect(computeStatChange(30, 40)).toEqual({ delta: -10, ratio: -0.25, direction: 'down' });
    expect(computeStatChange(40, 40)?.direction).toBe('flat');
    expect(computeStatChange(3, 0)).toEqual({ delta: 3, ratio: null, direction: 'up' });
    expect(computeStatChange(null, 4)).toBeNull();
    expect(computeStatChange(4, Number.NaN)).toBeNull();
  });

  it('positiveIsGood=false 時上升算變差', () => {
    expect(statChangeTone('up', true)).toBe('positive');
    expect(statChangeTone('up', false)).toBe('negative');
    expect(statChangeTone('down', false)).toBe('positive');
    expect(statChangeTone('flat', false)).toBe('neutral');
  });
});

@Component({
  imports: [StatCardComponent],
  template: `
    <lib-stat-card
      label="逾期"
      unit="件"
      period="上週"
      [value]="value()"
      [previous]="previous()"
      [positiveIsGood]="good()"
      [changeMode]="mode()"
      [sparkline]="spark()"
      [loading]="loading()"
    />
    <a lib-stat-card label="未結案" [value]="12" href="/x" class="as-link"></a>
  `,
})
class HostComponent {
  readonly value = signal<number | string | null>(45);
  readonly previous = signal<number | null>(40);
  readonly good = signal(true);
  readonly mode = signal<'percent' | 'delta'>('percent');
  readonly spark = signal<readonly number[]>([]);
  readonly loading = signal(false);
}

describe('StatCardComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;
  const card = () => el.querySelector('lib-stat-card') as HTMLElement;
  const change = () => card().querySelector('[data-stat-change]') as HTMLElement | null;
  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [{ provide: CHART_LABELS, useValue: TEST_CHART_LABELS }] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    await render();
  });

  it('數值、單位、「較上週 +12.5%」與箭頭；變好時報讀器念「表現變好」', () => {
    expect(card().querySelector('[data-stat-value]')!.textContent).toBe('45');
    expect(card().textContent).toContain('件');
    expect(change()!.textContent).toContain('較上週 +12.5%');
    expect(change()!.getAttribute('data-tone')).toBe('positive');
    expect(change()!.querySelector('.sc-arrow')!.textContent).toBe('arrow_upward');
    expect(change()!.textContent).toContain('表現變好');
  });

  it('positiveIsGood=false：同樣上升，顏色與報讀變成「變差」', async () => {
    host.good.set(false);
    await render();
    expect(change()!.getAttribute('data-tone')).toBe('negative');
    expect(change()!.textContent).toContain('表現變差');
    expect(change()!.textContent).toContain('+12.5%');
  });

  it('差值模式、持平、沒有比較值', async () => {
    host.mode.set('delta');
    await render();
    expect(change()!.textContent).toContain('較上週 +5 件');
    host.previous.set(45);
    await render();
    expect(change()!.getAttribute('data-tone')).toBe('neutral');
    expect(change()!.querySelector('.sc-arrow')!.textContent).toBe('remove');
    host.previous.set(null);
    await render();
    expect(change()).toBeNull();
  });

  it('迷你趨勢：role="img"＋摘要；少於 2 點不畫', async () => {
    expect(card().querySelector('[data-stat-spark]')).toBeNull();
    host.spark.set([3, 5, 4, 8]);
    await render();
    const spark = card().querySelector('[data-stat-spark]')!;
    expect(spark.getAttribute('role')).toBe('img');
    expect(spark.getAttribute('aria-label')).toBe('逾期的趨勢，3 到 8');
  });

  it('載入中顯示骨架與 aria-busy', async () => {
    host.loading.set(true);
    await render();
    expect(card().getAttribute('aria-busy')).toBe('true');
    expect(card().querySelector('[data-stat-value]')).toBeNull();
    expect(card().textContent).toContain('載入中');
  });

  it('<a lib-stat-card>：整張卡是連結，掛上可點卡片的 class', () => {
    const link = el.querySelector('a.as-link')!;
    expect(link.classList).toContain('ui-card');
    expect(link.classList).toContain('ui-card--clickable');
    expect(card().classList).not.toContain('ui-card--clickable');
  });
});
