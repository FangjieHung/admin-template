// 對比計算的純邏輯（無 DOM／無網路依賴），供 contrast-report.mjs 使用，並可獨立單元測試。
//
// 方法說明（alpha compositing）：
// 瀏覽器渲染時，一段文字實際看到的背景色，是從 <html> 往下、經過每一層祖先元素的
// background-color（含透明度）依序疊加到「元素自身背景」為止的合成結果。我們用標準
// Porter-Duff "source-over" 公式，從最外層（html）往內、逐層疊加到不透明畫布上：
//   base := 不透明白色 (瀏覽器預設畫布)
//   for each layer from outermost to innermost:
//     if layer.a > 0: base := compositeOver(layer, base)
//   effectiveBackground := base
// 對於半透明材質（如 Frosted 用 rgba 疊在毛玻璃上），這個方法會得到與實際渲染色一致的
// 「有效底色」，可直接拿去算 WCAG 對比。已知限制：backdrop-filter: blur() 不會改變
// flat 合成色的計算（我們只合成顏色數值，不模擬模糊取樣），對於背景本身是純色/低頻
// 漸層時誤差可忽略；若背景後方是複雜影像/漸層，合成結果僅為近似值。

/**
 * 解析 CSS 顏色字串為 {r,g,b,a}，支援瀏覽器 getComputedStyle 回傳的
 * `rgb(r, g, b)` / `rgba(r, g, b, a)` / `rgba(r g b / a)` / `transparent` 格式。
 */
export function parseColor(input) {
  if (!input || input === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  const rgbMatch = input.match(
    /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i,
  );
  if (rgbMatch) {
    const [, r, g, b, aRaw] = rgbMatch;
    const a = aRaw === undefined ? 1 : aRaw.endsWith('%') ? parseFloat(aRaw) / 100 : parseFloat(aRaw);
    return { r: Number(r), g: Number(g), b: Number(b), a };
  }

  // 部分瀏覽器（尤其牽涉 color-mix()/寬色域）會把 getComputedStyle 正規化成
  // `color(srgb r g b / a)`，分量是 0..1 而非 0..255，這裡換算回 0..255。
  const colorFnMatch = input.match(
    /^color\(\s*srgb(?:-linear)?\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i,
  );
  if (colorFnMatch) {
    const [, r, g, b, aRaw] = colorFnMatch;
    const a = aRaw === undefined ? 1 : aRaw.endsWith('%') ? parseFloat(aRaw) / 100 : parseFloat(aRaw);
    return { r: Number(r) * 255, g: Number(g) * 255, b: Number(b) * 255, a };
  }

  throw new Error(`無法解析顏色字串: ${input}`);
}

/** Porter-Duff source-over：把半透明 fg 疊在「已知不透明」的 bg 上。 */
export function compositeOver(fg, bg) {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

/**
 * 給一疊由外而內（html -> ... -> 元素自身）的背景色，合成出最終有效底色。
 * 找不到任何不透明底色時，以瀏覽器預設白色畫布當基底。
 */
export function effectiveBackground(layersOuterToInner) {
  let base = { r: 255, g: 255, b: 255, a: 1 };
  for (const layer of layersOuterToInner) {
    if (layer.a > 0) base = compositeOver(layer, base);
  }
  return base;
}

function srgbToLinear(c) {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x 相對亮度 */
export function relativeLuminance({ r, g, b }) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG 對比比值，輸入為兩個不透明 {r,g,b}，回傳 >= 1 的比值（較亮者在前）。 */
export function contrastRatio(rgbA, rgbB) {
  const lA = relativeLuminance(rgbA);
  const lB = relativeLuminance(rgbB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** 便利函式：文字色字串 + 一疊背景色字串（外->內）-> 對比比值與合成後底色。 */
export function contrastForTextOnStack(textColorStr, bgLayerStrsOuterToInner) {
  const text = parseColor(textColorStr);
  const layers = bgLayerStrsOuterToInner.map(parseColor);
  const bg = effectiveBackground(layers);
  const ratio = contrastRatio({ r: text.r, g: text.g, b: text.b }, bg);
  return { ratio, effectiveBg: bg, textRgb: { r: text.r, g: text.g, b: text.b } };
}

export const THRESHOLD_NORMAL_TEXT = 4.5;
export const THRESHOLD_LARGE_TEXT = 3.0;
export const THRESHOLD_UI_BOUNDARY = 3.0;

export function passes(ratio, kind) {
  const threshold =
    kind === 'large' || kind === 'ui' ? THRESHOLD_LARGE_TEXT : THRESHOLD_NORMAL_TEXT;
  return ratio >= threshold;
}
