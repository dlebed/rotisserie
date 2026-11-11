import { expect, test } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the stale-dist check in CI also fails on untracked files under dist/', async () => {
  const ci = await fs.readFile(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
  const step = ci.slice(ci.indexOf('name: Committed dist/ is up to date'));
  expect(step).toContain('git diff --exit-code -- dist/');
  expect(step).toContain('test -z "$(git status --porcelain -- dist/)"');
});
