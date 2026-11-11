import { promises as fs } from 'node:fs';
import { loadSession, sessionFile } from '../core/store';

const abortError = (signal: AbortSignal): Error =>
  signal.reason instanceof Error ? signal.reason : Object.assign(new Error('aborted'), { name: 'AbortError' });

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError(signal));
    const onAbort = () => { clearTimeout(timer); reject(abortError(signal!)); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function logSize(file: string): Promise<number> {
  try { return (await fs.stat(file)).size; } catch { return -1; }
}

/** Sleeps (file reads only) until the user has sent something for the agent, or the session is closed. */
export async function waitForUpdates(projectDir: string, id: string,
  o: { intervalMs?: number; signal?: AbortSignal } = {}): Promise<'updates' | 'closed'> {
  const interval = o.intervalMs ?? 1000;
  const file = sessionFile(projectDir, id);
  for (;;) {
    if (o.signal?.aborted) throw abortError(o.signal);
    const size = await logSize(file);
    const s = await loadSession(projectDir, id);   // throws SessionNotFound for an unknown session
    if (s.pendingWake) return 'updates';
    if (s.phase === 'confirmed') return 'closed';
    // Nothing to report: poll cheaply and only reload when the log has changed size.
    while (await logSize(file) === size) await sleep(interval, o.signal);
  }
}

