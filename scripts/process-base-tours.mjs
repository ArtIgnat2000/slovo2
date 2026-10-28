// Сборка картинок «внутри баз» и стимпанк-техники паровозной базы.
//
// 0.76.0: у каждой базы появилась экскурсия — фасад и пять комнат внутри
// (`src/engine/base-tours.ts`). Комнаты нарисованы фотореалистично (просили
// ультрареализм), поэтому здесь два разных конвейера:
//
//   1. Интерьеры — готовые PNG 1264×848 из генератора → WebP 1000×667 (3:2),
//      качество 78, метаданные вырезаются. Исходники лежат в
//      `images-src/base-tours/` и в git не попадают (см. .gitignore), в
//      репозиторий едут только оптимизированные WebP в `public/base-tours/`.
//      Эти файлы НЕ в precache PWA: их кладёт в кэш `slovo2-base-tours` при
//      первом просмотре (vite.config.ts).
//
//   2. Техника базы паровозов — рисунки на прозрачном фоне, как машины в
//      `scripts/make-car-images.mjs`: белый фон вырезается заливкой от углов,
//      рамка предмета обрезается, рисунок ставится на общее полотно так,
//      чтобы низ совпал с линией «пола» витрины. Машина — 720×480, самолёт —
//      1200×644, фасад базы — 1000×750 без альфы.
//
// Запуск: node scripts/process-base-tours.mjs   (нужен ImageMagick: `convert`)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tourSrc = path.join(root, 'images-src/base-tours');
const tourOut = path.join(root, 'public/base-tours');
const steamSrc = path.join(root, 'images-src/steam');

/** Интерьеры: 3:2, как в разметке (`width="1000" height="667"`). */
function buildTours() {
  if (!existsSync(tourSrc)) {
    console.log('· images-src/base-tours нет — пропускаем интерьеры');
    return;
  }
  mkdirSync(tourOut, { recursive: true });
  const files = readdirSync(tourSrc).filter((f) => f.endsWith('.png') && !f.startsWith('.'));
  let total = 0;
  for (const file of files) {
    const id = file.replace(/\.png$/, '');
    const target = path.join(tourOut, `${id}.webp`);
    execFileSync('convert', [
      path.join(tourSrc, file),
      '-resize', '1000x667^',
      '-gravity', 'center',
      '-extent', '1000x667',
      '-strip',
      '-quality', '78',
      target,
    ]);
    const size = statSync(target).size;
    total += size;
    console.log(`  ${id.padEnd(20)} ${(size / 1024).toFixed(1)} КБ`);
  }
  console.log(`✓ интерьеров: ${files.length}, всего ${(total / 1024).toFixed(0)} КБ`);
}

/** Вырезать белый фон заливкой от углов (как в scripts/make-car-images.mjs). */
function cutPaper(file, tmp) {
  execFileSync('convert', [
    file,
    '-alpha', 'on',
    '-fuzz', '14%',
    '-fill', 'none',
    '-draw', 'color 0,0 floodfill',
    tmp,
  ]);
  return tmp;
}

/** Рамка предмета по самой большой непрозрачной области. */
function subjectBox(file) {
  const report = execFileSync(
    'convert',
    [
      file,
      '-alpha', 'extract',
      '-threshold', '50%',
      '-define', 'connected-components:verbose=true',
      '-define', 'connected-components:area-threshold=100',
      '-connected-components', '8',
      'null:',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
  let best = null;
  for (const line of report.split('\n').slice(1)) {
    const m = line.match(/^\s*\d+:\s+(\d+)x(\d+)\+(\d+)\+(\d+)\s+\S+\s+(\d+)\s+gray\(255\)/);
    if (!m) continue;
    const area = Number(m[5]);
    if (!best || area > best.area) best = { w: +m[1], h: +m[2], x: +m[3], y: +m[4], area };
  }
  if (!best) throw new Error(`не нашёл предмет в ${file}`);
  return best;
}

/** Рисунок на прозрачном полотне: низ предмета — на общей линии «пола». */
function buildCutout(source, target, width, height, maxWidth, maxHeight, baseline) {
  const cut = `${source}.cut.png`;
  const trim = `${source}.trim.png`;
  cutPaper(source, cut);
  const box = subjectBox(cut);
  const margin = 6;
  execFileSync('convert', [
    cut,
    '-crop',
    `${box.w + margin * 2}x${box.h + margin * 2}+${Math.max(0, box.x - margin)}+${Math.max(0, box.y - margin)}`,
    '+repage',
    '-trim',
    '+repage',
    '-resize', `${maxWidth}x${maxHeight}>`,
    trim,
  ]);
  execFileSync('convert', [
    '-size', `${width}x${height}`, 'xc:none',
    '(', trim, '-channel', 'A', '-blur', '0x0.6', '+channel', ')',
    '-gravity', 'south',
    '-geometry', `+0+${height - baseline}`,
    '-composite',
    '-strip',
    '-define', 'webp:alpha-quality=92',
    '-quality', '76',
    target,
  ]);
  execFileSync('rm', ['-f', cut, trim]);
  const size = statSync(target).size;
  console.log(`  ${path.basename(target).padEnd(30)} ${(size / 1024).toFixed(1)} КБ`);
}

function buildSteam() {
  if (!existsSync(steamSrc)) {
    console.log('· images-src/steam нет — пропускаем стимпанк-технику');
    return;
  }
  const jobs = [
    // [файл, куда, ширина, высота, макс. рисунок, базовая линия]; base → без альфы.
    ['car-steam-base.png', 'public/cars/car-steam-base.webp', 720, 480, '676x404', 472],
    ['plane-steam-base.png', 'public/planes/plane-steam-base.webp', 1200, 644, '1120x560', 628],
  ];
  for (const [file, out, width, height, max, baseline] of jobs) {
    const source = path.join(steamSrc, file);
    if (!existsSync(source)) {
      console.log(`  · нет ${file} — пропускаем`);
      continue;
    }
    const [maxWidth, maxHeight] = max.split('x');
    buildCutout(source, path.join(root, out), width, height, Number(maxWidth), Number(maxHeight), baseline);
  }
  // Фасад базы: непрозрачная иллюстрация 4:3, как у остальных баз.
  const facade = path.join(steamSrc, 'steam-base.png');
  if (existsSync(facade)) {
    const target = path.join(root, 'public/buildings/steam-base.webp');
    execFileSync('convert', [
      facade,
      '-resize', '1000x750^',
      '-gravity', 'center',
      '-extent', '1000x750',
      '-strip',
      '-quality', '80',
      target,
    ]);
    console.log(`  ${path.basename(target).padEnd(30)} ${(statSync(target).size / 1024).toFixed(1)} КБ`);
  }
  // Крупные кадры кабины паровоза для CarTour (public/cars/<id>-interior.webp).
  for (const view of ['interior', 'dashboard']) {
    const source = path.join(steamSrc, `car-steam-base-${view}.png`);
    if (!existsSync(source)) {
      console.log(`  · нет car-steam-base-${view}.png — пропускаем`);
      continue;
    }
    const target = path.join(root, `public/cars/car-steam-base-${view}.webp`);
    execFileSync('convert', [
      source,
      '-resize', '1264x843^',
      '-gravity', 'center',
      '-extent', '1264x843',
      '-strip',
      '-quality', '78',
      target,
    ]);
    console.log(`  ${path.basename(target).padEnd(30)} ${(statSync(target).size / 1024).toFixed(1)} КБ`);
  }
}

buildTours();
buildSteam();
