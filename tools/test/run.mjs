/**
 * Unit tests without Minecraft: bundle each test entry with @minecraft/server
 * (and gametest) aliased to in-memory stubs, then run the bundles.
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const outDir = path.join(root, 'dist', 'tests');
fs.mkdirSync(outDir, { recursive: true });

const entries = ['sites.test.ts', 'bots.test.ts', 'registry.test.ts', 'actions.test.ts', 'codemod.test.ts'];
let failures = 0;

for (const entry of entries) {
  const outfile = path.join(outDir, entry.replace('.ts', '.mjs'));
  await build({
    entryPoints: [path.join(root, 'tools/test', entry)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: entry.startsWith('codemod') ? 'node' : 'neutral',
    target: 'es2022',
    alias: {
      '@minecraft/server': path.join(root, 'tools/test/stub-server.ts'),
      '@minecraft/server-ui': path.join(root, 'tools/test/stub-server-ui.ts'),
      '@minecraft/server-gametest': path.join(root, 'tools/test/stub-gametest.ts'),
    },
    logLevel: 'warning',
  });
  try {
    await import(pathToFileURL(outfile).href + '?t=' + Date.now());
  } catch (e) {
    failures++;
    console.error(`${entry} threw: ${e?.stack ?? e}`);
  }
}

if (failures > 0) process.exitCode = 1;
