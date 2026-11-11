import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** Classes deliberately refined by session.css in a compound selector (never redefined on their own). */
const ALLOWED = new Set(['rt-h1']);

/** Every rt- class that appears in a rule selector, ignoring comments and @keyframes steps. */
function classes(file: string): Set<string> {
  const css = readFileSync(path.join(__dirname, '../../web/src', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const out = new Set<string>();
  for (const m of css.matchAll(/([^{}]+)\{/g)) {
    const selector = (m[1] ?? '').trim();
    if (selector.startsWith('@')) continue;
    for (const c of selector.matchAll(/\.(rt-[a-zA-Z0-9_-]+)/g)) out.add(c[1] as string);
  }
  return out;
}

describe('stylesheets', () => {
  it('session.css does not reuse a class that theme.css already styles', () => {
    const theme = classes('theme.css');
    const shared = [...classes('session.css')].filter((c) => theme.has(c) && !ALLOWED.has(c));
    expect(shared).toEqual([]);
  });

  it('the session view opts out of native scroll anchoring, which would double the manual compensation', () => {
    const css = readFileSync(path.join(__dirname, '../../web/src/session.css'), 'utf8');
    const rule = /\.rt-session-view\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/overflow-anchor:\s*none/);
  });
});
