// Рендер арта мерча: SVG-сцены → WebP в docs/merch/img.
//
//   node scripts/make-merch-art.mjs            # всё
//   node scripts/make-merch-art.mjs mark       # только знак и замки
//   node scripts/make-merch-art.mjs goods      # предметы
//   node scripts/make-merch-art.mjs vehicles   # техника в ливрее
//
// Нужен sharp (не в зависимостях приложения — это инструмент дизайн-партии):
//   npm i --no-save sharp
// Исходники — вектор в scripts/merch/*.mjs; в git идут только рендеры
// docs/merch/img/*.webp (по ~80–150 КБ), чтобы превью открывалось на телефоне.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = path.join(root, 'docs/merch/img');
mkdirSync(OUT, { recursive: true });

let sharpMod = null;
async function sharp() {
  if (!sharpMod) {
    try {
      sharpMod = (await import('sharp')).default;
    } catch {
      console.error(
        'Нет sharp. Поставьте инструмент дизайн-партии: npm i --no-save sharp',
      );
      process.exit(1);
    }
  }
  return sharpMod;
}

/** SVG-строка → WebP. width — итоговая ширина (рендер 2× для резкости). */
export async function shot(name, markup, width, { quality = 84, svgCopy = false } = {}) {
  const s = await sharp();
  const file = path.join(OUT, `${name}.webp`);
  await s(Buffer.from(markup)).resize({ width }).webp({ quality, effort: 5 }).toFile(file);
  if (svgCopy) writeFileSync(path.join(OUT, `${name}.svg`), markup);
  return file;
}

const group = process.argv[2] ?? 'all';
const { SHEETS } = await import('./merch/sheets.mjs');
const keys = group === 'all' ? Object.keys(SHEETS) : [group];
let n = 0;
for (const key of keys) {
  const sheet = SHEETS[key];
  if (!sheet) {
    console.error(`нет группы "${key}"; есть: ${Object.keys(SHEETS).join(', ')}`);
    process.exit(1);
  }
  const made = await sheet(shot);
  n += made.length;
  console.log(`${key}: ${made.length} шт.`);
}
console.log(`готово: ${n} рендеров в docs/merch/img`);
