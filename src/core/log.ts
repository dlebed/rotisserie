import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Event, EventBody } from './events';

export async function appendEvent(file: string, body: EventBody, actor: 'agent' | 'user', cid?: string): Promise<void> {
  const ev: Event = { ...body, ts: new Date().toISOString(), actor, ...(cid !== undefined ? { cid } : {}) };
  await fs.mkdir(path.dirname(file), { recursive: true });
  // After a crash mid-append the last line has no newline; start a new line so this event is not
  // joined to the broken fragment. Still one append per event, and the log is never rewritten.
  const lead = (await endsMidLine(file)) ? '\n' : '';
  await fs.appendFile(file, lead + JSON.stringify(ev) + '\n', 'utf8');
}

async function endsMidLine(file: string): Promise<boolean> {
  let fh: fs.FileHandle;
  try { fh = await fs.open(file, 'r'); } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw e;
  }
  try {
    const { size } = await fh.stat();
    if (size === 0) return false;
    const last = Buffer.alloc(1);
    await fh.read(last, 0, 1, size - 1);
    return last[0] !== 0x0a;
  } finally { await fh.close(); }
}

export async function readEvents(file: string): Promise<Event[]> {
  const text = await fs.readFile(file, 'utf8');
  const out: Event[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line) as Event); } catch { /* skip corrupt line */ }
  }
  return out;
}
