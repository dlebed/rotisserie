import { afterEach, beforeEach, expect, test } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { append, loadEvents } from '../../src/core/store';
import { createTools } from '../../src/mcp/tools';

let dir: string;
let tools: ReturnType<typeof createTools>;
let opened: string[];
const call = (name: string, args: Record<string, unknown> = {}) => tools[name]!.handler(args) as Promise<any>;
const q = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: `Title ${id}`, body: 'body', ...extra });

async function start(): Promise<string> {
  const r = await call('start_session', { title: 'Session' });
  return r.sessionId as string;
}
const answer = (id: string, qid: string) =>
  append(dir, id, { type: 'response_marked', qid, response: { kind: 'answer', optionIds: ['a'], text: 'yes' } }, 'user');
const send = (id: string) => append(dir, id, { type: 'batch_sent' }, 'user');

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rt-mcp-'));
  process.env.ROTISSERIE_HOME = path.join(dir, 'home');
  opened = [];
  tools = createTools(dir, {
    sessionUrl: async (pk, id) => `http://x/s/${pk}/${id}`,
    accessHints: (_env, port) => (port === 5555 ? ['hint'] : ['wrong port']),
    port: async () => 5555,
    openBrowser: async (u) => { opened.push(u); return true; },
    ready: async () => {},
    cliPath: 'C:\\app\\dist\\cli.js',
  });
});
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });

test('exposes the eleven tools with descriptions', () => {
  expect(Object.keys(tools).sort()).toEqual(['add_note', 'get_session', 'get_updates', 'list_sessions',
    'post_questions', 'post_summary', 'resolve_question', 'retract_question', 'search_sessions',
    'set_status', 'start_session']);
  for (const t of Object.values(tools)) expect(t.description.length).toBeGreaterThan(20);
  expect(tools.get_updates!.description).toMatch(/call after the wait command exits or when the user says they have responded/i);
});

test('question id examples follow the skills: Q1, Q2 and follow-ups Q1a, Q1b', () => {
  const questions = tools.post_questions!.schema.questions as any;
  const desc: string = questions.element.shape.id.description;
  expect(desc).toMatch(/"Q1", "Q2"/);
  expect(desc).toMatch(/"Q1a", "Q1b"/);
  expect(desc).toMatch(/case-sensitive/i);
  expect(desc).not.toMatch(/q2\.1|"q1"/);
});

test('both skills say ids are case-sensitive and new, act on a closed session only once confirmed, and agree on the transport', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const read = (name: string) => fs.readFile(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
  const [grill, docs] = await Promise.all([read('grill'), read('grill-with-docs')]);
  for (const text of [grill, docs]) {
    expect(text).toMatch(/Ids are case-sensitive .* and must be new within the session/);
    const closed = text.split('\n').find((l) => l.includes('is closed.`'));
    expect(closed).toMatch(/Call `get_updates`, and once it reports `confirmed: true`/);
  }
  const transport = (t: string) => t.slice(t.indexOf('## 2.'));
  expect(transport(docs)).toBe(transport(grill));
});

test('start_session returns url, hints, browserOpened and a forward-slash waitCommand', async () => {
  const r = await call('start_session', { title: 'T' });
  expect(r.sessionId).toMatch(/^rt-/);
  expect(r.url).toContain(r.sessionId);
  expect(r.hints).toEqual(['hint']);
  expect(r.browserOpened).toBe(true);
  expect(opened).toEqual([r.url]);
  expect(r.waitCommand).toContain('--dir');
  expect(r.waitCommand).not.toContain('\\');
  expect(r.waitCommand).toBe(`node "C:/app/dist/cli.js" wait ${r.sessionId} --dir "${dir.replace(/\\/g, '/')}"`);
});

test('round trip: get_updates returns sent responses once', async () => {
  const id = await start();
  await call('post_questions', { sessionId: id, questions: [q('q1'), q('q2')] });
  await answer(id, 'q1');
  await send(id);
  const first = await call('get_updates', { sessionId: id });
  expect(first.responses).toEqual([{ qid: 'q1', title: 'Title q1',
    response: { kind: 'answer', optionIds: ['a'], text: 'yes' }, isRevision: false }]);
  expect(first.confirmed).toBe(false);
  expect(first.openCount).toBe(1);
  const second = await call('get_updates', { sessionId: id });
  expect(second.responses).toEqual([]);
  const events = await loadEvents(dir, id);
  expect(events.filter((e) => e.type === 'updates_acked')).toHaveLength(2);
});

test('a revised answer is flagged isRevision', async () => {
  const id = await start();
  await call('post_questions', { sessionId: id, questions: [q('q1')] });
  await answer(id, 'q1'); await send(id);
  await call('get_updates', { sessionId: id });
  await append(dir, id, { type: 'response_marked', qid: 'q1', response: { kind: 'skip' } }, 'user');
  await send(id);
  const r = await call('get_updates', { sessionId: id });
  expect(r.responses).toEqual([{ qid: 'q1', title: 'Title q1', response: { kind: 'skip' }, isRevision: true }]);
});

test('a revision edited again before sending is still flagged isRevision', async () => {
  const id = await start();
  await call('post_questions', { sessionId: id, questions: [q('q1')] });
  await answer(id, 'q1'); await send(id);
  await call('get_updates', { sessionId: id });
  await append(dir, id, { type: 'response_marked', qid: 'q1', response: { kind: 'skip' } }, 'user');
  await append(dir, id, { type: 'response_marked', qid: 'q1', response: { kind: 'invalid', reason: 'r' } }, 'user');
  await send(id);
  const r = await call('get_updates', { sessionId: id });
  expect(r.responses).toEqual([{ qid: 'q1', title: 'Title q1', response: { kind: 'invalid', reason: 'r' }, isRevision: true }]);
});

test('a resolution that lands before the user sends a revision does not drop it', async () => {
  const id = await start();
  await call('post_questions', { sessionId: id, questions: [q('q1')] });
  await answer(id, 'q1');
  await send(id);
  await call('get_updates', { sessionId: id });
  await call('resolve_question', { sessionId: id, qid: 'q1', decision: 'D1' });
  await append(dir, id, { type: 'response_marked', qid: 'q1', response: { kind: 'skip' } }, 'user');
  await call('resolve_question', { sessionId: id, qid: 'q1', decision: 'D2' });
  expect((await call('get_updates', { sessionId: id })).responses).toEqual([]);
  await send(id);
  const r = await call('get_updates', { sessionId: id });
  expect(r.responses).toEqual([{ qid: 'q1', title: 'Title q1', response: { kind: 'skip' }, isRevision: true }]);
  expect(r.openCount).toBe(0);
});

test('an answer marked Done but not sent is absent', async () => {
  const id = await start();
  await call('post_questions', { sessionId: id, questions: [q('q1'), q('q2')] });
  await answer(id, 'q1'); await send(id);
  await answer(id, 'q2');
  const r = await call('get_updates', { sessionId: id });
  expect(r.responses.map((x: any) => x.qid)).toEqual(['q1']);
});

test('duplicate question id and unknown parent are rejected', async () => {
  const id = await start();
  await call('post_questions', { sessionId: id, questions: [q('q1')] });
  await expect(call('post_questions', { sessionId: id, questions: [q('q1')] })).rejects.toThrow(/q1.*already exists/);
  await expect(call('post_questions', { sessionId: id, questions: [q('q2', { parentId: 'nope' })] })).rejects.toThrow(/nope/);
  await expect(call('post_questions', { sessionId: id, questions: [q('a'), q('a')] })).rejects.toThrow(/duplicate/i);
  // a parent posted earlier in the same batch is fine
  await call('post_questions', { sessionId: id, questions: [q('p'), q('c', { parentId: 'p' })] });
});

test('post_summary is refused while questions are open or sent, accepted once settled', async () => {
  const id = await start();
  const summary = { sessionId: id, html: '<p>x</p>', markdown: 'x', abstract: 'a' };
  await call('post_questions', { sessionId: id, questions: [q('q1'), q('q2')] });
  await expect(call('post_summary', summary)).rejects.toThrow(/q1.*q2/);
  await answer(id, 'q1'); await send(id);
  await expect(call('post_summary', summary)).rejects.toThrow(/q1/);
  await call('resolve_question', { sessionId: id, qid: 'q1', decision: 'go' });
  await call('retract_question', { sessionId: id, qid: 'q2', reason: 'moot' });
  await call('post_summary', summary);
  expect((await call('get_session', { sessionId: id })).phase).toBe('summary');
});

test('get_updates after session_reopened returns reopenNote', async () => {
  const id = await start();
  await call('get_updates', { sessionId: id });
  await append(dir, id, { type: 'session_confirmed' }, 'user');
  expect((await call('get_updates', { sessionId: id })).confirmed).toBe(true);
  await append(dir, id, { type: 'session_reopened', note: 'one more thing' }, 'user');
  const r = await call('get_updates', { sessionId: id });
  expect(r.reopenNote).toBe('one more thing');
  expect(r.confirmed).toBe(false);
  expect((await call('get_updates', { sessionId: id })).reopenNote).toBeUndefined();
});

test('unknown session and unknown qid fail clearly', async () => {
  const id = await start();
  for (const [name, args] of [['post_questions', { questions: [] }], ['get_updates', {}],
    ['set_status', { text: 't' }], ['add_note', { markdown: 'm' }], ['get_session', {}],
    ['resolve_question', { qid: 'q', decision: 'd' }], ['retract_question', { qid: 'q', reason: 'r' }],
    ['post_summary', { html: '', markdown: '', abstract: '' }]] as const) {
    await expect(call(name, { sessionId: 'rt-nope', ...args })).rejects.toThrow(/Unknown session rt-nope/);
  }
  await expect(call('resolve_question', { sessionId: id, qid: 'zz', decision: 'd' })).rejects.toThrow(/Unknown question zz/);
  await expect(call('retract_question', { sessionId: id, qid: 'zz', reason: 'r' })).rejects.toThrow(/Unknown question zz/);
});

test('set_status, add_note, get_session, list_sessions', async () => {
  const id = await start();
  await call('post_questions', { sessionId: id, questions: [q('q1')] });
  await call('set_status', { sessionId: id, text: 'working' });
  await call('add_note', { sessionId: id, markdown: 'a **note**' });
  await append(dir, id, { type: 'response_marked', qid: 'q1', response: { kind: 'skip' } }, 'user');
  await send(id);
  await call('resolve_question', { sessionId: id, qid: 'q1', decision: 'D', assumed: true, reason: 'because' });
  const s = await call('get_session', { sessionId: id });
  expect(s.title).toBe('Session');
  expect(s.notes).toEqual([expect.objectContaining({ markdown: 'a **note**' })]);
  expect(s.questions).toEqual([expect.objectContaining({ id: 'q1', status: 'assumed', decision: 'D' })]);
  expect((await call('list_sessions')).map((x: any) => x.id)).toEqual([id]);
});

test('search_sessions finds a posted question', async () => {
  const id = await start();
  await call('post_questions', { sessionId: id, questions: [q('q1', { title: 'Which database engine' })] });
  const hits = await call('search_sessions', { query: 'database' });
  expect(hits).toEqual([expect.objectContaining({ sessionId: id, kind: 'question', qid: 'q1' })]);
});

test('a partial round leaves the unanswered questions with the user', async () => {
  const id = await start();
  await call('post_questions', { sessionId: id, questions: [q('q1'), q('q2'), q('q3')] });
  await answer(id, 'q1');
  await answer(id, 'q3');
  await append(dir, id, { type: 'response_cleared', qid: 'q3' }, 'user');
  await send(id);
  const r = await call('get_updates', { sessionId: id });
  expect(r.waitingOn).toEqual(['q2', 'q3']);
  await expect(call('resolve_question', { sessionId: id, qid: 'q3', decision: 'mine' })).rejects.toThrow(/has not sent an answer/);
  expect(r.note).toMatch(/not answered q2, q3/);
  await expect(call('resolve_question', { sessionId: id, qid: 'q2', decision: 'mine', assumed: true, reason: 'x' }))
    .rejects.toThrow(/has not sent an answer/);
  await expect(call('post_summary', { sessionId: id, html: 'h', markdown: 'm', abstract: 'a' }))
    .rejects.toThrow(/has not answered q2, q3/);
  await call('retract_question', { sessionId: id, qid: 'q2', reason: 'moot after q1' });
  await call('resolve_question', { sessionId: id, qid: 'q1', decision: 'D' });
});

test('the agent decides a question itself only when the user skipped it', async () => {
  const id = await start();
  await call('post_questions', { sessionId: id, questions: [q('q1'), q('q2'), q('q3')] });
  await answer(id, 'q1');
  await append(dir, id, { type: 'response_marked', qid: 'q2', response: { kind: 'invalid', reason: 'wrong premise' } }, 'user');
  await append(dir, id, { type: 'response_marked', qid: 'q3', response: { kind: 'skip' } }, 'user');
  await send(id);
  const mine = { sessionId: id, decision: 'mine', assumed: true, reason: 'why' };
  await expect(call('resolve_question', { ...mine, qid: 'q1' })).rejects.toThrow(/the user answered it/);
  await expect(call('resolve_question', { ...mine, qid: 'q2' })).rejects.toThrow(/called the question invalid/);
  await expect(call('resolve_question', { sessionId: id, qid: 'q3', decision: 'mine' })).rejects.toThrow(/assumed=true and a reason/);
  await expect(call('resolve_question', { ...mine, qid: 'q3', reason: ' ' })).rejects.toThrow(/assumed=true and a reason/);
  await expect(call('retract_question', { sessionId: id, qid: 'q2', reason: '  ' })).rejects.toThrow(/without a reason/);
  await call('resolve_question', { sessionId: id, qid: 'q1', decision: 'as answered' });
  await call('retract_question', { sessionId: id, qid: 'q2', reason: 'The premise was wrong.' });
  await call('resolve_question', { ...mine, qid: 'q3' });
});
