import { afterEach, beforeEach, expect, test } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { append, createSession, listSessions, loadEvents, loadSession, readDrafts, sessionFile,
  SessionNotFound, UnsupportedVersion, writeDraft } from '../../src/core/store';

let dir: string;
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rt-store-')); });
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });

test('createSession writes a header and returns rt-xxxx', async () => {
  const id = await createSession(dir, { title: 'T' });
  expect(id).toMatch(/^rt-[0-9a-f]{4}$/);
  expect((await loadSession(dir, id)).title).toBe('T');
  expect(sessionFile(dir, id)).toBe(path.join(dir, '.rotisserie', 'sessions', `${id}.jsonl`));
});

test('loadSession throws SessionNotFound / UnsupportedVersion', async () => {
  await expect(loadSession(dir, 'rt-nope')).rejects.toBeInstanceOf(SessionNotFound);
  await fs.mkdir(path.join(dir, '.rotisserie', 'sessions'), { recursive: true });
  await fs.writeFile(sessionFile(dir, 'rt-9999'),
    JSON.stringify({ type: 'session_created', v: 2, id: 'rt-9999', title: 'X', ts: 't', actor: 'agent' }) + '\n');
  const err = await loadSession(dir, 'rt-9999').catch(e => e);
  expect(err).toBeInstanceOf(UnsupportedVersion);
  expect(err.found).toBe(2);
});

test('an unreadable or missing header line means not found', async () => {
  await fs.mkdir(path.join(dir, '.rotisserie', 'sessions'), { recursive: true });
  await fs.writeFile(sessionFile(dir, 'rt-bad1'), '{"type":"session_cr\n');
  await fs.writeFile(sessionFile(dir, 'rt-bad2'), '');
  await expect(loadSession(dir, 'rt-bad1')).rejects.toBeInstanceOf(SessionNotFound);
  await expect(loadSession(dir, 'rt-bad2')).rejects.toBeInstanceOf(SessionNotFound);
});

test('listSessions returns every session with progress', async () => {
  expect(await listSessions(dir)).toEqual([]);
  const a = await createSession(dir, { title: 'A' });
  const b = await createSession(dir, { title: 'B' });
  await append(dir, b, { type: 'questions_posted', questions: [{ id: 'Q1', title: 'q', body: '' }, { id: 'Q2', title: 'r', body: '' }] }, 'agent');
  const list = await listSessions(dir);
  expect(list.map(s => s.id).sort()).toEqual([a, b].sort());
  const sb = list.find(s => s.id === b)!;
  expect(sb.title).toBe('B');
  expect(sb.phase).toBe('active');
  expect(sb.progress.total).toBe(2);
  expect(list.find(s => s.id === a)!.progress.total).toBe(0);
  expect(Number.isNaN(Date.parse(sb.updatedAt))).toBe(false);
});

test('a cid passed to append is stored on the event', async () => {
  const id = await createSession(dir, { title: 'T' });
  await append(dir, id, { type: 'batch_sent' }, 'user', 'c-1');
  await append(dir, id, { type: 'status_set', text: 'x' }, 'agent');
  const evs = await loadEvents(dir, id);
  expect(evs[1]!.cid).toBe('c-1');
  expect('cid' in evs[2]!).toBe(false);
});

test('a parent session id is kept in the header', async () => {
  const id = await createSession(dir, { title: 'T', parentSessionId: 'rt-aaaa' });
  expect((await loadSession(dir, id)).parentSessionId).toBe('rt-aaaa');
});

test('drafts round-trip, overwrite per question and default to empty', async () => {
  const id = await createSession(dir, { title: 'T' });
  expect(await readDrafts(dir, id)).toEqual({});
  await writeDraft(dir, id, 'Q1', { text: 'a' });
  await writeDraft(dir, id, 'Q2', { text: 'b' });
  await writeDraft(dir, id, 'Q1', { text: 'c' });
  expect(await readDrafts(dir, id)).toEqual({ Q1: { text: 'c' }, Q2: { text: 'b' } });
});

test('ids that are not rt-xxxx are rejected by every store function', async () => {
  const bad = ['../x', '..%2Fx', 'rt-zzzz', 'rt-12345', 'rt-12', '/etc/passwd', 'rt-abcd/../../x', ''];
  for (const id of bad) {
    expect(() => sessionFile(dir, id)).toThrow(SessionNotFound);
    await expect(loadEvents(dir, id)).rejects.toBeInstanceOf(SessionNotFound);
    await expect(append(dir, id, { type: 'batch_sent' }, 'user')).rejects.toBeInstanceOf(SessionNotFound);
    await expect(readDrafts(dir, id)).rejects.toBeInstanceOf(SessionNotFound);
    await expect(writeDraft(dir, id, 'Q1', {})).rejects.toBeInstanceOf(SessionNotFound);
  }
  await expect(fs.stat(path.join(dir, '.rotisserie'))).rejects.toThrow();
});

test('overlapping writeDraft calls on one session lose nothing', async () => {
  const id = await createSession(dir, { title: 'T' });
  await Promise.all(Array.from({ length: 20 }, (_, i) => writeDraft(dir, id, `Q${i}`, { n: i })));
  const drafts = await readDrafts(dir, id);
  expect(Object.keys(drafts)).toHaveLength(20);
  expect(drafts['Q7']).toEqual({ n: 7 });
});
