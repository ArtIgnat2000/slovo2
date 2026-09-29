import type { Lesson, LessonSize, Task, TaskKind, Word, WordState } from '../types';
import { WORD_BY_ID } from '../content/words';
import { priority } from './srs';

const VOWELS = 'аеёиоуыэюя';
const CONSONANTS = 'бвгджзйклмнпрстфхцчшщ';

export const LESSON_SIZE_OPTIONS: { id: LessonSize; title: string; limit: number; description: string }[] = [
  { id: 'short', title: 'Короткий', limit: 12, description: '12 карточек — по умолчанию, легко и быстро' },
  { id: 'standard', title: 'Обычный', limit: 16, description: '16 карточек — если хочется подольше' },
  { id: 'full', title: 'Полный', limit: 20, description: '20 карточек — для спокойных дней' },
];

export const DEFAULT_LESSON_SIZE: LessonSize = 'short';

export function lessonCardLimit(size: LessonSize = DEFAULT_LESSON_SIZE): number {
  return LESSON_SIZE_OPTIONS.find((option) => option.id === size)?.limit ?? 12;
}

let seq = 0;
const uid = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`;

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Похожие по звучанию буквы: именно их дети и путают.
 * Из этой таблицы собираем и варианты ответа, и «ошибку робота».
 */
const CONFUSE: Record<string, string[]> = {
  а: ['о'],
  о: ['а'],
  е: ['и', 'я'],
  и: ['е'],
  я: ['и', 'е'],
  ы: ['и'],
  у: ['ю'],
  ю: ['у'],
  э: ['е'],
  ё: ['о', 'е'],
  б: ['п'],
  п: ['б'],
  в: ['ф'],
  ф: ['в'],
  г: ['к'],
  к: ['г'],
  д: ['т'],
  т: ['д'],
  ж: ['ш'],
  ш: ['ж'],
  з: ['с'],
  с: ['з'],
  ч: ['ц'],
  ц: ['ч'],
};

/**
 * Насколько буква «коварна»: 0 — настоящая опасность (безударные о/е/я/э, двойные и
 * непроизносимые согласные), 1 — буква, которая и без ударения слышится как пишется (у/ы/ю).
 * Такие «простые» буквы не даём в заданиях, если есть что-то посложнее.
 * (После переразметки у/ы/ю в danger не должны попадать вовсе — это страховка.)
 */
function dangerWeight(w: Word, idx: number): number {
  return 'уыю'.includes(w.text[idx]) ? 1 : 0;
}

/**
 * Выбираем «опасное место» для задания. Не любую отмеченную букву, а самую коварную:
 * в «ученик» — безударную Е, а не очевидную У; в «класс» — двойную С.
 */
export function pickDanger(w: Word): number {
  if (!w.danger.length) return Math.floor(w.text.length / 2);
  const sorted = [...w.danger].sort((a, b) => dangerWeight(w, a) - dangerWeight(w, b));
  const best = dangerWeight(w, sorted[0]);
  const top = sorted.filter((i) => dangerWeight(w, i) === best);
  return top[Math.floor(Math.random() * top.length)];
}

function letterOptions(correct: string): string[] {
  // Сначала похожие буквы, потом добираем буквами того же класса
  const pool = VOWELS.includes(correct) ? VOWELS : CONSONANTS;
  const set = new Set<string>([correct, ...(CONFUSE[correct] ?? [])]);
  let guard = 0;
  while (set.size < 4 && guard++ < 50) set.add(pool[Math.floor(Math.random() * pool.length)]);
  return shuffle([...set]);
}

function buildLetters(w: Word): string[] {
  // Перемешиваем, но гарантируем, что порядок не совпадает с правильным
  for (let attempt = 0; attempt < 8; attempt++) {
    const s = shuffle(w.text.split(''));
    if (s.join('') !== w.text) return s;
  }
  return shuffle(w.text.split(''));
}

/**
 * Типичная ошибка в согласной букве:
 *  • двойная — одну букву теряют: «класс» → «клас», «Россия» → «Росия»;
 *  • на конце слова — пишут парную глухую: «вдруг» → «вдрук»;
 *  • непроизносимая — пропускают: «здравствуйте» → «здраствуйте».
 */
function consonantError(text: string, idx: number): string | null {
  const ch = text[idx];
  const drop = () => text.slice(0, idx) + text.slice(idx + 1);
  if (text[idx - 1] === ch || text[idx + 1] === ch) return drop();
  const pair = CONFUSE[ch]?.[0];
  if (idx === text.length - 1 && pair && !VOWELS.includes(pair)) {
    return text.slice(0, idx) + pair + text.slice(idx + 1);
  }
  return drop();
}

function replaceAt(text: string, idx: number, letter: string): string {
  return text.slice(0, idx) + letter + text.slice(idx + 1);
}

/**
 * Варианты для задания «исправь робота». Робот ошибается так, как ошибаются дети,
 * а не случайными буквами: в «ворона» — «варона», в «класс» — «клас».
 */
function wrongVariants(w: Word, dangerIdx: number, count: number): string[] {
  const correctLetter = w.text[dangerIdx];
  const out: string[] = [];
  const push = (v: string) => {
    if (v && v !== w.text && !out.includes(v)) out.push(v);
  };

  if (VOWELS.includes(correctLetter)) {
    for (const l of shuffle(CONFUSE[correctLetter] ?? [])) push(replaceAt(w.text, dangerIdx, l));
  } else {
    const err = consonantError(w.text, dangerIdx);
    if (err) push(err);
  }

  if (!out.length) {
    // страховка: вариант нужен всегда, иначе задание «исправь робота» потеряет смысл
    const pool = VOWELS.includes(correctLetter) ? VOWELS : CONSONANTS;
    let guard = 0;
    while (!out.length && guard++ < 60) {
      const l = pool[Math.floor(Math.random() * pool.length)];
      if (l !== correctLetter) push(replaceAt(w.text, dangerIdx, l));
    }
  }

  return shuffle([w.text, ...out.slice(0, count)]);
}

export /**
 * Фразы («до свидания») нельзя собирать из букв и печатать — для них остаются
 * задания с выбором: окошко, исправь ошибку, знакомство, слоги.
 */
function safeKind(kind: TaskKind, wordId: string): TaskKind {
  const w = WORD_BY_ID[wordId];
  if (kind === 'intro' || kind === 'syllables' || !w.text.includes(' ')) return kind;
  return kind === 'fix' || kind === 'gap' ? kind : 'gap';
}

export function makeTask(kind: TaskKind, wordId: string, reason: Task['reason'], dangerIdx: number): Task {
  const kind0 = safeKind(kind, wordId);
  const w = WORD_BY_ID[wordId];
  const t: Task = { uid: uid(), kind: kind0, wordId, reason, dangerIdx };
  if (kind0 === 'gap') t.options = letterOptions(w.text[dangerIdx]);
  if (kind0 === 'build') t.letters = buildLetters(w);
  if (kind0 === 'fix') {
    const variants = wrongVariants(w, dangerIdx, 2);
    t.options = variants;
    t.wrong = variants.find((v) => v !== w.text) ?? w.text;
  }
  if (kind0 === 'visual') t.showMs = 1200 + w.text.length * 220;
  return t;
}

/** Какие типы заданий уместны для уровня навыка урока. */
function practiceKinds(level: number): TaskKind[] {
  if (level <= 0) return ['gap', 'build', 'syllables'];
  if (level === 1) return ['gap', 'build', 'write'];
  if (level === 2) return ['build', 'write', 'fix'];
  if (level === 3) return ['write', 'visual', 'fix'];
  return ['write', 'visual', 'fix', 'gap'];
}

function firstKind(level: number, st: WordState | undefined): TaskKind {
  const seen = (st?.ok ?? 0) + (st?.wrong ?? 0);
  if (seen === 0) return level === 0 ? 'build' : 'write';
  return 'write';
}

export interface BuildLessonArgs {
  lesson: Lesson;
  level: number;
  states: Record<string, WordState>;
  reviewWords: Word[];
  /** Лимит базовой очереди; repair-карточки после ошибки добавляются отдельно. */
  maxCards?: number;
}

function wordNeedScore(id: string, states: Record<string, WordState>): number {
  const st = states[id];
  if (!st || st.ok + st.wrong === 0) return 10_000;
  // В коротком режиме сначала оставляем слова, которые ещё не выучены или чаще ошибались.
  return st.wrong * 100 + Math.max(0, 100 - st.s) + (st.due <= Date.now() ? 20 : 0);
}

function selectedWordIds(
  ids: string[],
  states: Record<string, WordState>,
  maxCards: number | undefined,
  reviewCount: number,
): string[] {
  if (!maxCards || ids.length === 0) return ids;
  // Оставляем место для 1–2 старых слов. Если старых слов нет, вместится ещё одно
  // слово текущей темы — лимит остаётся честным, а не искусственно пустым.
  const reviewReserve = Math.min(reviewCount, maxCards <= 12 ? 2 : maxCards >= 20 ? 3 : 0);
  const capacity = Math.max(1, Math.floor((maxCards - reviewReserve) / 2));
  if (ids.length <= capacity) return ids;
  return [...ids]
    .sort((a, b) => wordNeedScore(b, states) - wordNeedScore(a, states))
    .slice(0, capacity);
}

/**
 * Строим последовательность заданий урока.
 * Порядок методический: ЗНАКОМСТВО → ПРОГОВАРИВАНИЕ → ЗАКРЕПЛЕНИЕ →
 * ПРОВЕРКА ИЗ ПАМЯТИ → ПОВТОРЕНИЕ ПРОЙДЕННОГО (интерливинг).
 *
 * При лимите сначала сохраняем знакомство и первую попытку вспомнить выбранные
 * слова. Сокращается второй круг уверенных слов; карточки repair не проходят
 * через этот лимит и добавляются LessonScreen после ошибки.
 */
export function buildLesson({ lesson, level, states, reviewWords, maxCards }: BuildLessonArgs): Task[] {
  const kinds = practiceKinds(level);
  const selectedIds = selectedWordIds(lesson.wordIds, states, maxCards, reviewWords.length);

  // 1. Знакомство + 2. первое закрепление выбранных слов
  const intro = selectedIds
    .filter((id) => {
      const st = states[id];
      return !st || st.ok + st.wrong === 0;
    })
    .map((id) => makeTask('intro', id, 'learn', pickDanger(WORD_BY_ID[id])));
  const first = selectedIds.map((id) =>
    makeTask(firstKind(level, states[id]), id, 'practice', pickDanger(WORD_BY_ID[id])),
  );

  // 3. Второй круг — другие типы заданий (перемешиваем, чтобы не было «одного и того же»)
  const second = shuffle(selectedIds).sort((a, b) => wordNeedScore(b, states) - wordNeedScore(a, states)).map((id, i) =>
    makeTask(kinds[i % kinds.length], id, 'practice', pickDanger(WORD_BY_ID[id])),
  );

  // 4. Интерливинг: повторение слов из прошлых уроков
  const review = reviewWords.map((w) => {
    const kind: TaskKind = level >= 2 ? 'write' : 'fix';
    return makeTask(kind, w.id, 'review', pickDanger(w));
  });

  if (!maxCards) return [...intro, ...first, ...second, ...review];

  const base = [...intro, ...first];
  const remaining = Math.max(0, maxCards - base.length);
  // В коротком режиме сначала оставляем небольшой интерливинг, затем добираем
  // второй круг. Для обычного режима место под старые слова появляется только
  // если все обязательные карточки уже поместились.
  const reviewCount = Math.min(review.length, maxCards <= 12 ? 2 : maxCards >= 20 ? 3 : remaining);
  const reviewSlice = review.slice(0, reviewCount);
  const secondSlice = second.slice(0, Math.max(0, remaining - reviewSlice.length));
  return [...base, ...secondSlice, ...reviewSlice];
}

/** Задание «исправь ошибку» — вставляется в урок чуть позже после промаха. */
export function repairTask(wordId: string): Task {
  return makeTask('write', wordId, 'repair', pickDanger(WORD_BY_ID[wordId]));
}

/** Сортировка очереди «слабых» слов для отдельной тренировки ошибок. */
export function weakestWords(states: Record<string, WordState>, limit: number): string[] {
  const now = Date.now();
  return Object.entries(states)
    .filter(([, st]) => st.wrong > 0)
    .sort((a, b) => priority(b[1], now) - priority(a[1], now))
    .slice(0, limit)
    .map(([id]) => id);
}
