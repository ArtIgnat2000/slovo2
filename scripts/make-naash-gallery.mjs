// ── Плитки «полки идей» для приложения (0.74.0, docs/proposals/naash-shop.md) ─
//
// Берём готовые карточки серии (docs/merch/img/*.webp, 760×946 или 900×1120),
// вырезаем только предмет — без названия, полосы и палитры внизу карточки —
// и кладём его квадратом 600×600 на ту же кремовую бумагу, что у серии.
//
// Почему свои файлы, а не карточки целиком: в приложении плитка бывает 150 px
// шириной, и подпись, впечатанная в карточку, превратилась бы в грязь. Имена
// вещей в приложении набираются настоящим текстом (src/engine/naash.ts).
//
// Запуск: node scripts/make-naash-gallery.mjs
// Результат: public/naash/*.webp (12 файлов, ≈300 КБ) — вне precache PWA.

import sharp from 'sharp';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHOOL_IDEAS } from '../src/engine/naash.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'docs/merch/img');
const OUT = path.join(root, 'public/naash');

// Рамка предмета — в пикселях самой карточки. Два вида карточек серии:
//  • предметы и одежда — 760×946 (линейка с названием на y≈817, предмет выше);
//  • студийные кадры техники (растр, photoCard) — 900×1120 (кадр до y≈950,
//    линейка на y≈962).
// Метка «серия» и палитра живут в верхней полосе, поэтому кроп начинается ниже.
const BOX_GOODS = { x: 30, y: 85, w: 700, h: 725 };
const BOX_PHOTO = { x: 40, y: 100, w: 820, h: 855 };
const SIZE = 600;

/** Средний цвет угла карточки — это и есть бумага серии, без догадок. */
async function paperColor(input) {
  const { width, height } = await sharp(input).metadata();
  const { data, info } = await sharp(input)
    .extract({ left: 2, top: 2, width: Math.min(40, width - 4), height: Math.min(40, height - 4) })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let r = 0;
  let g = 0;
  let b = 0;
  const pixels = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  return { r: Math.round(r / pixels), g: Math.round(g / pixels), b: Math.round(b / pixels), alpha: 1 };
}

await mkdir(OUT, { recursive: true });
const files = await readdir(SRC);
let total = 0;

for (const idea of SCHOOL_IDEAS) {
  const file = `${idea.file}.webp`;
  if (!files.includes(file)) {
    console.error(`✗ нет исходной карточки ${file} в docs/merch/img — сначала npm run merch:art`);
    process.exit(1);
  }
  const src = path.join(SRC, file);
  const { width, height } = await sharp(src).metadata();
  const BOX = width === 900 ? BOX_PHOTO : BOX_GOODS;
  const background = await paperColor(src);

  const buf = await sharp(src)
    .extract({ left: BOX.x, top: BOX.y, width: BOX.w, height: BOX.h })
    .resize({ width: SIZE, height: SIZE, fit: 'contain', background })
    .flatten({ background })
    .webp({ quality: 72, effort: 6 })
    .toBuffer();

  const out = path.join(OUT, `${idea.file}.webp`);
  await sharp(buf).toFile(out);
  total += buf.length;
  console.log(`  ${idea.file}.webp  ${(buf.length / 1024).toFixed(0)} КБ`);
  void height;
}

console.log(`готово: ${SCHOOL_IDEAS.length} плиток в public/naash, ${(total / 1024).toFixed(0)} КБ`);
