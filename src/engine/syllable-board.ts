/**
 * «Слоговая мозаика» — слово из слогов (0.106.0, §6-F плана «Игры»).
 *
 * Отличие от «Собери слово» принципиальное: там единица — буква, здесь —
 * **слог**. Поэтому в игру попадают длинные слова (до 17 букв), которые в
 * буквенных играх нечитаемы, и она тренирует слоговое чтение и перенос, а не
 * порядок букв.
 *
 * Чем не дублирует урок: в уроке задание `syllables` спрашивает «сколько
 * слогов», ответ — число. Здесь ребёнок **выкладывает** слово слогами.
 *
 * Правила рамки те же, что у остальных игр: ничего не сгорает, таймера нет,
 * ошибка возвращает плитки и ничего не отнимает. Модуль чистый.
 */
import type { Word } from '../types';

/**
 * Сколько слогов максимум берём в игру.
 *
 * 6 — предел, на котором плитки ещё помещаются в два ряда на 360 px. Слова
 * длиннее (в банке есть 7-слоговые) остаются в других играх: там длина не
 * ограничена, а мозаика из семи плиток уже не читается как слово.
 */
export const SYL_MAX_PARTS = 6;

/** Подходит ли слово: слогов от двух и без пробелов/дефисов. */
export function syllableFits(word: Word): boolean {
  if (/[\s-]/.test(word.text)) return false;
  const parts = word.syllables.filter((s) => s.trim().length > 0);
  return parts.length >= 2 && parts.length <= SYL_MAX_PARTS;
}

export interface SyllableTile {
  /** Уникальный id плитки: слоги в слове могут повторяться («ма-ма»). */
  id: number;
  text: string;
}

export interface SyllableBoard {
  word: Word;
  /** Слоты в правильном порядке — их столько же, сколько слогов. */
  slots: string[];
  /** Плитки в порядке показа (перемешаны), с уникальными id. */
  tiles: SyllableTile[];
}

/**
 * Собрать доску. `shuffle` — источник перемешивания (в тестах свой), чтобы
 * проверки были детерминированными.
 *
 * Перемешивание гарантированно НЕ совпадает с правильным порядком: если
 * слово уже «собрано» с первого взгляда, игра теряет смысл (та же страховка,
 * что в `buildLetters` урока).
 */
export function syllableBoard(word: Word, shuffle: (list: SyllableTile[]) => SyllableTile[]): SyllableBoard | null {
  if (!syllableFits(word)) return null;
  const slots = word.syllables.filter((s) => s.trim().length > 0);
  const base = slots.map((text, id) => ({ id, text }));
  let tiles = shuffle([...base]);
  for (let attempt = 0; attempt < 8 && tiles.map((t) => t.id).join(',') === base.map((t) => t.id).join(','); attempt++) {
    tiles = shuffle([...base]);
  }
  return { word, slots, tiles };
}

/** Правильный ли порядок слогов: `slots` собраны как в слове. */
export function syllableSolved(board: SyllableBoard, picked: SyllableTile[]): boolean {
  return (
    picked.length === board.slots.length &&
    picked.every((tile, i) => tile.text === board.slots[i])
  );
}

/** Пул мозаики: слова из двух и более слогов. */
export function syllablePool(pool: ReadonlyArray<Word>): Word[] {
  return pool.filter(syllableFits);
}
