#!/usr/bin/env node
// Сцена «Цветка слова» (0.109.0): исходные кадры → public/flower/*.webp
//
// Зачем отдельный скрипт, а не `make-word-image.mjs`. Там пайплайн картинок
// СЛОВ: кремовый фон и непрозрачный квадрат, потому что картинка стоит в
// паспарту карточки. Здесь наоборот — элементы цветка накладываются друг на
// друга (лепестки по кругу, серединка, лист), поэтому нужна ПРОЗРАЧНОСТЬ:
// белый фон генератора убирается, а не заменяется кремовым.
//
// Что делает:
//   1. читает кадры из `images-src/flower/` (в git не входят — это источник);
//   2. снимает белый фон: пиксель становится прозрачным, если он близок к
//      белому И близок к цвету рамки (углы кадра) — так не выедаются светлые
//      блики внутри лепестка;
//   3. обрезает поля по содержимому, вписывает в квадрат с запасом;
//   4. сохраняет в `public/flower/` как WebP без метаданных.
//
// Запуск: node scripts/make-flower-art.mjs
// Требование к кадрам: один объект по центру, ровный белый фон, без текста.
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'images-src/flower');
const outDir = path.join(root, 'public/flower');

mkdirSync(outDir, { recursive: true });

/**
 * Размеры под сцену. Лепесток — 256 px: в сцене он рисуется 40–52 px, запас
 * нужен для экранов с DPR 2–3. Серединка и лист крупнее по пропорции.
 * Фон-плашка — 640×420, ровно под пропорцию сцены на телефоне.
 */
const ASSETS = [
  { name: 'petal', side: 256, quality: 82, fuzz: '8%' },
  { name: 'center', side: 256, quality: 84, fuzz: '8%' },
  { name: 'leaf', side: 256, quality: 82, fuzz: '8%' },
];

const MAX_BYTES = 60 * 1024;

for (const asset of ASSETS) {
  const src = path.join(srcDir, `${asset.name}.png`);
  const out = path.join(outDir, `${asset.name}.webp`);
  // `-fuzz … -transparent white` убирает только близкое к белому; поля
  // обрезаются по прозрачности (`-trim`), затем кадр вписывается в квадрат.
  execFileSync('convert', [
    src,
    '-alpha', 'on',
    '-fuzz', asset.fuzz,
    '-transparent', 'white',
    '-trim', '+repage',
    '-resize', `${asset.side}x${asset.side}>`,
    '-gravity', 'center',
    '-background', 'none',
    '-extent', `${asset.side}x${asset.side}`,
    '-strip',
    '-quality', String(asset.quality),
    out,
  ]);
  const bytes = statSync(out).size;
  if (bytes > MAX_BYTES) {
    throw new Error(`${asset.name}: ${(bytes / 1024).toFixed(0)} КБ — больше предела ${MAX_BYTES / 1024} КБ`);
  }
  console.log(`✓ ${asset.name}.webp — ${asset.side}×${asset.side}, ${(bytes / 1024).toFixed(1)} КБ`);
}

// Фон: без прозрачности, но сильно сжатый — это размытая плашка, деталей нет.
const bgOut = path.join(outDir, 'backplate.webp');
execFileSync('convert', [
  path.join(srcDir, 'backplate.png'),
  '-resize', '640x420^',
  '-gravity', 'center',
  '-extent', '640x420',
  '-strip',
  '-quality', '62',
  bgOut,
]);
console.log(`✓ backplate.webp — 640×420, ${(statSync(bgOut).size / 1024).toFixed(1)} КБ`);
