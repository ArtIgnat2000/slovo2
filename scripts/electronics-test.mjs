import { build } from 'esbuild';
import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const outfile = '.electronics-test.mjs';
try {
  await build({
    entryPoints: ['tests/electronics-art.test.tsx'], bundle: true,
    platform: 'node', format: 'esm', jsx: 'automatic', outfile,
    external: ['react', 'react-dom/server'],
    define: { 'import.meta.env.BASE_URL': JSON.stringify('/slovo2/') },
  });
  const result = spawnSync(process.execPath, [outfile], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(outfile, { force: true });
}
