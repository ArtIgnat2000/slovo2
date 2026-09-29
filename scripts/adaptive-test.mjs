import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const dir = mkdtempSync(join(tmpdir(), 'slovo-adaptive-'));
try {
  const outfile = join(dir, 'test.mjs');
  await build({ entryPoints: ['tests/adaptive.test.ts'], outfile, bundle: true, platform: 'node', format: 'esm' });
  const result = spawnSync(process.execPath, [outfile], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally { rmSync(dir, { recursive: true, force: true }); }
