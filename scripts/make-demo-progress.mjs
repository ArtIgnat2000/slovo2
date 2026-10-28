#!/usr/bin/env node
// Генерация docs/promo/slovo2-demo-progress.json — файла формы родительской
// выгрузки { profiles, activeId, settings }, который грузится в пустую базу
// кнопкой «Загрузить файл». TS-логика в scripts/demo/* собирается esbuild'ом
// перед запуском (Node не импортирует TS без расширений, как это делает Vite).
//
// Запуск: npm run demo:progress
// Свой путь: DEMO_OUT=/tmp/demo.json npm run demo:progress
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.tmp-art');
const entry = path.join(out, 'demo-progress.mjs');

mkdirSync(out, { recursive: true });

const env = { ...process.env, DEMO_ROOT: root };

await build({
  entryPoints: [path.join(root, 'scripts/demo/main.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: entry,
  logLevel: 'warning',
});

const gen = spawnSync(process.execPath, [entry], { stdio: 'inherit', cwd: root, env });
if (gen.status !== 0) {
  rmSync(entry, { force: true });
  process.exit(gen.status ?? 1);
}

// Сквозная проверка настоящим стором: jsdom + fake-indexeddb + replaceAll.
const validateEntry = path.join(out, 'demo-validate.mjs');
await build({
  entryPoints: [path.join(root, 'scripts/demo/validate.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: validateEntry,
  logLevel: 'warning',
  // CJS-пакеты тестового окружения оставляем внешними (так же, как smoke.mjs):
  // втянутые в ESM-бандл, они падают на dynamic require.
  external: ['jsdom', 'fake-indexeddb'],
  alias: { 'virtual:pwa-register': path.join(root, 'tests/pwa-stub.js') },
});
const check = spawnSync(process.execPath, [validateEntry], { stdio: 'inherit', cwd: root, env });

rmSync(entry, { force: true });
rmSync(validateEntry, { force: true });
process.exit(check.status ?? 1);
