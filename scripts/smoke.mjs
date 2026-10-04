// Запуск смоук-теста: собираем tests/smoke.test.tsx в один файл (esbuild) и
// запускаем в Node с jsdom. Отдельная сборка нужна потому, что Node не умеет
// импортировать TS без расширений, как это делает Vite, и не знает
// виртуальный модуль PWA (его подменяет tests/pwa-stub.js).
import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// jsdom 30 не работает на Node младше 22.22 — проверяем сразу, иначе падение
// внутри библиотеки выглядит как загадочная ошибка (так и случилось в CI на Node 20)
const [maj, min, patch] = process.versions.node.split('.').map(Number);
const ok = maj > 22 || (maj === 22 && (min > 22 || (min === 22 && patch >= 2)));
if (!ok) {
  console.error(
    `✗ Смоук-тест требует Node ≥ 22.22.2 (сейчас ${process.versions.node}).\n` +
      '  Такой Node нужен jsdom 30: обновите Node или CI-workflow.',
  );
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.smoke'); // внутри проекта: бандл должен видеть node_modules
const entry = path.join(out, 'smoke.mjs');

mkdirSync(out, { recursive: true });

await build({
  entryPoints: [path.join(root, 'tests/smoke.test.tsx')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  target: 'node20',
  outfile: entry,
  logLevel: 'warning',
  external: ['jsdom', 'fake-indexeddb'],
  // Vite подставляет import.meta.env; в тесте задаём то же самое руками
  define: {
    'import.meta.env.BASE_URL': '"/"',
    'import.meta.env.DEV': 'true',
    'import.meta.env.VITE_APP_VERSION': '"test"',
    // Порог паузы помощника БУКа: в продукте 20 с, в тесте — 0,9 с (см. bukHelp.ts)
    'import.meta.env.VITE_BUK_NUDGE_MS': '"900"',
    'import.meta.env.VITE_BUILD_SHA': '"test"',
  },
  alias: { 'virtual:pwa-register': path.join(root, 'tests/pwa-stub.js') },
});

const res = spawnSync(process.execPath, [entry], { stdio: 'inherit', cwd: root });
rmSync(out, { recursive: true, force: true });
process.exit(res.status ?? 1);
