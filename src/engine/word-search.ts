/**
 * «Филворд» — поиск слов на буквенном поле.
 *
 * Чистая геометрия и чистый PRNG — без React и без DOM: сетка строится
 * детерминированно из `seed`, поэтому смоук-тесты и «Новая сетка» работают
 * одинаково предсказуемо.
 *
 * Правила доски:
 *  • поле 8×8 (1–3 класс) или 9×9 (4–5 класс); если в срезе почти нет
 *    коротких слов, поле аккуратно растёт до 12×12 — лучше большое поле,
 *    чем честный, но пустой экран;
 *  • прячем не больше MAX_WORDS слов, сначала длинные; пересечения разрешены,
 *    если совпадают буквы (филворд «держится» на пересечениях);
 *  • 4–5 класс ищут по горизонтали и вертикали; 5 класс — ещё и по
 *    диагоналям (так задумано в proposal §5-C);
 *  • пустые клетки добиваем буквами с частотным распределением русского
 *    алфавита — поле не выглядит «как попало»;
 *  • словарные фразы («Великая Отечественная война») в сетку не идут:
 *    их нельзя выделить одним росчерком.
 */

export interface WsCell {
  row: number;
  col: number;
}

export interface WsPlacedWord {
  wordId: string;
  /** Текст в исходном регистре банка (ё и заглавные сохранены). */
  text: string;
  /** Клетки слова по порядку букв. */
  cells: WsCell[];
  /** Клетки «опасных» букв слова (danger → cells по тем же индексам). */
  dangerCells: WsCell[];
}

export interface WordSearchBoard {
  size: number;
  /** size × size, русские строчные буквы. */
  cells: string[][];
  words: WsPlacedWord[];
  /**
   * Курсор для СЛЕДУЮЩЕЙ сетки (0.96.5). Считается здесь, а не на экране:
   * курсор ходит по кругу той выборки, из которой движок реально берёт слова
   * (длинные «телепередача» и «библиотекарь» отсеиваются по длине), а экран
   * знал бы только длину исходного пула — шаги расходились бы и слова
   * повторялись.
   */
  nextCursor: number;
}

/** Минимум слов, ради которых игра вообще имеет смысл. */
export const WS_MIN_WORDS = 3;
/** Больше этого в детское поле не прячем — поле перестаёт читаться. */
export const WS_MAX_WORDS = 7;

const DIRECTIONS_STRAIGHT: WsCell[] = [
  { row: 0, col: 1 },
  { row: 1, col: 0 },
];
const DIRECTIONS_WITH_DIAGONALS: WsCell[] = [
  ...DIRECTIONS_STRAIGHT,
  { row: 1, col: 1 },
  { row: 1, col: -1 },
];

/** Оценочные частоты букв русского алфавита (в %); «ё» встречается реже «е». */
const FILLER: ReadonlyArray<readonly [string, number]> = [
  ['о', 10.97], ['е', 8.45], ['а', 8.01], ['и', 7.35], ['н', 6.7], ['т', 6.26],
  ['с', 5.47], ['р', 4.73], ['в', 4.54], ['л', 4.4], ['к', 3.49], ['м', 3.21],
  ['д', 2.98], ['п', 2.81], ['у', 2.62], ['я', 2.01], ['ы', 1.9], ['ь', 1.74],
  ['г', 1.7], ['з', 1.65], ['б', 1.59], ['ч', 1.44], ['й', 1.21], ['х', 0.97],
  ['ж', 0.94], ['ш', 0.73], ['ю', 0.64], ['ц', 0.48], ['щ', 0.36], ['э', 0.32],
  ['ф', 0.26], ['ё', 0.04], ['ъ', 0.04],
];

const FILLER_TOTAL = FILLER.reduce((sum, [, w]) => sum + w, 0);

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFillerLetter(rng: () => number): string {
  let roll = rng() * FILLER_TOTAL;
  for (const [ch, weight] of FILLER) {
    roll -= weight;
    if (roll <= 0) return ch;
  }
  return 'о';
}

/** Буквы текста слова; регистр приводим к строчному для сетки. */
function lettersOf(text: string): string[] {
  return [...text.toLowerCase()];
}

/** Сколько слов хотим видеть на поле: меньше — поле «пустое», больше — каша. */
const WORDS_TARGET = 5;
/**
 * Доля пула, которую поле забирает за один раз (0.96.5).
 *
 * Ровно половина — не «на глаз»: следующая сетка начинается ровно с того места
 * круга, где кончилась прошлая, поэтому при половине пула две соседние сетки
 * вообще не пересекаются словами, а слово возвращается лишь после полного
 * обхода. Раньше (0.96.4) доска брала 60 % и «хвост» повторялся через раз:
 * владелец видел «постоянно телефон» (замечание 2026-11-11).
 */
const BOARD_SHARE = 0.5;

import { pickBoardWords } from './pool-cursor';

export interface BuildWordSearchOptions {
  grade: number;
  seed: number;
  /**
   * С какого места круга начинать выбор слов (0.96.5). Экран сдвигает курсор
   * на число показанных слов, поэтому каждая новая сетка начинается с новых
   * слов, а весь пул проходится по кругу (см. `engine/pool-cursor.ts`).
   */
  cursor?: number;
  /**
   * Слова, в которых ребёнок ошибается (0.96.7): игра — это тренировка, а не
   * случайная выборка, поэтому такие слова идут на поле первыми.
   */
  priorityIds?: ReadonlyArray<string>;
  /**
   * Слова прошлой сетки: в новом поле они берутся в последнюю очередь.
   * «Новая сетка» должна менять не только расположение букв, но и слова
   * (замечание 2026-11-11). Если свежих слов не хватает на доску, они
   * возвращаются — пустой экран хуже повтора.
   */
  avoidIds?: ReadonlyArray<string>;
}

/** Сколько слов прячем на поле: не меньше трёх, не больше детского предела. */
const WORDS_MAX = WS_MAX_WORDS;

/**
 * Дубликаты на поле запрещены физически (0.96.3).
 *
 * Даже если движок получит список с повторами (ошибка в вызывающем коде —
 * именно так на телефоне появились три «телефон», три «беседа» и три
 * «человек» в одной сетке, замечание 2026-11-11), доска не покажет одно слово
 * дважды: клетки у повтора указывают на тот же wordId, `matchSelection`
 * засчитывает первое найденное и остальные оставляет «ненайденными», и
 * ребёнок видит нерешаемый чип.
 */
function uniqueById<T extends { id: string }>(list: ReadonlyArray<T>): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/**
 * Правила сетки по классу (0.104.0, §6-G плана «Игры»).
 *
 * До 0.104.0 всё было «одно на всех»: поле 8×8 в младших и 9×9 с 4 класса,
 * диагонали — только с 5-го. Владелец просил обратное: **малым классам поле
 * поменьше**, а старшим — всё, что они уже могут. Отсюда одна функция, а не
 * числа, разбросанные по коду: правила класса должны меняться в одном месте.
 *
 * Почему 7×7 для 1 класса, а не 6×6 из §6-G: на 6×6 не помещаются три слова
 * по 7–8 букв практически ни в каком расположении, и поле начало бы отдавать
 * `null` (пустой экран) на нормальном пуле первого класса. 7×7 — предел, на
 * котором три коротких слова встают без пересечений, а клетка остаётся
 * крупной для пальца.
 */
export function fieldSizeFor(grade: number): number {
  if (grade <= 1) return 7;
  if (grade === 2) return 8;
  if (grade === 3) return 8;
  return 9;
}

/** Диагонали: с 4 класса. Раньше — только с 5-го, хотя в 4 классе слова уже длинные. */
export function directionsFor(grade: number): WsCell[] {
  return grade >= 4 ? DIRECTIONS_WITH_DIAGONALS : DIRECTIONS_STRAIGHT;
}

/**
 * Собираем доску из переданного пула (это уже «встреченные ребёнком» слова).
 * Возвращает null, если спрятать нечего — UI показывает честную заглушку.
 */
export function buildWordSearch(pool: ReadonlyArray<{
  id: string;
  text: string;
  danger?: number[];
}>, opts: BuildWordSearchOptions): WordSearchBoard | null {
  const { grade, seed } = opts;
  // Пул без повторов: одно слово — одна позиция в сетке.
  const uniquePool = uniqueById(pool);
  const candidates = uniquePool.filter((w) => !w.text.includes(' ') && lettersOf(w.text).length >= 2);

  // Размер и направления поля — по правилам класса (0.104.0, §6-G плана).
  let size = fieldSizeFor(grade);
  while (size < 12 && candidates.filter((w) => lettersOf(w.text).length <= size).length < WS_MIN_WORDS) {
    size += 1;
  }
  const placeable = candidates.filter((w) => lettersOf(w.text).length <= size);
  if (placeable.length < WS_MIN_WORDS) return null;

  const rng = mulberry32(seed);
  const directions = directionsFor(grade);
  const grid: Array<Array<string | null>> = Array.from({ length: size }, () => Array.from({ length: size }, () => null));
  const placed: WsPlacedWord[] = [];
  const placedIds = new Set<string>();

  /**
   * Сколько слов берём за сетку.
   *
   * Было: движок прятал до семи слов, то есть на пуле из шести изученных слов
   * забирал ВСЕ — и «Новая сетка» не могла показать другие слова, ей просто
   * нечего было менять (замечание 2026-11-11: «так и не работает смена
   * слов»). Теперь смена работает на любом пуле:
   *   пул 3–7 слов → 3 (иначе сетки не собрать);
   *   пул 8–9      → 4;
   *   пул 10+      → 5 (предел поля).
   * Две соседние сетки при этом не пересекаются словами: курсор сдвигается
   * ровно на число показанных слов.
   */
  const placedLimit = Math.min(
    WORDS_MAX,
    WORDS_TARGET,
    Math.max(WS_MIN_WORDS, Math.floor(placeable.length * BOARD_SHARE)),
  );

  // Слова идут по кругу с курсором: порция — первые `placedLimit` слов.
  // Курсор следующей сетки сдвигается ровно на размер порции, поэтому
  // соседние сетки начинаются с новых слов (замечание 2026-11-11).
  const pickedResult = pickBoardWords(placeable, placedLimit, {
    cursor: opts.cursor,
    avoidIds: opts.avoidIds,
    priorityIds: opts.priorityIds,
    rng,
  });
  const picked = pickedResult.chosen;

  for (const word of picked) {
    if (placed.length >= placedLimit) break;
    // Страховка от повторов: одно слово — одна позиция, что бы ни пришло
    // в списке (см. uniqueById выше).
    if (placedIds.has(word.id)) continue;
    const letters = lettersOf(word.text);
    const placedWord = tryPlace(grid, word, letters, directions, rng);
    if (placedWord) {
      placed.push(placedWord);
      placedIds.add(word.id);
    }
  }

  if (placed.length < WS_MIN_WORDS) return null;

  const cells = grid.map((row) => row.map((cell) => cell ?? pickFillerLetter(rng)));
  // Курсор приходит из выбора слов: он ставится за последним выбранным в
  // круге (по пригодной выборке — ровно по тому кругу, откуда брали слова),
  // поэтому следующая сетка начинается с новых слов.
  const nextCursor = pickedResult.cursor;
  return { size, cells, words: placed, nextCursor };
}

function tryPlace(
  grid: Array<Array<string | null>>,
  word: { id: string; text: string; danger?: number[] },
  letters: string[],
  directions: WsCell[],
  rng: () => number,
): WsPlacedWord | null {
  const size = grid.length;
  for (let attempt = 0; attempt < 240; attempt++) {
    const dir = directions[Math.floor(rng() * directions.length)];
    const n = letters.length - 1; // смещение последней буквы от первой
    const minRow = 0;
    const maxRow = dir.row === 0 ? size - 1 : size - 1 - n * dir.row;
    const minCol = dir.col === -1 ? n : 0;
    const maxCol = dir.col === 0 ? size - 1 : dir.col === 1 ? size - 1 - n : size - 1;
    if (maxRow < minRow || maxCol < minCol) continue;
    const row = minRow + Math.floor(rng() * (maxRow - minRow + 1));
    const col = dir.col === 0
      ? Math.floor(rng() * size)
      : minCol + Math.floor(rng() * (maxCol - minCol + 1));

    const cells: WsCell[] = [];
    let ok = true;
    for (let i = 0; i < letters.length; i++) {
      const r = row + dir.row * i;
      const c = col + dir.col * i;
      if (r < 0 || r >= size || c < 0 || c >= size) { ok = false; break; }
      const existing = grid[r][c];
      if (existing !== null && existing !== letters[i]) { ok = false; break; }
      cells.push({ row: r, col: c });
    }
    if (!ok) continue;

    for (let i = 0; i < letters.length; i++) grid[cells[i].row][cells[i].col] = letters[i];
    const dangerCells = (word.danger ?? [])
      .filter((index) => index >= 0 && index < cells.length)
      .map((index) => cells[index]);
    return { wordId: word.id, text: word.text, cells, dangerCells };
  }
  return null;
}

export const sameCell = (a: WsCell, b: WsCell): boolean => a.row === b.row && a.col === b.col;

export const cellKey = (cell: WsCell): string => `${cell.row},${cell.col}`;

/**
 * Клетки ровной линии от `start` до `end` включительно.
 * Нулевая длина — сама клетка; не линия (не горизонталь/вертикаль/диагональ) — null.
 */
export function selectionCells(start: WsCell, end: WsCell): WsCell[] | null {
  const dr = end.row - start.row;
  const dc = end.col - start.col;
  if (dr === 0 && dc === 0) return [{ ...start }];
  const straight = dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc);
  if (!straight) return null;
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  const stepRow = Math.sign(dr);
  const stepCol = Math.sign(dc);
  const cells: WsCell[] = [];
  for (let i = 0; i <= steps; i++) {
    cells.push({ row: start.row + stepRow * i, col: start.col + stepCol * i });
  }
  return cells;
}

/**
 * Метод к доске: какое слово найдено выделенной линией (в любую сторону).
 * Уже найденные слова не засчитываются повторно.
 */
export function matchSelection(
  words: WsPlacedWord[],
  foundIds: ReadonlySet<string>,
  selection: WsCell[],
): WsPlacedWord | null {
  if (selection.length < 2) return null;
  const forward = selection.map(cellKey).join('|');
  const backward = [...selection].reverse().map(cellKey).join('|');
  for (const word of words) {
    if (foundIds.has(word.wordId)) continue;
    if (word.cells.length !== selection.length) continue;
    const key = word.cells.map(cellKey).join('|');
    if (key === forward || key === backward) return word;
  }
  return null;
}
