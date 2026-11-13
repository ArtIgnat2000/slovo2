/**
 * «Хитрая буква» — детская замена Wordle и «виселицы» (0.103.0, §6-E плана).
 *
 * В слове закрыта одна буква — та, в которой чаще всего ошибаются (`danger`,
 * её выбирает `pickDanger` из `engine/scheduler.ts`). Ребёнок выбирает букву
 * из четырёх вариантов. Ошибка не наказывает, а даёт **следующую ступень
 * подсказки**:
 *
 *   1) мнемоника (если у слова есть — она только у части карточек);
 *   2) предложение с пропуском (`sentence`) — слово в живом контексте;
 *   3) буква открывается целиком, слово читается.
 *
 * После третьей ступени выбор продолжается с ОСТАВШИМИСЯ буквами: попытки не
 * кончаются, слово засчитывается всегда. Никаких «6 попыток», «сердечек» и
 * «проигрыша» — это стоп-лист проекта, а не украшение.
 *
 * Варианты — типичные детские ошибки (`CONFUSE`: о↔а, е↔и↔я, д↔т …), те же,
 * что в задании «Исправь робота»: игра тренирует ровно ту орфограмму, ради
 * которой проект существует. Модуль чистый: ни React, ни стора.
 */
import type { Word } from '../types';

/** Сколько слов в одном раунде. Шесть — это 1–2 минуты спокойной игры. */
export const TRICKY_ROUND_SIZE = 6;
/** Сколько ступеней подсказки: мнемоника, предложение, открытая буква. */
export const TRICKY_STEPS = 3;

/** Похожие буквы — те же пары, что в `engine/scheduler.ts:CONFUSE`. */
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

const VOWELS = 'аеёиоуыэюя';
/** Гласные и согласные алфавита — для добора, когда соседок не хватило. */
const VOWEL_POOL = [...VOWELS];
const CONSONANT_POOL = [...'бвгджзйклмнпрстфхцчшщ'];

/**
 * Подходит ли слово.
 *
 * Нужна ровно одна «хитрая» буква: если в слове их несколько, ребёнок не
 * понимает, какую из них спрашивают. Фразы и дефисы не годятся — слово
 * показывается целиком с одной прорезью.
 */
export function trickyFits(word: Word): boolean {
  if (/[\s-]/.test(word.text)) return false;
  const text = [...word.text];
  if (text.length < 3) return false;
  const danger = word.danger.filter((i) => i >= 0 && i < text.length);
  return danger.length >= 1;
}

export interface TrickyTask {
  word: Word;
  /** Индекс закрытой буквы. */
  index: number;
  /** Верная буква. */
  answer: string;
  /** Четыре варианта в порядке показа — верная всегда внутри. */
  options: string[];
}

/**
 * Собрать задание: слово, закрытая буква, четыре варианта.
 *
 * `pick` — источник случайности (в тестах передаём свой), возвращает 0..1.
 */
export function trickyTask(word: Word, pick: () => number = Math.random): TrickyTask | null {
  if (!trickyFits(word)) return null;
  const text = [...word.text];
  // Из нескольких опасных мест берём первое «настоящее» (не у/ы/ю — это
  // страховка из scheduler.ts: такие буквы слышны как пишутся), иначе первое.
  const danger = word.danger.filter((i) => i >= 0 && i < text.length);
  const hard = danger.filter((i) => !'уыю'.includes(text[i]));
  const list = hard.length ? hard : danger;
  const index = list[Math.min(list.length - 1, Math.floor(pick() * list.length))];
  const answer = text[index];
  return { word, index, answer, options: trickyOptions(answer, text, pick) };
}

/**
 * Четыре варианта: верная буква + три «соседки».
 *
 * Порядок — только случайный: если верная всегда на одном месте, ребёнок
 * выучит место, а не букву. Соседки сначала из `CONFUSE`, потом — буквами
 * того же типа (гласная/согласная), чтобы вариант нельзя было отбросить «по
 * виду».
 */
export function trickyOptions(answer: string, text: string[], pick: () => number = Math.random): string[] {
  const same = VOWELS.includes(answer);
  const pool = (same ? VOWEL_POOL : CONSONANT_POOL).filter((l) => l !== answer);
  const out: string[] = [];
  for (const letter of CONFUSE[answer] ?? []) {
    if (letter !== answer && !out.includes(letter)) out.push(letter);
  }
  // Добор — буквами слова (кроме самой закрытой и уже взятых), потом пулом.
  for (const letter of text) {
    if (out.length >= 3) break;
    if (letter !== answer && !out.includes(letter)) out.push(letter);
  }
  let guard = 0;
  while (out.length < 3 && guard++ < 200) {
    const letter = pool[Math.floor(pick() * pool.length)];
    if (letter && !out.includes(letter)) out.push(letter);
  }
  const options = [answer, ...out.slice(0, 3)];
  // Перемешивание Фишера–Йетса на том же источнике случайности.
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(pick() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

/**
 * Что показать после `wrong` ошибок.
 *
 * Возвращает ступень подсказки, которую надо ПРИБАВИТЬ к уже открытой:
 *  • 1 ошибка → мнемоника (если у слова её нет — предложение, то есть
 *    ступень пропускается, но следующая не «перескакивает»);
 *  • 2 ошибки → предложение с пропуском;
 *  • 3 ошибки → буква открыта, слово читается.
 *
 * Ступень не откатывается назад: если ребёнок ошибся четвёртый раз, буква
 * остаётся открытой, а выбор — с оставшимися вариантами.
 */
export type TrickyHint = 'none' | 'mnemonic' | 'sentence' | 'revealed';

export function trickyHint(word: Word, wrong: number): TrickyHint {
  if (wrong <= 0) return 'none';
  // Без мнемоники первая ошибка сразу даёт предложение: пустой ступени,
  // которая ничего не показывает, в подсказке быть не должно.
  if (wrong === 1) return word.mnemonic ? 'mnemonic' : 'sentence';
  if (wrong === 2) return 'sentence';
  return 'revealed';
}

/** Раунд: сколько слов, сколько верных, закрыта ли партия. */
export interface TrickyRound {
  size: number;
  solved: number;
  /** Слово считается «с подсказкой», если буква открылась сама. */
  hintsUsed: number;
}

export const emptyRound = (size = TRICKY_ROUND_SIZE): TrickyRound => ({ size, solved: 0, hintsUsed: 0 });
export const roundDone = (round: TrickyRound): boolean => round.solved >= round.size;

export function advanceRound(round: TrickyRound, usedHint: boolean): TrickyRound {
  return {
    size: round.size,
    solved: Math.min(round.size, round.solved + 1),
    hintsUsed: round.hintsUsed + (usedHint ? 1 : 0),
  };
}

/** Пул «Хитрой буквы»: слова с «хитрой» буквой. */
export function trickyPool(pool: ReadonlyArray<Word>): Word[] {
  return pool.filter(trickyFits);
}
