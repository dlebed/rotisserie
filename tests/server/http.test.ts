import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../../src/server/http';
import { getToken, registerProject } from '../../src/core/registry';
import { append, createSession, loadEvents, sessionFile } from '../../src/core/store';

let tmp: string, projectDir: string, webDir: string, pk: string, id: string, token: string;
let server: http.Server, app: ReturnType<typeof createApp>, base: string;
const savedHome = process.env.ROTISSERIE_HOME;
const savedHost = process.env.ROTISSERIE_HOST;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rt-http-'));
  process.env.ROTISSERIE_HOME = path.join(tmp, 'home');
  delete process.env.ROTISSERIE_HOST;
  projectDir = path.join(tmp, 'proj');
  webDir = path.join(tmp, 'web');
  await fs.mkdir(projectDir, { recursive: true });
  await fs.mkdir(webDir, { recursive: true });
  await fs.writeFile(path.join(webDir, 'index.html'), '<!doctype html><title>idx</title>');
  await fs.writeFile(path.join(webDir, 'app.js'), 'console.log(1)');
  await fs.writeFile(path.join(tmp, 'secret.txt'), 'SECRET');
  pk = await registerProject(projectDir);
  id = await createSession(projectDir, { title: 'T' });
  token = await getToken();
  app = createApp({ webDir });
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  app.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await fs.rm(tmp, { recursive: true, force: true });
  if (savedHome === undefined) delete process.env.ROTISSERIE_HOME; else process.env.ROTISSERIE_HOME = savedHome;
  if (savedHost === undefined) delete process.env.ROTISSERIE_HOST; else process.env.ROTISSERIE_HOST = savedHost;
});

const auth = () => ({ 'x-rotisserie-token': token });
const api = (p: string, init: RequestInit & { headers?: Record<string, string> } = {}) =>
  fetch(base + p, { ...init, headers: { ...auth(), ...(init.headers ?? {}) } });
const send = (method: string, p: string, body?: unknown, headers: Record<string, string> = {}) =>
  api(p, { method, headers: { 'content-type': 'application/json', ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const sp = (rest = '') => `/api/sessions/${pk}/${id}${rest}`;
const post = (qs: { id: string }[]) => append(projectDir, id,
  { type: 'questions_posted', questions: qs.map((q) => ({ ...q, title: 't', body: '' })) }, 'agent');
const raw = (p: string, headers: Record<string, string> = {}) => new Promise<{ status: number; body: string }>((res, rej) => {
  const u = new URL(base);
  http.get({ host: u.hostname, port: u.port, path: p, headers, setHost: !headers.host }, (r) => {
    let b = ''; r.on('data', (c) => (b += c)); r.on('end', () => res({ status: r.statusCode!, body: b }));
  }).on('error', rej);
});

test('health is open and every response has nosniff', async () => {
  const r = await fetch(`${base}/api/health`);
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ app: 'rotisserie', formatVersion: 1 });
  expect(r.headers.get('x-content-type-options')).toBe('nosniff');
  expect(r.headers.get('cache-control')).toBe('no-store');
});

test('/api/sessions needs a token (header or cookie)', async () => {
  expect((await fetch(`${base}/api/sessions`)).status).toBe(401);
  expect((await fetch(`${base}/api/sessions`, { headers: { 'x-rotisserie-token': 'wrong' } })).status).toBe(401);
  const r = await api('/api/sessions');
  expect(r.status).toBe(200);
  const j = (await r.json()) as { projects: { key: string; name: string; dir: string; sessions: { id: string }[] }[] };
  expect(j.projects[0]!.key).toBe(pk);
  expect(j.projects[0]!.sessions.map((s) => s.id)).toEqual([id]);
  expect((await fetch(`${base}/api/sessions`, { headers: { cookie: `a=b; rt=${token}` } })).status).toBe(200);
});

test('?t=<token> sets the cookie on any path, a wrong token does not', async () => {
  const r = await fetch(`${base}/s/${pk}/${id}?t=${token}`);
  const c = r.headers.get('set-cookie')!;
  expect(c).toContain(`rt=${token}`);
  expect(c).toMatch(/HttpOnly/i);
  expect(c).toMatch(/SameSite=Strict/i);
  expect(c).toMatch(/Path=\//);
  expect((await r.text())).toContain('idx');
  expect((await fetch(`${base}/x?t=nope`)).headers.get('set-cookie')).toBeNull();
});

test('a POST with a foreign Origin is 403 and appends nothing', async () => {
  await post([{ id: 'Q1' }]);
  await send('PUT', sp('/responses/Q1'), { kind: 'skip' });
  const before = (await loadEvents(projectDir, id)).length;
  const r = await send('POST', sp('/respond'), undefined, { origin: 'http://evil.example' });
  expect(r.status).toBe(403);
  expect((await loadEvents(projectDir, id)).length).toBe(before);
  const ok = await send('POST', sp('/respond'), undefined, { origin: base });
  expect(ok.status).toBe(200);
});

test('a Host header that is not loopback is 403 on /api (DNS rebinding)', async () => {
  expect((await raw('/api/health', { host: 'evil.example:80' })).status).toBe(403);
  expect((await raw('/api/health', { host: 'localhost:1234' })).status).toBe(200);
  expect((await raw('/api/health', { host: '[::1]:1234' })).status).toBe(200);
  process.env.ROTISSERIE_HOST = 'box.lan';
  expect((await raw('/api/health', { host: 'box.lan:4783' })).status).toBe(200);
});

test('Host check is skipped when ROTISSERIE_HOST is non-loopback, kept when unset or loopback', async () => {
  const get = (host: string) => raw('/api/sessions', { ...auth(), host });
  expect((await get('evil.example')).status).toBe(403);
  process.env.ROTISSERIE_HOST = '127.0.0.1';
  expect((await get('evil.example')).status).toBe(403);
  process.env.ROTISSERIE_HOST = '0.0.0.0';
  expect((await get('192.168.1.5:4783')).status).toBe(200);
  expect((await raw('/api/sessions', { host: '192.168.1.5:4783' })).status).toBe(401);
});

test('/api/events after close() is 503, a failed token read is retried, and a 500 is logged', async () => {
  const errs: unknown[][] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => { errs.push(a); });
  try {
    const bad = path.join(tmp, 'home', 'config.json');
    await fs.writeFile(bad, 'garbage');                  // unreadable config: getToken throws
    const app2 = createApp({ webDir });
    const srv = http.createServer(app2);
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
    const b2 = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
    const r1 = await fetch(`${b2}/api/sessions`, { headers: auth() });
    expect(r1.status).toBe(500);
    expect(errs.length).toBeGreaterThan(0);
    await fs.writeFile(bad, JSON.stringify({ token }));
    expect((await fetch(`${b2}/api/sessions`, { headers: auth() })).status).toBe(200);
    app2.close();
    expect((await fetch(`${b2}/api/events`, { headers: auth() })).status).toBe(503);
    srv.closeAllConnections();
    await new Promise<void>((r) => srv.close(() => r()));
  } finally { spy.mockRestore(); }
});

test('response -> respond flow changes state; nothing unsent is 409', async () => {
  await post([{ id: 'Q1' }, { id: 'Q2' }]);
  const r1 = await send('PUT', sp('/responses/Q1'), { kind: 'answer', optionIds: ['a'], text: 'hi' });
  expect(r1.status).toBe(200);
  let st = (await (await api(sp())).json()) as { state: { unsentCount: number; questions: Record<string, { status: string }> } };
  expect(st.state.unsentCount).toBe(1);
  expect(st.state.questions['Q1']!.status).toBe('done');
  expect((await send('DELETE', sp('/responses/Q1'))).status).toBe(200);
  await send('PUT', sp('/responses/Q1'), { kind: 'skip' });
  expect((await send('POST', sp('/respond'))).status).toBe(200);
  st = (await (await api(sp())).json()) as typeof st;
  expect(st.state.questions['Q1']!.status).toBe('sent');
  const again = await send('POST', sp('/respond'));
  expect(again.status).toBe(409);
  const j = (await again.json()) as { error: string; message: string };
  expect(j.error).toBe('nothing_unsent');
  expect(j.message).toBeTruthy();
  const del = await send('DELETE', sp('/responses/Q1'));
  expect(del.status).toBe(409);
  expect(((await del.json()) as { error: string }).error).toBe('already_sent');
});

test('retracted question and confirmed session give 409', async () => {
  await post([{ id: 'Q1' }, { id: 'Q2' }]);
  await append(projectDir, id, { type: 'question_retracted', qid: 'Q2', reason: 'x' }, 'agent');
  const r = await send('PUT', sp('/responses/Q2'), { kind: 'skip' });
  expect(r.status).toBe(409);
  expect(((await r.json()) as { error: string }).error).toBe('retracted');
  await append(projectDir, id, { type: 'summary_posted', html: '', markdown: '', abstract: '' }, 'agent');
  expect((await send('POST', sp('/confirm'))).status).toBe(200);
  const c = await send('PUT', sp('/responses/Q1'), { kind: 'skip' });
  expect(c.status).toBe(409);
  expect(((await c.json()) as { error: string }).error).toBe('confirmed');
});

test('confirm is 409 outside the summary phase', async () => {
  const r = await send('POST', sp('/confirm'));
  expect(r.status).toBe(409);
  expect(((await r.json()) as { error: string }).error).toBe('not_in_summary');
});

test('the same cid appends one event and the replay returns { duplicate: true }', async () => {
  await post([{ id: 'Q1' }]);
  const h = { 'x-rotisserie-cid': '11111111-1111-1111-1111-111111111111' };
  const n0 = (await loadEvents(projectDir, id)).length;
  const a = await send('PUT', sp('/responses/Q1'), { kind: 'skip' }, h);
  const b = await send('PUT', sp('/responses/Q1'), { kind: 'skip' }, h);
  expect(a.status).toBe(200);
  expect(b.status).toBe(200);
  expect(await b.json()).toEqual({ duplicate: true });
  const evs = await loadEvents(projectDir, id);
  expect(evs.length).toBe(n0 + 1);
  expect(evs[n0]!.cid).toBe(h['x-rotisserie-cid']);
});

test('concurrent requests with one cid append once', async () => {
  await post([{ id: 'Q1' }]);
  const h = { 'x-rotisserie-cid': 'dup-1' };
  const n0 = (await loadEvents(projectDir, id)).length;
  await Promise.all([1, 2, 3].map(() => send('PUT', sp('/responses/Q1'), { kind: 'skip' }, h)));
  expect((await loadEvents(projectDir, id)).length).toBe(n0 + 1);
});

test('reopen with an empty note is 400; a note appends session_reopened', async () => {
  expect((await send('POST', sp('/reopen'), { note: '  ' })).status).toBe(400);
  expect((await send('POST', sp('/reopen'), {})).status).toBe(400);
  expect((await send('POST', sp('/reopen'), { note: 'more' })).status).toBe(200);
  const evs = await loadEvents(projectDir, id);
  expect(evs[evs.length - 1]).toMatchObject({ type: 'session_reopened', note: 'more', actor: 'user' });
});

test('drafts: PUT stores and GET returns them; 204', async () => {
  await post([{ id: 'Q1' }]);
  expect((await send('PUT', sp('/drafts/Q1'), { text: 'wip' })).status).toBe(204);
  const j = (await (await api(sp())).json()) as { drafts: Record<string, unknown> };
  expect(j.drafts['Q1']).toEqual({ text: 'wip' });
});

test('bad bodies: invalid JSON, wrong shape and oversize', async () => {
  await post([{ id: 'Q1' }]);
  const bad = (body: string) => api(sp('/responses/Q1'), { method: 'PUT', body, headers: { 'content-type': 'application/json' } });
  expect((await bad('{nope')).status).toBe(400);
  expect((await bad(JSON.stringify({ kind: 'weird' }))).status).toBe(400);
  expect((await bad(JSON.stringify({ kind: 'answer', optionIds: 'a' }))).status).toBe(400);
  expect((await bad(JSON.stringify({ kind: 'invalid' }))).status).toBe(400);
  expect((await api(sp('/drafts/Q1'), { method: 'PUT', body: '{nope' })).status).toBe(400);
  const big = await api(sp('/drafts/Q1'), { method: 'PUT', body: JSON.stringify({ t: 'x'.repeat(1_100_000) }) });
  expect(big.status).toBe(413);
});

test('a v2 log gives 409 unsupported_version', async () => {
  const v2 = 'rt-9999';
  await fs.writeFile(sessionFile(projectDir, v2),
    JSON.stringify({ type: 'session_created', v: 2, id: v2, title: 'X', ts: 't', actor: 'agent' }) + '\n');
  const r = await api(`/api/sessions/${pk}/${v2}`);
  expect(r.status).toBe(409);
  const j = (await r.json()) as { error: string; found: number; message: string };
  expect(j).toMatchObject({ error: 'unsupported_version', found: 2 });
  expect(j.message).toBeTruthy();
});

test('unknown project, unknown session, unknown question and traversal ids are 404 JSON', async () => {
  await post([{ id: 'Q1' }]);
  const nf = async (r: Response) => {
    expect(r.status).toBe(404);
    const j = (await r.json()) as { error: string; message: string };
    expect(j.error).toBeTruthy(); expect(j.message).toBeTruthy();
  };
  await nf(await api(`/api/sessions/deadbeef/${id}`));
  await nf(await api(`/api/sessions/${pk}/rt-0000`));
  await nf(await send('PUT', sp('/drafts/NOPE'), { a: 1 }));
  await nf(await send('PUT', sp('/responses/NOPE'), { kind: 'skip' }));
  await nf(await send('DELETE', sp('/responses/NOPE')));
  await nf(await api(`/api/sessions/${pk}/..%2F..%2Fx`));
  await nf(await api(`/api/sessions/${pk}/%2e%2e%2f%2e%2e%2fsecret`));
  await nf(await send('PUT', `/api/sessions/${pk}/..%2F..%2Fx/drafts/Q1`, { a: 1 }));
  await nf(await api(`/api/nothing`));
  expect((await raw(`/api/sessions/${pk}/../../x`, auth())).status).toBe(404);
  await expect(fs.stat(path.join(projectDir, '.rotisserie', 'drafts'))).rejects.toThrow();
  await expect(fs.stat(path.join(tmp, 'x.jsonl'))).rejects.toThrow();
});

async function readSse(onData: (chunks: string[]) => boolean, timeoutMs = 3000) {
  const ctl = new AbortController();
  const r = await fetch(`${base}/api/events`, { headers: auth(), signal: ctl.signal });
  expect(r.headers.get('content-type')).toContain('text/event-stream');
  const reader = r.body!.getReader();
  const dec = new TextDecoder();
  const chunks: string[] = [];
  return {
    chunks,
    async until(): Promise<boolean> {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        const v = await Promise.race([reader.read(), new Promise<null>((res) => setTimeout(() => res(null), timeoutMs))]);
        if (!v || v.done) return false;
        chunks.push(dec.decode(v.value));
        if (onData(chunks)) return true;
      }
      return false;
    },
    stop: () => ctl.abort(),
  };
}

test('SSE needs auth', async () => {
  expect((await fetch(`${base}/api/events`)).status).toBe(401);
});

test('SSE emits {pk,id} within 1.5s of an outside append, and {sessions:true} for a new session', async () => {
  const s = await readSse((c) => c.join('').includes(`"id":"${id}"`));
  await post([{ id: 'Q1' }]);
  const t0 = Date.now();
  expect(await s.until()).toBe(true);
  expect(Date.now() - t0).toBeLessThan(1500);
  expect(s.chunks.join('')).toContain(`data: {"pk":"${pk}","id":"${id}"}`);
  s.stop();
  const s2 = await readSse((c) => c.join('').includes('"sessions":true'));
  await createSession(projectDir, { title: 'N' });
  expect(await s2.until()).toBe(true);
  s2.stop();
});

test('close() ends open SSE responses', async () => {
  const r = await fetch(`${base}/api/events`, { headers: auth() });
  const reader = r.body!.getReader();
  await reader.read();
  app.close();
  const end = await Promise.race([
    (async () => { for (;;) { const v = await reader.read(); if (v.done) return 'ended'; } })(),
    new Promise((res) => setTimeout(() => res('hung'), 2000)),
  ]);
  expect(end).toBe('ended');
});

test('static files: content types, index fallback, and no escape from webDir', async () => {
  const js = await fetch(`${base}/app.js`);
  expect(js.headers.get('content-type')).toContain('text/javascript');
  expect(js.headers.get('x-content-type-options')).toBe('nosniff');
  expect(await (await fetch(`${base}/`)).text()).toContain('idx');
  expect(await (await fetch(`${base}/s/${pk}/${id}`)).text()).toContain('idx');
  for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2Fsecret.txt', '/%2e%2e%2fsecret.txt', '/a/..%5C..%5Csecret.txt']) {
    const r = await raw(p);
    expect(r.body).not.toContain('SECRET');
    expect(r.body).toContain('idx');
  }
  const bad = await fetch(`${base}/%00`);
  expect(await bad.text()).toContain('idx');
});

test('static content types for css, svg, woff2, json', async () => {
  for (const [f, t] of [['a.css', 'text/css'], ['a.svg', 'image/svg+xml'], ['a.woff2', 'font/woff2'],
    ['a.json', 'application/json'], ['a.html', 'text/html']] as const) {
    await fs.writeFile(path.join(webDir, f), 'x');
    expect((await fetch(`${base}/${f}`)).headers.get('content-type')).toContain(t);
  }
});
