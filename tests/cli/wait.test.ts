import { afterEach, beforeEach, expect, test } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { append, createSession, loadEvents, SessionNotFound } from '../../src/core/store';
import { waitForUpdates } from '../../src/cli/wait';

let dir: string;
let id: string;
const opts = { intervalMs: 10 };
const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));
const settled = (p: Promise<unknown>) => { let done = false; p.then(() => { done = true; }, () => { done = true; }); return () => done; };

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rt-wait-'));
  id = await createSession(dir, { title: 'T' });
  await append(dir, id, { type: 'questions_posted', questions: [{ id: 'q1', title: 'Q', body: 'b' }] }, 'agent');
});
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });

test('resolves updates immediately when a batch is already pending', async () => {
  await append(dir, id, { type: 'response_marked', qid: 'q1', response: { kind: 'skip' } }, 'user');
  await append(dir, id, { type: 'batch_sent' }, 'user');
  expect(await waitForUpdates(dir, id, opts)).toBe('updates');
});

test('stays pending until batch_sent is appended, ignoring agent-only events', async () => {
  const p = waitForUpdates(dir, id, opts);
  const isDone = settled(p);
  await tick(50);
  await append(dir, id, { type: 'status_set', text: 'thinking' }, 'agent');
  await append(dir, id, { type: 'questions_posted', questions: [{ id: 'q2', title: 'Q2', body: 'b' }] }, 'agent');
  await tick(50);
  expect(isDone()).toBe(false);
  await append(dir, id, { type: 'batch_sent' }, 'user');
  expect(await p).toBe('updates');
});

test('closed session resolves closed, then updates after session_reopened', async () => {
  await append(dir, id, { type: 'session_confirmed' }, 'user');
  const n = (await loadEvents(dir, id)).length;
  await append(dir, id, { type: 'updates_acked', through: n }, 'agent');
  const p = waitForUpdates(dir, id, opts);
  const isDone = settled(p);
  await tick(50);
  expect(isDone()).toBe(true);        // closed, resolved already
  expect(await p).toBe('closed');
  await append(dir, id, { type: 'session_reopened', note: 'more' }, 'user');
  expect(await waitForUpdates(dir, id, opts)).toBe('updates');
});

test('resolves closed for a confirmed, acked session', async () => {
  await append(dir, id, { type: 'session_confirmed' }, 'user');
  const n = (await loadEvents(dir, id)).length;
  await append(dir, id, { type: 'updates_acked', through: n }, 'agent');
  expect(await waitForUpdates(dir, id, opts)).toBe('closed');
});

test('a confirmed session with an unacked confirmation still reports updates', async () => {
  await append(dir, id, { type: 'session_confirmed' }, 'user');
  expect(await waitForUpdates(dir, id, opts)).toBe('updates');
});

test('rejects with SessionNotFound for a missing id', async () => {
  await expect(waitForUpdates(dir, 'rt-none', opts)).rejects.toBeInstanceOf(SessionNotFound);
});

test('abort rejects promptly', async () => {
  const ac = new AbortController();
  const p = waitForUpdates(dir, id, { intervalMs: 60_000, signal: ac.signal });
  const caught = p.catch((e) => e);
  await tick(20);
  ac.abort();
  const err = await caught;
  expect((err as Error).name).toBe('AbortError');
});

test('an already-aborted signal rejects without waiting', async () => {
  const ac = new AbortController();
  ac.abort();
  await expect(waitForUpdates(dir, id, { signal: ac.signal })).rejects.toMatchObject({ name: 'AbortError' });
});
