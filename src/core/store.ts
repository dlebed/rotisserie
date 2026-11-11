import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { FORMAT_VERSION } from './events';
import type { Event, EventBody } from './events';
import { reduce } from './reduce';
import type { Progress, SessionState } from './reduce';
import { appendEvent, readEvents } from './log';

export class SessionNotFound extends Error {}
export class UnsupportedVersion extends Error {
  constructor(public found: number) { super(`Session format v${found} is newer than supported; update Rotisserie to view this session`); }
}
export type SessionSummary = { id: string; title: string; phase: SessionState['phase'];
  progress: Progress; updatedAt: string };

const sessionsDir = (projectDir: string) => path.join(projectDir, '.rotisserie', 'sessions');
const draftsDir = (projectDir: string) => path.join(projectDir, '.rotisserie', 'drafts');

const SESSION_ID = /^rt-[0-9a-f]{4}$/;
function checkId(id: string): void { if (!SESSION_ID.test(id)) throw new SessionNotFound(id); }

export function sessionFile(projectDir: string, id: string): string {
  checkId(id);
  return path.join(sessionsDir(projectDir), `${id}.jsonl`);
}

export async function createSession(projectDir: string, o: { title: string; parentSessionId?: string }): Promise<string> {
  await fs.mkdir(sessionsDir(projectDir), { recursive: true });
  for (;;) {
    const id = `rt-${randomBytes(2).toString('hex')}`;
    const file = sessionFile(projectDir, id);
    try { await (await fs.open(file, 'wx')).close(); }   // exclusive create: regenerate on collision
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'EEXIST') continue; throw e; }
    const body: EventBody = { type: 'session_created', v: FORMAT_VERSION, id, title: o.title,
      ...(o.parentSessionId !== undefined ? { parentSessionId: o.parentSessionId } : {}) };
    await appendEvent(file, body, 'agent');
    return id;
  }
}

export async function loadEvents(projectDir: string, id: string): Promise<Event[]> {
  let events: Event[];
  try { events = await readEvents(sessionFile(projectDir, id)); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw new SessionNotFound(id); throw e; }
  const head = events[0];
  if (!head || head.type !== 'session_created') throw new SessionNotFound(id);
  if (head.v > FORMAT_VERSION) throw new UnsupportedVersion(head.v);
  return events;
}

export async function loadSession(projectDir: string, id: string): Promise<SessionState> {
  return reduce(await loadEvents(projectDir, id));
}

export async function listSessions(projectDir: string): Promise<SessionSummary[]> {
  let names: string[];
  try { names = await fs.readdir(sessionsDir(projectDir)); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; throw e; }
  const out: SessionSummary[] = [];
  for (const n of names) {
    if (!n.endsWith('.jsonl')) continue;
    const id = n.slice(0, -'.jsonl'.length);
    try {
      const events = await loadEvents(projectDir, id);
      const s = reduce(events);
      out.push({ id: s.id, title: s.title, phase: s.phase, progress: s.progress,
        updatedAt: events[events.length - 1]!.ts });
    } catch (e) { if (!(e instanceof SessionNotFound || e instanceof UnsupportedVersion)) throw e; }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function append(projectDir: string, id: string, body: EventBody, actor: 'agent' | 'user', cid?: string): Promise<void> {
  await appendEvent(sessionFile(projectDir, id), body, actor, cid);
}

function draftFile(projectDir: string, id: string): string {
  checkId(id);
  return path.join(draftsDir(projectDir), `${id}.json`);
}

export async function readDrafts(projectDir: string, id: string): Promise<Record<string, unknown>> {
  const file = draftFile(projectDir, id);
  try {
    const v: unknown = JSON.parse(await fs.readFile(file, 'utf8'));
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch { return {}; }
}

const draftQueues = new Map<string, Promise<unknown>>();   // per-file chain: serialises read-modify-write

export async function writeDraft(projectDir: string, id: string, qid: string, draft: unknown): Promise<void> {
  const file = draftFile(projectDir, id);                      // throws (rejects) before queueing on a bad id
  const run = async () => {
    const drafts = await readDrafts(projectDir, id);
    drafts[qid] = draft;
    await fs.mkdir(draftsDir(projectDir), { recursive: true });
    const tmp = `${file}.${process.pid}.${randomBytes(3).toString('hex')}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(drafts), 'utf8');
    await fs.rename(tmp, file);
  };
  const next = (draftQueues.get(file) ?? Promise.resolve()).then(run, run);
  const tail = next.catch(() => {});
  draftQueues.set(file, tail);
  void tail.then(() => { if (draftQueues.get(file) === tail) draftQueues.delete(file); });
  return next;
}
