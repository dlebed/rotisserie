import { afterEach, beforeEach, expect, test } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendEvent, readEvents } from '../../src/core/log';
import type { EventBody } from '../../src/core/events';

let tmp: string, f: string;
beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rt-log-')); f = path.join(tmp, 's.jsonl'); });
afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }); });

const created: EventBody = { type: 'session_created', v: 1, id: 'rt-0001', title: 'T' };
const posted: EventBody = { type: 'questions_posted', questions: [{ id: 'Q1', title: 'a', body: '' }] };

test('append then read round-trips', async () => {
  await appendEvent(f, created, 'agent');
  await appendEvent(f, posted, 'agent');
  await appendEvent(f, { type: 'batch_sent' }, 'user');
  const evs = await readEvents(f);
  expect(evs.length).toBe(3);
  expect(evs.map(e => e.type)).toEqual(['session_created', 'questions_posted', 'batch_sent']);
  expect(evs.map(e => e.actor)).toEqual(['agent', 'agent', 'user']);
  for (const e of evs) expect(Number.isNaN(Date.parse(e.ts))).toBe(false);
});

test('a corrupt line is skipped', async () => {
  await appendEvent(f, created, 'agent'); await fs.appendFile(f, '{"type":"quest\n');
  await appendEvent(f, posted, 'agent'); expect((await readEvents(f)).length).toBe(2);
});

test('a crash mid-append (partial last line, no newline) does not take the next event with it', async () => {
  await appendEvent(f, created, 'agent');
  await fs.appendFile(f, '{"type":"quest');                    // the crash: no trailing newline
  await appendEvent(f, { type: 'batch_sent' }, 'user');
  expect((await readEvents(f)).map((e) => e.type)).toEqual(['session_created', 'batch_sent']);
  const text = await fs.readFile(f, 'utf8');
  expect(text.startsWith(JSON.stringify((await readEvents(f))[0]) + '\n{"type":"quest\n')).toBe(true);
});
