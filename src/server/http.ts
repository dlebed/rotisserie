import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, timingSafeEqual } from 'node:crypto';
import { FORMAT_VERSION } from '../core/events';
import type { EventBody, UserResponse } from '../core/events';
import { reduce } from '../core/reduce';
import type { SessionState } from '../core/reduce';
import { getToken, listProjects } from '../core/registry';
import { append, listSessions, loadEvents, readDrafts, SessionNotFound, UnsupportedVersion, writeDraft } from '../core/store';

export type App = http.RequestListener & { close(): void };

const MAX_BODY = 1024 * 1024;
const SCAN_MS = 500;
const KEEPALIVE_MS = 20_000;
const SESSION_ID = /^rt-[0-9a-f]{4}$/;
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public extra: Record<string, unknown> = {}) { super(message); }
}
const notFound = (what = 'Not found') => new HttpError(404, 'not_found', what);
const conflict = (code: string, message: string) => new HttpError(409, code, message);
const badRequest = (message: string) => new HttpError(400, 'bad_request', message);

const sha = (s: string) => createHash('sha256').update(s).digest();
const sameToken = (a: string, b: string) => timingSafeEqual(sha(a), sha(b));

function cookieToken(req: http.IncomingMessage): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === 'rt') return part.slice(i + 1).trim();
  }
  return undefined;
}

function hostName(hostHeader: string): string {
  const h = hostHeader.trim().toLowerCase();
  if (h.startsWith('[')) { const e = h.indexOf(']'); return e < 0 ? h : h.slice(0, e + 1); }
  const i = h.lastIndexOf(':');
  return i < 0 ? h : h.slice(0, i);
}
const isLoopbackName = (n: string) => n === 'localhost' || n === '127.0.0.1' || n === '[::1]' || n === '::1';
function hostAllowed(hostHeader: string | undefined): boolean {
  const configured = process.env.ROTISSERIE_HOST?.trim().toLowerCase();
  // Operator bound to a non-loopback address: opted into network exposure, token + Origin still guard /api.
  if (configured && !isLoopbackName(configured)) return true;
  if (!hostHeader) return false;
  return isLoopbackName(hostName(hostHeader));
}
function originMatches(origin: string, host: string | undefined): boolean {
  try { return host !== undefined && new URL(origin).host.toLowerCase() === host.toLowerCase(); } catch { return false; }
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'too_large', 'Request body is too large');
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}
async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const text = await readBody(req);
  try { return JSON.parse(text); } catch { throw badRequest('Request body is not valid JSON'); }
}

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
function parseUserResponse(v: unknown): UserResponse {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const optStr = (k: string) => {
    if (o[k] !== undefined && typeof o[k] !== 'string') throw badRequest(`"${k}" must be a string`);
    return o[k] as string | undefined;
  };
  if (o.kind === 'skip') return { kind: 'skip' };
  if (o.kind === 'invalid') {
    if (typeof o.reason !== 'string') throw badRequest('"reason" must be a string');
    return { kind: 'invalid', reason: o.reason };
  }
  if (o.kind === 'answer') {
    if (!isStrings(o.optionIds)) throw badRequest('"optionIds" must be an array of strings');
    const text = optStr('text'), note = optStr('note');
    return { kind: 'answer', optionIds: o.optionIds, ...(text !== undefined ? { text } : {}), ...(note !== undefined ? { note } : {}) };
  }
  throw badRequest('Body is not a valid response');
}

export function createApp(o: { webDir: string }): App {
  const webDir = path.resolve(o.webDir);
  const clients = new Set<http.ServerResponse>();
  let tokenP: Promise<string> | undefined;
  const token = () => (tokenP ??= getToken().catch((e: unknown) => { tokenP = undefined; throw e; }));
  const locks = new Map<string, Promise<unknown>>();
  let scanTimer: NodeJS.Timeout | undefined, pingTimer: NodeJS.Timeout | undefined;
  let snapshot: Map<string, number> | undefined;
  let projectKeys: Set<string> | undefined;
  let scanning = false;
  let closed = false;

  function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const run = (locks.get(key) ?? Promise.resolve()).then(fn, fn);
    const tail = run.catch(() => {});
    locks.set(key, tail);
    void tail.then(() => { if (locks.get(key) === tail) locks.delete(key); });
    return run;
  }

  // ---- change detection ----
  async function scan(): Promise<{ files: Map<string, number>; keys: Set<string> }> {
    const files = new Map<string, number>();
    const keys = new Set<string>();
    for (const p of await listProjects()) {
      keys.add(p.key);
      const dir = path.join(p.dir, '.rotisserie', 'sessions');
      let names: string[] = [];
      try { names = await fs.readdir(dir); } catch { /* no sessions yet */ }
      for (const n of names) {
        if (!n.endsWith('.jsonl')) continue;
        const st = await fs.stat(path.join(dir, n)).catch(() => null);
        if (st) files.set(`${p.key}/${n.slice(0, -'.jsonl'.length)}`, st.size);
      }
    }
    return { files, keys };
  }
  const emit = (data: unknown) => { for (const c of clients) c.write(`data: ${JSON.stringify(data)}\n\n`); };
  async function tick(): Promise<void> {
    if (scanning || !snapshot || !projectKeys) return;
    scanning = true;
    try {
      const { files, keys } = await scan();
      if (closed || !snapshot || !projectKeys) return;
      let listChanged = keys.size !== projectKeys.size || [...keys].some((k) => !projectKeys!.has(k));
      for (const [k, size] of files) {
        const prev = snapshot.get(k);
        if (prev === undefined) listChanged = true;
        else if (prev !== size) { const [pk, id] = k.split('/') as [string, string]; emit({ pk, id }); }
      }
      if ([...snapshot.keys()].some((k) => !files.has(k))) listChanged = true;
      snapshot = files; projectKeys = keys;
      if (listChanged) emit({ sessions: true });
    } catch (e) { console.error('rotisserie: change scan failed:', e); } finally { scanning = false; }
  }
  function stopTimers() {
    if (scanTimer) clearInterval(scanTimer);
    if (pingTimer) clearInterval(pingTimer);
    scanTimer = pingTimer = undefined; snapshot = projectKeys = undefined;
  }
  async function openStream(res: http.ServerResponse): Promise<void> {
    if (!snapshot) {                       // baseline first, so an append right after the headers is never missed
      const s = await scan();
      if (!snapshot) { snapshot = s.files; projectKeys = s.keys; }
    }
    if (closed) throw new HttpError(503, 'shutting_down', 'The Rotisserie server is shutting down.');
    if (res.destroyed) return;
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(': connected\n\n');
    clients.add(res);
    res.on('close', () => { clients.delete(res); if (clients.size === 0) stopTimers(); });
    scanTimer ??= setInterval(() => void tick(), SCAN_MS).unref();
    pingTimer ??= setInterval(() => { for (const c of clients) c.write(': keep-alive\n\n'); }, KEEPALIVE_MS).unref();
  }

  // ---- responses ----
  function json(res: http.ServerResponse, status: number, body: unknown) {
    const text = JSON.stringify(body);
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(text) });
    res.end(text);
  }

  // ---- session routes ----
  async function projectDir(pk: string): Promise<string> {
    const p = (await listProjects()).find((x) => x.key === pk);
    if (!p) throw notFound('Unknown project');
    return p.dir;
  }
  async function load(dir: string, id: string) {
    if (!SESSION_ID.test(id)) throw notFound('Unknown session');
    try { const events = await loadEvents(dir, id); return { events, state: reduce(events) }; }
    catch (e) {
      if (e instanceof SessionNotFound) throw notFound('Unknown session');
      if (e instanceof UnsupportedVersion) throw new HttpError(409, 'unsupported_version', e.message, { found: e.found });
      throw e;
    }
  }
  const mustHaveQuestion = (state: SessionState, qid: string) => {
    if (!Object.hasOwn(state.questions, qid)) throw notFound('Unknown question');
    return state.questions[qid]!;
  };

  async function sessionRoute(req: http.IncomingMessage, res: http.ServerResponse, segs: string[]): Promise<void> {
    const [pk, id, kind, qid] = segs as [string, string, string | undefined, string | undefined];
    const method = req.method ?? 'GET';
    const dir = await projectDir(pk);
    const cid = typeof req.headers['x-rotisserie-cid'] === 'string' ? req.headers['x-rotisserie-cid'] : undefined;

    if (kind === undefined && method === 'GET' && segs.length === 2) {
      const { state } = await load(dir, id);
      return json(res, 200, { state, drafts: await readDrafts(dir, id) });
    }
    if (kind === 'drafts' && qid !== undefined && segs.length === 4 && method === 'PUT') {
      const draft = await readJson(req);
      const { state } = await load(dir, id);
      mustHaveQuestion(state, qid);
      await writeDraft(dir, id, qid, draft);
      res.writeHead(204); return void res.end();
    }

    type Plan = { body: EventBody } | { skip: true };
    let plan: (s: SessionState) => Plan;
    let input: unknown;
    if (kind === 'responses' && qid !== undefined && segs.length === 4 && method === 'PUT') {
      input = parseUserResponse(await readJson(req));
      plan = (s) => {
        const q = mustHaveQuestion(s, qid);
        if (q.status === 'retracted') throw conflict('retracted', 'The agent withdrew this question, so it can no longer be answered.');
        if (s.phase === 'confirmed') throw conflict('confirmed', 'This session is confirmed and can no longer be changed.');
        return { body: { type: 'response_marked', qid, response: input as UserResponse } };
      };
    } else if (kind === 'responses' && qid !== undefined && segs.length === 4 && method === 'DELETE') {
      plan = (s) => {
        const q = mustHaveQuestion(s, qid);
        if (q.status === 'retracted') throw conflict('retracted', 'The agent withdrew this question.');
        if (q.status === 'sent' || q.status === 'settled' || q.status === 'assumed')
          throw conflict('already_sent', 'This answer was already sent to the agent and cannot be cleared.');
        if (q.status === 'open') return { skip: true };
        return { body: { type: 'response_cleared', qid } };
      };
    } else if (kind === 'respond' && segs.length === 3 && method === 'POST') {
      plan = (s) => {
        if (s.unsentCount === 0) throw conflict('nothing_unsent', 'There is nothing new to send to the agent.');
        return { body: { type: 'batch_sent' } };
      };
    } else if (kind === 'confirm' && segs.length === 3 && method === 'POST') {
      plan = (s) => {
        if (s.phase !== 'summary') throw conflict('not_in_summary', 'The session can only be confirmed when the summary is ready.');
        return { body: { type: 'session_confirmed' } };
      };
    } else if (kind === 'reopen' && segs.length === 3 && method === 'POST') {
      const b = (await readJson(req)) as { note?: unknown } | null;
      const note = typeof b?.note === 'string' ? b.note.trim() : '';
      if (!note) throw badRequest('A note is required to reopen the session.');
      plan = () => ({ body: { type: 'session_reopened', note } });
    } else throw notFound();

    const result = await withLock(`${pk}/${id}`, async () => {
      const { events, state } = await load(dir, id);
      if (cid !== undefined && events.some((e) => e.cid === cid)) return { duplicate: true };
      const p = plan(state);
      if ('body' in p) await append(dir, id, p.body, 'user', cid);
      return { ok: true };
    });
    json(res, 200, result);
  }

  // ---- static ----
  async function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): Promise<void> {
    const index = path.join(webDir, 'index.html');
    let file = index;
    try {
      const rel = decodeURIComponent(pathname);
      if (!rel.includes('\0') && !rel.includes('\\')) {
        const cand = path.resolve(webDir, '.' + path.sep + rel.split('/').join(path.sep));
        if (cand.startsWith(webDir + path.sep)) {
          const real = await fs.realpath(cand).catch(() => null);
          const root = await fs.realpath(webDir).catch(() => webDir);
          if (real && real.startsWith(root + path.sep) && (await fs.stat(real)).isFile()) file = real;
        }
      }
    } catch { /* malformed escape: fall back to index.html */ }
    let data: Buffer;
    try { data = await fs.readFile(file); } catch { throw notFound('Web UI is not built'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'content-length': data.length });
    res.end(req.method === 'HEAD' ? undefined : data);
  }

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', 'http://localhost');
    const isApi = url.pathname === '/api' || url.pathname.startsWith('/api/');

    const t = url.searchParams.get('t');
    if (t !== null && sameToken(t, await token()))
      res.setHeader('set-cookie', `rt=${t}; HttpOnly; SameSite=Strict; Path=/`);

    if (!isApi) {
      if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'method_not_allowed', 'Method not allowed');
      return serveStatic(req, res, url.pathname);
    }
    res.setHeader('cache-control', 'no-store');
    if (!hostAllowed(req.headers.host)) throw new HttpError(403, 'forbidden_host', 'Unexpected Host header.');
    if (method !== 'GET' && method !== 'HEAD' && req.headers.origin !== undefined
      && !originMatches(req.headers.origin, req.headers.host))
      throw new HttpError(403, 'forbidden_origin', 'Cross-origin requests are not allowed.');

    if (url.pathname === '/api/health' && method === 'GET') return json(res, 200, { app: 'rotisserie', formatVersion: FORMAT_VERSION });

    const given = req.headers['x-rotisserie-token'];
    const presented = typeof given === 'string' ? given : cookieToken(req);
    if (presented === undefined || !sameToken(presented, await token()))
      throw new HttpError(401, 'unauthorized', 'Open the session link from Claude Code to sign in.');

    if (url.pathname === '/api/events' && method === 'GET') return openStream(res);
    if (url.pathname === '/api/sessions' && method === 'GET') {
      const projects = [];
      for (const p of await listProjects()) {
        const sessions = await listSessions(p.dir).catch((e: unknown) => {
          console.error(`rotisserie: cannot list sessions in ${p.dir}:`, e);
          return [];
        });
        projects.push({ key: p.key, name: p.name, dir: p.dir, sessions });
      }
      return json(res, 200, { projects });
    }
    const m = /^\/api\/sessions\/(.+)$/.exec(url.pathname);
    if (m) {
      let segs: string[];
      try { segs = m[1]!.split('/').map(decodeURIComponent); } catch { throw notFound(); }
      if (segs.length >= 2 && segs.length <= 4) return sessionRoute(req, res, segs);
    }
    throw notFound();
  }

  const app = ((req, res) => {
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'no-referrer');
    handle(req, res).catch((e: unknown) => {
      if (res.headersSent) return void res.end();
      if (e instanceof HttpError) return json(res, e.status, { ...e.extra, error: e.code, message: e.message });
      console.error('rotisserie: request failed:', e);
      json(res, 500, { error: 'internal', message: 'Something went wrong in the Rotisserie server.' });
    });
  }) as App;
  app.close = () => {
    closed = true;
    stopTimers();
    for (const c of clients) c.end();
    clients.clear();
  };
  return app;
}
