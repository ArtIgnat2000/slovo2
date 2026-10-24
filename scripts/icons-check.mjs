// Стенд «UI-иконки» (0.54.0): сборка tests/icons.main.tsx
// через esbuild и запуск в Node с jsdom. Приложение целиком не рендерим:
// проверяются правила набора (docs/proposals/ui-icons.md §4) — разметка SVG,
// доступность, бюджет веса и отсутствие функциональных эмодзи в заменённых
// местах.
import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const [maj, min, patch] = process.versions.node.split('.').map(Number);
const ok = maj > 22 || (maj === 22 && (min > 22 || (min === 22 && patch >= 2)));
if (!ok) {
  console.error(`✗ стенд требует Node ≥ 22.22.2 (сейчас ${process.versions.node})`);
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.icons');
const entry = path.join(out, 'main.mjs');
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [path.join(root, 'tests/icons.main.tsx')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  target: 'node20',
  outfile: entry,
  logLevel: 'warning',
  external: ['jsdom', 'fake-indexeddb'],
  define: {
    'import.meta.env': JSON.stringify({
      BASE_URL: '/',
      MODE: 'test',
      DEV: true,
      PROD: false,
      VITE_APP_VERSION: 'test',
      VITE_BUILD_SHA: 'test',
      VITE_BUK_NUDGE_MS: '900',
      VITE_PUBLIC_URL: 'https://artignat2000.github.io/slovo2/',
    }),
  },
  alias: { 'virtual:pwa-register': path.join(root, 'tests/pwa-stub.js') },
});

const res = spawnSync(process.execPath, [entry], { stdio: 'inherit', cwd: root });
rmSync(out, { recursive: true, force: true });
process.exit(res.status ?? 1);
