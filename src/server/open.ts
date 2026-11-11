import { spawn as nodeSpawn } from 'node:child_process';
import type { SpawnOptions } from 'node:child_process';
import { getToken, readServerInfo } from '../core/registry';

const DEFAULT_PORT = 4783;
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);
const WILDCARD = new Set(['0.0.0.0', '::']);

/** A bind address as it goes in a URL: IPv6 literals are bracketed. */
const urlHost = (h: string) => (h.includes(':') && !h.startsWith('[') ? `[${h}]` : h);

const envPort = (env: NodeJS.ProcessEnv) => Number(env.ROTISSERIE_PORT) || DEFAULT_PORT;

/** Port of the running host (from the registry), else ROTISSERIE_PORT / 4783. */
export async function currentPort(): Promise<number> {
  return (await readServerInfo())?.port ?? envPort(process.env);
}

export async function sessionUrl(pk: string, id: string): Promise<string> {
  const info = await readServerInfo();
  const port = info?.port ?? envPort(process.env);
  const bind = info?.host ?? process.env.ROTISSERIE_HOST ?? '127.0.0.1';
  const host = bind === '127.0.0.1' || WILDCARD.has(bind) ? 'localhost' : urlHost(bind);
  return `http://${host}:${port}/s/${pk}/${id}?t=${await getToken()}`;
}

export function accessHints(env: NodeJS.ProcessEnv, port: number): string[] {
  const hints: string[] = [];
  const ssh = env.SSH_CONNECTION?.trim().split(/\s+/);
  const server = ssh?.[2];
  if (server) hints.push(`ssh -L ${port}:127.0.0.1:${port} ${env.USER ?? env.USERNAME ?? 'user'}@${server}`);
  const bind = env.ROTISSERIE_HOST;
  if (bind && !LOOPBACK.has(bind)) {
    const where = WILDCARD.has(bind) ? `on all network interfaces at port ${port}` : `at ${urlHost(bind)}:${port}`;
    hints.push(`The page is reachable from other machines ${where}; the token in the URL is the only protection, so share the link only with people you trust.`);
  }
  return hints;
}

export type OpenOptions = { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv; spawn?: typeof nodeSpawn };

/** Opens the URL in the default browser. Never throws. Skipped (false) when ROTISSERIE_NO_OPEN is set. */
export function openBrowser(url: string, o: OpenOptions = {}): Promise<boolean> {
  const env = o.env ?? process.env;
  const platform = o.platform ?? process.platform;
  const spawn = o.spawn ?? nodeSpawn;
  if (env.ROTISSERIE_NO_OPEN) return Promise.resolve(false);
  // cmd's `start` treats & as a command separator, so it is escaped as ^&. That is enough here: the
  // URL is generated internally (host, port, project key, session id, base64url token) and has no
  // spaces or quotes, so no other cmd metacharacter can appear in it.
  const [cmd, args] = ((): [string, string[]] => {
    if (platform === 'darwin') return ['open', [url]];
    if (platform === 'win32') return ['cmd', ['/c', 'start', '', url.replace(/&/g, '^&')]];
    if (env.WSL_DISTRO_NAME) return ['cmd.exe', ['/c', 'start', '', url.replace(/&/g, '^&')]];
    return ['xdg-open', [url]];
  })();
  return new Promise<boolean>((resolve) => {
    try {
      // windowsHide: no console window flashes up for cmd on Windows.
      const opts: SpawnOptions = { detached: true, stdio: 'ignore', windowsHide: true };
      const child = spawn(cmd, args, opts);
      child.once('error', () => resolve(false));
      child.once('spawn', () => { child.unref(); resolve(true); });
    } catch {
      resolve(false);
    }
  });
}
