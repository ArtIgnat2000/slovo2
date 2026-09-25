import type { Lesson, Task, TaskKind, Word, WordState } from '../types';
import { WORD_BY_ID } from '../content/words';
import { priority } from './srs';

const VOWELS = 'аеёиоуыэюя';
const CONSONANTS = 'бвгджзйклмнпрстфхцчшщ';

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

function pickDanger(w: Word): number {
  return w.danger[Math.floor(Math.random() * w.danger.length)] ?? Math.floor(w.text.length / 2);
}

function letterOptions(correct: string): string[] {
  // Варианты подбираем по самой букве: гласные — к гласным, согласные — к согласным
  const pool = VOWELS.includes(correct) ? VOWELS : CONSONANTS;
  const set = new Set<string>([correct]);
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

function wrongVariants(w: Word, dangerIdx: number, count: number): string[] {
  const correctLetter = w.text[dangerIdx];
  const pool = w.dangerKind === 'consonant' ? CONSONANTS : VOWELS;
  const out: string[] = [];
  let guard = 0;
  while (out.length < count && guard++ < 60) {
    const l = pool[Math.floor(Math.random() * pool.length)];
    if (l === correctLetter) continue;
    const variant = w.text.slice(0, dangerIdx) + l + w.text.slice(dangerIdx + 1);
    if (variant !== w.text && !out.includes(variant)) out.push(variant);
  }
  const all = shuffle([w.text, ...out]);
  return all.slice(0, count + 1);
}

export /**
 * Фразы («до свидания») нельзя собирать из букв и печатать — для них остаются
 * задания с выбором: окошко, исправь ошибку, знакомство, слоги.
 */
function safeKind(kind: TaskKind, wordId: string): TaskKind {
  const w = WORD_BY_ID[wordId];
  if (!w.text.includes(' ')) return kind;
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
}

/**
 * Строим последовательность заданий урока.
 * Порядок методический: ЗНАКОМСТВО → ПРОГОВАРИВАНИЕ → ЗАКРЕПЛЕНИЕ →
 * ПРОВЕРКА ИЗ ПАМЯТИ → ПОВТОРЕНИЕ ПРОЙДЕННОГО (интерливинг).
 */
export function buildLesson({ lesson, level, states, reviewWords }: BuildLessonArgs): Task[] {
  const tasks: Task[] = [];
  const kinds = practiceKinds(level);

  // 1. Знакомство + орфографическое проговаривание новых слов
  for (const id of lesson.wordIds) {
    const st = states[id];
    const isNew = !st || (st.ok + st.wrong) === 0;
    if (isNew) {
      tasks.push(makeTask('intro', id, 'learn', pickDanger(WORD_BY_ID[id])));
    }
  }

  // 2. Первое закрепление каждого слова урока
  for (const id of lesson.wordIds) {
    tasks.push(makeTask(firstKind(level, states[id]), id, 'practice', pickDanger(WORD_BY_ID[id])));
  }

  // 3. Второй круг — другие типы заданий (перемешиваем, чтобы не было «одного и того же»)
  const second = shuffle(lesson.wordIds).map((id, i) =>
    makeTask(kinds[i % kinds.length], id, 'practice', pickDanger(WORD_BY_ID[id])),
  );
  tasks.push(...second);

  // 4. Интерливинг: повторение слов из прошлых уроков
  for (const w of reviewWords) {
    const kind: TaskKind = level >= 2 ? 'write' : 'fix';
    tasks.push(makeTask(kind, w.id, 'review', pickDanger(w)));
  }

  return tasks;
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
