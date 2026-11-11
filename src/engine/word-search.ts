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

export interface BuildWordSearchOptions {
  grade: number;
  seed: number;
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

  // Базовый размер по классу; если коротких слов не хватает — растим поле.
  let size = grade >= 4 ? 9 : 8;
  while (size < 12 && candidates.filter((w) => lettersOf(w.text).length <= size).length < WS_MIN_WORDS) {
    size += 1;
  }
  const placeable = candidates.filter((w) => lettersOf(w.text).length <= size);
  if (placeable.length < WS_MIN_WORDS) return null;

  const rng = mulberry32(seed);
  const directions = grade >= 5 ? DIRECTIONS_WITH_DIAGONALS : DIRECTIONS_STRAIGHT;
  const grid: Array<Array<string | null>> = Array.from({ length: size }, () => Array.from({ length: size }, () => null));
  const placed: WsPlacedWord[] = [];
  const placedIds = new Set<string>();

  // Пробуем несколько составов слов: если первая порция упёрлась в границы
  // поля и не легла, берём следующую — поле всё равно должно получиться,
  // иначе сетка окажется пустым экраном.
  // `avoidIds` передаём всегда: свежие слова идут первыми, прошлые — в конце
  // очереди (и попадут на поле, только если свежих не хватило).
  for (const window of wordWindows(placeable, rng, opts.avoidIds)) {
    for (const word of window) {
      if (placed.length >= WORDS_MAX) break;
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
    if (placed.length >= WORDS_TARGET) break;
  }

  if (placed.length < WS_MIN_WORDS) return null;

  const cells = grid.map((row) => row.map((cell) => cell ?? pickFillerLetter(rng)));
  return { size, cells, words: placed };
}

/**
 * Составы слов для поля — от самого «богатого» к самому простому.
 *
 * Было: слова брались строго по длине (`sort` по убыванию), поэтому каждый
 * заход на «Филворд» показывал один и тот же набор — самые длинные слова пула
 * (замечание владельца 2026-11-11: «чтобы были разные слова, а не жёстко один
 * набор»).
 *
 * Стало: порядок слов случайный, а «якорь» (первое, самое длинное слово)
 * каждый раз новый. Слова прошлой сетки (`avoidIds`) уходят в самый конец —
 * «Новая сетка» меняет и слова, а не только расположение букв. Порядок здесь
 * не косметика: `tryPlace` идёт по списку сверху вниз и прячет то, что легло,
 * поэтому список = приоритет.
 *
 *  • первое окно — якорь + свежие слова вперемешку (разные длины: филворд не
 *    должен состоять из одних 8-буквенных «извините» и «обезьяна»);
 *  • второе — весь пул, включая прошлую сетку: если пул крошечный, лучше
 *    повторить слово, чем показать пустой экран.
 */
function wordWindows(
  placeable: ReadonlyArray<{ id: string; text: string; danger?: number[] }>,
  rng: () => number,
  avoidIds?: ReadonlyArray<string>,
): Array<Array<{ id: string; text: string; danger?: number[] }>> {
  type Candidate = { id: string; text: string; danger?: number[] };
  const avoid = new Set(avoidIds ?? []);
  const len = (w: { text: string }) => lettersOf(w.text).length;
  const shuffled = <T,>(list: readonly T[]): T[] => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  const fresh: Candidate[] = shuffled(placeable.filter((w) => !avoid.has(w.id)));
  const old: Candidate[] = shuffled(placeable.filter((w) => avoid.has(w.id)));
  // Якорь — случайное из самых длинных свежих слов: его заметнее всего искать,
  // а класть в пустое поле проще всего.
  const longest = Math.max(0, ...fresh.map(len));
  const anchorPool = fresh.filter((w) => len(w) === longest);
  const anchor = anchorPool.length > 0 ? anchorPool[Math.floor(rng() * anchorPool.length)] : fresh[0] ?? null;
  const rest = shuffled(fresh.filter((w) => w.id !== anchor?.id));

  const primary: Candidate[] = [...(anchor ? [anchor] : []), ...rest];
  const all: Candidate[] = [...new Map([...primary, ...old].map((w) => [w.id, w])).values()];
  return [primary, all];
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
