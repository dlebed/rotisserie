import type { SessionState } from '../../src/core/reduce';
import type { SessionSummary } from '../../src/core/store';
import type { Action } from './outbox';

export type ProjectInfo = { key: string; name: string; dir: string; sessions: SessionSummary[] };
export type SessionList = { projects: ProjectInfo[] };
export type SessionPayload = { state: SessionState; drafts: Record<string, unknown> };
export type ServerEvent = { pk: string; id: string } | { sessions: true };
export type SendResult = { status: number; body: any };

type Deps = {
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  EventSource: new (url: string) => { onmessage: ((e: { data: string }) => void) | null; close(): void };
};

const seg = encodeURIComponent;

/** A non-2xx response: the HTTP status, plus the server's `{ error, message }` when the body has them. */
export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function createApi(deps: Deps) {
  async function call(method: string, url: string, body?: unknown, cid?: string): Promise<SendResult> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (cid) headers['x-rotisserie-cid'] = cid;
    const init: RequestInit = { method, credentials: 'same-origin', headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await deps.fetch(url, init);
    let parsed: unknown = null;
    try { parsed = await res.json(); } catch { /* 204 or empty body */ }
    return { status: res.status, body: parsed };
  }

  async function read<T>(url: string): Promise<T> {
    const r = await call('GET', url);
    if (r.status < 200 || r.status >= 300) {
      const b = (r.body && typeof r.body === 'object' ? r.body : {}) as { error?: unknown; message?: unknown };
      throw new ApiError(r.status, typeof b.message === 'string' ? b.message : `GET ${url} failed with ${r.status}`,
        typeof b.error === 'string' ? b.error : undefined);
    }
    return r.body as T;
  }

  return {
    listSessions: () => read<SessionList>('/api/sessions'),
    getSession: (pk: string, id: string) => read<SessionPayload>(`/api/sessions/${seg(pk)}/${seg(id)}`),
    health: () => read<{ app: string; formatVersion: number }>('/api/health'),
    subscribe(cb: (e: ServerEvent) => void): () => void {
      const es = new deps.EventSource('/api/events');   // EventSource reconnects by itself
      es.onmessage = (e) => {
        try { cb(JSON.parse(e.data) as ServerEvent); } catch { /* ignore a malformed frame */ }
      };
      return () => es.close();
    },
    /** Resolves with the status and body of any HTTP response; rejects only on a network error. */
    send(pk: string, id: string, a: Action): Promise<SendResult> {
      const base = `/api/sessions/${seg(pk)}/${seg(id)}`;
      const q = seg('qid' in a ? a.qid : '');
      switch (a.kind) {
        case 'mark': return call('PUT', `${base}/responses/${q}`, a.response, a.cid);
        case 'clear': return call('DELETE', `${base}/responses/${q}`, undefined, a.cid);
        case 'draft': return call('PUT', `${base}/drafts/${q}`, a.draft, a.cid);
        case 'respond': return call('POST', `${base}/respond`, undefined, a.cid);
        case 'confirm': return call('POST', `${base}/confirm`, undefined, a.cid);
        case 'reopen': return call('POST', `${base}/reopen`, { note: a.note }, a.cid);
      }
    },
  };
}

export type Api = ReturnType<typeof createApi>;

/** The page's own client. Built on first use so tests can import this module without a browser. */
let shared: Api | undefined;
export const api: Api = {
  listSessions: () => (shared ??= defaults()).listSessions(),
  getSession: (pk, id) => (shared ??= defaults()).getSession(pk, id),
  health: () => (shared ??= defaults()).health(),
  subscribe: (cb) => (shared ??= defaults()).subscribe(cb),
  send: (pk, id, a) => (shared ??= defaults()).send(pk, id, a),
};
function defaults(): Api {
  return createApi({
    fetch: (input, init) => window.fetch(input, init),
    EventSource: window.EventSource as unknown as Deps['EventSource'],
  });
}
