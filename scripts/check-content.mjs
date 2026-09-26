#!/usr/bin/env node
/**
 * Проверка контент-пака (npm run content:check).
 *
 * Проверяем не только разметку, но и смысловые ошибки, которые уже случались:
 *   • ударение стоит на гласной, слоги складываются в слово;
 *   • «опасная» буква — это НЕ ударная гласная (иначе подчёркнута не та буква);
 *   • все безударные гласные, которые слышатся иначе (о, е, я, э), отмечены как опасные;
 *   • тип слова (vowel / consonant / other) совпадает с отмеченными буквами;
 *   • мнемоника: «две С» — значит две, заглавная буква — это ударение или опасная буква,
 *     «мягкий знак на конце» — значит слово правда кончается на Ь;
 *   • подсказка есть у каждого слова и не «как?» / «когда?»;
 *   • в предложении есть пропуск ____ и в нём не подсвечен ответ.
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
const CONSONANTS = 'бвгджзйклмнпрстфхцчшщьъ';
/** Безударные гласные, которые читаются не так, как пишутся: их обязательно помечаем. */
const TRICKY = 'оеяэ';

const rows = m[1]
  .trim()
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean);

let errors = 0;
const seen = new Set();

const fail = (word, msg) => {
  console.error(`✗ ${word}: ${msg}`);
  errors++;
};

/** Числительные в мнемонике: «две С», «три О»… */
const NUM_WORDS = { один: 1, одна: 1, одну: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5 };
const NUM_NAMES = { 1: 'одна', 2: 'две', 3: 'три', 4: 'четыре', 5: 'пять' };

for (const row of rows) {
  const parts = row.split('|');
  const [text, stressRaw, syll, dangerRaw, kind, emoji, sentence, hint, mnemonic] = parts;
  const stress = Number(stressRaw);
  const letters = text.split('');
  const danger = dangerRaw.split(',').map(Number);

  if (parts.length !== 9)
    fail(text, `ожидалось 9 полей (слово|ударение|слоги|опасные|тип|эмодзи|предложение|подсказка|мнемоника), получили ${parts.length}`);
  if (seen.has(text)) fail(text, 'слово повторяется');
  seen.add(text);

  // ── разметка ───────────────────────────────────────────────────────────────
  if (!VOWELS.includes(text[stress] ?? '')) fail(text, `ударение (${stress}) стоит не на гласной`);
  const noSpaces = (x) => x.replace(/\s+/g, '');
  if (noSpaces(syll.split('-').join('')) !== noSpaces(text)) fail(text, `слоги «${syll}» не складываются в «${text}»`);
  if (!emoji) fail(text, 'нет эмодзи');
  if (!sentence || !sentence.includes('____')) fail(text, 'в предложении нет пропуска ____');
  else if (noSpaces(sentence.toLowerCase()).includes(noSpaces(text.toLowerCase())))
    fail(text, 'в предложении виден сам ответ — ребёнку нечего вспоминать');

  // ── подсказка ──────────────────────────────────────────────────────────────
  if (!hint || hint.trim().length < 4) fail(text, 'нет подсказки: в заданиях «напиши слово» непонятно, какое слово писать');
  else if (/^(как|когда|что|кто|где)\?$/.test(hint.trim()))
    fail(text, `подсказка «${hint}» не называет слово — её можно отнести к десятку слов`);

  // ── «опасные» буквы ────────────────────────────────────────────────────────
  const dangerChars = [];
  for (const d of danger) {
    if (Number.isNaN(d) || d < 0 || d >= text.length) fail(text, `опасный индекс ${d} вне слова`);
    const ch = letters[d] ?? '';
    dangerChars.push(ch);
    if (d === stress) fail(text, `опасной отмечена ударная гласная «${ch}» (${d}) — это не ошибка, а подсказка`);
    if (kind === 'vowel' && !VOWELS.includes(ch)) fail(text, `danger[${d}]='${ch}' — не гласная`);
    if (kind === 'consonant' && !CONSONANTS.includes(ch)) fail(text, `danger[${d}]='${ch}' — не согласная`);
  }
  if (kind === 'other' && dangerChars.length) {
    const hasVowel = dangerChars.some((c) => VOWELS.includes(c));
    const hasCons = dangerChars.some((c) => CONSONANTS.includes(c));
    if (!(hasVowel && hasCons)) fail(text, `тип «other», но отмечены только ${hasVowel ? 'гласные' : 'согласные'} — поставьте vowel или consonant`);
  }

  // все «коварные» безударные гласные должны быть помечены
  letters.forEach((ch, i) => {
    if (i !== stress && VOWELS.includes(ch) && TRICKY.includes(ch) && !danger.includes(i))
      fail(text, `безударная «${ch}» (${i}) не отмечена опасной, хотя слышится иначе`);
  });

  // ── мнемоника ──────────────────────────────────────────────────────────────
  if (mnemonic) {
    for (const [word, n] of Object.entries(NUM_WORDS)) {
      const hit = mnemonic.match(new RegExp(`\\b${word}\\s+([А-ЯЁа-яё])\\b`));
      if (!hit) continue;
      const letter = hit[1].toLowerCase();
      if (!/[а-яё]/.test(letter)) continue;
      const actual = letters.filter((c) => c === letter).length;
      if (actual !== n)
        fail(text, `мнемоника «${hit[0]}»: в слове ${actual} «${letter}», а не ${NUM_NAMES[n] ?? n}`);
    }
    if (/мягк(ий|ого) знак|на конце Ь/i.test(mnemonic) && letters[letters.length - 1] !== 'ь')
      fail(text, `мнемоника говорит про мягкий знак на конце, а слово кончается на «${letters[letters.length - 1]}»`);

    // заглавные буквы внутри слова в мнемонике = ударение и/или опасные буквы
    const at = mnemonic.toLowerCase().indexOf(text.toLowerCase());
    if (at >= 0) {
      // «Россия», «Москва» — заглавная на первом месте это просто имя собственное
      const proper = text[0] === text[0].toUpperCase();
      const caps = [];
      for (let i = 0; i < text.length; i++) {
        if (proper && i === 0) continue;
        const ch = mnemonic[at + i] ?? '';
        if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) caps.push(i);
      }
      if (caps.length) {
        if (!caps.includes(stress))
          fail(text, `в мнемонике заглавные ${caps.map((i) => i).join(',')} не включают ударную букву (${stress})`);
        for (const i of caps) {
          if (i !== stress && !danger.includes(i))
            fail(text, `в мнемонике подчёркнута «${letters[i]}» (${i}) — она и не ударная, и не опасная`);
        }
      }
    }
  }
}

console.log(
  errors === 0
    ? `✓ Контент в порядке: ${rows.length} слов (ударения, опасные буквы, мнемоники, подсказки)`
    : `✗ Ошибок: ${errors}`,
);
process.exit(errors === 0 ? 0 : 1);
