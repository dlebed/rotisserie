import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { RefObject } from 'preact';
import type { SessionState } from '../../src/core/reduce';
import type { Api, SendResult, SessionPayload } from './api';
import { applyPending, createOutbox, loadCached, saveCached } from './outbox';
import type { Action, OutboxDeps } from './outbox';

export type SessionDataDeps = {
  pk: string;
  id: string;
  api: Api;
  storage: Storage;
  send?: ((a: Action) => Promise<SendResult>) | undefined;
  timers?: OutboxDeps['timers'] | undefined;
  /** Called right before a fetched payload replaces the shown one, or the offline or lost-access banner may
   * appear or go (the DOM has not changed yet). */
  beforeUpdate?: (() => void) | undefined;
};

type Fetched = { key: string; payload: SessionPayload | null; loadError: 'not_found' | 'unsupported' | null;
  fetchAuthLost: boolean; failures: number };
const initial = (key: string): Fetched => ({ key, payload: null, loadError: null, fetchAuthLost: false, failures: 0 });

const RETRY_MS = 3000;

/** The HTTP status api.getSession put on the error, if it was an HTTP failure. */
function httpStatus(e: unknown): number | null {
  const status = (e as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : null;
}

/**
 * One outbox, cache and fetch loop per `${pk}/${id}`. Fetches run one at a time; a request made meanwhile runs
 * once the current one ends. Actions the server accepted stay overlaid until a fetch that started after their
 * delivery lands, so a Done never flickers back to Open while the refetch is on its way.
 */
function createSession(pk: string, id: string, storage: Storage, deps: RefObject<SessionDataDeps>,
  update: (key: string, f: (prev: Fetched) => Fetched) => void) {
  const key = `${pk}/${id}`;
  const d = () => deps.current!;
  const timers = d().timers;
  const outbox = createOutbox(pk, id, {
    send: (a) => (d().send ?? ((x: Action) => d().api.send(pk, id, x)))(a),
    storage,
    health: () => d().api.health().then(() => true, () => false),
    ...(timers ? { timers } : {}),
  });
  const cached = loadCached(pk, id, storage);
  const net = { alive: true, busy: false, again: false, seq: 0, delivered: [] as { a: Action; seq: number }[] };

  function refetch(): void {
    if (!net.alive) return;
    if (net.busy) { net.again = true; return; }
    net.busy = true;
    const seq = ++net.seq;
    d().api.getSession(pk, id).then((p) => {
      if (!net.alive) return;
      if (!p || typeof p !== 'object' || !p.state) throw new Error('malformed session payload');
      saveCached(pk, id, { state: p.state, drafts: p.drafts ?? {} }, storage);
      net.delivered = net.delivered.filter((x) => x.seq >= seq);
      d().beforeUpdate?.();
      update(key, () => ({ ...initial(key), payload: p }));
    }).catch((e: unknown) => {
      if (!net.alive) return;
      const status = httpStatus(e);
      if (status === 404) update(key, (f) => ({ ...f, loadError: 'not_found' }));
      else if (status === 409) update(key, (f) => ({ ...f, loadError: 'unsupported' }));
      else {
        d().beforeUpdate?.();                     // the banner may appear above the card being typed in
        if (status === 401) update(key, (f) => ({ ...f, fetchAuthLost: true }));
        else update(key, (f) => ({ ...f, failures: f.failures + 1 }));
      }
    }).finally(() => {
      net.busy = false;
      if (net.again && net.alive) { net.again = false; refetch(); }
    });
  }

  function start(rerender: () => void): () => void {
    let prev = outbox.pending();
    let wasOnline = outbox.online();
    let wasAuthLost = outbox.authLost();
    const unsubscribe = outbox.subscribe(() => {
      const now = outbox.pending();
      const left = new Set(now.map((a) => a.cid));
      const refused = new Set(outbox.rejected().map((r) => r.action.cid));
      const delivered = prev.filter((a) => a.kind !== 'draft' && !left.has(a.cid) && !refused.has(a.cid));
      prev = now;
      const back = !wasOnline && outbox.online();
      const bannerMayChange = wasOnline !== outbox.online() || wasAuthLost !== outbox.authLost();
      wasOnline = outbox.online();
      wasAuthLost = outbox.authLost();
      net.delivered.push(...delivered.map((a) => ({ a, seq: net.seq })));
      if (bannerMayChange) d().beforeUpdate?.();
      rerender();
      if (delivered.length > 0 || back) refetch();
    });
    const unlisten = d().api.subscribe((e) => {
      if (!('pk' in e) || e.pk !== pk || e.id !== id) return;
      refetch();
      if (!outbox.online()) void outbox.flush();
    });
    refetch();
    void outbox.flush();
    return () => {
      net.alive = false;
      unsubscribe(); unlisten();
      setTimeout(() => outbox.dispose(), 0);      // after the cards' unmount, which may flush a last draft
    };
  }

  return { key, outbox, cached, net, refetch, start };
}

export function useSessionData(deps: SessionDataDeps) {
  const { pk, id, storage } = deps;
  const key = `${pk}/${id}`;
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const [fetched, setFetched] = useState<Fetched>(() => initial(key));
  const [, setTick] = useState(0);
  const session = useMemo(() => createSession(pk, id, storage, depsRef,
    (k, f) => setFetched((prev) => (k === key ? f(prev.key === k ? prev : initial(k)) : prev))), [key, storage]);

  useEffect(() => session.start(() => setTick((t) => t + 1)), [session]);

  const cur = fetched.key === key ? fetched : initial(key);
  useEffect(() => {
    if (cur.failures === 0) return;
    const t = setTimeout(() => session.refetch(), RETRY_MS);
    return () => clearTimeout(t);
  }, [session, cur.failures]);

  const { outbox, cached } = session;
  const base: SessionState | null = cur.payload?.state ?? cached?.state ?? null;
  const pending = outbox.pending();
  const delivered = session.net.delivered.map((x) => x.a);
  const state = base ? applyPending(base, [...delivered, ...pending]) : null;

  const drafts: Record<string, unknown> = { ...(cur.payload?.drafts ?? cached?.drafts ?? {}) };
  for (const a of pending) if (a.kind === 'draft') drafts[a.qid] = a.draft;

  // While a Respond is queued: how many updates it carries.
  const lastRespond = pending.map((a) => a.kind).lastIndexOf('respond');
  const queued = lastRespond < 0 || !base ? null
    : applyPending(base, [...delivered, ...pending.slice(0, lastRespond)]).unsentCount;

  return {
    outbox,
    /** Changes identity only when a fetched payload lands. */
    payload: cur.payload,
    state,
    drafts,
    queued,
    loadError: cur.loadError,
    failures: cur.failures,
    offline: !outbox.online() || cur.failures > 0,
    authLost: outbox.authLost() || cur.fetchAuthLost,
  };
}
