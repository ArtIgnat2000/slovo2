/**
 * «Тропа слов» (0.111.0): чистый движок без DOM.
 *
 * Проверяем то, что ребёнок увидит глазами: полную программу 1–5 классов,
 * цикл «починить → пройти → найти → слоги», лабиринт каждого четвёртого
 * отрезка, текстовый режим 5 класса, две строки истории, дорогу из букв,
 * мост из слогов, шаг по плите, санитайзер прогресса и продолжение.
 */
import assert from 'node:assert/strict';
import { LESSONS_BY_GRADE, WORD_BY_ID, WORDS, WORDS_BY_GRADE } from '../src/content/words';
import {
  buildTrail,
  EMPTY_TRAIL,
  normalizeTrail,
  TRAIL_MAX_LETTERS,
  TRAIL_STOPS_MVP,
  TRAIL_WORDS_PER_STOP,
  trailActionFor,
  trailAvailable,
  trailFits,
  trailFindOptions,
  trailMazeOptions,
  trailModeFor,
  trailResume,
  trailStep,
  trailStory,
  trailStops,
  trailStopsFor,
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
assert.equal(stops.length, TRAIL_STOPS_MVP, '2 класс: превью из двух остановок');
assert.deepEqual(stops.map((s) => s.id), ['school', 'birds'], 'превью — «Школа» и «Птицы»');
assert.deepEqual(stops.map((s) => s.title), ['Школа', 'Птицы'], 'названия остановок');
assert.ok(stops.every((s) => s.wordIds.length <= TRAIL_WORDS_PER_STOP), 'в остановке не больше четырёх слов');
assert.ok(stops.every((s) => s.wordIds.length >= 2), 'в остановке хотя бы два слова');
assert.ok(stops.every((s) => s.wordIds.every((id) => !!WORD_BY_ID[id])), 'все слова остановки есть в банке');
assert.equal(stops[0].wordIds[0], 'g2_алфавит', 'первым стоит слово с опасной буквой');
assert.equal(stops[0].wordIds[1], 'g2_класс', 'вторым — слово, которое просто проходим');
assert.equal(stops[0].wordIds[2], 'g2_картина', 'третьим — слово с картинкой');
assert.equal(stops[0].wordIds[3], 'g2_карандаш', 'четвёртым — слово из слогов');
assert.deepEqual(
  stops[0].wordIds.map((id, index) => trailActionFor(WORD_BY_ID[id], index)),
  ['letters', 'walk', 'find', 'syllables'],
  'цикл остановки: починить → пройти → найти → слоги',
);
assert.equal(trailModeFor(WORD_BY_ID[stops[0].wordIds[0]], 0), 'letters', 'первое задание — буквы');
assert.equal(trailModeFor(WORD_BY_ID[stops[0].wordIds[3]], 3), 'syllables', 'последнее задание — слоги');
assert.equal(trailModeFor(WORD_BY_ID['g2_класс'], 1), 'letters', 'односложное слово остаётся буквенным');
assert.equal(trailActionFor(WORD_BY_ID['g2_класс'], 2), 'find', 'у слова с картинкой — поиск');
assert.equal(
  trailActionFor(word({ text: 'крот', syllables: ['крот'], danger: [2], image: undefined }), 2),
  'find',
  'без картинки, но с эмодзи — текстовый поиск',
);
assert.equal(
  trailActionFor(word({ text: 'крот', syllables: ['крот'], danger: [2], image: undefined, emoji: undefined }), 2),
  'walk',
  'без картинки и эмодзи «найти» заменяется дорогой',
);

const allStops = trailStopsFor(2);
assert.equal(allStops.length, LESSONS_BY_GRADE[2].length, '2 класс: все 16 уроков — остановки');
assert.equal(allStops.length, 16, 'в программе 2 класса ровно 16 остановок');
assert.deepEqual(
  allStops.map((s) => s.id),
  LESSONS_BY_GRADE[2].map((lesson) => lesson.id),
  'остановки идут по порядку уроков',
);
assert.ok(allStops.every((s) => s.wordIds.length >= 2 && s.wordIds.length <= TRAIL_WORDS_PER_STOP), 'каждая остановка 2–4 слова');
assert.deepEqual(trailStops(2, { limit: 0 }).map((s) => s.id), allStops.map((s) => s.id), 'без лимита — тот же список');

// С 0.112.0 открыты все классы: тропа идёт по всей программе, без превью.
for (const grade of [1, 2, 3, 4, 5] as const) {
  assert.equal(trailAvailable(grade), true, `${grade} класс открыт`);
  const gradeStops = trailStopsFor(grade);
  assert.ok(gradeStops.length > TRAIL_STOPS_MVP, `${grade} класс: вся программа, а не превью`);
  assert.deepEqual(
    gradeStops.map((s) => s.id),
    trailStops(grade, { limit: 0 }).map((s) => s.id),
    `${grade} класс: остановки без лимита`,
  );
}
assert.equal(trailStopsFor(1).length, 5, '1 класс: 5 остановок');
assert.equal(trailStopsFor(2).length, 16, '2 класс: 16 остановок');
assert.equal(trailStopsFor(3).length, 13, '3 класс: 13 остановок');
assert.equal(trailStopsFor(4).length, 15, '4 класс: 15 остановок');
assert.equal(trailStopsFor(5).length, 22, '5 класс: 22 остановки текстового режима');

// Лабиринт — третье слово каждого четвёртого отрезка.
const mazeStop = trailStopsFor(2)[3];
assert.equal(trailActionFor(WORD_BY_ID[mazeStop.wordIds[2]], 2, 3), 'maze', '4-я остановка даёт лабиринт');
assert.equal(trailActionFor(WORD_BY_ID[mazeStop.wordIds[2]], 2, 4), 'find', '5-я — снова «найти»');
assert.deepEqual(
  [3, 4, 7, 11, 15].map((index) => trailActionFor(WORD_BY_ID[trailStopsFor(2)[index].wordIds[2]], 2, index)),
  ['maze', 'find', 'maze', 'maze', 'maze'],
  'лабиринт повторяется каждый четвёртый отрезок',
);
const mazeTask = buildTrail(WORD_BY_ID[mazeStop.wordIds[2]], 'letters');
const mazeOptions = trailMazeOptions(mazeTask, 0, () => 0.42);
assert.equal(mazeOptions.length, 4, 'в лабиринте четыре ветки');
assert.ok(mazeOptions.includes(mazeTask.segments[0]), 'верная буква есть среди веток');
assert.equal(new Set(mazeOptions).size, mazeOptions.length, 'ветки не повторяются');

// Две строки истории: авторские для 2 класса, тёплая формула для остальных.
assert.deepEqual(
  trailStory(trailStopsFor(2)[0], trailStopsFor(2)[1]),
  ['В школьном дворе пахнет мелом и яблоками.', 'На стене — новая открытка «Школа».'],
  'у «Школы» своя история',
);
const genericStory = trailStory(trailStopsFor(5)[0], trailStopsFor(5)[1]);
assert.equal(genericStory.length, 2, 'история всегда из двух строк');
assert.ok(genericStory.every((line) => line.trim().length > 0), 'строки не пустые');

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

// ── 4.1. Найти картинку ─────────────────────────────────────────────────────
const picture = WORD_BY_ID['g2_картина'];
assert.ok(picture, 'слово «картина» на месте');
const find = trailFindOptions(picture!, WORDS_BY_GRADE[2], () => 0.42);
assert.equal(find.length, 4, 'четыре картинки на выбор');
assert.ok(find.includes(picture!), 'среди них есть верная картинка');
assert.equal(new Set(find.map((item) => item.id)).size, 4, 'картинки без повторов');
assert.ok(find.every((item) => !!item.image), 'у каждого варианта есть картинка');
assert.ok(find.every((item) => !/[\s-]/.test(item.text)), 'фраз и дефисов среди вариантов нет');
assert.deepEqual(
  find.map((item) => item.text),
  trailFindOptions(picture!, WORDS_BY_GRADE[2], () => 0.42).map((item) => item.text),
  'один и тот же pick даёт тот же набор',
);
const findClass = trailFindOptions(WORD_BY_ID['g2_воробей'], WORDS_BY_GRADE[2], () => 0.42);
assert.ok(findClass.every((item) => item.grades.includes(2)), 'варианты — из класса ребёнка');

// 5 класс: текстовый режим. Картинки есть не у всех слов, поэтому варианты
// набираются по картинке ИЛИ эмодзи, а карточка показывает слово.
const textWord = WORDS_BY_GRADE[5].find((item) => !item.image && item.emoji)!;
assert.ok(textWord, 'в 5 классе есть слово без картинки, но с эмодзи');
assert.equal(trailActionFor(textWord, 2), 'find', 'текстовое слово всё равно даёт «найти»');
const textFind = trailFindOptions(textWord, WORDS_BY_GRADE[5], () => 0.42);
assert.equal(textFind.length, 4, 'в текстовом режиме тоже четыре варианта');
assert.ok(textFind.every((item) => !!item.image || !!item.emoji), 'у каждого варианта есть картинка или эмодзи');
assert.ok(textFind.some((item) => !item.image), 'в 5 классе варианты без картинок допустимы');
assert.ok(textFind.includes(textWord), 'верное слово среди вариантов');

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

// Класс-владелец (0.111.0): старый v1 — это 2 класс, чужой класс — чистый лист.
assert.equal(normalizeTrail({ v: 1, words: ['g2_алфавит'] }).v, 2, 'v1 поднимается до v2');
const legacyTwo = normalizeTrail({ v: 1, stop: 1, words: ['g2_алфавит'], cards: ['school'] }, 2);
assert.equal(legacyTwo.grade, 2, 'v1 считается прогрессом 2 класса');
assert.deepEqual(legacyTwo.words, ['g2_алфавит'], 'v1 не теряет слова 2 класса');
assert.equal(legacyTwo.stop, 1, 'v1 не теряет остановку');
const foreign = normalizeTrail(
  { v: 2, grade: 2, stop: 1, words: ['g2_алфавит'], cards: ['school'] },
  3,
);
assert.deepEqual(
  foreign,
  { v: 2, grade: 3, stop: 0, words: [], cards: [] },
  'прогресс 2 класса не продолжается в 3-м',
);
const legacyForeign = normalizeTrail({ v: 1, stop: 1, words: ['g2_алфавит'], cards: ['school'] }, 1);
assert.deepEqual(
  legacyForeign,
  { v: 2, grade: 1, stop: 0, words: [], cards: [] },
  'старый прогресс 2 класса не протекает в 1-й',
);
const ownWord = WORDS_BY_GRADE[3][0].id;
const sameClass = normalizeTrail({ v: 2, grade: 3, stop: 1, words: [ownWord], cards: [] }, 3);
assert.equal(sameClass.stop, 1, 'свой класс сохраняет остановку');
assert.deepEqual(sameClass.words, [ownWord], 'свой класс сохраняет слова');
assert.equal(normalizeTrail({ v: 2, grade: 2, words: ['g2_алфавит'] }, 2).grade, 2, 'grade проставляется');

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

// Сохранённый `stop` — не истина: смена класса или старый профиль не должны
// уводить на чужую остановку. Ищем первую незакрытую.
const stalePointer = { ...one, stop: 1 };
assert.equal(trailResume(stops, stalePointer).stopIndex, 0, 'открытая остановка важнее сохранённого stop');
assert.equal(trailResume(stops, closed).stopIndex, 0, 'закрытая остановка ещё показывает открытку');
assert.equal(trailResume(stops, closed).stopDone, true, 'открытка не перепрыгивается');
assert.equal(trailSummary(stops, closed).currentTitle, 'Птицы', 'сводка уже смотрит на следующую остановку');

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
  const list = trailStopsFor(grade);
  assert.ok(list.length > 0, `${grade} класс: есть хотя бы одна остановка`);
  assert.ok(list.every((s) => s.wordIds.every((id) => trailFits(WORD_BY_ID[id]))), `${grade} класс: только пригодные слова`);
  assert.ok(
    list.every((s) => s.wordIds.filter((id) => !!WORD_BY_ID[id].image || !!WORD_BY_ID[id].emoji).length >= 2),
    `${grade} класс: в каждой остановке хотя бы два слова с картинкой или эмодзи`,
  );
}
for (const grade of [1, 3, 4] as const) {
  for (const stop of trailStopsFor(grade)) {
    // В 1/3/4 классах у каждого слова есть картинка: «найти» не должно
    // превращаться в пустую карточку.
    assert.ok(stop.wordIds.every((id) => !!WORD_BY_ID[id].image), `${grade} класс, ${stop.id}: у слов есть картинки`);
  }
}

console.log(
  `✓ тропа: 1–5 классы (${trailStopsFor(1).length}+${allStops.length}+${trailStopsFor(3).length}+` +
    `${trailStopsFor(4).length}+${trailStopsFor(5).length} остановок), лабиринт каждого 4-го отрезка, ` +
    `текстовый режим 5 класса, история из двух строк, шаг и санитайзер проверены`,
);
