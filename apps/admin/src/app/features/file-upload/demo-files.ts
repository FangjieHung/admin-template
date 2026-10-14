/**
 * 附件上傳展示頁的示範檔案：不用自己找檔案也能看到每一種狀態。照片是用 canvas 依目前配色畫出的風景
 * （換配色後再加一次，顏色就跟著變）；文件是內容固定的假檔案，大小照指定的 bytes。
 */

/** 一份最小的單頁 PDF（下載後打得開，內容是空白頁）。 */
const MINIMAL_PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj
trailer<</Root 1 0 R>>
%%EOF
`;

/** 指定大小的假文件（PDF 用上面那份當開頭，其餘補空白）。 */
export function demoDocument(name: string, type: string, size: number): File {
  const head = type === 'application/pdf' ? MINIMAL_PDF : `${name}\n`;
  const padding = new Uint8Array(Math.max(0, size - head.length)).fill(32);
  return new File([head, padding], name, { type, lastModified: Date.UTC(2026, 9, 14) });
}

/** 把語意 token 解析成 canvas 認得的 rgb()（token 的值可能是 light-dark() 或 color-mix()）。 */
function resolveColors(tokens: readonly string[]): string[] {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.append(probe);
  const colors = tokens.map((token) => {
    probe.style.color = `var(${token})`;
    return getComputedStyle(probe).color;
  });
  probe.remove();
  return colors;
}

/**
 * 一張依目前配色畫的「現場照片」（天空、太陽、兩座山、地面），`variant` 換構圖。預設 3200×2400，
 * 用來示範 maxImageDimension 縮小。
 */
export async function demoPhoto(name: string, variant: number, width = 3200, height = 2400): Promise<File> {
  const [sky, horizon, sun, far, near, ground] = resolveColors([
    '--mat-sys-secondary-container',
    '--mat-sys-surface-container-low',
    '--mat-sys-tertiary',
    '--mat-sys-primary-container',
    '--mat-sys-primary',
    '--mat-sys-surface-container-highest',
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d is not available');
  const w = width;
  const h = height;
  const shift = (variant % 4) * 0.17;

  const skyFill = ctx.createLinearGradient(0, 0, 0, h * 0.7);
  skyFill.addColorStop(0, sky);
  skyFill.addColorStop(1, horizon);
  ctx.fillStyle = skyFill;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(w * (0.2 + shift * 2.5), h * (0.22 + (variant % 2) * 0.08), h * 0.09, 0, Math.PI * 2);
  ctx.fill();

  const ridge = (color: string, base: number, peaks: number, amp: number, phase: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= peaks * 2; i++) {
      const x = (i / (peaks * 2)) * w;
      const y = h * base - (i % 2 === 0 ? 0 : h * amp * (0.6 + 0.4 * Math.sin(i + phase)));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  };
  ridge(far, 0.62, 3 + (variant % 3), 0.22, variant);
  ridge(near, 0.78, 2 + (variant % 2), 0.2, variant * 2 + 1);
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * 0.86, w, h * 0.14);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('canvas.toBlob failed');
  return new File([blob], name, { type: 'image/jpeg', lastModified: Date.UTC(2026, 9, 14) });
}
