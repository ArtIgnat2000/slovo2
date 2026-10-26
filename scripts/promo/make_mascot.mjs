// Сова БУК картинками для промо-слайдов: тот же <Mascot>, что видит ребёнок
// (React → SVG), + растр @resvg/resvg-js. Ничего не рисуем «по мотивам» —
// на слайдах должна быть настоящая сова приложения.
//
// Запуск из корня репозитория:
//   npm i --no-save @resvg/resvg-js
//   node scripts/promo/make_mascot.mjs [--out docs/promo/2026-10-26/assets]
//
// Результат: buk-<mood>.png — прозрачный фон, высота 480 px (2× от слайда).
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const argOut = process.argv.indexOf('--out');
const outDir = path.resolve(argOut > -1 ? process.argv[argOut + 1] : path.join(root, 'docs/promo/2026-10-26/assets'));
mkdirSync(outDir, { recursive: true });

const entry = path.join(root, '.tmp-art/mascot-export.tsx');
mkdirSync(path.dirname(entry), { recursive: true });
writeFileSync(entry, `// Временный вход сборки: рисует сову в SVG (создаётся make_mascot.mjs).
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'node:fs';
import { Mascot } from '../src/ui/Mascot';

const MOODS = ['idle', 'happy', 'excited', 'think'] as const;
const out = process.env.OUT_DIR!;
for (const mood of MOODS) {
  const html = renderToStaticMarkup(h(Mascot, { mood, stage: 3, size: 240 } as never));
  const svg = html.match(/<svg[\\s\\S]*?<\\/svg>/)?.[0];
  if (!svg) throw new Error('Mascot не отдал svg для ' + mood);
  // xmlns обязателен: resvg отказывается разбирать svg без корневого пространства имён.
  writeFileSync(
    out + '/buk-' + mood + '.svg',
    svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
      .replace(/ width="[^"]*"/, ' width="400"')
      .replace(/ height="[^"]*"/, ' height="480"'),
  );
}
`);

await build({
  entryPoints: [entry],
  bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', target: 'node20',
  outfile: path.join(root, 'scripts/promo/.out-mascot.mjs'), logLevel: 'warning',
  external: ['jsdom', 'fake-indexeddb'],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  define: {
    'import.meta.env.BASE_URL': '"/"', 'import.meta.env.DEV': 'true',
    'import.meta.env.VITE_APP_VERSION': '"preview"', 'import.meta.env.VITE_BUILD_SHA': '"preview"',
  },
  alias: { 'virtual:pwa-register': path.join(root, 'tests/pwa-stub.js') },
});
const r = spawnSync(process.execPath, [path.join(root, 'scripts/promo/.out-mascot.mjs')], {
  stdio: 'inherit', cwd: root, env: { ...process.env, OUT_DIR: outDir },
});
rmSync(path.join(root, 'scripts/promo/.out-mascot.mjs'), { force: true });
rmSync(entry, { force: true });
if (r.status !== 0) process.exit(r.status ?? 1);

const { Resvg } = await import('@resvg/resvg-js');
for (const f of readdirSync(outDir).filter((x) => x.endsWith('.svg'))) {
  const svg = readFileSync(path.join(outDir, f), 'utf8');
  const png = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: 2 },
    font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' },
  }).render().asPng();
  writeFileSync(path.join(outDir, f.replace(/\.svg$/, '.png')), png);
  rmSync(path.join(outDir, f), { force: true });
  console.log('png:', f.replace(/\.svg$/, '.png'), `${(png.length / 1024).toFixed(0)} KiB`);
}
