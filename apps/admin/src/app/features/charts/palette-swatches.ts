import { COLOR_THEMES, colorThemeStylesheetHref, isOnDemandColorTheme } from '@admin-template/theme-pack';

/**
 * 「12 套配色的圖表色」示範：直接讀各配色樣式檔裡 `:root[data-theme='<id>']` 的變數，不在程式裡抄一份色碼。
 * 常駐配色（Verdant）在主樣式裡、從 document.styleSheets 找；按需配色下載 `color-<id>.css` 後用 CSSStyleSheet 解析。
 */

export interface PaletteSwatch {
  id: string;
  label: string;
  /** 卡片表面（--mat-sys-surface）與文字墨（--mat-sys-on-surface）。 */
  surface: string;
  ink: string;
  /** --app-chart-1…6 與各自對卡片表面的對比。 */
  colors: { value: string; contrast: number }[];
}

const CHART_VARS = [1, 2, 3, 4, 5, 6].map((i) => `--app-chart-${i}`);

function collectRules(rules: CSSRuleList, id: string, out: CSSStyleRule[]): void {
  const selector = new RegExp(`^:root\\[data-theme=["']?${id}["']?\\]$`);
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule && selector.test(rule.selectorText.trim())) out.push(rule);
    else if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) collectRules((rule as CSSGroupingRule).cssRules, id, out);
  }
}

function resolver(rules: CSSStyleRule[]): (name: string) => string {
  const read = (name: string): string => {
    for (const rule of rules) {
      const v = rule.style.getPropertyValue(name).trim();
      if (v) return v;
    }
    return '';
  };
  return (name) => {
    let value = read(name);
    for (let depth = 0; depth < 5; depth++) {
      const m = /^var\((--[\w-]+)\)$/.exec(value);
      if (!m) break;
      value = read(m[1]);
    }
    return value;
  };
}

function luminance(hex: string): number | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** WCAG 對比；任一個不是 6 位色碼時回 0。 */
export function contrastOf(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return 0;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

async function rulesFor(id: string, doc: Document): Promise<CSSStyleRule[]> {
  const out: CSSStyleRule[] = [];
  if (isOnDemandColorTheme(id)) {
    const response = await fetch(new URL(colorThemeStylesheetHref(id), doc.baseURI));
    if (!response.ok) throw new Error(`無法載入 ${colorThemeStylesheetHref(id)}`);
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(await response.text());
    collectRules(sheet.cssRules, id, out);
  } else {
    for (const sheet of Array.from(doc.styleSheets)) {
      try {
        collectRules(sheet.cssRules, id, out);
      } catch {
        // 跨來源的樣式表（Google Fonts）讀不到規則，略過。
      }
    }
  }
  return out;
}

/** 讀出 12 套配色的圖表色；讀不到的配色略過（例如離線時按需配色下載失敗）。 */
export async function loadPaletteSwatches(doc: Document): Promise<PaletteSwatch[]> {
  const results = await Promise.all(
    COLOR_THEMES.map(async (theme): Promise<PaletteSwatch | null> => {
      try {
        const get = resolver(await rulesFor(theme.id, doc));
        const surface = get('--mat-sys-surface');
        if (!surface) return null;
        return {
          id: theme.id,
          label: theme.label,
          surface,
          ink: get('--mat-sys-on-surface'),
          colors: CHART_VARS.map((name) => {
            const value = get(name);
            return { value, contrast: contrastOf(value, surface) };
          }),
        };
      } catch {
        return null;
      }
    }),
  );
  return results.filter((r): r is PaletteSwatch => r !== null);
}
