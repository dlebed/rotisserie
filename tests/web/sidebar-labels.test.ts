import { expect, test } from 'vitest';
import { projectLabels } from '../../web/src/Sidebar';

const p = (key: string, dir: string) => ({ key, name: dir.split(/[\\/]/).at(-1)!, dir, sessions: [] });

test('projects that share a folder name are told apart by their parent folder', () => {
  const labels = projectLabels([p('a', '/work/one/app'), p('b', 'C:\\work\\two\\app'), p('c', '/work/solo')]);
  expect(labels.get('a')).toBe('app (one)');
  expect(labels.get('b')).toBe('app (two)');
  expect(labels.get('c')).toBe('solo');
});
