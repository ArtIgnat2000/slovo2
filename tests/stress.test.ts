// Заморозка ударений банка (0.60.0).
//
// Ударения 257 слов заданы в контенте руками, и до сих пор их никто не
// сторожил: `content:check` проверяет, что ударение стоит на гласной и не
// спорит с «опасной» буквой, но НЕ проверяет, что оно стоит на той гласной.
// Сдвиг на соседнюю гласную проходил молча, а ребёнок учил слово с ошибкой.
//
// Здесь снимок `tests/stress-snapshot.ts` сверяется с контентом: любое
// расхождение — падение с читаемым сообщением, где видно оба варианта
// («ожидалось адрЕс, получено Адрес»). Заодно проверяется, что словарь
// известных ударений (для своих слов из списков) внутренне корректен.
import assert from 'node:assert/strict';
import { WORDS } from '../src/content/words';
import { KNOWN_STRESS, knownStress } from '../src/content/stress-dict';
import { STRESS_SNAPSHOT, STRESS_SNAPSHOT_SIZE } from './stress-snapshot';

/** Слово с заглавной ударной буквой — для сообщений и для чтения глазами. */
const marked = (text: string, stress: number) =>
  [...text].map((ch, i) => (i === stress ? ch.toUpperCase() : ch)).join('');

const VOWELS = 'аеёиоуыэюя';

// ── 1. Снимок и контент совпадают один-в-один ────────────────────────────────

assert.equal(
  WORDS.length,
  STRESS_SNAPSHOT_SIZE,
  `в банке ${WORDS.length} слов, а в снимке ударений ${STRESS_SNAPSHOT_SIZE} — обновите tests/stress-snapshot.ts`,
);

const snapshotKeys = Object.keys(STRESS_SNAPSHOT);
assert.equal(
  new Set(snapshotKeys).size,
  snapshotKeys.length,
  'в снимке ударений есть повторяющиеся слова',
);

for (const word of WORDS) {
  const expected = STRESS_SNAPSHOT[word.text];
  assert.notEqual(
    expected,
    undefined,
    `«${word.text}» нет в снимке ударений — добавьте строку в tests/stress-snapshot.ts`,
  );
  assert.equal(
    word.stress,
    expected,
    `«${word.text}»: ударение сдвинулось — ожидалось «${marked(word.text, expected!)}», ` +
      `в контенте «${marked(word.text, word.stress)}»`,
  );
}

// Лишние записи в снимке — тоже ошибка: слово переименовали или удалили.
const wordTexts = new Set(WORDS.map((w) => w.text));
for (const key of snapshotKeys) {
  assert.ok(
    wordTexts.has(key),
    `в снимке ударений лишнее слово «${key}» — его нет в контенте`,
  );
}

// ── 2. Ударение каждого слова стоит на гласной ───────────────────────────────

for (const word of WORDS) {
  const letter = word.text[word.stress];
  assert.ok(
    VOWELS.includes((letter ?? '').toLowerCase()),
    `«${word.text}»: ударение стоит на «${letter ?? '—'}», а не на гласной`,
  );
}

// ── 3. Словарь известных ударений (свои слова из списков) ────────────────────

const dictKeys = Object.keys(KNOWN_STRESS);
assert.ok(dictKeys.length >= 3, 'в словаре ударений должно быть минимум три слова');

for (const [key, index] of Object.entries(KNOWN_STRESS)) {
  assert.equal(
    key,
    key.toLowerCase().replace(/ё/g, 'е'),
    `«${key}»: ключ словаря должен быть в нижнем регистре и с «е» вместо «ё»`,
  );
  assert.ok(
    Number.isInteger(index) && index >= 0 && index < key.length,
    `«${key}»: индекс ударения ${index} вне слова`,
  );
  const letter = key[index];
  assert.ok(
    VOWELS.includes(letter),
    `«${key}»: ударение стоит на «${letter}», а не на гласной`,
  );
  assert.equal(
    knownStress(key),
    index,
    `«${key}»: knownStress возвращает не то значение`,
  );
  // Ё в ключе заменена на Е, но в реальном слове буква та же по позиции:
  // проверяем, что пометка читается («подлЕжащее», «прощАйте»).
  assert.ok(
    marked(key, index).includes(letter.toUpperCase()),
    `«${key}»: не удалось показать ударную букву`,
  );
}

// Школьные слова, из-за которых и появился словарь (0.59.1).
const expectedDict: Record<string, string> = {
  подлежащее: 'подлЕжащее',
  сказуемое: 'сказУемое',
  прощайте: 'прощАйте',
};
for (const [key, expected] of Object.entries(expectedDict)) {
  const index = KNOWN_STRESS[key];
  assert.notEqual(index, undefined, `в словаре нет «${key}»`);
  assert.equal(
    marked(key, index!),
    expected,
    `«${key}»: ожидалось «${expected}», получилось «${marked(key, index!)}»`,
  );
}

console.log(
  `✓ ударения: снимок из ${STRESS_SNAPSHOT_SIZE} слов совпадает с контентом; ` +
    `словарь известных ударений — ${dictKeys.length} слов (подлЕжащее, сказУемое, прощАйте и др.)`,
);
