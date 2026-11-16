/**
 * «Колесо букв» — проведи по слову (0.103.0, §6-C плана «Игры»).
 *
 * Буквы слова стоят по кругу. Ребёнок ведёт палец по ним в порядке слова, и
 * слово «собирается». Тап работает так же, как ведение (доступность и
 * клавиатура) — это в филворде уже проверенный приём.
 *
 * Почему круг, а не прямая. «Собери слово» уже есть, и оно про порядок букв
 * на прямой. Колесо даёт другое действие: непрерывное движение по кругу,
 * «телесный» вход в слово. До 0.118.1 буквы лежали на окружности в порядке
 * слова — владелец сказал «так слишком просто» (скриншот 2026-11-16): ребёнок
 * просто вёл палец по кругу, не вспоминая слово. Теперь позиции на круге
 * перемешаны, а `index` остаётся порядком букв в слове: шаг принимает
 * следующую букву, но найти её на круге — уже задача.
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
 * Перемешать позиции на круге.
 *
 * Возвращает массив «номер позиции» для каждой буквы слова. Фишер—Йетс,
 * `random` можно подменить в тестах. Если перемешивание случайно вернуло
 * исходный порядок (или рандом всегда максимальный), сдвигаем на половину
 * круга, а не на одну позицию: сдвиг на одну оставил бы почти готовую
 * последовательность «со второй буквы и дальше по кругу».
 */
function ringSlots(count: number, random: () => number): number[] {
  const slots = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const roll = Math.floor(random() * (i + 1));
    // Защита от «рандома» ровно 1.0 из подмены: индекс не выходит за край.
    const j = Math.max(0, Math.min(i, roll));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const identity = slots.every((slot, i) => slot === i);
  if (identity && count > 1) {
    const shift = Math.max(1, Math.floor(count / 2));
    slots.push(...slots.splice(0, shift));
  }
  return slots;
}

/**
 * Стабильный «рандом» раскладки.
 *
 * Раскладка не должна зависеть от глобального `Math.random`: иначе она
 * меняется при каждом рендере и ломает детерминированные сценарии проверок.
 * Сеем от id и текста слова — один и тот же круг выглядит одинаково, пока
 * ребёнок не перейдёт к другому слову.
 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function textSeed(text: string): number {
  let hash = 2166136261;
  for (const ch of text) {
    hash = Math.imul(hash ^ (ch.codePointAt(0) ?? 0), 16777619);
  }
  return hash >>> 0;
}

/**
 * Раскладка по кругу.
 *
 * Буквы стоят на окружности в перемешанном порядке (0.118.1): `index` —
 * по-прежнему порядок букв в слове, `angle` — позиция на круге. Первая буква
 * больше не привязана к «12 часам»: иначе начало слова было бы видно сразу.
 * `random` можно подменить в тестах; по умолчанию — стабильный сид слова.
 */
export function ringBoard(word: Word, random?: () => number): RingBoard | null {
  if (!ringFits(word)) return null;
  const letters = ringLetters(word);
  const danger = new Set(word.danger);
  const step = 360 / letters.length;
  const slots = ringSlots(letters.length, random ?? seededRandom(textSeed(`${word.id}:${word.text}`)));
  const dots: RingDot[] = letters.map((letter, index) => {
    const raw = slots[index] * step;
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
