import path from 'node:path';
import { SessionNotFound } from '../core/store';
import { waitForUpdates } from './wait';

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main(argv: string[]): Promise<number> {
  const [cmd, id, ...rest] = argv;
  if (cmd !== 'wait' || !id || id.startsWith('--')) {
    process.stderr.write('usage: rotisserie wait <sessionId> [--dir <projectDir>] [--interval <ms>]\n');
    return 2;
  }
  const dir = path.resolve(flag(rest, '--dir') ?? process.cwd());
  const raw = flag(rest, '--interval');
  const intervalMs = raw === undefined ? 1000 : Number(raw);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    process.stderr.write(`invalid --interval: ${raw}\n`);
    return 2;
  }
  try {
    const result = await waitForUpdates(dir, id, { intervalMs });
    process.stdout.write(result === 'updates'
      ? `ROTISSERIE: updates ready for ${id}. Call get_updates.\n`
      : `ROTISSERIE: session ${id} is closed.\n`);
    return 0;
  } catch (e) {
    if (e instanceof SessionNotFound) {
      process.stderr.write(`ROTISSERIE: session ${id} not found in ${dir}\n`);
      return 2;
    }
    process.stderr.write(`ROTISSERIE: ${(e as Error).message}\n`);
    return 1;
  }
}

process.exitCode = await main(process.argv.slice(2));
