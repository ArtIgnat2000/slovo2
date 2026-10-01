// Картинки костюмных пазлов для ревью (как scripts/promo/make_slides.py для слайдов).
// Честный превью-рендер: тот же <Mascot>, что видит ребёнок (React→SVG), + растер @resvg/resvg-js.
// Запуск из корня репозитория: npm i --no-save @resvg/resvg-js && node scripts/promo/make_costumes.mjs
// Результат: docs/promo/2026-10-01/costumes-sheet.png и c-<id>.png (10 костюмов + «без костюма»).
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const outDir = process.env.OUT_DIR ?? path.join(root, 'docs/promo/2026-10-01');
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.join(root, 'scripts/promo/costume-cards.tsx')],
  bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', target: 'node20',
  outfile: path.join(root, 'scripts/promo/.out.mjs'), logLevel: 'warning',
  external: ['jsdom', 'fake-indexeddb'],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  define: {
    'import.meta.env.BASE_URL': '"/"', 'import.meta.env.DEV': 'true',
    'import.meta.env.VITE_APP_VERSION': '"preview"', 'import.meta.env.VITE_BUILD_SHA': '"preview"',
  },
  alias: { 'virtual:pwa-register': path.join(root, 'tests/pwa-stub.js') },
});
const r = spawnSync(process.execPath, [path.join(root, 'scripts/promo/.out.mjs')], {
  stdio: 'inherit', cwd: root, env: { ...process.env, OUT_DIR: outDir },
});
rmSync(path.join(root, 'scripts/promo/.out.mjs'), { force: true });
if (r.status !== 0) process.exit(r.status ?? 1);

// 2× зум — карточки читаются с телефона; DejaVu для русских подписей.
for (const f of readdirSync(outDir).filter((x) => x.endsWith('.svg'))) {
  const svg = readFileSync(path.join(outDir, f), 'utf8');
  const png = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: 2 },
    font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' },
    background: 'white',
  }).render().asPng();
  writeFileSync(path.join(outDir, f.replace(/\.svg$/, '.png')), png);
  console.log('png:', f.replace(/\.svg$/, '.png'), `${(png.length / 1024).toFixed(0)} KiB`);
}
