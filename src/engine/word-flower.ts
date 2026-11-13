/**
 * «Цветок слова» — слово открывается по буквам (0.105.0, `games-catalog-detail.md` §5-B).
 *
 * Это переделка «виселицы» из каталога 20 игр. У виселицы два запрещённых
 * свойства: жизни («6 попыток и проигрыш») и наказание за ошибку. Здесь
 * наоборот:
 *
 *  • попытки НЕ кончаются — цветок не вянET и не «умирает»;
 *  • ошибка даёт информацию (следующую ступень подсказки), а не отнимает;
 *  • буквы открываются СЛЕВА НАПРАВО — ребёнок на каждом шаге видит, какая
 *    буква следующая, и это ближе к чтению, чем к сборке целого слова.
 *
 * Чем не дубль урока: в уроке `fix` просит найти ОДНУ букву в целом слове,
 * `build` — выложить все буквы сразу. Здесь слово растёт по буквам, и каждый
 * шаг — отдельное решение.
 *
 * Модуль чистый: ни React, ни стора.
 */
import type { Word } from '../types';

/** Сколько карточек-букв снизу на каждом шаге: верная + три соседки. */
export const FLOWER_CHOICES = 4;

/** Похожие буквы — те же пары, что в `engine/scheduler.ts:CONFUSE`. */
const CONFUSE: Record<string, string[]> = {
  а: ['о'], о: ['а'], е: ['и', 'я'], и: ['е'], я: ['и', 'е'], ы: ['и'],
  у: ['ю'], ю: ['у'], э: ['е'], ё: ['о', 'е'],
  б: ['п'], п: ['б'], в: ['ф'], ф: ['в'], г: ['к'], к: ['г'],
  д: ['т'], т: ['д'], ж: ['ш'], ш: ['ж'], з: ['с'], с: ['з'], ч: ['ц'], ц: ['ч'],
};

const VOWELS = 'аеёиоуыэюя';
const CONSONANTS = 'бвгджзйклмнпрстфхцчшщ';

/** Подходит ли слово: без фраз, без дефисов, не короче двух букв. */
export function flowerFits(word: Word): boolean {
  if (/[\s-]/.test(word.text)) return false;
  return [...word.text].length >= 2;
}

export interface FlowerStep {
  /** Индекс буквы, которую открываем сейчас. */
  index: number;
  answer: string;
  /** Карточки в порядке показа; верная всегда внутри. */
  choices: string[];
}

/**
 * Четыре карточки для текущего шага.
 *
 * Соседки — типичные детские ошибки (`CONFUSE`), затем буквы самого слова,
 * затем добор из алфавита того же типа. Карточки не «дорисованы» из слова и
 * стоят в случайном порядке: иначе форма варианта подсказывала бы ответ.
 */
export function flowerChoices(answer: string, text: string[], pick: () => number = Math.random): string[] {
  const same = VOWELS.includes(answer);
  const pool = [...(same ? VOWELS : CONSONANTS)].filter((l) => l !== answer);
  const out: string[] = [];
  for (const letter of CONFUSE[answer] ?? []) {
    if (letter !== answer && !out.includes(letter)) out.push(letter);
  }
  for (const letter of text) {
    if (out.length >= FLOWER_CHOICES - 1) break;
    if (letter !== answer && !out.includes(letter)) out.push(letter);
  }
  let guard = 0;
  while (out.length < FLOWER_CHOICES - 1 && guard++ < 200) {
    const letter = pool[Math.floor(pick() * pool.length)];
    if (letter && !out.includes(letter)) out.push(letter);
  }
  const choices = [answer, ...out.slice(0, FLOWER_CHOICES - 1)];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(pick() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices;
}

/** Шаг цветка: какая буква следующая и что показать снизу. */
export function flowerStep(word: Word, opened: number, pick: () => number = Math.random): FlowerStep | null {
  if (!flowerFits(word)) return null;
  const text = [...word.text];
  const index = Math.max(0, Math.min(text.length, Math.trunc(opened)));
  if (index >= text.length) return null;
  const answer = text[index];
  return { index, answer, choices: flowerChoices(answer, text, pick) };
}

/**
 * Выбор буквы. Возвращает новое число открытых букв; при ошибке — то же
 * число (вызывающая сторона по равенству понимает, что был промах).
 *
 * Неверная буква из набора не исчезает: ребёнок видит, что пробовал, и может
 * выбрать её снова — попыток не кончается.
 */
export function flowerPick(word: Word, opened: number, letter: string): number {
  if (!flowerFits(word)) return opened;
  const text = [...word.text];
  if (opened < 0 || opened >= text.length) return opened;
  return letter === text[opened] ? opened + 1 : opened;
}

/** Цветок распустился: открыты все буквы. */
export function flowerDone(word: Word, opened: number): boolean {
  return flowerFits(word) && opened >= [...word.text].length;
}

/**
 * Подсказка после ошибки. Три ступени, как у «Хитрой буквы», но текст другой:
 * в «Цветке» слово уже видно частично, поэтому первая ступень — значение.
 */
export type FlowerHint = 'none' | 'mnemonic' | 'sentence' | 'letter';

/**
 * Ступень подсказки после ошибки.
 *
 * Значение слова (`hint`) показывается всегда — это не подсказка ответа, а
 * смысл слова, который ребёнок и так встречает в каждом задании. Поэтому
 * лестница начинается со ступени выше: мнемоника (если есть) → предложение с
 * пропуском → сама буква.
 */
export function flowerHint(word: Word, wrong: number): FlowerHint {
  if (wrong <= 0) return 'none';
  if (wrong === 1) return word.mnemonic ? 'mnemonic' : 'sentence';
  if (wrong === 2) return 'sentence';
  return 'letter';
}

/** Пул «Цветка»: слова без фраз (картинка — только как подсказка). */
export function flowerPool(pool: ReadonlyArray<Word>): Word[] {
  return pool.filter(flowerFits);
}
