import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import http from 'node:http';
import net from 'node:net';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { probeHealth, startHostLoop } from '../../src/server/host';
import type { HostSeams } from '../../src/server/host';
import { readServerInfo } from '../../src/core/registry';

let tmp: string, webDir: string;
const saved = { ...process.env };
const loops: { stop(): Promise<void> }[] = [];
const loop = (retryMs = 50, seams: HostSeams = {}) => { const l = startHostLoop({ retryMs, webDir, ...seams }); loops.push(l); return l; };
const realListen = (s: http.Server, port: number, host: string) => new Promise<void>((resolve, reject) => {
  s.once('error', reject);
  s.listen(port, host, () => { s.off('error', reject); resolve(); });
});
const errno = (code: string) => Object.assign(new Error(code), { code });

const freePort = () => new Promise<number>((res) => {
  const s = net.createServer().listen(0, '127.0.0.1', () => { const p = (s.address() as net.AddressInfo).port; s.close(() => res(p)); });
});
const health = (port: number) => fetch(`http://127.0.0.1:${port}/api/health`).then((r) => r.json());
const until = async (f: () => boolean, ms = 2000) => {
  const t = Date.now();
  while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 10)); }
};

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rt-host-'));
  webDir = path.join(tmp, 'web');
  await fs.mkdir(webDir);
  await fs.writeFile(path.join(webDir, 'index.html'), 'x');
  process.env.ROTISSERIE_HOME = path.join(tmp, 'home');
  process.env.ROTISSERIE_PORT = String(await freePort());
  delete process.env.ROTISSERIE_HOST;
});
afterEach(async () => {
  await Promise.all(loops.splice(0).map((l) => l.stop()));
  process.env = { ...saved };
  await fs.rm(tmp, { recursive: true, force: true });
});

test('first loop becomes host and writes server info', async () => {
  const a = loop();
  await a.ready();
  expect(a.isHost()).toBe(true);
  const port = Number(process.env.ROTISSERIE_PORT);
  expect(await readServerInfo()).toEqual({ host: '127.0.0.1', port, pid: process.pid });
  expect((await health(port)).app).toBe('rotisserie');
});

test('second loop is standby; takes over within 500 ms of the host stopping', async () => {
  const port = Number(process.env.ROTISSERIE_PORT);
  const a = loop(); await a.ready();
  const b = loop(); await b.ready();
  expect(a.isHost()).toBe(true);
  expect(b.isHost()).toBe(false);
  await a.stop();
  const t = Date.now();
  await until(() => b.isHost(), 500);
  expect(Date.now() - t).toBeLessThan(500);
  expect((await health(port)).app).toBe('rotisserie');
  expect((await readServerInfo())?.port).toBe(port);
});

test('a foreign server on the port makes the loop bind the next port', async () => {
  const port = Number(process.env.ROTISSERIE_PORT);
  const foreign = http.createServer((_q, r) => { r.end('hello'); });
  await new Promise<void>((r) => foreign.listen(port, '127.0.0.1', r));
  try {
    // Test files run in parallel and the OS can hand out neighbouring ports, so port + 1 may hold another
    // file's Rotisserie server. Only the base port is probed for real; any other busy port counts as foreign,
    // so the loop walks on instead of standing by behind a server this test does not own.
    const a = loop(50, { probe: (h, p) => (p === port ? probeHealth(h, p) : Promise.resolve('other')) });
    await a.ready();
    expect(a.isHost()).toBe(true);
    const bound = (await readServerInfo())?.port ?? 0;
    expect(bound).toBeGreaterThan(port);
    expect(bound).toBeLessThanOrEqual(port + 20);
    expect((await health(bound)).app).toBe('rotisserie');
  } finally {
    foreign.closeAllConnections();
    await new Promise<void>((r) => foreign.close(() => r()));
  }
});

test('stop releases the port and ready still resolves when nothing can be bound', async () => {
  const a = loop(); await a.ready();
  const port = Number(process.env.ROTISSERIE_PORT);
  await a.stop();
  expect(a.isHost()).toBe(false);
  await new Promise<void>((res, rej) => {
    const s = net.createServer().once('error', rej).listen(port, '127.0.0.1', () => s.close(() => res()));
  });
});

test('ready resolves (does not hang) when stopped before binding', async () => {
  const a = loop(10_000);
  await a.stop();
  await a.ready();
});

test('a probe that cannot connect right after EADDRINUSE retries the bind on the same port once', async () => {
  const port = Number(process.env.ROTISSERIE_PORT);
  const binds: number[] = [];
  const probe = vi.fn(async () => 'unreachable' as const);   // the old host just went away mid-takeover
  const a = loop(50, { probe, listen: (s, p, h) => {
    binds.push(p);
    return binds.length === 1 ? Promise.reject(errno('EADDRINUSE')) : realListen(s, p, h);
  } });
  await a.ready();
  expect(a.isHost()).toBe(true);
  expect(binds).toEqual([port, port]);
  expect(probe).toHaveBeenCalledTimes(1);
  expect((await readServerInfo())?.port).toBe(port);
});

test('when the retried bind is taken again, a Rotisserie there makes the loop standby; otherwise it moves on', async () => {
  const port = Number(process.env.ROTISSERIE_PORT);
  const inuse = () => Promise.reject(errno('EADDRINUSE'));
  const results: ('unreachable' | 'rotisserie' | 'other')[] = ['unreachable', 'rotisserie'];
  const a = loop(10_000, { probe: async () => results.shift() ?? 'other', listen: inuse });
  await a.ready();
  expect(a.isHost()).toBe(false);
  expect(results).toEqual([]);                                  // probed twice, then stood by on this port
  const binds: number[] = [];
  const b = loop(10_000, { probe: async () => 'unreachable', listen: (s, p, h) => {
    binds.push(p);
    return p === port ? inuse() : realListen(s, p, h);
  } });
  await b.ready();
  expect(binds).toEqual([port, port, port + 1]);                // once more on the same port, then foreign
  expect(b.isHost()).toBe(true);
});

test('a standby whose bind fails with another error logs it and keeps retrying', async () => {
  const port = Number(process.env.ROTISSERIE_PORT);
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  try {
    let n = 0;
    const a = loop(10, { probe: async () => 'rotisserie', listen: (s, p, h) => {
      n += 1;
      if (n === 1) return Promise.reject(errno('EADDRINUSE'));  // a host is there: become standby
      if (n === 2) return Promise.reject(errno('EACCES'));      // a transient other failure
      return realListen(s, p, h);
    } });
    await a.ready();
    expect(a.isHost()).toBe(false);
    await until(() => a.isHost());
    expect(n).toBe(3);
    await vi.waitFor(async () => expect((await readServerInfo())?.port).toBe(port));
    expect(stderr.mock.calls.map((c) => String(c[0])).join('')).toMatch(/standby bind failed: EACCES/);
  } finally { stderr.mockRestore(); }
});
