import { describe, expect, it } from 'vitest';
import { assertChartLabels, formatChartLabel } from './chart-labels';
import {
  arcPath,
  areaPath,
  chartColorOf,
  chartDash,
  estimateTextWidth,
  groupSmallSlices,
  labelStep,
  linePath,
  nearestIndex,
  niceNumber,
  niceTicks,
  stackValues,
  toPercentages,
  truncateText,
  valueExtent,
} from './chart-math';
import { TEST_CHART_LABELS } from './testing';

describe('niceTicks', () => {
  it('把範圍往外擴到 1／2／5 × 10ⁿ 的整數倍', () => {
    expect(niceTicks(0, 87)).toEqual({ min: 0, max: 100, step: 20, ticks: [0, 20, 40, 60, 80, 100] });
    expect(niceTicks(3, 47, { maxTicks: 6 }).ticks).toEqual([0, 10, 20, 30, 40, 50]);
    expect(niceTicks(0, 1.3).ticks).toEqual([0, 0.5, 1, 1.5]);
  });

  it('小數刻度不會累積浮點誤差', () => {
    const { ticks } = niceTicks(0, 0.7);
    expect(ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8]);
    expect(ticks.every((t) => String(t).length <= 3)).toBe(true);
  });

  it('負值與跨 0 的範圍', () => {
    expect(niceTicks(-35, 62).ticks).toEqual([-40, -20, 0, 20, 40, 60, 80]);
    expect(niceTicks(-12, -3).ticks).toEqual([-12, -10, -8, -6, -4, -2]);
  });

  it('整數刻度：件數只有 0–2 時間距是 1，不出現 0.5', () => {
    expect(niceTicks(0, 2, { integer: true }).ticks).toEqual([0, 1, 2]);
    expect(niceTicks(0, 1, { integer: true }).ticks).toEqual([0, 1]);
  });

  it('兩端相同或沒有資料時撐開成可畫的範圍', () => {
    expect(niceTicks(0, 0).ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    const same = niceTicks(50, 50);
    expect(same.min).toBeLessThan(50);
    expect(same.max).toBeGreaterThan(50);
    expect(niceTicks(Number.NaN, 4)).toEqual(niceTicks(0, 1));
    expect(niceTicks(10, 0)).toEqual(niceTicks(0, 10));
  });

  it('niceNumber：往上取與四捨五入', () => {
    expect(niceNumber(87, false)).toBe(100);
    expect(niceNumber(3.2, true)).toBe(5);
    expect(niceNumber(0.14, true)).toBe(0.1);
    expect(niceNumber(0, true)).toBe(1);
  });
});

describe('stackValues 與 valueExtent', () => {
  it('同一類別的正值往上疊、負值往下疊，缺值當 0', () => {
    const stacks = stackValues([
      [3, 5, -2],
      [4, null, -1],
      [1, 2, 6],
    ]);
    expect(stacks[0]).toEqual([
      { start: 0, end: 3 },
      { start: 0, end: 5 },
      { start: 0, end: -2 },
    ]);
    expect(stacks[1]).toEqual([
      { start: 3, end: 7 },
      { start: 5, end: 5 },
      { start: -2, end: -3 },
    ]);
    expect(stacks[2]).toEqual([
      { start: 7, end: 8 },
      { start: 5, end: 7 },
      { start: 0, end: 6 },
    ]);
  });

  it('範圍：分組看單一值、堆疊看總和', () => {
    const values = [
      [3, 5],
      [4, null],
    ];
    expect(valueExtent(values)).toEqual([3, 5]);
    expect(valueExtent(values, true)).toEqual([0, 7]);
    expect(valueExtent([[null, null]])).toEqual([0, 0]);
  });
});

describe('toPercentages', () => {
  it('四捨五入後加總剛好 100', () => {
    for (const values of [
      [1, 1, 1],
      [33, 33, 34],
      [5, 7, 11, 13, 17, 19, 23],
      [0.1, 0.2, 0.3],
      [999, 1],
    ]) {
      const pcts = toPercentages(values);
      expect(pcts.reduce((a, b) => a + b, 0), values.join(',')).toBe(100);
    }
    expect(toPercentages([1, 1, 1])).toEqual([34, 33, 33]);
  });

  it('小數位數：加總仍是 100', () => {
    const pcts = toPercentages([1, 1, 1], 1);
    expect(pcts).toEqual([33.4, 33.3, 33.3]);
    expect(Math.round(pcts.reduce((a, b) => a + b, 0) * 10)).toBe(1000);
  });

  it('負值當 0；總和是 0 時全部是 0', () => {
    expect(toPercentages([-5, 5])).toEqual([0, 100]);
    expect(toPercentages([0, 0])).toEqual([0, 0]);
  });
});

describe('groupSmallSlices', () => {
  const slices = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id, i) => ({ id, label: id.toUpperCase(), value: [30, 2, 25, 1, 18, 9, 4, 11][i] }));
  const other = { id: '__other', label: '其他' };

  it('超過上限時保留最大的 max − 1 類（原本的順序），其餘合併成「其他」排最後', () => {
    const grouped = groupSmallSlices(slices, 6, other);
    expect(grouped.map((s) => s.id)).toEqual(['a', 'c', 'e', 'f', 'h', '__other']);
    expect(grouped[5]).toEqual({ id: '__other', label: '其他', value: 2 + 1 + 4 });
    expect(grouped.reduce((sum, s) => sum + s.value, 0)).toBe(slices.reduce((sum, s) => sum + s.value, 0));
  });

  it('沒有超過就原樣回傳複本', () => {
    const few = slices.slice(0, 4);
    const grouped = groupSmallSlices(few, 6, other);
    expect(grouped).toEqual(few);
    expect(grouped).not.toBe(few);
  });
});

describe('顏色、線型與路徑', () => {
  it('顏色依順序 1–6 循環，可以指定', () => {
    expect([0, 1, 5, 6, 7].map((i) => chartColorOf(i))).toEqual([1, 2, 6, 1, 2]);
    expect(chartColorOf(0, 4)).toBe(4);
  });

  it('前 3 條實線，第 4–6 條各有不同的虛線樣式', () => {
    expect([0, 1, 2].map(chartDash)).toEqual(['', '', '']);
    const dashes = [3, 4, 5].map(chartDash);
    expect(new Set(dashes).size).toBe(3);
    expect(dashes.every((d) => d.length > 0)).toBe(true);
  });

  it('折線在缺值的地方斷開；面積每段各自封到基準線', () => {
    const pts = [{ x: 0, y: 10 }, { x: 10, y: 5 }, null, { x: 30, y: 8 }, { x: 40, y: 2 }];
    expect(linePath(pts)).toBe('M0 10L10 5M30 8L40 2');
    expect(areaPath(pts, 20)).toBe('M0 20L0 10L10 5L10 20ZM30 20L30 8L40 2L40 20Z');
  });

  it('圓環的一段從 12 點鐘順時針；整圈拆成兩個半圓', () => {
    expect(arcPath(50, 50, 40, 20, 0, Math.PI / 2)).toBe('M50 10A40 40 0 0 1 90 50L70 50A20 20 0 0 0 50 30Z');
    expect(arcPath(50, 50, 40, 20, 0, Math.PI * 2).match(/A40/g)).toHaveLength(2);
    expect(arcPath(50, 50, 40, 20, 1, 1)).toBe('');
  });

  it('最接近的位置', () => {
    expect(nearestIndex([0, 10, 20, 30], 14)).toBe(1);
    expect(nearestIndex([0, 10, 20, 30], 99)).toBe(3);
    expect(nearestIndex([], 5)).toBe(-1);
  });
});

describe('文字寬度與軸標', () => {
  it('中文 1em、數字約半個字寬', () => {
    expect(estimateTextWidth('帳號權限', 12)).toBe(48);
    expect(estimateTextWidth('10/14', 10)).toBeCloseTo(0.56 * 40 + 5.2, 5);
  });

  it('超過寬度就截斷並加「…」，結果不超過寬度', () => {
    const long = '會議室投影機沒有畫面';
    const cut = truncateText(long, 60, 12);
    expect(cut.endsWith('…')).toBe(true);
    expect(estimateTextWidth(cut, 12)).toBeLessThanOrEqual(60);
    expect(truncateText('網路', 60, 12)).toBe('網路');
  });

  it('放不下時每隔幾個標一次', () => {
    expect(labelStep(30, 600, 40)).toBe(2);
    expect(labelStep(7, 600, 40)).toBe(1);
    expect(labelStep(92, 300, 36)).toBe(12);
  });
});

describe('CHART_LABELS', () => {
  it('缺字時丟錯並列出缺的名稱', () => {
    const { other: _other, viewAsTable: _view, ...partial } = TEST_CHART_LABELS;
    expect(() => assertChartLabels(partial)).toThrow(/「viewAsTable」「other」/);
    expect(() => assertChartLabels(null)).toThrow(/CHART_LABELS/);
    expect(assertChartLabels(TEST_CHART_LABELS)).toBe(TEST_CHART_LABELS);
  });

  it('formatChartLabel 換掉 {name}，不認得的保留原樣', () => {
    expect(formatChartLabel('較{period} {change}', { period: '上週', change: '+12.5%' })).toBe('較上週 +12.5%');
    expect(formatChartLabel('{a}{b}', { a: 1 })).toBe('1{b}');
  });
});
