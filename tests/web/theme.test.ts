import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.join(__dirname, '../../web/src/theme.css'), 'utf8');

function vars(selectorStart: string): string[] {
  const i = css.indexOf(selectorStart);
  expect(i, `block ${selectorStart}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', i);
  const close = css.indexOf('}', open);
  return [...css.slice(open, close).matchAll(/(--rt-[a-z0-9-]+)\s*:/g)].map((m) => m[1] as string).sort();
}

describe('theme tokens', () => {
  const light = vars(':root {');
  const darkAuto = vars(':root:not([data-theme="light"])');
  const darkManual = vars(':root[data-theme="dark"]');

  it('defines the required variables', () => {
    for (const v of ['bg', 'surface', 'raised', 'border', 'border-strong', 'text', 'text-2', 'muted', 'accent',
      'accent-tint', 'on-accent', 'primary', 'on-primary', 'sent', 'done', 'assumed', 'invalid', 'open']) {
      expect(light).toContain(`--rt-${v}`);
    }
  });

  it('redefines every light variable in both dark blocks', () => {
    expect(darkAuto).toEqual(light);
    expect(darkManual).toEqual(light);
  });
});
