import { vi } from 'vitest';
import { reduce } from '../../src/core/reduce';
import type { Question } from '../../src/core/reduce';
import type { Event, EventBody, QuestionInput } from '../../src/core/events';
import type { Api, SendResult } from '../../web/src/api';
import type { Action } from '../../web/src/outbox';

export class MemStorage implements Storage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

let tick = 0;
export const ev = (body: EventBody, actor: 'agent' | 'user' = 'agent'): Event =>
  ({ ...body, ts: new Date(Date.UTC(2026, 10, 10, 10, 0, tick++)).toISOString(), actor }) as Event;

export const qi = (id: string, title: string, extra: Partial<QuestionInput> = {}): QuestionInput =>
  ({ id, title, body: `Body of ${id}`, ...extra });

export const question = (over: Partial<Question> = {}): Question =>
  ({ id: 'Q1', title: 'Where should sessions be stored?', body: 'Per project or global.', status: 'open',
    isNew: false, isRevision: false, childIds: [], ...over });

export function created(title = 'Plugin design'): EventBody {
  return { type: 'session_created', v: 1, id: 'rt-0001', title };
}

const network = () => new TypeError('Failed to fetch');

/** An in-memory server: send() appends events the way the HTTP layer does, getSession() reduces them. */
export function fakeServer(bodies: EventBody[]) {
  const events: Event[] = bodies.map((b) => ev(b));
  const drafts: Record<string, unknown> = {};
  let down = false;
  let listener: (e: unknown) => void = () => {};
  const send = vi.fn(async (a: Action): Promise<SendResult> => {
    if (down) throw network();
    const state = reduce(events);
    switch (a.kind) {
      case 'mark': {
        if (state.questions[a.qid]?.status === 'retracted') {
          return { status: 409, body: { error: 'retracted', message: 'The agent withdrew this question, so it can no longer be answered.' } };
        }
        events.push(ev({ type: 'response_marked', qid: a.qid, response: a.response }, 'user'));
        break;
      }
      case 'clear': events.push(ev({ type: 'response_cleared', qid: a.qid }, 'user')); break;
      case 'respond':
        if (state.unsentCount === 0) return { status: 409, body: { error: 'nothing_unsent', message: 'There is nothing new to send to the agent.' } };
        events.push(ev({ type: 'batch_sent' }, 'user'));
        break;
      case 'confirm': events.push(ev({ type: 'session_confirmed' }, 'user')); break;
      case 'reopen': events.push(ev({ type: 'session_reopened', note: a.note }, 'user')); break;
      case 'draft': drafts[a.qid] = a.draft; return { status: 204, body: null };
      default: break;
    }
    return { status: 200, body: { ok: true } };
  });
  const raw = {
    listSessions: vi.fn(async () => ({ projects: [] })),
    getSession: vi.fn(async () => {
      if (down) throw network();
      return { state: reduce(events), drafts: { ...drafts } };
    }),
    health: vi.fn(async () => { if (down) throw network(); return { app: 'rotisserie', formatVersion: 1 }; }),
    subscribe: vi.fn((cb: (e: unknown) => void) => { listener = cb; return () => { listener = () => {}; }; }),
    send: vi.fn((_pk: string, _id: string, a: Action) => send(a)),
  };
  return {
    api: raw as unknown as Api, raw, send, events, drafts,
    /** The agent (or another tab) appends an event without telling the page yet. */
    push(body: EventBody) { events.push(ev(body)); },
    /** The server's SSE frame for this session. */
    emit(e: unknown = { pk: 'pk', id: 'rt-0001' }) { listener(e); },
    setDown(d: boolean) { down = d; },
  };
}

export function manualTimers() {
  const fns = new Map<number, () => void>();
  let n = 0;
  return {
    timers: { set: (fn: () => void) => { fns.set(++n, fn); return n; }, clear: (h: unknown) => { fns.delete(h as number); } },
    tick: () => { for (const f of [...fns.values()]) f(); },
  };
}
