import { afterEach, beforeEach, expect, test } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { append, createSession } from '../../src/core/store';
import { searchSessions } from '../../src/core/search';

let dir: string;
let id: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rt-search-'));
  id = await createSession(dir, { title: 'Auth design' });
  await append(dir, id, { type: 'questions_posted', questions: [
    { id: 'q1', title: 'Which store?', body: 'Pick a session store', options: [
      { id: 'a', label: 'Redis cache' }, { id: 'b', label: 'Postgres table' }] },
    { id: 'q2', title: 'Server port', body: 'Where to listen' },
  ] }, 'agent');
  await append(dir, id, { type: 'response_marked', qid: 'q1', response: { kind: 'answer', optionIds: ['a'], text: 'sticky sessions' } }, 'user');
  await append(dir, id, { type: 'response_marked', qid: 'q2', response: { kind: 'answer', optionIds: [], text: 'use port 4783' } }, 'user');
  await append(dir, id, { type: 'batch_sent' }, 'user');
  await append(dir, id, { type: 'question_resolved', qid: 'q1', decision: 'Use Redis', assumed: false }, 'agent');
});
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });

test('keyword finds a question by a word in its answer and returns its decision', async () => {
  const hits = await searchSessions(dir, { query: 'STICKY' });
  expect(hits).toHaveLength(1);
  expect(hits[0]).toMatchObject({ sessionId: id, sessionTitle: 'Auth design', kind: 'question',
    qid: 'q1', title: 'Which store?', decision: 'Use Redis' });
  expect(hits[0]!.answer).toBe('Redis cache sticky sessions');
  expect(hits[0]!.excerpt).toContain('sticky');
});

test('every word must match', async () => {
  expect(await searchSessions(dir, { query: 'redis sticky' })).toHaveLength(1);
  expect(await searchSessions(dir, { query: 'redis nonexistent' })).toHaveLength(0);
});

test('regex mode matches, and an invalid pattern rejects', async () => {
  const hits = await searchSessions(dir, { query: 'port\\s+\\d+', regex: true });
  expect(hits.map((h) => h.qid)).toEqual(['q2']);
  await expect(searchSessions(dir, { query: '(', regex: true })).rejects.toThrow(/^Invalid regular expression: /);
});

test('notes and summary markdown are searched', async () => {
  await append(dir, id, { type: 'note_added', markdown: 'remember the zebra constraint' }, 'user');
  await append(dir, id, { type: 'summary_posted', html: '<p>x</p>', markdown: '# Final\nwe chose giraffe', abstract: 'a' }, 'agent');
  const n = await searchSessions(dir, { query: 'zebra' });
  expect(n).toHaveLength(1);
  expect(n[0]).toMatchObject({ kind: 'note' });
  expect(n[0]!.excerpt).toContain('zebra');
  const s = await searchSessions(dir, { query: 'giraffe' });
  expect(s).toHaveLength(1);
  expect(s[0]).toMatchObject({ kind: 'summary', sessionId: id });
});

test('limit is honoured', async () => {
  expect(await searchSessions(dir, { query: 'e', limit: 1 })).toHaveLength(1);
  expect((await searchSessions(dir, { query: 'e' })).length).toBeGreaterThan(1);
});
