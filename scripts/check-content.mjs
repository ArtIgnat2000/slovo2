#!/usr/bin/env node
/**
 * Проверка контент-пака: ударение стоит на гласной, слоги складываются в слово,
 * «опасные» индексы существуют, в предложении есть пропуск.
 *
 * Запуск: npm run content:check
 */
import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'src/content/words.ts');
const src = fs.readFileSync(file, 'utf8');
const m = src.match(/const RAW = `([\s\S]*?)`/);
if (!m) {
  console.error('Не найден блок RAW в src/content/words.ts');
  process.exit(1);
}

const VOWELS = 'аеёиоуыэюя';
const rows = m[1]
  .trim()
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean);

let errors = 0;
const seen = new Set();

for (const row of rows) {
  const parts = row.split('|');
  const [text, stress, syll, danger, kind, emoji, sentence] = parts;
  const fail = (msg) => {
    console.error(`✗ ${text}: ${msg}`);
    errors++;
  };
  if (parts.length < 8) fail(`ожидалось 8 полей, получили ${parts.length}`);
  if (seen.has(text)) fail('слово повторяется');
  seen.add(text);

  if (!VOWELS.includes(text[Number(stress)] ?? '')) fail(`ударение (${stress}) стоит не на гласной`);

  const noSpaces = (x) => x.replace(/\s+/g, '');
  if (noSpaces(syll.split('-').join('')) !== noSpaces(text))
    fail(`слоги «${syll}» не складываются в «${text}»`);

  for (const d of danger.split(',').map(Number)) {
    if (Number.isNaN(d) || d < 0 || d >= text.length) fail(`опасный индекс ${d} вне слова`);
    const ch = text[d] ?? '';
    if (kind === 'vowel' && !VOWELS.includes(ch)) fail(` dangerous[${d}]='${ch}' — не гласная`);
  }
  if (!emoji) fail('нет эмодзи');
  if (!sentence || !sentence.includes('____')) fail('в предложении нет пропуска ____');
}

console.log(errors === 0 ? `✓ Контент в порядке: ${rows.length} слов` : `✗ Ошибок: ${errors}`);
process.exit(errors === 0 ? 0 : 1);
