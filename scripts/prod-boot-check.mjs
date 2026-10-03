// Обратный тест «пустого экрана»: собираем приложение ПРОД-бандлом (минификация,
// NODE_ENV=production — как это делает `npm run build`) и запускаем в jsdom с
// пустой базой, то есть ровно в ситуации первого запуска: профиля ещё нет.
//
// Зачем отдельный скрипт, а не строка в смоук-тесте: смоук-тест гоняет React в
// dev-режиме, где бесконечный цикл перерисовок выглядит как человекочитаемая
// ошибка. На проде React сворачивает её в «Minified React error #185» — а на
// GitHub Pages лежит именно прод-бандл. Проверять надо то, что видит ребёнок.
//
// Использование:
//   node scripts/prod-boot-check.mjs                # текущее рабочее дерево
//   node scripts/prod-boot-check.mjs --ref 8e62e13  # любой коммит из истории
//
// Выход: 0 — приложение отрисовалось, 1 — #root остался пустым.
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';
// fake-indexeddb/auto поднимает все IDB-глобали в Node: idb внутри бандла
// обращается к IDBRequest и прочим как к глобалям окна, и без полного набора
// попытка открыть базу падает с ReferenceError (см. ниже — это был «зелёный»
// прогон со сломанным хранилищем до появления экрана сбоя чтения).
import 'fake-indexeddb/auto';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const refIndex = args.indexOf('--ref');
const ref = refIndex >= 0 ? args[refIndex + 1] : null;

// ── 1. Исходники: рабочее дерево или указанный коммит ────────────────────────
let src = root;
let tmp = null;
if (ref) {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'slovo2-boot-'));
  src = path.join(tmp, 'tree');
  mkdirSync(src, { recursive: true });
  execSync(`git -C ${JSON.stringify(root)} archive ${ref} | tar -x -C ${JSON.stringify(src)}`, {
    shell: '/bin/bash',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // зависимости не копируем — берём те же, что стоят в проекте
  symlinkSync(path.join(root, 'node_modules'), path.join(src, 'node_modules'), 'dir');
}

// ── 2. Прод-бандл одним классическим скриптом (jsdom не умеет type="module") ──
const outfile = path.join(tmp ?? root, '.boot-check.js');
await build({
  absWorkingDir: src,
  entryPoints: [path.join(src, 'src/main.tsx')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2019',
  minify: true, // как в `vite build` — именно минификация даёт «error #185»
  outfile,
  logLevel: 'warning',
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env.BASE_URL': '"/slovo2/"',
    'import.meta.env.DEV': 'false',
    'import.meta.env.VITE_APP_VERSION': '"boot-check"',
    'import.meta.env.VITE_BUILD_SHA': '"boot-check"',
  },
  alias: { 'virtual:pwa-register': path.join(root, 'tests/pwa-stub.js') },
  plugins: [
    {
      name: 'ignore-css',
      setup(b) {
        b.onResolve({ filter: /\.css$/ }, (a) => ({ path: a.path, namespace: 'css-stub' }));
        b.onLoad({ filter: /.*/, namespace: 'css-stub' }, () => ({ contents: '', loader: 'js' }));
      },
    },
  ],
});

// ── 3. Запуск в jsdom: пустая база = первый запуск без профиля ────────────────

/**
 * Один прогон бандла в своём окне jsdom.
 *
 * @param breakStorage — эмуляция «хранилище недоступно»: приватный режим,
 *   блокировка после обновления системы, нехватка места. Раньше в этой ситуации
 *   приложение просто показывало «Кто будет учиться?» и первое же действие
 *   затирало старую запись; теперь обязано показать экран сбоя и не писать.
 */
async function runBundle({ breakStorage = false } = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push(String(e.detail ?? e.message ?? e)));
  virtualConsole.on('error', (...a) => errors.push(a.map(String).join(' ')));

  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost:4173/slovo2/',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    virtualConsole,
  });
  const w = dom.window;
  if (breakStorage) {
    w.indexedDB = {
      open() {
        throw new Error('IndexedDB недоступна');
      },
    };
  } else {
    // jsdom без IndexedDB — подставляем фейковую, как в tests/setup.ts
    w.indexedDB = indexedDB;
    w.IDBKeyRange = IDBKeyRange;
    for (const key of Object.getOwnPropertyNames(globalThis)) {
      if (key === 'indexedDB' || key.startsWith('IDB')) w[key] = globalThis[key];
    }
  }
  w.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });
  w.addEventListener('error', (e) => errors.push(String(e.error?.stack ?? e.message)));
  w.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason?.stack ?? e.reason)));

  // сам бандл исполняем внутри окна — так React берёт прод-сборку и jsdom-шный DOM
  w.eval(readFileSync(outfile, 'utf8'));

  // даём React доработать цикл: boot() ждёт rehydrate(), потом рисует
  await new Promise((r) => setTimeout(r, 2500));

  const rootEl = w.document.getElementById('root');
  return {
    errors,
    html: (rootEl?.innerHTML ?? '').trim(),
    text: (rootEl?.textContent ?? '').trim(),
  };
}

const first = await runBundle();
const broken = await runBundle({ breakStorage: true });

const report = (title, run, expectText) => {
  const saw = run.text.includes(expectText);
  console.log(`${title}: ${saw ? 'виден' : 'НЕ виден'}`);
  return saw;
};

const rootEl = first.html;
const sawProfileScreen = report('экран выбора ученика', first, 'Кто будет учиться');
const sawStorageScreen = report('экран сбоя при недоступном хранилище', broken, 'Прогресс не удалось открыть');
const allErrors = [...first.errors, ...broken.errors];
const saw185 = allErrors.join('\n').includes('#185') || allErrors.join('\n').includes('invariant=185');

console.log(`сборка:      ${ref ? `коммит ${ref}` : 'рабочее дерево'}${ref ? ` (${execSync(`git -C ${JSON.stringify(root)} log -1 --format=%s ${ref}`).toString().trim()})` : ''}`);
console.log(`#root пуст:  ${rootEl.length === 0 ? 'да' : `нет (${rootEl.length} символов)`}`);
if (allErrors.length) {
  console.log(`ошибок в консоли: ${allErrors.length}`);
  for (const e of [...new Set(allErrors)].slice(0, 4)) console.log(`  · ${e.split('\n')[0].slice(0, 300)}`);
} else {
  console.log('ошибок в консоли: 0');
}
console.log(`React #185 (бесконечный цикл перерисовок): ${saw185 ? 'есть' : 'нет'}`);

rmSync(outfile, { force: true });
if (tmp && existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });

const ok = rootEl.length > 0 && sawProfileScreen && sawStorageScreen && !saw185;
console.log(
  ok
    ? '\n✓ прод-бандл рисуется на первом запуске и не притворяется им при сбое хранилища'
    : '\n✗ прод-бандл показал пустой экран или перепутал сбой хранилища с первым запуском',
);
process.exit(ok ? 0 : 1);
