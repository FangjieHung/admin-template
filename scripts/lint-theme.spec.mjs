import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectThemedAppRoots } from './lint-theme.mjs';

function run(dir) {
  try {
    execFileSync('node', ['scripts/lint-theme.mjs', dir], { encoding: 'utf8' });
    return { code: 0, out: '' };
  } catch (e) {
    return { code: e.status, out: e.stdout?.toString() ?? '' };
  }
}

describe('lint-theme', () => {
  it('掃到寫死色 → exit 1 並列出檔案', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lt-'));
    writeFileSync(join(dir, 'bad.scss'), '.x { color: #ff0000; }');
    const r = run(dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain('bad.scss');
  });

  it('乾淨（只用 token）→ exit 0', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lt-'));
    writeFileSync(join(dir, 'ok.scss'), '.x { color: var(--mat-sys-primary); }');
    expect(run(dir).code).toBe(0);
  });

  it('_tokens.scss 允許寫死色 → exit 0', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lt-'));
    mkdirSync(join(dir, 'material'), { recursive: true });
    writeFileSync(join(dir, 'material', '_tokens.scss'), '--x: #ff0000;');
    expect(run(dir).code).toBe(0);
  });

  it('scanRoot 可以是單一 .scss 檔（非目錄）→ 也會被 lint', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lt-'));
    const file = join(dir, 'single.scss');
    writeFileSync(file, '.x { color: #ff0000; }');
    const r = run(file);
    expect(r.code).toBe(1);
    expect(r.out).toContain('single.scss');
  });

  it('transition 寫死時長（含多行值、延遲）→ exit 1', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lt-'));
    writeFileSync(join(dir, 'a.scss'), '.x { transition: color 200ms ease; }');
    writeFileSync(join(dir, 'b.scss'), '.y {\n  transition:\n    width var(--app-motion-base) ease,\n    opacity 0.15s linear;\n}');
    writeFileSync(join(dir, 'c.scss'), '.z { transition-delay: 90ms; }');
    const r = run(dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain('a.scss:1');
    expect(r.out).toContain('b.scss:4');
    expect(r.out).toContain('c.scss:1');
  });

  it('transition 用 --app-motion-*、0s 延遲、calc 比例 → exit 0；_tokens.scss 可寫時長', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lt-'));
    writeFileSync(
      join(dir, 'ok.scss'),
      '.x {\n  transition:\n    grid-template-rows var(--app-motion-base) var(--app-ease-standard),\n    flex-basis 0s linear 0s;\n}\n.y { transition: width var(--app-motion-base) ease calc(var(--app-motion-base) * 0.45); }\n.z { animation: spin 200ms linear; }',
    );
    mkdirSync(join(dir, 'frosted'), { recursive: true });
    writeFileSync(join(dir, 'frosted', '_tokens.scss'), ':root { --x: 1; transition: color 200ms; }');
    expect(run(dir).code).toBe(0);
  });

  it('collectThemedAppRoots 只回傳有 @use theme-pack 的 app', () => {
    const base = mkdtempSync(join(tmpdir(), 'lt-'));
    const apps = join(base, 'apps');
    for (const [name, styles] of [
      ['admin', "@use 'theme-pack/src/lib/styles/skeleton';"],
      ['store', "@use 'tailwindcss';"],
    ]) {
      mkdirSync(join(apps, name, 'src'), { recursive: true });
      writeFileSync(join(apps, name, 'src', 'styles.scss'), styles);
    }
    const roots = collectThemedAppRoots(apps);
    expect(roots).toHaveLength(1);
    expect(roots[0].endsWith(join('admin', 'src'))).toBe(true);
  });
});
