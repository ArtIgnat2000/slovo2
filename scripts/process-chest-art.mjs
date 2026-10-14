// Сборка иллюстраций сундуков: images-src/chest-<облик>-<состояние>.png
//   → public/illustrations/chests/<облик>-<состояние>.webp
//
// Зачем отдельный скрипт. Сундуков стало несколько (облики-коллекция, см.
// src/engine/chests.ts), и у каждого два состояния — закрытый и открытый. Арт
// приходит из генератора на «зелёном экране»: снимаем фон (см.
// scripts/lib/chroma-key.mjs — проход по пикселям, а не заливка), обрезаем
// пустые поля и приводим картинки к одному холсту 512×512, чтобы в сцене
// открытия один облик не прыгал относительно другого.
//
// В репозиторий идут только готовые WebP (как и с картинками слов): исходники
// лежат в images-src/ и в git не попадают (см. .gitignore).
//
// Запуск: node scripts/process-chest-art.mjs   (нужен ImageMagick: convert/montage)

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { decodePng, encodePng, keyOutGreen } from './lib/chroma-key.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'images-src');
const out = path.join(root, 'public/illustrations/chests');
const sheetDir = path.join(root, 'docs');

/** Холст готовой картинки: одна сетка для всех обликов и состояний. */
const CANVAS = 512;
/** Поле от края: сцена даёт свою тень, поэтому арт не должен касаться рамки. */
const PADDING = 14;

mkdirSync(out, { recursive: true });

const sources = readdirSync(src).filter((f) => /^chest-[a-z]+-(closed|open)\.png$/.test(f)).sort();
if (!sources.length) {
  console.error('нет исходников images-src/chest-<облик>-<состояние>.png');
  process.exit(1);
}

let total = 0;
const done = [];
const stats = [];
for (const file of sources) {
  const key = file.replace(/^chest-/, '').replace(/\.png$/, '');
  const decoded = decodePng(readFileSync(path.join(src, file)));
  const keyed = keyOutGreen(decoded);
  const cut = path.join(src, `.cut-${key}.png`);
  writeFileSync(cut, encodePng(keyed));

  const inner = CANVAS - PADDING * 2;
  const target = path.join(out, `${key}.webp`);
  execFileSync('convert', [
    cut,
    '-trim', '+repage',
    '-resize', `${inner}x${inner}`,
    '-background', 'none',
    '-gravity', 'center',
    '-extent', `${CANVAS}x${CANVAS}`,
    '-strip',
    '-define', 'webp:alpha-quality=92',
    '-quality', '84',
    target,
  ]);
  execFileSync('rm', ['-f', cut]);

  const size = statSync(target).size;
  total += size;
  done.push({ key, size });
  stats.push({ key, ...keyed, keyBg: keyed.keyBg, t0: keyed.t0, t1: keyed.t1 });
  console.log(
    `  ${key.padEnd(14)} ${(size / 1024).toFixed(1).padStart(6)} КБ   ` +
      `фон=${keyed.keyBg} пороги ${keyed.t0}/${keyed.t1}`,
  );
}
console.log(`✓ обликов: ${done.length}, всего ${(total / 1024).toFixed(0)} КБ → public/illustrations/chests/`);

// Листы превью — глазами проверить, что фон снят чисто и облики не «пляшут»
// по размеру. Две подложки: тёмная (сцена открытия) и светлая (обычные экраны),
// чтобы ореол или серая кайма были видны в обоих режимах приложения.
for (const [name, background] of [
  ['chest-skins.png', '#3a3358'],
  ['chest-skins-light.png', '#fff8ec'],
]) {
  const sheet = path.join(sheetDir, name);
  execFileSync('montage', [
    ...done.map((d) => path.join(out, `${d.key}.webp`)),
    '-tile', '4x',
    '-geometry', '260x260+6+6',
    '-label', '%t',
    '-pointsize', '16',
    '-background', background,
    sheet,
  ]);
  console.log(`  лист превью: ${path.relative(root, sheet)}`);
}
if (total > 700 * 1024) {
  console.warn('⚠ картинки сундуков тяжелее 700 КБ — поднять сжатие (приложение офлайн, вес важен)');
}
if (stats.some((s) => s.t1 >= 150 || s.keyBg < 60)) {
  console.warn('⚠ у какого-то облика фон далёк от чистого зелёного — проверить лист превью');
}
