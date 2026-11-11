import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...s) => path.join(root, ...s);

for (const entry of ['src/mcp/main.ts', 'src/cli/main.ts', 'web/src/main.tsx', 'web/index.html']) {
  if (!existsSync(p(entry))) {
    console.error(`build failed: required entry point ${entry} is missing`);
    process.exit(1);
  }
}

await rm(p('dist'), { recursive: true, force: true });
await mkdir(p('dist', 'web'), { recursive: true });

const node = { platform: 'node', bundle: true, format: 'esm', target: 'node20', logLevel: 'info' };
const banner = { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" };

for (const [entry, out] of [['src/mcp/main.ts', 'dist/mcp.js'], ['src/cli/main.ts', 'dist/cli.js']]) {
  await build({ ...node, banner, entryPoints: [p(entry)], outfile: p(out) });
}

await build({
  platform: 'browser', bundle: true, format: 'esm', target: 'es2022', logLevel: 'info',
  jsx: 'automatic', jsxImportSource: 'preact', loader: { '.woff2': 'file', '.woff': 'file' },
  entryPoints: [p('web/src/main.tsx')], outdir: p('dist/web'), entryNames: 'app', assetNames: 'assets/[name]',
});

await cp(p('web/index.html'), p('dist/web/index.html'));
if (existsSync(p('web/assets'))) await cp(p('web/assets'), p('dist/web/assets'), { recursive: true });
