import http from 'node:http';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { writeServerInfo } from '../core/registry';
import { createApp } from './http';

const PORT_SPAN = 20;
const PROBE_TIMEOUT_MS = 500;

const log = (m: string) => process.stderr.write(`[rotisserie] ${m}\n`);

function defaultWebDir(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), 'web');
}

/** 'unreachable': no answer at all (connection error or timeout), as when the host just went away. */
export type ProbeResult = 'rotisserie' | 'other' | 'unreachable';
export type HostSeams = {
  probe?: (host: string, port: number) => Promise<ProbeResult>;
  listen?: (s: http.Server, port: number, host: string) => Promise<void>;
};

export function probeHealth(host: string, port: number): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const req = http.get({ host, port, path: '/api/health', timeout: PROBE_TIMEOUT_MS }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
      res.on('end', () => {
        try { resolve(JSON.parse(body)?.app === 'rotisserie' ? 'rotisserie' : 'other'); } catch { resolve('other'); }
      });
      res.on('error', () => resolve('other'));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve('unreachable'));   // a no-op once a response has resolved
  });
}

function listenOn(s: http.Server, port: number, host: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    s.once('error', reject);
    s.listen(port, host, () => { s.off('error', reject); resolve(); });
  });
}

export function startHostLoop(o: { retryMs?: number; webDir?: string } & HostSeams = {}): {
  stop(): Promise<void>; isHost(): boolean; ready(): Promise<void>;
} {
  const retryMs = o.retryMs ?? 1000;
  const webDir = o.webDir ?? defaultWebDir();
  const probe = o.probe ?? probeHealth;
  const listen = o.listen ?? listenOn;
  const bindHost = process.env.ROTISSERIE_HOST ?? '127.0.0.1';
  const basePort = Number(process.env.ROTISSERIE_PORT) || 4783;
  const probeHost = bindHost === '0.0.0.0' ? '127.0.0.1' : bindHost;

  let stopped = false, host = false, running = false;
  let server: http.Server | undefined, app: ReturnType<typeof createApp> | undefined;
  let timer: NodeJS.Timeout | undefined;
  let standbyPort: number | undefined;
  let inflight: Promise<void> = Promise.resolve();
  let markReady!: () => void;
  const readyP = new Promise<void>((r) => { markReady = r; });

  async function tryBind(port: number): Promise<'host' | 'inuse'> {
    const a = createApp({ webDir });
    const s = http.createServer(a);
    try {
      await listen(s, port, bindHost);
    } catch (e) {
      a.close();
      if ((e as NodeJS.ErrnoException).code === 'EADDRINUSE') return 'inuse';
      throw e;
    }
    if (stopped) { a.close(); await new Promise<void>((r) => s.close(() => r())); return 'host'; }
    server = s; app = a; host = true;
    s.on('error', (e) => log(`server error: ${e.message}`));
    await writeServerInfo({ host: bindHost, port: (s.address() as AddressInfo).port, pid: process.pid })
      .catch((e: Error) => log(`could not write server info: ${e.message}`));
    return 'host';
  }

  async function attempt(): Promise<void> {
    if (stopped || host || running) return;
    running = true;
    try {
      if (standbyPort !== undefined) {
        // Standby: stay on the host's port so the page address survives a takeover.
        let r: 'host' | 'inuse';
        try { r = await tryBind(standbyPort); } catch (e) {
          log(`standby bind failed: ${(e as Error).message}; retrying`);
          schedule(); return;
        }
        if (r === 'inuse') { schedule(); return; }
        markReady(); return;
      }
      for (let port = basePort; port <= basePort + PORT_SPAN; port++) {
        if (stopped) return;
        if (await tryBind(port) === 'host') { markReady(); return; }
        let found = await probe(probeHost, port);
        if (found === 'unreachable') {
          // Nobody answers: the host may have just let go of the port (a takeover). Try it once more.
          if (stopped) return;
          if (await tryBind(port) === 'host') { markReady(); return; }
          found = await probe(probeHost, port);
        }
        if (found === 'rotisserie') {
          standbyPort = port;
          markReady();
          schedule();
          return;
        }
      }
      log(`no free port in ${basePort}-${basePort + PORT_SPAN}; the web page is unavailable from this process`);
      markReady();
    } catch (e) {
      log(`cannot start web server: ${(e as Error).message}`);
      markReady();
    } finally {
      running = false;
    }
  }

  function schedule(): void {
    if (stopped) return;
    timer = setTimeout(() => { inflight = attempt(); }, retryMs);
    timer.unref();
  }

  inflight = attempt();

  return {
    isHost: () => host,
    ready: () => readyP,
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      await inflight;
      host = false;
      const s = server;
      server = undefined;
      app?.close();
      if (s) {
        s.closeAllConnections?.();
        await new Promise<void>((r) => s.close(() => r()));
      }
      markReady();
    },
  };
}
