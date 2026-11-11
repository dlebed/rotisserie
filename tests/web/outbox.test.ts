import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApi } from '../../web/src/api';
import { applyPending, createOutbox, loadCached, saveCached } from '../../web/src/outbox';
import type { Action, Cached } from '../../web/src/outbox';
import type { Question, SessionState } from '../../src/core/reduce';

class MemStorage implements Storage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

const ok = { status: 200, body: {} };
const answer = (t: string) => ({ kind: 'answer' as const, optionIds: [], text: t });
const flushAsync = () => new Promise((r) => setTimeout(r, 0));

function manualTimers() {
  const fns = new Map<number, () => void>();
  let n = 0;
  return {
    timers: { set: (fn: () => void) => { fns.set(++n, fn); return n; }, clear: (h: unknown) => { fns.delete(h as number); } },
    active: () => fns.size,
    tick: () => { for (const f of [...fns.values()]) f(); },
  };
}

const boxes: { dispose(): void }[] = [];
afterEach(() => { boxes.splice(0).forEach((b) => b.dispose()); });
function make(deps: Partial<Parameters<typeof createOutbox>[2]> & { send: any }, storage: Storage = new MemStorage()) {
  const box = createOutbox('pk', 'id', { storage, ...deps });
  boxes.push(box);
  return { box, storage };
}

describe('outbox', () => {
  it('writes to storage synchronously, before send resolves', async () => {
    let release!: (v: typeof ok) => void;
    const send = vi.fn(() => new Promise<typeof ok>((r) => { release = r; }));
    const { box, storage } = make({ send });
    box.enqueue({ kind: 'mark', qid: 'q1', response: { kind: 'skip' } });
    expect(JSON.parse(storage.getItem('rt-outbox-pk-id')!)).toHaveLength(1);
    expect(box.pending()).toHaveLength(1);
    release(ok);
    await flushAsync();
    expect(box.pending()).toHaveLength(0);
    expect(JSON.parse(storage.getItem('rt-outbox-pk-id')!)).toHaveLength(0);
  });

  it('flushes three actions in order', async () => {
    const sent: Action[] = [];
    const { box } = make({ send: async (a: Action) => { sent.push(a); return ok; } });
    box.enqueue({ kind: 'mark', qid: 'q1', response: { kind: 'skip' } });
    box.enqueue({ kind: 'mark', qid: 'q2', response: { kind: 'skip' } });
    box.enqueue({ kind: 'respond' });
    await box.flush();
    expect(sent.map((a) => a.kind + ('qid' in a ? a.qid : ''))).toEqual(['markq1', 'markq2', 'respond']);
    expect(box.pending()).toEqual([]);
    expect(box.online()).toBe(true);
  });

  it('keeps all on a network error, goes offline, then delivers in order with the same cids', async () => {
    let down = true;
    const sent: Action[] = [];
    const send = vi.fn(async (a: Action) => { if (down) throw new TypeError('fetch failed'); sent.push(a); return ok; });
    const { box } = make({ send });
    box.enqueue({ kind: 'mark', qid: 'q1', response: { kind: 'skip' } });
    box.enqueue({ kind: 'mark', qid: 'q2', response: { kind: 'skip' } });
    box.enqueue({ kind: 'respond' });
    await flushAsync();
    expect(box.online()).toBe(false);
    const cids = box.pending().map((a) => a.cid);
    expect(cids).toHaveLength(3);
    expect(send).toHaveBeenCalledTimes(1);          // stopped at the first failure
    down = false;
    await box.flush();
    expect(sent.map((a) => a.cid)).toEqual(cids);
    expect(box.online()).toBe(true);
    expect(box.pending()).toEqual([]);
  });

  it('treats a 5xx like a network error', async () => {
    const send = vi.fn(async () => ({ status: 503, body: null }));
    const { box } = make({ send });
    box.enqueue({ kind: 'respond' });
    await flushAsync();
    expect(box.online()).toBe(false);
    expect(box.pending()).toHaveLength(1);
  });

  it('a new outbox over the same storage still has the pending actions', async () => {
    const storage = new MemStorage();
    const a = make({ send: async () => { throw new Error('down'); } }, storage);
    a.box.enqueue({ kind: 'mark', qid: 'q1', response: { kind: 'skip' } });
    await flushAsync();
    const b = make({ send: async () => ok }, storage);
    expect(b.box.pending().map((x) => x.cid)).toEqual(a.box.pending().map((x) => x.cid));
  });

  it('moves a 409 to rejected with its code and still sends the next action', async () => {
    const sent: string[] = [];
    const send = async (a: Action) => {
      sent.push(a.kind);
      return a.kind === 'mark' ? { status: 409, body: { error: 'retracted', message: 'That question was withdrawn.' } } : ok;
    };
    const { box, storage } = make({ send });
    box.enqueue({ kind: 'mark', qid: 'q1', response: { kind: 'skip' } });
    box.enqueue({ kind: 'respond' });
    await flushAsync();
    expect(sent).toEqual(['mark', 'respond']);
    expect(box.pending()).toEqual([]);
    expect(box.rejected()).toHaveLength(1);
    expect(box.rejected()[0]).toMatchObject({ code: 'retracted', message: 'That question was withdrawn.' });
    expect(JSON.parse(storage.getItem('rt-rejected-pk-id')!)).toHaveLength(1);
    const cid = box.rejected()[0]!.action.cid;
    box.dismissRejected(cid);
    expect(box.rejected()).toEqual([]);
  });

  it('moves a 404 to rejected', async () => {
    const { box } = make({ send: async () => ({ status: 404, body: { error: 'not_found', message: 'gone' } }) });
    box.enqueue({ kind: 'respond' });
    await flushAsync();
    expect(box.rejected()[0]?.code).toBe('not_found');
  });

  it('collapses consecutive drafts for one qid to the latest', () => {
    const { box } = make({ send: () => new Promise(() => {}) });    // the first action stays in flight
    box.enqueue({ kind: 'respond' });
    box.enqueue({ kind: 'draft', qid: 'q1', draft: 'a' });
    box.enqueue({ kind: 'draft', qid: 'q1', draft: 'ab' });
    box.enqueue({ kind: 'draft', qid: 'q1', draft: 'abc' });
    const drafts = box.pending().filter((x) => x.kind === 'draft');
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ draft: 'abc' });
    box.enqueue({ kind: 'draft', qid: 'q2', draft: 'x' });
    expect(box.pending()).toHaveLength(3);
  });

  it('does not collapse a draft into one that is in flight', async () => {
    let release!: (v: typeof ok) => void;
    const send = vi.fn(() => new Promise<typeof ok>((r) => { release = r; }));
    const { box } = make({ send });
    box.enqueue({ kind: 'draft', qid: 'q1', draft: 'a' });
    box.enqueue({ kind: 'draft', qid: 'q1', draft: 'ab' });
    expect(box.pending()).toHaveLength(2);
    release(ok);
    await flushAsync();
    release(ok);
    await flushAsync();
    expect(box.pending()).toEqual([]);
  });

  it('applies a draft action to the cached drafts at enqueue time', () => {
    const storage = new MemStorage();
    saveCached('pk', 'id', { state: baseState(), drafts: { q0: 'keep' } }, storage);
    const { box } = make({ send: async () => { throw new Error('down'); } }, storage);
    box.enqueue({ kind: 'draft', qid: 'q1', draft: 'half typed' });
    expect(loadCached('pk', 'id', storage)?.drafts).toEqual({ q0: 'keep', q1: 'half typed' });
  });

  it('never runs two flushes concurrently', async () => {
    let inFlight = 0, max = 0;
    const sent: string[] = [];
    const send = async (a: Action) => {
      inFlight++; max = Math.max(max, inFlight);
      await flushAsync();
      inFlight--; sent.push(a.cid);
      return ok;
    };
    const { box } = make({ send });
    box.enqueue({ kind: 'mark', qid: 'q1', response: { kind: 'skip' } });
    box.enqueue({ kind: 'mark', qid: 'q2', response: { kind: 'skip' } });
    await Promise.all([box.flush(), box.flush(), box.flush()]);
    expect(max).toBe(1);
    expect(new Set(sent).size).toBe(sent.length);
    expect(sent).toHaveLength(2);
  });

  it('sends an action enqueued after the last send but before the flush has finished', async () => {
    const sent: string[] = [];
    const { box } = make({ send: async (a: Action) => { sent.push(a.kind); return ok; } });
    box.enqueue({ kind: 'mark', qid: 'q1', response: { kind: 'skip' } });
    // Like a card that flushes a last draft while it unmounts: the enqueue comes from a microtask
    // queued by the notify that follows the last send, so it lands after run() saw an empty queue
    // and before the flush clears its running flag.
    let once = true;
    box.subscribe(() => { if (once) { once = false; queueMicrotask(() => box.enqueue({ kind: 'respond' })); } });
    await flushAsync();
    expect(sent).toEqual(['mark', 'respond']);
    expect(box.pending()).toEqual([]);
  });

  it('does not throw from enqueue when storage throws on setItem, and still sends', async () => {
    const storage = new MemStorage();
    storage.setItem = () => { throw new Error('quota'); };
    const send = vi.fn(async () => ok);
    const { box } = make({ send }, storage);
    expect(() => box.enqueue({ kind: 'respond' })).not.toThrow();
    expect(box.pending()).toHaveLength(1);
    expect(box.storageOk()).toBe(false);
    await flushAsync();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('survives storage whose getItem throws', () => {
    const storage = new MemStorage();
    storage.getItem = () => { throw new Error('denied'); };
    const { box } = make({ send: async () => ok }, storage);
    expect(box.pending()).toEqual([]);
    expect(loadCached('pk', 'id', storage)).toBeNull();
  });

  it('retries health every 2 s while offline and flushes when it answers, then stops the timer', async () => {
    let down = true, healthy = false;
    const sent: string[] = [];
    const t = manualTimers();
    const health = vi.fn(async () => healthy);
    const { box } = make({
      send: async (a: Action) => { if (down) throw new Error('down'); sent.push(a.cid); return ok; },
      health, timers: t.timers,
    });
    const changes = vi.fn();
    box.subscribe(changes);
    box.enqueue({ kind: 'respond' });
    await flushAsync();
    expect(box.online()).toBe(false);
    expect(t.active()).toBe(1);
    t.tick(); await flushAsync();
    expect(health).toHaveBeenCalledTimes(1);
    expect(box.online()).toBe(false);
    healthy = true; down = false;
    t.tick(); await flushAsync();
    expect(box.online()).toBe(true);
    expect(sent).toHaveLength(1);
    expect(t.active()).toBe(0);
    expect(changes).toHaveBeenCalled();
  });

  it('uses a 2000 ms interval by default shape', async () => {
    const set = vi.fn(() => 1);
    const { box } = make({ send: async () => { throw new Error('down'); }, timers: { set, clear: () => {} } });
    box.enqueue({ kind: 'respond' });
    await flushAsync();
    expect(set).toHaveBeenCalledWith(expect.any(Function), 2000);
  });

  it('a 401 keeps the action, stops, and reports authLost without hammering', async () => {
    let cookie = false;
    const send = vi.fn(async () => (cookie ? ok : { status: 401, body: { error: 'unauthorized' } }));
    const t = manualTimers();
    const { box } = make({ send, timers: t.timers });
    box.enqueue({ kind: 'respond' });
    box.enqueue({ kind: 'confirm' });
    await flushAsync();
    expect(box.authLost()).toBe(true);
    expect(box.pending()).toHaveLength(2);
    expect(box.rejected()).toEqual([]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(t.active()).toBe(0);
    cookie = true;
    await box.flush();
    expect(box.authLost()).toBe(false);
    expect(box.pending()).toEqual([]);
  });

  it('dispose clears timers and subscribers', async () => {
    const t = manualTimers();
    const { box } = make({ send: async () => { throw new Error('down'); }, timers: t.timers });
    const cb = vi.fn();
    box.subscribe(cb);
    box.enqueue({ kind: 'respond' });
    await flushAsync();
    expect(t.active()).toBe(1);
    box.dispose();
    expect(t.active()).toBe(0);
    cb.mockClear();
    box.enqueue({ kind: 'confirm' });
    expect(cb).not.toHaveBeenCalled();
  });

  it('generates distinct cids even without crypto.randomUUID', () => {
    const orig = crypto.randomUUID;
    (crypto as any).randomUUID = undefined;
    try {
      const { box } = make({ send: async () => { throw new Error('down'); } });
      box.enqueue({ kind: 'respond' });
      box.enqueue({ kind: 'confirm' });
      const [a, b] = box.pending();
      expect(a!.cid).toMatch(/^[0-9a-f-]{36}$/);
      expect(a!.cid).not.toBe(b!.cid);
    } finally { (crypto as any).randomUUID = orig; }
  });
});

function q(id: string, status: Question['status'], extra: Partial<Question> = {}): Question {
  return { id, title: id, body: '', status, isNew: false, isRevision: false, childIds: [], ...extra };
}
function stateOf(qs: Question[], extra: Partial<SessionState> = {}): SessionState {
  const live = qs.filter((x) => x.status !== 'retracted');
  const sent = live.filter((x) => ['sent', 'settled', 'assumed'].includes(x.status)).length;
  const done = live.filter((x) => x.status === 'done').length;
  return { v: 1, id: 'id', title: 't', phase: 'active', questions: Object.fromEntries(qs.map((x) => [x.id, x])),
    order: qs.map((x) => x.id), notes: [], unsentCount: done, pendingWake: false, eventCount: 3,
    progress: { total: live.length, sent, done, open: live.length - sent - done,
      newCount: live.filter((x) => x.isNew).length, totalAtLastBatch: null }, ...extra };
}
function baseState() { return stateOf([q('q1', 'open'), q('q2', 'open')]); }
const act = (a: object): Action => ({ cid: 'c' + Math.random(), at: '2026-11-10T10:00:00Z', ...a }) as Action;

describe('applyPending', () => {
  it('mark then respond yields sent and unsentCount 0', () => {
    const s = baseState();
    const out = applyPending(s, [act({ kind: 'mark', qid: 'q1', response: answer('x') }), act({ kind: 'respond' })]);
    expect(out.questions.q1!.status).toBe('sent');
    expect(out.questions.q1!.response).toEqual(answer('x'));
    expect(out.unsentCount).toBe(0);
    expect(out.progress).toMatchObject({ total: 2, sent: 1, done: 0, open: 1, totalAtLastBatch: 2 });
  });

  it('mark sets done and recomputes progress and unsentCount', () => {
    const out = applyPending(baseState(), [act({ kind: 'mark', qid: 'q2', response: { kind: 'skip' } })]);
    expect(out.questions.q2!.status).toBe('done');
    expect(out.unsentCount).toBe(1);
    expect(out.progress).toMatchObject({ total: 2, sent: 0, done: 1, open: 1 });
  });

  it('never mutates its input', () => {
    const s = baseState();
    const snap = JSON.stringify(s);
    const p = [act({ kind: 'mark', qid: 'q1', response: { kind: 'skip' } }), act({ kind: 'respond' }), act({ kind: 'confirm' })];
    const psnap = JSON.stringify(p);
    applyPending(s, p);
    expect(JSON.stringify(s)).toBe(snap);
    expect(JSON.stringify(p)).toBe(psnap);
  });

  it('marks a sent, settled or assumed question as a revision', () => {
    const s = stateOf([q('a', 'sent', { response: { kind: 'skip' } }), q('b', 'settled', { decision: 'd' }), q('c', 'assumed', { decision: 'd', reason: 'r' }), q('d', 'open')]);
    const out = applyPending(s, ['a', 'b', 'c', 'd'].map((id) => act({ kind: 'mark', qid: id, response: { kind: 'skip' } })));
    expect(['a', 'b', 'c'].map((id) => out.questions[id]!.isRevision)).toEqual([true, true, true]);
    expect(out.questions.d!.isRevision).toBe(false);
    expect(out.questions.b!.status).toBe('done');
    expect(out.questions.b!.decision).toBeUndefined();
    expect(out.progress).toMatchObject({ total: 4, sent: 0, done: 4, open: 0 });
  });

  it('keeps the revision flag when an unsent revision is marked again', () => {
    const s = stateOf([q('a', 'done', { response: { kind: 'skip' }, isRevision: true }), q('b', 'done', { response: { kind: 'skip' } })]);
    const out = applyPending(s, ['a', 'b'].map((id) => act({ kind: 'mark', qid: id, response: answer('again') })));
    expect(out.questions.a!.isRevision).toBe(true);
    expect(out.questions.b!.isRevision).toBe(false);
    const twice = applyPending(stateOf([q('c', 'sent', { response: { kind: 'skip' } })]),
      [act({ kind: 'mark', qid: 'c', response: answer('1') }), act({ kind: 'mark', qid: 'c', response: answer('2') })]);
    expect(twice.questions.c!.isRevision).toBe(true);
  });

  it('clear returns a done question to open', () => {
    const s = stateOf([q('q1', 'done', { response: { kind: 'skip' } })]);
    const out = applyPending(s, [act({ kind: 'clear', qid: 'q1' })]);
    expect(out.questions.q1!.status).toBe('open');
    expect(out.questions.q1!.response).toBeUndefined();
    expect(out.unsentCount).toBe(0);
    expect(out.progress).toMatchObject({ done: 0, open: 1 });
  });

  it('respond turns every done question to sent', () => {
    const s = stateOf([q('a', 'done', { response: { kind: 'skip' } }), q('b', 'done', { response: { kind: 'skip' } }), q('c', 'open', { isNew: true })]);
    const out = applyPending(s, [act({ kind: 'respond' })]);
    expect(out.questions.a!.status).toBe('sent');
    expect(out.questions.b!.status).toBe('sent');
    expect(out.questions.c!.isNew).toBe(false);
    expect(out.unsentCount).toBe(0);
    expect(out.progress).toMatchObject({ sent: 2, done: 0, open: 1, newCount: 0 });
  });

  it('excludes retracted questions from the total and ignores marks on them', () => {
    const s = stateOf([q('a', 'retracted', { reason: 'r' }), q('b', 'open')]);
    const out = applyPending(s, [act({ kind: 'mark', qid: 'a', response: { kind: 'skip' } })]);
    expect(out.questions.a!.status).toBe('retracted');
    expect(out.progress.total).toBe(1);
  });

  it('confirm and reopen set the phase', () => {
    const s = stateOf([q('a', 'open')], { phase: 'summary' });
    expect(applyPending(s, [act({ kind: 'confirm' })]).phase).toBe('confirmed');
    expect(applyPending(s, [act({ kind: 'confirm' }), act({ kind: 'reopen', note: 'n' })]).phase).toBe('active');
  });

  it('ignores unknown qids and leaves draft actions alone', () => {
    const s = baseState();
    const out = applyPending(s, [act({ kind: 'mark', qid: 'zz', response: { kind: 'skip' } }), act({ kind: 'clear', qid: 'zz' }), act({ kind: 'draft', qid: 'q1', draft: 'x' })]);
    expect(out).toEqual(s);
  });
});

describe('cache', () => {
  it('round-trips and returns null for missing or corrupt data', () => {
    const storage = new MemStorage();
    expect(loadCached('pk', 'id', storage)).toBeNull();
    const c: Cached = { state: baseState(), drafts: { q1: 'x' } };
    saveCached('pk', 'id', c, storage);
    expect(loadCached('pk', 'id', storage)).toEqual(c);
    storage.setItem('rt-state-pk-id', '{nope');
    expect(loadCached('pk', 'id', storage)).toBeNull();
  });
});

describe('api.send', () => {
  const fakeFetch = (res: { status: number; body?: unknown } | Error) => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => {
      if (res instanceof Error) throw res;
      return { status: res.status, json: async () => res.body ?? {} } as Response;
    });
    return { f, api: createApi({ fetch: f, EventSource: class { onmessage = null; close() {} } as any }) };
  };
  const base = { cid: 'C1', at: 'now' };

  it.each([
    [{ kind: 'mark', qid: 'q 1', response: { kind: 'skip' } }, 'PUT', '/api/sessions/pk/id/responses/q%201', '{"kind":"skip"}'],
    [{ kind: 'clear', qid: 'q1' }, 'DELETE', '/api/sessions/pk/id/responses/q1', undefined],
    [{ kind: 'draft', qid: 'q1', draft: { t: 1 } }, 'PUT', '/api/sessions/pk/id/drafts/q1', '{"t":1}'],
    [{ kind: 'respond' }, 'POST', '/api/sessions/pk/id/respond', undefined],
    [{ kind: 'confirm' }, 'POST', '/api/sessions/pk/id/confirm', undefined],
    [{ kind: 'reopen', note: 'hi' }, 'POST', '/api/sessions/pk/id/reopen', '{"note":"hi"}'],
  ] as [object, string, string, string | undefined][])('maps %j', async (a, method, url, body) => {
    const { f, api } = fakeFetch({ status: 200 });
    const r = await api.send('pk', 'id', { ...base, ...a } as Action);
    expect(r.status).toBe(200);
    const [u, init] = f.mock.calls[0]!;
    expect(u).toBe(url);
    expect(init!.method).toBe(method);
    expect(init!.body).toBe(body);
    expect((init!.headers as Record<string, string>)['x-rotisserie-cid']).toBe('C1');
  });

  it('resolves with status and body for 409 and rejects only on network error', async () => {
    const a = { ...base, kind: 'respond' } as Action;
    const r = await fakeFetch({ status: 409, body: { error: 'nothing_unsent', message: 'm' } }).api.send('pk', 'id', a);
    expect(r).toEqual({ status: 409, body: { error: 'nothing_unsent', message: 'm' } });
    await expect(fakeFetch(new TypeError('fetch failed')).api.send('pk', 'id', a)).rejects.toThrow('fetch failed');
  });
});
