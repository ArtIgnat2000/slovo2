#!/usr/bin/env node
/**
 * Распознавание списка слов со скана/фото (tesseract.js, языки rus+eng).
 *
 *   node scripts/ocr-words.mjs путь/к/скан.png
 *   node scripts/ocr-words.mjs https://.../image.png      (файл скачается сам)
 *
 * Печатает распознанный текст и тут же — черновые строки контент-пака.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createWorker } from 'tesseract.js';
import { fileURLToPath } from 'node:url';

// CDN в этой песочнице недоступен — используем локальные файлы.
const here = path.dirname(fileURLToPath(import.meta.url));
const NODE_MODULES = path.resolve(here, '../node_modules');
const LOCAL = {
  // workerPath для Node задавать нельзя — там используется отдельный node-воркер
  corePath: path.join(NODE_MODULES, 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js'),
  langPath: process.env.TESSDATA_DIR || path.resolve(here, '../../.tools/tessdata'),
};

const src = process.argv[2];
if (!src) {
  console.error('Укажите путь к изображению или URL');
  process.exit(1);
}

let file = src;
if (/^https?:\/\//.test(src)) {
  const res = await fetch(src);
  if (!res.ok) {
    console.error('Не удалось скачать изображение:', res.status);
    process.exit(1);
  }
  file = path.join(os.tmpdir(), `ocr-${Date.now()}.png`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

console.error(`▸ Распознаю (модели: ${LOCAL.langPath})...`);
const worker = await createWorker(['rus'], 1, { ...LOCAL, gzip: false, lstmOnly: true, cacheMethod: 'none' });
const { data } = await worker.recognize(file);
await worker.terminate();

console.error(`▸ Уверенность: ${Math.round(data.confidence)}%`);
const text = data.text;
console.log('----- РАСПОЗНАННЫЙ ТЕКСТ -----');
console.log(text);
console.log('----- СЛОВА -----');

const VOWELS = 'аеёиоуыэюя';
const tokens = text
  .replace(/\r/g, '')
  .split(/\s+/)
  .map((t) => t.trim())
  .filter(Boolean);

const words = [];
for (let t of tokens) {
  let clean = t.replace(/[^а-яёА-ЯЁ́']/gi, '').toLowerCase();
  if (!clean) continue;
  // исправляем типичные ошибки распознавания
  clean = clean.replace(/[́`´]/g, "'");
  const stress = clean.indexOf("'");
  const text0 = clean.replace(/'/g, '');
  if (text0.length < 3 || ![...text0].some((c) => VOWELS.includes(c))) continue;
  if (!/^[а-яё]+$/.test(text0)) continue;
  words.push({ text: text0, stress: stress >= 0 ? stress - 1 : -1 });
}

console.log(words.map((w) => w.text).join('\n'));
console.error(`\nНайдено слов: ${words.length}. Проверьте список глазами и отдайте мне на разметку.`);
