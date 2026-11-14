/**
 * «Тропа слов» (0.110.0): чистый движок без DOM.
 *
 * Проверяем то, что ребёнок увидит глазами: остановки 2 класса, дорогу из
 * букв, мост из слогов, шаг по плите, честный санитайзер прогресса и
 * продолжение с того же места после перезапуска.
 */
import assert from 'node:assert/strict';
import { LESSONS_BY_GRADE, WORD_BY_ID, WORDS } from '../src/content/words';
import {
  buildTrail,
  EMPTY_TRAIL,
  normalizeTrail,
  TRAIL_MAX_LETTERS,
  TRAIL_STOPS_MVP,
  TRAIL_WORDS_PER_STOP,
  trailFits,
  trailModeFor,
  trailResume,
  trailStep,
  trailStops,
  trailSummary,
  withTrailStop,
  withTrailWord,
} from '../src/engine/word-trail';
import type { Word } from '../src/types';

const word = (over: Partial<Word>): Word => ({
  id: 'test',
  text: 'слово',
  syllables: ['сло', 'во'],
  stress: 1,
  danger: [],
  hint: 'подсказка',
  sentence: 'Это ____.',
  emoji: '🧪',
  grades: [2],
  theme: 'test',
  ...over,
});

// ── 1. Остановки класса ─────────────────────────────────────────────────────
const stops = trailStops(2);
assert.equal(stops.length, TRAIL_STOPS_MVP, '2 класс: в MVP две остановки');
assert.deepEqual(stops.map((s) => s.id), ['school', 'birds'], 'остановки — «Школа» и «Птицы»');
assert.deepEqual(stops.map((s) => s.title), ['Школа', 'Птицы'], 'названия остановок');
assert.ok(stops.every((s) => s.wordIds.length <= TRAIL_WORDS_PER_STOP), 'в остановке не больше четырёх слов');
assert.ok(stops.every((s) => s.wordIds.length >= 2), 'в остановке хотя бы два слова');
assert.ok(stops.every((s) => s.wordIds.every((id) => !!WORD_BY_ID[id])), 'все слова остановки есть в банке');
assert.equal(stops[0].wordIds[0], 'g2_алфавит', 'первым стоит слово с опасной буквой');
assert.equal(stops[0].wordIds[1], 'g2_карандаш', 'вторым — слово из слогов');
assert.equal(trailModeFor(WORD_BY_ID[stops[0].wordIds[0]], 0), 'letters', 'первое задание — буквы');
assert.equal(trailModeFor(WORD_BY_ID[stops[0].wordIds[1]], 1), 'syllables', 'второе задание — слоги');
assert.equal(trailModeFor(WORD_BY_ID['g2_класс'], 1), 'letters', 'односложное слово остаётся буквенным');

const allStops = trailStops(2, { limit: 0 });
assert.equal(allStops.length, LESSONS_BY_GRADE[2].length, 'без лимита — все уроки 2 класса');
assert.ok(allStops.every((s) => s.wordIds.length >= 2 && s.wordIds.length <= TRAIL_WORDS_PER_STOP), 'каждая остановка 2–4 слова');

// ── 2. Какие слова годятся ──────────────────────────────────────────────────
assert.equal(trailFits(word({ text: 'алфавит', danger: [0] })), true, 'обычное слово с опасной буквой годится');
assert.equal(trailFits(word({ text: 'сло во', danger: [0] })), false, 'фраза не годится');
assert.equal(trailFits(word({ text: 'кое-как', danger: [0] })), false, 'дефис не годится');
assert.equal(trailFits(word({ text: 'да', danger: [0] })), false, 'короче трёх букв не годится');
assert.equal(trailFits(word({ text: 'я'.repeat(TRAIL_MAX_LETTERS + 1), danger: [0] })), false, 'длиннее предела не годится');
assert.equal(trailFits(word({ text: 'крот', syllables: ['крот'], danger: [] })), false, 'без опасной буквы и без слогов нечего чинить');
assert.equal(trailFits(word({ text: 'крот', syllables: ['крот'], danger: [2] })), true, 'опасная буква делает слово пригодным');

const phrase = WORDS.find((w) => w.text.includes(' '));
assert.ok(phrase, 'в банке есть фраза для проверки');
assert.equal(trailFits(phrase!), false, 'фраза из банка отсеивается');

// ── 3. Дорога из букв ───────────────────────────────────────────────────────
const abc = WORD_BY_ID['g2_алфавит'];
assert.ok(abc, 'слово «алфавит» на месте');
const letters = buildTrail(abc!, 'letters', 3, () => 0.42);
assert.equal(letters.mode, 'letters', 'режим букв');
assert.deepEqual(letters.segments, [...abc!.text], 'дорога — все буквы слова');
assert.equal(letters.dangerIndex, 3, 'закрыта выбранная опасная буква');
assert.equal(letters.answer, [...abc!.text][3], 'ответ — буква под индексом');
assert.equal(letters.options.length, 4, 'четыре варианта');
assert.equal(new Set(letters.options).size, 4, 'варианты без повторов');
assert.ok(letters.options.includes(letters.answer), 'среди вариантов есть верная буква');
const fallback = buildTrail(abc!, 'letters', 99, () => 0.42);
assert.ok(fallback.dangerIndex === abc!.danger[0], 'индекс вне слова откатывается к первой опасной букве');
assert.ok(fallback.options.includes(fallback.answer), 'и там есть верный вариант');

// ── 4. Мост из слогов ───────────────────────────────────────────────────────
const pencil = WORD_BY_ID['g2_карандаш'];
assert.ok(pencil, 'слово «карандаш» на месте');
const syll = buildTrail(pencil!, 'syllables');
assert.equal(syll.mode, 'syllables', 'режим слогов');
assert.deepEqual(syll.segments, ['ка', 'ран', 'даш'], 'мост — слоги по порядку');
assert.equal(syll.dangerIndex, -1, 'у слогов нет закрытой буквы');
assert.equal(syll.answer, '', 'у слогов нет буквенного ответа');
assert.deepEqual(syll.options, [], 'у слогов нет вариантов буквы');

// ── 5. Шаг по плите ─────────────────────────────────────────────────────────
assert.equal(trailStep(0, 7, 0), 'next', 'первая плита — шаг');
assert.equal(trailStep(0, 7, 3), 'again', 'не та плита — герой стоит');
assert.equal(trailStep(6, 7, 6), 'next', 'последняя плита — шаг');
assert.equal(trailStep(7, 7, 7), 'done', 'после последней — готово');
assert.equal(trailStep(2, 7, 1), 'again', 'назад по дороге не шагаем');

// ── 6. Санитайзер прогресса ─────────────────────────────────────────────────
assert.deepEqual(normalizeTrail(null), EMPTY_TRAIL, 'пустое значение — пустая тропа');
assert.deepEqual(normalizeTrail('мусор'), EMPTY_TRAIL, 'строка — пустая тропа');
assert.deepEqual(normalizeTrail([]), EMPTY_TRAIL, 'массив — пустая тропа');
const fixed = normalizeTrail({ stop: 2.9, words: ['g2_алфавит', 'g2_алфавит', 3, '', 'g2_карандаш'], cards: ['school', 'school'] });
assert.equal(fixed.stop, 2, 'дробный stop округляется вниз');
assert.deepEqual(fixed.words, ['g2_алфавит', 'g2_карандаш'], 'words без мусора и повторов');
assert.deepEqual(fixed.cards, ['school'], 'cards без повторов');
assert.equal(normalizeTrail({ stop: -5 }).stop, 0, 'отрицательный stop — ноль');
assert.equal(normalizeTrail({ stop: Infinity }).stop, 0, 'бесконечность — ноль');

// ── 7. Продолжение и сводка ─────────────────────────────────────────────────
const start = trailResume(stops, EMPTY_TRAIL);
assert.equal(start.stopIndex, 0, 'новая тропа начинается с первой остановки');
assert.equal(start.wordId, stops[0].wordIds[0], 'первое слово — первое непройденное');
assert.equal(start.stopDone, false, 'остановка не закрыта');
assert.equal(start.allDone, false, 'тропа не пройдена');

let one = EMPTY_TRAIL;
for (const id of stops[0].wordIds.slice(0, -1)) one = withTrailWord(one, id);
assert.equal(trailResume(stops, one).wordId, stops[0].wordIds.at(-1), 'после трёх слов остаётся четвёртое');
assert.equal(trailResume(stops, one).stopDone, false, 'остановка ещё не закрыта');

const closed = withTrailWord(one, stops[0].wordIds.at(-1)!);
assert.equal(trailResume(stops, closed).stopDone, true, 'все слова — остановка закрыта');
assert.equal(trailResume(stops, closed).allDone, false, 'но вторая остановка ещё впереди');
const next = withTrailStop(closed, stops[0].id, 1);
assert.equal(trailResume(stops, next).stopIndex, 1, 'переход на вторую остановку');
assert.equal(trailResume(stops, next).wordId, stops[1].wordIds[0], 'и её первое слово');
assert.deepEqual(next.cards, ['school'], 'открытка первой остановки сохранена');
assert.equal(withTrailWord(next, stops[0].wordIds[0]).words.length, next.words.length, 'повторное слово не дублируется');

let all = next;
for (const id of stops[1].wordIds) all = withTrailWord(all, id);
const finish = trailResume(stops, all);
assert.equal(finish.allDone, true, 'все остановки закрыты');
assert.equal(finish.wordId, null, 'непройденных слов нет');
assert.equal(finish.stopDone, true, 'последняя остановка закрыта');

const summary = trailSummary(stops, all);
assert.equal(summary.doneStops, 2, 'сводка: две остановки');
assert.equal(summary.totalStops, 2, 'сводка: всего две');
assert.equal(summary.doneWords, summary.totalWords, 'сводка: все слова');
assert.equal(summary.allDone, true, 'сводка: тропа пройдена');
assert.equal(trailSummary(stops, EMPTY_TRAIL).doneStops, 0, 'сводка пустой тропы');

// ── 8. В банке хватает слов ─────────────────────────────────────────────────
for (const grade of [1, 2, 3, 4, 5] as const) {
  const list = trailStops(grade, { limit: 0 });
  assert.ok(list.length > 0, `${grade} класс: есть хотя бы одна остановка`);
  assert.ok(list.every((s) => s.wordIds.every((id) => trailFits(WORD_BY_ID[id]))), `${grade} класс: только пригодные слова`);
}

console.log(
  `✓ тропа: ${stops.length} остановки 2 класса (` +
    stops.map((s) => `${s.title} — ${s.wordIds.length} сл.`).join(', ') +
    `); движок букв/слогов, шаг и санитайзер проверены`,
);
