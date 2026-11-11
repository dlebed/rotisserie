import type { Progress, Question, SessionState } from '../../src/core/reduce';
import type { UserResponse } from '../../src/core/events';

export type Action = { cid: string; at: string } & (
  | { kind: 'mark'; qid: string; response: UserResponse }
  | { kind: 'clear'; qid: string }
  | { kind: 'draft'; qid: string; draft: unknown }
  | { kind: 'respond' } | { kind: 'confirm' } | { kind: 'reopen'; note: string });
export type NewAction = Action extends infer A ? A extends Action ? Omit<A, 'cid' | 'at'> : never : never;
export type Rejected = { action: Action; code: string; message: string };
export type Cached = { state: SessionState; drafts: Record<string, unknown> };

type Timers = { set(fn: () => void, ms: number): unknown; clear(handle: unknown): void };
export type OutboxDeps = {
  send(a: Action): Promise<{ status: number; body: any }>;   // rejects on a network error
  storage: Storage;
  health?: () => Promise<boolean>;                           // default: GET /api/health
  timers?: Timers;                                           // default: the global setInterval/clearInterval
};

const HEALTH_RETRY_MS = 2000;

function newCid(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  // Plain http on a LAN address is not a secure context, so randomUUID is missing there.
  const b = new Uint8Array(16);
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6]! & 0x0f) | 0x40; b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function readJson<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch { return null; }
}

export function loadCached(pk: string, id: string, storage: Storage): Cached | null {
  const c = readJson<Cached>(storage, `rt-state-${pk}-${id}`);
  return c && typeof c === 'object' && c.state && typeof c.state === 'object' ? c : null;
}

export function saveCached(pk: string, id: string, c: Cached, storage: Storage): void {
  try { storage.setItem(`rt-state-${pk}-${id}`, JSON.stringify(c)); } catch { /* storage unavailable */ }
}

export function createOutbox(pk: string, id: string, deps: OutboxDeps) {
  const { send, storage } = deps;
  const outboxKey = `rt-outbox-${pk}-${id}`;
  const rejectedKey = `rt-rejected-${pk}-${id}`;
  const health = deps.health ?? (async () => {
    try { return (await fetch('/api/health', { credentials: 'same-origin' })).ok; } catch { return false; }
  });
  const timers: Timers = deps.timers ?? {
    set: (fn, ms) => globalThis.setInterval(fn, ms),
    clear: (h) => globalThis.clearInterval(h as ReturnType<typeof setInterval>),
  };

  let queue: Action[] = readJson<Action[]>(storage, outboxKey) ?? [];
  let rejectedList: Rejected[] = readJson<Rejected[]>(storage, rejectedKey) ?? [];
  if (!Array.isArray(queue)) queue = [];
  if (!Array.isArray(rejectedList)) rejectedList = [];
  let isOnline = true, isAuthLost = false, saved = true, disposed = false;
  let inFlight: string | undefined;           // cid being sent right now
  let running: Promise<void> | undefined;
  let timer: unknown;
  let subs = new Set<() => void>();

  const notify = () => { for (const cb of [...subs]) cb(); };
  const persist = () => {
    try {
      storage.setItem(outboxKey, JSON.stringify(queue));
      storage.setItem(rejectedKey, JSON.stringify(rejectedList));
      saved = true;
    } catch { saved = false; }
  };

  function stopHealth() {
    if (timer !== undefined) { timers.clear(timer); timer = undefined; }
  }
  function goOffline() {
    isOnline = false;
    if (timer !== undefined || disposed) return;
    let checking = false;
    timer = timers.set(() => {
      if (checking) return;
      checking = true;
      health().then((ok) => {
        if (disposed || !ok) return;
        isOnline = true; stopHealth(); notify();   // subscribers refetch on this change
        void flush();
      }, () => { /* still away */ }).finally(() => { checking = false; });
    }, HEALTH_RETRY_MS);
  }

  async function run(): Promise<void> {
    while (!disposed) {
      const a = queue[0];
      if (!a) break;
      inFlight = a.cid;
      let res: { status: number; body: any };
      try { res = await send(a); } catch { inFlight = undefined; goOffline(); notify(); return; }
      inFlight = undefined;
      if (disposed) return;
      if (res.status === 401) { isAuthLost = true; notify(); return; }
      if (res.status >= 500) { goOffline(); notify(); return; }
      isAuthLost = false;
      queue = queue.filter((x) => x.cid !== a.cid);
      if (res.status >= 400) {
        const body = res.body ?? {};
        rejectedList = [...rejectedList, { action: a,
          code: typeof body.error === 'string' ? body.error : `http_${res.status}`,
          message: typeof body.message === 'string' ? body.message : `The server refused this action (${res.status}).` }];
      }
      if (!isOnline) { isOnline = true; stopHealth(); }
      persist();
      notify();
    }
  }

  function flush(): Promise<void> {
    if (running) return running;
    running = run().finally(() => {
      running = undefined;
      // An action enqueued after run() saw an empty queue but before this point found the flush
      // still running and did not start one; run again so it is not stranded until the next trigger.
      if (queue.length > 0 && isOnline && !isAuthLost && !disposed) return flush();
    });
    return running;
  }

  function enqueue(input: NewAction): void {
    if (disposed) return;
    const a = { ...input, cid: newCid(), at: new Date().toISOString() } as Action;
    const last = queue[queue.length - 1];
    if (a.kind === 'draft' && last?.kind === 'draft' && last.qid === a.qid && last.cid !== inFlight) {
      queue = [...queue.slice(0, -1), a];
    } else {
      queue = [...queue, a];
    }
    persist();
    if (a.kind === 'draft') {
      const c = loadCached(pk, id, storage);
      if (c) saveCached(pk, id, { ...c, drafts: { ...c.drafts, [a.qid]: a.draft } }, storage);
    }
    notify();
    void flush();
  }

  return {
    enqueue, flush,
    pending: (): Action[] => [...queue],
    rejected: (): Rejected[] => [...rejectedList],
    dismissRejected(cid: string): void {
      rejectedList = rejectedList.filter((r) => r.action.cid !== cid);
      persist(); notify();
    },
    online: () => isOnline,
    authLost: () => isAuthLost,
    storageOk: () => saved,
    subscribe(cb: () => void): () => void { subs.add(cb); return () => { subs.delete(cb); }; },
    dispose(): void { disposed = true; stopHealth(); subs = new Set(); },
  };
}

const settledLike = (s: Question['status']) => s === 'sent' || s === 'settled' || s === 'assumed';

/** What the session would look like once every pending action has landed. Pure. */
export function applyPending(state: SessionState, pending: Action[]): SessionState {
  const questions: Record<string, Question> = { ...state.questions };
  let phase = state.phase;
  let totalAtLastBatch = state.progress.totalAtLastBatch;
  const live = () => Object.values(questions).filter((q) => q.status !== 'retracted').length;

  for (const a of pending) {
    switch (a.kind) {
      case 'mark': {
        const q = questions[a.qid];
        if (!q || q.status === 'retracted') break;
        const { decision: _d, reason: _r, ...rest } = q;
        questions[a.qid] = { ...rest, status: 'done', response: a.response, isNew: false,
          isRevision: settledLike(q.status) || (q.status === 'done' && q.isRevision) };
        if (phase === 'summary') phase = 'active';
        break;
      }
      case 'clear': {
        const q = questions[a.qid];
        if (!q || q.status !== 'done') break;
        const { response: _x, ...rest } = q;
        const orig = state.questions[a.qid];
        questions[a.qid] = { ...rest, status: 'open', isRevision: false,
          isNew: orig?.status === 'open' ? orig.isNew : false };
        break;
      }
      case 'respond':
        for (const [qid, q] of Object.entries(questions)) {
          if (q.status === 'done') questions[qid] = { ...q, status: 'sent', isRevision: false };
          else if (q.status === 'open' && q.isNew) questions[qid] = { ...q, isNew: false };
        }
        totalAtLastBatch = live();
        break;
      case 'confirm': phase = 'confirmed'; break;
      case 'reopen': phase = 'active'; break;
      case 'draft': break;
    }
  }

  const progress: Progress = { total: 0, sent: 0, done: 0, open: 0, newCount: 0, totalAtLastBatch };
  for (const q of Object.values(questions)) {
    if (q.status === 'retracted') continue;
    progress.total += 1;
    if (settledLike(q.status)) progress.sent += 1;
    else if (q.status === 'done') progress.done += 1;
    else progress.open += 1;
    if (q.isNew) progress.newCount += 1;
  }
  return { ...state, phase, questions, progress, unsentCount: progress.done };
}
