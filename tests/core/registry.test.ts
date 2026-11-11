import { afterEach, beforeEach, expect, test } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getToken, home, listProjects, normalizeDir, readServerInfo, registerProject, writeServerInfo } from '../../src/core/registry';

let tmp: string, oldHome: string | undefined;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rt-reg-'));
  oldHome = process.env.ROTISSERIE_HOME;
  process.env.ROTISSERIE_HOME = path.join(tmp, 'home');
});
afterEach(async () => {
  if (oldHome === undefined) delete process.env.ROTISSERIE_HOME; else process.env.ROTISSERIE_HOME = oldHome;
  await fs.rm(tmp, { recursive: true, force: true });
});

test('home reads ROTISSERIE_HOME at call time', () => {
  expect(home()).toBe(path.join(tmp, 'home'));
  process.env.ROTISSERIE_HOME = path.join(tmp, 'other');
  expect(home()).toBe(path.join(tmp, 'other'));
  delete process.env.ROTISSERIE_HOME;
  expect(home()).toBe(path.join(os.homedir(), '.rotisserie'));
});

test('project keys differ for same-named folders and survive awkward paths', async () => {
  const a = path.join(tmp, 'one', 'my app ü'), b = path.join(tmp, 'two', 'my app ü');
  await fs.mkdir(a, { recursive: true }); await fs.mkdir(b, { recursive: true });
  const ka = await registerProject(a), kb = await registerProject(b);
  expect(ka).not.toBe(kb);
  expect(ka).toMatch(/^[0-9a-f]{8}$/);
  expect((await listProjects()).map(p => p.name)).toEqual(['my app ü', 'my app ü']);
});

test('a Windows drive letter in either case gives one project path (checked on any platform)', () => {
  expect(normalizeDir('c:\\Work\\app', 'win32')).toBe('C:\\Work\\app');
  expect(normalizeDir('C:\\Work\\app', 'win32')).toBe('C:\\Work\\app');
  expect(normalizeDir('d:/Work/sub/../app', 'win32')).toBe('D:\\Work\\app');
  // only the drive letter changes case, and nothing changes off Windows
  expect(normalizeDir('c:\\work\\App', 'win32')).toBe('C:\\work\\App');
  expect(normalizeDir('/home/c:/x/../y', 'linux')).toBe('/home/c:/y');
});

test('registering the same folder twice, even via a symlink, gives one key', async () => {
  const a = path.join(tmp, 'proj'); await fs.mkdir(a);
  const link = path.join(tmp, 'link');
  try { await fs.symlink(a, link, 'dir'); } catch { return; }   // symlinks may be unavailable (Windows)
  expect(await registerProject(link)).toBe(await registerProject(a));
  expect((await listProjects()).length).toBe(1);
});

test('getToken is stable across calls', async () => {
  const t = await getToken();
  expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
  expect(await getToken()).toBe(t);
});

test('concurrent first calls agree on one token', async () => {
  const tokens = await Promise.all([getToken(), getToken(), getToken(), getToken()]);
  expect(new Set(tokens).size).toBe(1);
});

test.skipIf(process.platform === 'win32')('config.json is mode 0600', async () => {
  await getToken();
  expect((await fs.stat(path.join(home(), 'config.json'))).mode & 0o777).toBe(0o600);
});

test('listProjects omits a project whose folder was deleted', async () => {
  const a = path.join(tmp, 'keep'), b = path.join(tmp, 'gone');
  await fs.mkdir(a); await fs.mkdir(b);
  await registerProject(a); await registerProject(b);
  await fs.rm(b, { recursive: true });
  expect((await listProjects()).map(p => p.name)).toEqual(['keep']);
});

test('listProjects is empty before any registration', async () => {
  expect(await listProjects()).toEqual([]);
});

test('server info round-trips and is null when absent or corrupt', async () => {
  expect(await readServerInfo()).toBeNull();
  await writeServerInfo({ host: '127.0.0.1', port: 4783, pid: 42 });
  expect(await readServerInfo()).toEqual({ host: '127.0.0.1', port: 4783, pid: 42 });
  await fs.writeFile(path.join(home(), 'server.json'), '{oops');
  expect(await readServerInfo()).toBeNull();
});
