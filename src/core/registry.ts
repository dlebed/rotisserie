import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';

export function home(): string {
  return process.env.ROTISSERIE_HOME || path.join(os.homedir(), '.rotisserie');
}

async function writeAtomic(file: string, data: string, mode?: number): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(tmp, data, { encoding: 'utf8', ...(mode !== undefined ? { mode } : {}) });
  await fs.rename(tmp, file);
}

async function readJson(file: string): Promise<unknown> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return undefined; }
}

export async function getToken(): Promise<string> {
  const file = path.join(home(), 'config.json');
  const read = async () => {
    const c = (await readJson(file)) as { token?: unknown } | undefined;
    return typeof c?.token === 'string' && c.token ? c.token : undefined;
  };
  const existing = await read();
  if (existing) return existing;
  await fs.mkdir(home(), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ token: randomBytes(24).toString('base64url') }), { encoding: 'utf8', mode: 0o600 });
  try { await fs.link(tmp, file); }           // atomic create-if-absent: concurrent callers agree on one token
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
  finally { await fs.unlink(tmp).catch(() => {}); }
  const t = await read();
  if (!t) throw new Error('could not create Rotisserie config');
  return t;
}

/** Normalises a project path; on Windows the drive letter is upper-cased so `c:` and `C:` give one key. Pure. */
export function normalizeDir(p: string, platform: NodeJS.Platform = process.platform): string {
  if (platform !== 'win32') return path.posix.normalize(p);
  return path.win32.normalize(p).replace(/^[a-z]:/i, (d) => d.toUpperCase());
}

async function realDir(projectDir: string): Promise<string> {
  return normalizeDir(await fs.realpath(projectDir));
}

export async function registerProject(projectDir: string): Promise<string> {
  const dir = await realDir(projectDir);
  const key = createHash('sha256').update(dir).digest('hex').slice(0, 8);
  await writeAtomic(path.join(home(), 'projects', `${key}.json`), JSON.stringify({ dir, name: path.basename(dir) }));
  return key;
}

export async function listProjects(): Promise<{ key: string; dir: string; name: string }[]> {
  let names: string[];
  try { names = await fs.readdir(path.join(home(), 'projects')); } catch { return []; }
  const out: { key: string; dir: string; name: string }[] = [];
  for (const n of names.sort()) {
    if (!n.endsWith('.json')) continue;
    const p = (await readJson(path.join(home(), 'projects', n))) as { dir?: unknown; name?: unknown } | undefined;
    if (!p || typeof p.dir !== 'string' || typeof p.name !== 'string') continue;
    const stat = await fs.stat(p.dir).catch(() => null);
    if (!stat?.isDirectory()) continue;
    out.push({ key: n.slice(0, -'.json'.length), dir: p.dir, name: p.name });
  }
  return out;
}

type ServerInfo = { host: string; port: number; pid: number };

export async function readServerInfo(): Promise<ServerInfo | null> {
  const i = (await readJson(path.join(home(), 'server.json'))) as Partial<ServerInfo> | undefined;
  return i && typeof i.host === 'string' && typeof i.port === 'number' && typeof i.pid === 'number'
    ? { host: i.host, port: i.port, pid: i.pid } : null;
}

export async function writeServerInfo(i: ServerInfo): Promise<void> {
  await writeAtomic(path.join(home(), 'server.json'), JSON.stringify(i));
}
