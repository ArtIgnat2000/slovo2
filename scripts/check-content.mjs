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
const notes = [];

const fail = (word, msg) => {
  console.error(`✗ ${word}: ${msg}`);
  errors++;
};

const warn = (word, msg) => notes.push(`${word}: ${msg}`);

/** Числительные в мнемонике: «две С», «три О»… */
const NUM_WORDS = { один: 1, одна: 1, одну: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5 };
const NUM_NAMES = { 1: 'одна', 2: 'две', 3: 'три', 4: 'четыре', 5: 'пять' };

// ── Падежи ───────────────────────────────────────────────────────────────────
// В пропуск подставляется словарная форма («завод»), поэтому предложение не должно
// требовать другой падеж: «Папа работает на ____» читается как «на завод» — ошибка.
// Такие фразы надо переписывать: «Наш ____ выпускает машины».

const PREPOSITIONS = new Set(
  'в во на за из от до для у к ко по с со над под перед о об про через без около при между'.split(' '),
);

/**
 * Исключения: после предлога падеж всё-таки совпадает со словарной формой.
 * Это проверено вручную, для каждого слова — свой предлог и объяснение.
 */
const PREPOSITION_OK = {
  'магазин': ['в'], // «Мама пошла в магазин» — винительный неодушевлённого совпадает с начальной формой
  'метро': ['на'], // «Мы поехали на метро» — слово не склоняется
  'стакан': ['в'], // «Налей воды в стакан» — винительный неодушевлённого совпадает с начальной формой
};

/** Слова, после которых идёт родительный падеж: «две ложки сахара». */
const GENITIVE_HEAD = new Set([
  'ложка', 'ложки', 'ложек', 'чашка', 'чашки', 'чашек', 'кусок', 'куска', 'мешок', 'мешка',
  'килограмм', 'килограмма', 'много', 'мало', 'немного', 'пара', 'пары', 'половина',
]);

/**
 * Окончания перед пропуском, которые требуют другого падежа существительного.
 * 'ь' на конце («грызёт сладкую морковь») — винительный падеж совпадает со словарной формой.
 */
const ADJ_CASE = [
  { re: /(ую|юю)$/, fits: (t) => /[ую]$/.test(t) || t.endsWith('ь'), name: 'винительный падеж женского рода' },
  { re: /ым$/, fits: () => false, name: 'творительный падеж' },
  { re: /(ому|ему)$/, fits: () => false, name: 'дательный падеж' },
  { re: /(ого|его)$/, fits: () => false, name: 'родительный падеж' },
];

/**
 * Окончания, по которым падеж однозначно не определить: «синим» — прилагательное,
 * а «учим», «открой» — глаголы. Такие случаи показываем как замечание для вычитки,
 * чтобы проверка не ругалась на верные предложения.
 */
const ADJ_CASE_REVIEW = [
  { re: /им$/, hint: 'творительный падеж прилагательного или глагол «учим/строим»' },
  { re: /(ой|ей)$/, hint: 'косвенный падеж прилагательного или глагол «открой/помой»' },
  { re: /(ою|ею)$/, hint: 'творительный или винительный падеж — проверьте форму существительного' },
];

/** Разобранные вручную замечания — сюда попадают только проверенные предложения. */
const CASE_REVIEW_OK = {
  'русский': '«Мы учим русский язык» — «учим» это глагол, а «русский» стоит в винительном, как и надо',
  'тетрадь': '«Открой тетрадь» — «открой» это глагол, а винительный падеж совпадает со словарной формой',
};

/**
 * Местоимения в винительном падеже женского рода: после них существительное обязано
 * стоять с окончанием -у/-ю (или быть на «ь»). «Напиши свою фамилию», не «своя фамилия».
 */
const ACC_FEM_PRONOUNS = new Set([
  'свою', 'мою', 'твою', 'нашу', 'вашу', 'эту', 'ту', 'всю', 'одну', 'саму', 'какую', 'любую', 'каждую',
]);

/**
 * Несклоняемые слова и этикетные формулы: у них любая форма совпадает со словарной,
 * поэтому падеж по соседним словам не проверяем.
 */
const NO_DECLENSION = new Set([
  'до свидания', 'здравствуйте', 'извините', 'спасибо', 'пожалуйста', 'прощай', 'метро', 'пальто',
]);

/** Союзы и частицы: они ничего не требуют от падежа. */
const PARTICLES = new Set(['и', 'а', 'но', 'да', 'или', 'либо', 'не', 'ни', 'же', 'бы', 'ли', 'то', 'уж']);

/** Слова-поводы, после которых существительное идёт в винительном (вопрос «что?»). */
const ACCUSATIVE_HEADS = new Set(['пожалуйста', 'возьми', 'возьмите', 'помой', 'напиши', 'прочитай', 'повтори']);

/** Местоимения и служебные слова: падеж по ним не проверяем — «мой отец» это именительный. */
const PRONOUNS = new Set([
  'мой', 'моя', 'моё', 'мое', 'мои', 'твой', 'твоя', 'твои', 'свой', 'своя', 'свои',
  'чей', 'чья', 'чьи', 'наш', 'наша', 'наше', 'наши', 'ваш', 'ваша', 'ваше', 'ваши',
  'этот', 'эта', 'это', 'эти', 'тот', 'та', 'то', 'те', 'весь', 'вся', 'всё', 'все', 'сам', 'сама',
]);

/** Последнее слово перед пропуском. */
function wordBeforeGap(sentence) {
  const at = sentence.indexOf('____');
  const before = sentence.slice(0, at).trim();
  if (!before) return '';
  const m = before.match(/([А-Яа-яЁё]+)[^А-Яа-яЁё]*$/);
  return m ? m[1] : '';
}

function checkCase(text, sentence, fail, warn) {
  if (NO_DECLENSION.has(text)) return;
  const prev = wordBeforeGap(sentence).toLowerCase();
  if (!prev || PRONOUNS.has(prev)) return;

  if (PREPOSITIONS.has(prev)) {
    const allowed = PREPOSITION_OK[text] ?? [];
    if (!allowed.includes(prev))
      fail(text, `пропуск идёт после предлога «${prev}», а вставляется словарная форма «${text}» — нужно другое предложение`);
    return;
  }

  if (GENITIVE_HEAD.has(prev)) {
    fail(text, `после «${prev}» нужен родительный падеж, а вставляется «${text}» — перепишите предложение`);
    return;
  }

  // «Напиши свою ____»: после местоимения в винительном падеже нужна форма на -у/-ю или «ь»
  if (ACC_FEM_PRONOUNS.has(prev) && !/[уюь]$/.test(text)) {
    fail(text, `после «${prev}» нужен винительный падеж, а вставляется словарная форма «${text}»`);
    return;
  }

  // «Возьми ____»: императив или глагол на -и требует винительный, а не начальную форму на -а/-я
  if ((ACCUSATIVE_HEADS.has(prev) || (prev.endsWith('и') && !PARTICLES.has(prev))) && /[ая]$/.test(text)) {
    fail(text, `после «${prev}» нужен винительный падеж, а вставляется словарная форма «${text}» (окончание -а/-я)`);
    return;
  }

  for (const rule of ADJ_CASE) {
    if (!rule.re.test(prev)) continue;
    if (rule.fits(text)) return;
    fail(text, `перед пропуском слово «${prev}» (${rule.name}), а вставляется словарная форма «${text}»`);
    return;
  }

  if (CASE_REVIEW_OK[text]) return;
  if (ACCUSATIVE_HEADS.has(prev) && /[ая]$/.test(text)) {
    warn(text, `проверьте падеж: перед пропуском «${prev}», обычно нужен винительный падеж`);
    return;
  }

  for (const rule of ADJ_CASE_REVIEW) {
    if (!rule.re.test(prev)) continue;
    warn(text, `проверьте падеж: перед пропуском «${prev}» (${rule.hint})`);
    return;
  }
}

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
  else {
    if (sentence.split('____').length !== 2) fail(text, 'в предложении должно быть ровно один пропуск ____');
    if (noSpaces(sentence.toLowerCase()).includes(noSpaces(text.toLowerCase())))
      fail(text, 'в предложении виден сам ответ — ребёнку нечего вспоминать');
    checkCase(text, sentence, fail, warn);
  }

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

if (notes.length) {
  console.log('⚠ К вычитке вручную:');
  for (const n of notes) console.log(`   ${n}`);
}

console.log(
  errors === 0
    ? `✓ Контент в порядке: ${rows.length} слов (ударения, опасные буквы, падежи, мнемоники, подсказки)`
    : `✗ Ошибок: ${errors}`,
);
process.exit(errors === 0 ? 0 : 1);
