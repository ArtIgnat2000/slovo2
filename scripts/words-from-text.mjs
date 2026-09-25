#!/usr/bin/env node
/**
 * Черновой импорт списка слов в формат контент-пака.
 *
 *   node scripts/words-from-text.mjs путь/к/spisok.txt > words.draft.txt
 *
 * На входе — просто список слов (по одному в строке или через запятую/пробел).
 * На выходе — строки контент-пака, где:
 *   • слоги расставлены автоматически;
 *   • ударение и «опасные» буквы помечены как AUTO — их нужно проверить вручную
 *     (или заменить скриптом, если ударения указаны знаком «'» после гласной).
 *
 * Подсказка: если в исходном списке ударение стоит (каранда'ш), скрипт его считает.
 */
import fs from 'node:fs';

const input = process.argv[2];
if (!input) {
  console.error('Укажите файл со списком слов');
  process.exit(1);
}

const VOWELS = 'аеёиоуыэюя';
const raw = fs.readFileSync(input, 'utf8');
const tokens = raw
  .replace(/\r/g, '')
  .split(/[\n,;]+/)
  .flatMap((line) => line.trim().split(/\s{2,}|\t/))
  .map((t) => t.trim())
  .filter(Boolean);

const words = [];
for (const tok of tokens) {
  // варианты: «каранда'ш», «карандаш», «каранда́ш» (ударение знаком акута)
  const m = tok.match(/^([а-яёА-ЯЁ']+?)\s*(\d+)?$/);
  const cleaned = tok.replace(/́/g, "'").trim();
  const accentIdx = cleaned.indexOf("'");
  const text = cleaned.replace(/'/g, '').toLowerCase();
  if (!text || !/^[а-яё]+$/.test(text)) continue;
  const stress = accentIdx >= 0 ? accentIdx - 1 : -1;
  void m;
  words.push({ text, stress });
}

function syllables(word) {
  const V = (c) => VOWELS.includes(c);
  const letters = word.split('');
  const vowelIdx = letters.map((c, i) => (V(c) ? i : -1)).filter((i) => i >= 0);
  if (vowelIdx.length === 0) return [word];
  if (vowelIdx.length === 1) return [word];

  const parts = [];
  let start = 0; // индекс, с которого начинается текущий слог
  for (let v = 0; v < vowelIdx.length; v++) {
    const vi = vowelIdx[v];
    if (v === 0) continue; // первый слог начинается с начала слова
    const clusterLen = vi - (vowelIdx[v - 1] + 1); // согласные между гласными
    // 1 согласный → следующему слогу (открытый слог); 2 и больше → первый остаётся в прошлом слоге
    const cut = vowelIdx[v - 1] + 1 + (clusterLen >= 2 ? 1 : 0);
    parts.push(word.slice(start, cut));
    start = cut;
  }
  parts.push(word.slice(start)); // остаток (последний слог с конечными согласными)
  return parts.filter(Boolean);
}

const lines = words.map(({ text, stress }) => {
  const syl = syllables(text);
  const danger = stress >= 0 ? text.split('').map((c, i) => (i !== stress && VOWELS.includes(c) ? i : -1)).filter((i) => i >= 0) : [];
  const st = stress >= 0 ? stress : 'AUTO';
  const dg = danger.length ? danger.slice(0, 2).join(',') : 'AUTO';
  return `${text}|${st}|${syl.join('-')}|${dg}|vowel|❔|Вставь предложение с пропуском ____.|пояснение|`;
});

console.log(lines.join('\n'));
console.error(`\nСлов: ${words.length}. Пометьте AUTO и ❔ вручную, затем перенесите блок в src/content/words.ts`);
