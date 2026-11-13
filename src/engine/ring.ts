/**
 * «Колесо букв» — проведи по слову (0.103.0, §6-C плана «Игры»).
 *
 * Буквы слова стоят по кругу. Ребёнок ведёт палец по ним в порядке слова, и
 * слово «собирается». Тап работает так же, как ведение (доступность и
 * клавиатура) — это в филворде уже проверенный приём.
 *
 * Почему круг, а не перемешанные плитки. «Собери слово» уже есть, и оно про
 * порядок букв на прямой. Колесо даёт другое действие: непрерывное движение
 * по кругу, «телесный» вход в слово. Именно поэтому буквы стоят на окружности
 * В ПОРЯДКЕ СЛОВА — ребёнок не угадывает, он ведёт. Перемешивать буквы по
 * кругу значило бы сделать второе «Собери слово» с худшей читаемостью.
 *
 * Жёсткие границы:
 *  • нет таймера, нет попыток, нет проигрыша — ошибочный шаг просто ничего
 *    не меняет;
 *  • круг читается только на коротких словах: длинные слова отсеиваются
 *    (`RING_MAX_LETTERS`), иначе буквы сливаются в точку;
 *  • фразы (пробел) и дефисы не попадают — в круге нет места для пробела;
 *  • модуль чистый: ни React, ни стора, ни `window`.
 */
import type { Word } from '../types';

/**
 * Сколько букв максимум ставим на круг.
 *
 * 8 — из плана (§6-C: «для 1 класса (30 слов, ≤ 8 букв) — идеально»).
 * При 9–10 буквах на 360 px соседние точки уже ближе 30 px, и палец
 * задевает не ту; при 12 (5 класс) круг превращается в кашу.
 */
export const RING_MAX_LETTERS = 8;

export interface RingDot {
  /** Индекс буквы в слове — он же порядковый номер шага. */
  index: number;
  letter: string;
  /** Угол от «12 часов» по часовой стрелке, в градусах: 0..360. */
  angle: number;
  /** Опасные буквы подсвечиваем — колесо повторяет слово там, где ошибаются. */
  danger: boolean;
}

export interface RingBoard {
  word: Word;
  dots: RingDot[];
  letters: number;
}

/** Буквы слова без пробелов и дефисов — для круга фразы и «до свидания» не годятся. */
export function ringLetters(word: Word): string[] {
  return [...word.text];
}

/** Подходит ли слово для колеса: без пробела, без дефиса, не длиннее потолка. */
export function ringFits(word: Word): boolean {
  if (/[\s-]/.test(word.text)) return false;
  const n = [...word.text].length;
  return n >= 2 && n <= RING_MAX_LETTERS;
}

/**
 * Раскладка по кругу.
 *
 * Первая буква — строго сверху (12 часов), дальше по часовой стрелке. Так
 * ребёнок начинает движение «от носа», а не с произвольной точки: на телефоне
 * это самое заметное место круга.
 */
export function ringBoard(word: Word): RingBoard | null {
  if (!ringFits(word)) return null;
  const letters = ringLetters(word);
  const danger = new Set(word.danger);
  const step = 360 / letters.length;
  const dots: RingDot[] = letters.map((letter, index) => {
    const raw = index * step;
    return {
      index,
      letter,
      // Округляем до десятых: ровные углы дают ровную геометрию в CSS и
      // стабильные значения в тестах (26.666666 дало бы разные строки).
      angle: Math.round(raw * 10) / 10,
      danger: danger.has(index),
    };
  });
  return { word, dots, letters: letters.length };
}

/**
 * Шаг по кругу. Возвращает новое число собранных букв.
 *
 * Правило одно: принимается только СЛЕДУЮЩАЯ буква. Промах возвращает тот же
 * прогресс — и вызывающая сторона по нему понимает, что был промах (сравнение
 * `===`). Так экран не держит второй копии правды: «сколько собрано» есть в
 * одном месте.
 */
export function ringStep(board: RingBoard, collected: number, letterIndex: number): number {
  if (collected < 0 || collected >= board.letters) return collected;
  return letterIndex === collected ? collected + 1 : collected;
}

/** Слово собрано целиком. */
export function ringDone(board: RingBoard, collected: number): boolean {
  return collected >= board.letters;
}

/**
 * Пул колеса: короткие слова класса. Порядок исходный (пул уже отсортирован
 * экраном по знакомству), курсор и приоритет применяет `pool-cursor`.
 */
export function ringPool(pool: ReadonlyArray<Word>): Word[] {
  return pool.filter(ringFits);
}
