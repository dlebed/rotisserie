import { afterAll, beforeAll, expect, test } from 'vitest';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const mcpJs = path.join(root, 'dist', 'mcp.js');
const cliJs = path.join(root, 'dist', 'cli.js');

let tmp: string, projectDir: string, home: string, port: number;
let client: Client | undefined;
const children: ChildProcess[] = [];

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(p));
    });
  });
}

async function tool(name: string, args: Record<string, unknown>): Promise<any> {
  const r: any = await client!.callTool({ name, arguments: args });
  const text = r.content?.[0]?.text as string;
  if (r.isError) throw new Error(`${name} failed: ${text}`);
  return JSON.parse(text);
}

type Wait = { child: ChildProcess; out: () => string; exited: Promise<number | null>; isRunning: () => boolean };
function startWait(args: string[]): Wait {
  const child = spawn(process.execPath, args, {
    env: { ...process.env, ROTISSERIE_HOME: home }, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  let out = '';
  let running = true;
  child.stdout!.on('data', (c) => (out += c));
  child.stderr!.on('data', (c) => (out += c));
  const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => { running = false; resolve(code); }));
  return { child, out: () => out, exited, isRunning: () => running };
}

beforeAll(async () => {
  for (const f of [mcpJs, cliJs]) {
    if (!existsSync(f)) throw new Error(`${path.relative(root, f)} is missing. Run \`npm run build\` before this test.`);
  }
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rt-e2e-'));
  home = path.join(tmp, 'home');
  projectDir = path.join(tmp, 'project');
  await fs.mkdir(projectDir, { recursive: true });
  port = await freePort();
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  Object.assign(env, { ROTISSERIE_HOME: home, ROTISSERIE_NO_OPEN: '1', ROTISSERIE_PORT: String(port),
    CLAUDE_PROJECT_DIR: projectDir });
  delete env.ROTISSERIE_HOST;
  client = new Client({ name: 'rotisserie-smoke', version: '0.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [mcpJs], env }));
}, 20_000);

afterAll(async () => {
  for (const c of children) if (c.exitCode === null && c.signalCode === null) c.kill();
  try { await client?.close(); } catch { /* already gone */ }
  if (tmp) await fs.rm(tmp, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
}, 20_000);

test('start_session, post_questions, wait, respond over HTTP, get_updates', async () => {
  const started = await tool('start_session', { title: 'Smoke' });
  const { sessionId, url, waitCommand } = started as { sessionId: string; url: string; waitCommand: string };
  expect(sessionId).toMatch(/^rt-[0-9a-f]{4}$/);
  const u = new URL(url);
  expect(u.port).toBe(String(port));
  const token = u.searchParams.get('t');
  expect(token).toBeTruthy();
  const [, , pk, id] = u.pathname.split('/');
  expect(id).toBe(sessionId);

  await tool('post_questions', { sessionId, questions: [
    { id: 'Q1', title: 'First', body: 'Pick one', recommendation: 'A',
      options: [{ id: 'a', label: 'A', recommended: true }, { id: 'b', label: 'B' }] }] });

  // Run the waitCommand the way an agent would: it is "node <cli> wait <id> --dir <dir>".
  expect(waitCommand).toContain(sessionId);
  const wait = startWait([cliJs, 'wait', sessionId, '--dir', projectDir, '--interval', '100']);

  const base = `http://127.0.0.1:${port}`;
  const noToken = await fetch(`${base}/api/sessions/${pk}/${sessionId}`);
  expect(noToken.status).toBe(401);

  const headers = { 'x-rotisserie-token': token!, 'content-type': 'application/json' };
  const api = `${base}/api/sessions/${pk}/${sessionId}`;
  const got = await fetch(api, { headers });
  expect(got.status).toBe(200);
  expect(((await got.json()) as any).state.questions.Q1.title).toBe('First');

  await new Promise((r) => setTimeout(r, 600));
  expect(wait.isRunning()).toBe(true);   // nothing sent yet, so the wait must still be blocking

  const put = await fetch(`${api}/responses/Q1`, { method: 'PUT', headers,
    body: JSON.stringify({ kind: 'answer', optionIds: ['a'], note: 'smoke' }) });
  expect(put.status).toBe(200);
  expect(wait.isRunning()).toBe(true);   // marked Done but not sent: still waiting
  const respond = await fetch(`${api}/respond`, { method: 'POST', headers });
  expect(respond.status).toBe(200);

  const code = await Promise.race([wait.exited,
    new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 10_000))]);
  expect(code).toBe(0);
  expect(wait.out()).toContain(`ROTISSERIE: updates ready for ${sessionId}. Call get_updates.`);

  const updates = await tool('get_updates', { sessionId });
  expect(updates.confirmed).toBe(false);
  expect(updates.responses).toHaveLength(1);
  expect(updates.responses[0].qid).toBe('Q1');
  expect(updates.responses[0].response).toMatchObject({ kind: 'answer', optionIds: ['a'], note: 'smoke' });
}, 20_000);
