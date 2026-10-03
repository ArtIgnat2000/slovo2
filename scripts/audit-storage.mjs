// Прогон аудита хранилища прогресса: собираем tests/storage-audit.probe.tsx
// в один файл (esbuild) и запускаем в Node с jsdom + fake-indexeddb — ровно так
// же, как scripts/smoke.mjs, только без проверок на выход: прогон описывает
// текущее поведение, а не требует зелёного результата.
import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.smoke');
const entry = path.join(out, 'storage-audit.mjs');

mkdirSync(out, { recursive: true });

await build({
  entryPoints: [path.join(root, 'tests/storage-audit.probe.tsx')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  target: 'node20',
  outfile: entry,
  logLevel: 'warning',
  external: ['jsdom', 'fake-indexeddb'],
  define: {
    'import.meta.env.BASE_URL': '"/"',
    'import.meta.env.DEV': 'true',
    'import.meta.env.VITE_APP_VERSION': '"test"',
    'import.meta.env.VITE_BUILD_SHA': '"test"',
  },
  alias: { 'virtual:pwa-register': path.join(root, 'tests/pwa-stub.js') },
});

const res = spawnSync(process.execPath, [entry], { stdio: 'inherit', cwd: root });
rmSync(out, { recursive: true, force: true });
process.exit(res.status ?? 1);
