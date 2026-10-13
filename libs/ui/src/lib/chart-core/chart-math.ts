import { ChartColor } from './chart.types';

/**
 * 圖表的數學（純函式，不碰 DOM）：刻度、堆疊、百分比、「其他」合併、文字寬度估算與 SVG 路徑。
 * 元件只負責把結果畫出來；這裡的每個函式都有單元測試（chart-math.spec.ts）。
 */

export interface NiceScale {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

export interface NiceTickOptions {
  /** 最多幾個刻度（含兩端），實際數量可能少一兩個。預設 5。 */
  maxTicks?: number;
  /** 只出整數刻度（件數、人數）：間距至少 1。 */
  integer?: boolean;
}

/** 1、2、5 × 10ⁿ 中最接近的「好看的數」。`round` 為 false 時往上取（涵蓋整個範圍）。 */
export function niceNumber(value: number, round: boolean): number {
  if (value <= 0 || !Number.isFinite(value)) return 1;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  let nice: number;
  if (round) nice = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  else nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * 10 ** exponent;
}

/**
 * 軸的刻度：把 [lo, hi] 往外擴到間距是 1／2／5 × 10ⁿ 的整數倍（Heckbert 的 nice numbers）。
 * 兩端相同時往外撐開一點（全是 0 時是 0–1），非有限數當成 0–1。
 */
export function niceTicks(lo: number, hi: number, options: NiceTickOptions = {}): NiceScale {
  const maxTicks = Math.max(2, options.maxTicks ?? 5);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) [lo, hi] = [0, 1];
  if (lo > hi) [lo, hi] = [hi, lo];
  if (lo === hi) {
    if (lo === 0) hi = 1;
    else {
      const pad = Math.abs(lo) * 0.1;
      lo -= pad;
      hi += pad;
    }
  }
  const range = niceNumber(hi - lo, false);
  let step = niceNumber(range / (maxTicks - 1), true);
  if (options.integer && step < 1) step = 1;
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const fix = (v: number) => Number(v.toFixed(decimals));
  const min = fix(Math.floor(lo / step) * step);
  const max = fix(Math.ceil(hi / step) * step);
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(fix(v));
  return { min, max, step, ticks };
}

/** 一段堆疊的起點與終點（同一個類別裡，正值往上疊、負值往下疊）。 */
export interface StackSpan {
  start: number;
  end: number;
}

/** 堆疊：`values[系列][類別]` → 每個系列每個類別的起訖。缺值當 0（起訖相同）。 */
export function stackValues(values: readonly (readonly (number | null)[])[]): StackSpan[][] {
  const length = Math.max(0, ...values.map((s) => s.length));
  const up = new Array<number>(length).fill(0);
  const down = new Array<number>(length).fill(0);
  return values.map((series) =>
    Array.from({ length }, (_, i) => {
      const v = series[i] ?? 0;
      if (v >= 0) {
        const span = { start: up[i], end: up[i] + v };
        up[i] = span.end;
        return span;
      }
      const span = { start: down[i], end: down[i] + v };
      down[i] = span.end;
      return span;
    }),
  );
}

/** 數值範圍（堆疊時看每個類別的總和）。沒有任何數值時是 [0, 0]。 */
export function valueExtent(values: readonly (readonly (number | null)[])[], stacked = false): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  if (stacked) {
    for (const series of stackValues(values)) {
      for (const span of series) {
        lo = Math.min(lo, span.start, span.end);
        hi = Math.max(hi, span.start, span.end);
      }
    }
  } else {
    for (const series of values) {
      for (const v of series) {
        if (v === null || !Number.isFinite(v)) continue;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
  }
  return Number.isFinite(lo) ? [lo, hi] : [0, 0];
}

/**
 * 百分比，四捨五入後加總剛好是 100（最大餘數法：先全部無條件捨去，差額依小數部分由大到小補上）。
 * 負值當 0；總和是 0 時全部是 0。
 */
export function toPercentages(values: readonly number[], decimals = 0): number[] {
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = clean.reduce((a, b) => a + b, 0);
  if (total <= 0) return clean.map(() => 0);
  const scale = 10 ** decimals;
  const raw = clean.map((v) => (v / total) * 100 * scale);
  const floors = raw.map(Math.floor);
  let remaining = 100 * scale - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - floors[i] })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remaining <= 0) break;
    floors[i] += 1;
    remaining -= 1;
  }
  return floors.map((f) => f / scale);
}

/**
 * 類別太多時把小項合併成一類：超過 `max` 類就保留數值最大的 `max - 1` 類（維持原本的順序），
 * 其餘加總成 `other`，排在最後。沒有超過就原樣回傳（複本）。
 */
export function groupSmallSlices<T extends { id: string; label: string; value: number }>(
  slices: readonly T[],
  max: number,
  other: { id: string; label: string },
): (T | { id: string; label: string; value: number })[] {
  if (slices.length <= max) return slices.slice();
  const keep = new Set(
    slices
      .map((s, i) => ({ i, value: s.value }))
      .sort((a, b) => b.value - a.value || a.i - b.i)
      .slice(0, Math.max(0, max - 1))
      .map((s) => s.i),
  );
  const rest = slices.filter((_, i) => !keep.has(i)).reduce((sum, s) => sum + Math.max(0, s.value), 0);
  return [...slices.filter((_, i) => keep.has(i)), { id: other.id, label: other.label, value: rest }];
}

/** 系列的顏色編號：有指定就用指定的，否則依順序 1–6 循環。 */
export function chartColorOf(index: number, explicit?: ChartColor): ChartColor {
  return explicit ?? (((index % 6) + 6) % 6 + 1) as ChartColor;
}

/** 第幾條線的虛線樣式：前 3 條實線，第 4–6 條虛線、點線、點虛線（色盲時第 4 色起靠線型分辨，ADR 0017）。 */
const DASHES = ['', '', '', '6 4', '1 4', '9 3 1 3'];
export function chartDash(index: number): string {
  return DASHES[index % DASHES.length];
}

/** 第幾條線的資料點形狀（圓、方、三角、菱形、倒三角、橫條），以 (x, y) 為中心、約 2r 見方的 SVG path。 */
export function chartMarker(index: number, x: number, y: number, r: number): string {
  const n = (v: number) => Number(v.toFixed(2));
  switch (index % 6) {
    case 1:
      return `M${n(x - r * 0.9)} ${n(y - r * 0.9)}h${n(r * 1.8)}v${n(r * 1.8)}h${n(-r * 1.8)}Z`;
    case 2:
      return `M${n(x)} ${n(y - r * 1.2)}L${n(x + r * 1.1)} ${n(y + r * 0.8)}L${n(x - r * 1.1)} ${n(y + r * 0.8)}Z`;
    case 3:
      return `M${n(x)} ${n(y - r * 1.25)}L${n(x + r * 1.25)} ${n(y)}L${n(x)} ${n(y + r * 1.25)}L${n(x - r * 1.25)} ${n(y)}Z`;
    case 4:
      return `M${n(x)} ${n(y + r * 1.2)}L${n(x + r * 1.1)} ${n(y - r * 0.8)}L${n(x - r * 1.1)} ${n(y - r * 0.8)}Z`;
    case 5:
      return `M${n(x - r * 1.2)} ${n(y - r * 0.55)}h${n(r * 2.4)}v${n(r * 1.1)}h${n(-r * 2.4)}Z`;
    default:
      return `M${n(x - r)} ${n(y)}a${n(r)} ${n(r)} 0 1 0 ${n(r * 2)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-r * 2)} 0Z`;
  }
}

export interface ChartPoint {
  x: number;
  y: number;
}

/** 折線：連續的點連成一段，`null` 的地方斷開。 */
export function linePath(points: readonly (ChartPoint | null)[]): string {
  let d = '';
  let open = false;
  for (const p of points) {
    if (!p) {
      open = false;
      continue;
    }
    d += `${open ? 'L' : 'M'}${round2(p.x)} ${round2(p.y)}`;
    open = true;
  }
  return d;
}

/** 面積：每一段連續的點各自往下封到基準線。 */
export function areaPath(points: readonly (ChartPoint | null)[], baseline: number): string {
  let d = '';
  let run: ChartPoint[] = [];
  const flush = () => {
    if (run.length > 1) {
      d += `M${round2(run[0].x)} ${round2(baseline)}`;
      for (const p of run) d += `L${round2(p.x)} ${round2(p.y)}`;
      d += `L${round2(run[run.length - 1].x)} ${round2(baseline)}Z`;
    }
    run = [];
  };
  for (const p of points) {
    if (p) run.push(p);
    else flush();
  }
  flush();
  return d;
}

/**
 * 圓環的一段：角度以 12 點鐘方向為 0、順時針，單位是弧度。整圈（≥ 2π）畫成兩個半圓。
 */
export function arcPath(cx: number, cy: number, outer: number, inner: number, start: number, end: number): string {
  const sweep = end - start;
  if (sweep <= 0) return '';
  if (sweep >= Math.PI * 2 - 1e-6) {
    const half = start + Math.PI;
    return arcPath(cx, cy, outer, inner, start, half) + arcPath(cx, cy, outer, inner, half, start + Math.PI * 2);
  }
  const pt = (r: number, a: number) => `${round2(cx + r * Math.sin(a))} ${round2(cy - r * Math.cos(a))}`;
  const large = sweep > Math.PI ? 1 : 0;
  return (
    `M${pt(outer, start)}A${round2(outer)} ${round2(outer)} 0 ${large} 1 ${pt(outer, end)}` +
    `L${pt(inner, end)}A${round2(inner)} ${round2(inner)} 0 ${large} 0 ${pt(inner, start)}Z`
  );
}

/** 最接近 x 的位置（positions 由小到大）。空陣列回 -1。 */
export function nearestIndex(positions: readonly number[], x: number): number {
  let best = -1;
  let distance = Infinity;
  positions.forEach((p, i) => {
    const d = Math.abs(p - x);
    if (d < distance) {
      distance = d;
      best = i;
    }
  });
  return best;
}

/**
 * 文字寬度的估算（不量 DOM，測試與伺服器端都能算）：中日韓全形字 1em、數字 0.56em、
 * 大寫拉丁 0.64em、其他 0.52em、空白 0.28em。用來決定軸標要不要跳著標、要不要旋轉或截斷。
 */
export function estimateTextWidth(text: string, fontPx: number): number {
  let em = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x2e80) em += 1;
    else if (ch >= '0' && ch <= '9') em += 0.56;
    else if (ch === ' ') em += 0.28;
    else if (ch >= 'A' && ch <= 'Z') em += 0.64;
    else em += 0.52;
  }
  return em * fontPx;
}

/** 超過寬度就截斷並加「…」（完整文字由使用端放在 `<title>`）。 */
export function truncateText(text: string, maxPx: number, fontPx: number): string {
  if (estimateTextWidth(text, fontPx) <= maxPx) return text;
  let out = '';
  for (const ch of text) {
    if (estimateTextWidth(`${out}${ch}…`, fontPx) > maxPx) break;
    out += ch;
  }
  return `${out}…`;
}

/** 每隔幾個標一次，讓相鄰的軸標不重疊（第一個一定標）。 */
export function labelStep(count: number, available: number, labelWidth: number): number {
  if (count <= 1 || labelWidth <= 0) return 1;
  const fit = Math.max(1, Math.floor(available / labelWidth));
  return Math.max(1, Math.ceil(count / fit));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
