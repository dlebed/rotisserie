import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { accessHints, openBrowser, sessionUrl } from '../../src/server/open';
import { getToken, writeServerInfo } from '../../src/core/registry';

let tmp: string;
const saved = { ...process.env };
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rt-open-'));
  process.env.ROTISSERIE_HOME = tmp;
  delete process.env.ROTISSERIE_HOST; delete process.env.ROTISSERIE_PORT; delete process.env.ROTISSERIE_NO_OPEN;
});
afterEach(async () => {
  process.env = { ...saved };
  await fs.rm(tmp, { recursive: true, force: true });
});

test('sessionUrl uses the registry port, localhost for loopback binds, and the token', async () => {
  await writeServerInfo({ host: '127.0.0.1', port: 5123, pid: 1 });
  expect(await sessionUrl('pk', 'id')).toBe(`http://localhost:5123/s/pk/id?t=${await getToken()}`);
  await writeServerInfo({ host: '0.0.0.0', port: 5124, pid: 1 });
  expect(await sessionUrl('pk', 'id')).toContain('http://localhost:5124/');
  await writeServerInfo({ host: '10.1.1.1', port: 5125, pid: 1 });
  expect(await sessionUrl('pk', 'id')).toContain('http://10.1.1.1:5125/');
});

test('sessionUrl maps the IPv6 wildcard to localhost and brackets other IPv6 literals', async () => {
  await writeServerInfo({ host: '::', port: 5126, pid: 1 });
  expect(await sessionUrl('pk', 'id')).toContain('http://localhost:5126/s/pk/id?t=');
  await writeServerInfo({ host: 'fe80::1', port: 5127, pid: 1 });
  expect(await sessionUrl('pk', 'id')).toContain('http://[fe80::1]:5127/s/pk/id?t=');
  await writeServerInfo({ host: '::1', port: 5128, pid: 1 });
  expect(await sessionUrl('pk', 'id')).toContain('http://[::1]:5128/');
});

test('sessionUrl falls back to ROTISSERIE_PORT then 4783 without server info', async () => {
  expect(await sessionUrl('a', 'b')).toContain('http://localhost:4783/s/a/b?t=');
  process.env.ROTISSERIE_PORT = '4999';
  expect(await sessionUrl('a', 'b')).toContain('http://localhost:4999/');
});

test('accessHints builds the ssh tunnel command', () => {
  expect(accessHints({ SSH_CONNECTION: '10.0.0.5 50000 10.0.0.9 22', USER: 'dev' }, 4783))
    .toEqual(['ssh -L 4783:127.0.0.1:4783 dev@10.0.0.9']);
  expect(accessHints({}, 4783)).toEqual([]);
});

test('accessHints warns when bound to a non-loopback host', () => {
  const h = accessHints({ ROTISSERIE_HOST: '0.0.0.0' }, 4783);
  expect(h).toHaveLength(1);
  expect(h[0]).toMatch(/other machines/);
  expect(h[0]).toMatch(/token/);
  for (const wildcard of ['0.0.0.0', '::']) {
    const [hint] = accessHints({ ROTISSERIE_HOST: wildcard }, 4783);
    expect(hint).toMatch(/on all network interfaces at port 4783;/);
    expect(hint).not.toContain(`${wildcard}:`);
  }
  expect(accessHints({ ROTISSERIE_HOST: '10.1.1.1' }, 4783)[0]).toMatch(/at 10\.1\.1\.1:4783;/);
  expect(accessHints({ ROTISSERIE_HOST: 'fe80::1' }, 4783)[0]).toMatch(/at \[fe80::1\]:4783;/);
  expect(accessHints({ ROTISSERIE_HOST: '::1' }, 4783)).toEqual([]);
  expect(accessHints({ ROTISSERIE_HOST: '127.0.0.1' }, 4783)).toEqual([]);
  expect(accessHints({ ROTISSERIE_HOST: 'localhost' }, 4783)).toEqual([]);
});

function fakeSpawn(outcome: 'spawn' | 'error') {
  const calls: { cmd: string; args: string[]; opts: any }[] = [];
  const unref = vi.fn();
  const fn = ((cmd: string, args: string[], opts: any) => {
    calls.push({ cmd, args, opts });
    const c = new EventEmitter() as EventEmitter & { unref(): void };
    c.unref = unref;
    queueMicrotask(() => (outcome === 'error' ? c.emit('error', new Error('ENOENT')) : c.emit('spawn')));
    return c;
  }) as any;
  return { fn, calls, unref };
}
const U = 'http://localhost:4783/s/a/b?t=x';

test.each([
  ['darwin', {}, 'open', [U]],
  ['win32', {}, 'cmd', ['/c', 'start', '', U]],
  ['linux', { WSL_DISTRO_NAME: 'Ubuntu' }, 'cmd.exe', ['/c', 'start', '', U]],
  ['linux', {}, 'xdg-open', [U]],
] as const)('openBrowser on %s %j', async (platform, env, cmd, args) => {
  const s = fakeSpawn('spawn');
  expect(await openBrowser(U, { platform, env, spawn: s.fn })).toBe(true);
  expect(s.calls).toEqual([{ cmd, args, opts: { detached: true, stdio: 'ignore', windowsHide: true } }]);
  expect(s.unref).toHaveBeenCalled();
});

test('openBrowser resolves false on spawn error and when ROTISSERIE_NO_OPEN is set', async () => {
  const e = fakeSpawn('error');
  expect(await openBrowser(U, { platform: 'linux', env: {}, spawn: e.fn })).toBe(false);
  const n = fakeSpawn('spawn');
  expect(await openBrowser(U, { platform: 'linux', env: { ROTISSERIE_NO_OPEN: '1' }, spawn: n.fn })).toBe(false);
  expect(n.calls).toHaveLength(0);
  const throwing = (() => { throw new Error('boom'); }) as any;
  expect(await openBrowser(U, { platform: 'linux', env: {}, spawn: throwing })).toBe(false);
});
