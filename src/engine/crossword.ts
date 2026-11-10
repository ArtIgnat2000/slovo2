/**
 * «Кроссворд дня» — сетка из слов класса + пул букв, без вопросов.
 *
 * Чистая логика без React и DOM; детерминирована `seed` (как «Филворд»).
 *
 * Как устроен генератор (честно про алгоритм):
 *  • общий пересекающийся кроссворд — NP-трудная задача, поэтому «честный
 *    произвольный» не строим; вместо этого делаем 120 рестартов жадного
 *    размещения на виртуальном полотне 31×31: якорь — самое длинное слово,
 *    остальные кладутся туда, где дают больше пересечений, с жёсткими
 *    правилами школьной решётки (торцы свободны, параллельные не касаются,
 *    перпендикулярное касание вне пересечения запрещено);
 *  • слово, для которого хоть одно пересечение построить не удалось,
 *    уходит на «лестницу» — отдельная строка без пересечений (proposal §5-B);
 *  • из всех рестартов берём лучший: сначала число слов, потом сумма
 *    пересечений, потом компактность поля;
 *  • пул букв — ТОЧНОЕ мультимножество букв размещённых слов (без лишних):
 *    решение единственно по построению — перестановка тех же букв по клеткам
 *    единственна для каждого слота;
 *  • фразы («Великая Отечественная война») в сетку не идут.
 */

export interface CrosswordCell {
  row: number;
  col: number;
}

export type CrosswordDir = 'across' | 'down';

export interface CrosswordSlot {
  /** Номер слота после нумерации «по строкам» (1..N). */
  slot: number;
  dir: CrosswordDir;
  wordId: string;
  text: string;
  cells: CrosswordCell[];
}

export interface CrosswordBoard {
  rows: number;
  cols: number;
  /** rows×cols; null — заблокированная клетка. */
  letters: Array<Array<string | null>>;
  slots: CrosswordSlot[];
  /** Перемешанный (детерминированно) мультимножество букв решения. */
  pool: string[];
}

export interface BuildCrosswordOptions {
  seed: number;
  /** Максимум слов в сетке (по умолчанию 6). */
  maxWords?: number;
}

const CANVAS = 31;
const CENTER = Math.floor(CANVAS / 2);
const MAX_ATTEMPTS = 120;
const MIN_LEN = 3;
const MAX_LEN = 9;

const key = (row: number, col: number): string => `${row},${col}`;
/** Ключ клетки для Map/Record — принимает объект клетки. */
export const cellKey = (cell: CrosswordCell): string => key(cell.row, cell.col);

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

const lettersOf = (text: string): string[] => [...text.toLowerCase()];

export function sameCell(a: CrosswordCell, b: CrosswordCell): boolean {
  return a.row === b.row && a.col === b.col;
}

interface CanvasCell {
  letter: string;
  dir: CrosswordDir;
}

interface Placement {
  wordId: string;
  text: string;
  dir: CrosswordDir;
  row: number;
  col: number;
  cells: CrosswordCell[];
  crossings: number;
}

/** Проверка кандидата на размещение; null — нельзя. */
function candidatePlacement(
  canvas: Map<string, CanvasCell>,
  word: { id: string; text: string },
  dir: CrosswordDir,
  startRow: number,
  startCol: number,
): Placement | null {
  const letters = lettersOf(word.text);
  const cells: CrosswordCell[] = [];
  let crossings = 0;
  const crossingCells = new Set<number>();

  for (let i = 0; i < letters.length; i++) {
    const row = dir === 'across' ? startRow : startRow + i;
    const col = dir === 'across' ? startCol + i : startCol;
    if (row < 0 || row >= CANVAS || col < 0 || col >= CANVAS) return null;
    const existing = canvas.get(key(row, col));
    if (existing !== undefined) {
      if (existing.letter !== letters[i]) return null;
      if (existing.dir === dir) return null; // параллельное наложение запрещено
      crossings += 1;
      crossingCells.add(i);
    }
    cells.push({ row, col });
  }

  // Торцы пусты.
  const head = dir === 'across' ? { row: startRow, col: startCol - 1 } : { row: startRow - 1, col: startCol };
  const tail = dir === 'across'
    ? { row: startRow, col: startCol + letters.length }
    : { row: startRow + letters.length, col: startCol };
  if (canvas.has(key(head.row, head.col)) || canvas.has(key(tail.row, tail.col))) return null;

  // Боковые клетки: пусто. У клетки-пересечения соседи могут быть буквами
  // того перпендикулярного слова, сквозь которое мы проходим.
  for (let i = 0; i < cells.length; i++) {
    if (crossingCells.has(i)) continue;
    const { row, col } = cells[i];
    const neighbours: CrosswordCell[] = dir === 'across'
      ? [{ row: row - 1, col }, { row: row + 1, col }]
      : [{ row, col: col - 1 }, { row, col: col + 1 }];
    for (const n of neighbours) {
      if (canvas.has(key(n.row, n.col))) return null;
    }
  }

  return { wordId: word.id, text: word.text, dir, row: startRow, col: startCol, cells, crossings };
}

/** Все допустимые размещения слова с пересечением ≥ 1 с занятой областью. */
function intersectingPlacements(
  canvas: Map<string, CanvasCell>,
  word: { id: string; text: string },
): Placement[] {
  const letters = lettersOf(word.text);
  const out: Placement[] = [];
  const seen = new Set<string>();

  for (const [placedKey, placed] of canvas) {
    const placedLetter = placed.letter;
    // Клетка пересечения: существующая буква == буква слова?
    const [r, c] = placedKey.split(',').map(Number);
    for (let i = 0; i < letters.length; i++) {
      if (letters[i] !== placedLetter) continue;
      // Слово перпендикулярно «сквозь» клетку (r,c) на i-й букве.
      for (const dir of (placed.dir === 'across' ? (['down'] as const) : (['across'] as const))) {
        const startRow = dir === 'across' ? r : r - i;
        const startCol = dir === 'across' ? c - i : c;
        const p = candidatePlacement(canvas, word, dir, startRow, startCol);
        if (!p || p.crossings < 1) continue;
        const sig = `${p.dir}:${p.row}:${p.col}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        out.push(p);
      }
    }
  }
  return out;
}

interface AttemptResult {
  placements: Placement[];
  crossings: number;
  bboxArea: number;
}

function scoreAttempt(res: AttemptResult): number {
  // Число слов важнее всего, дальше — пересечения, дальше — компактность.
  return res.placements.length * 1_000_000 + res.crossings * 10_000 - res.bboxArea * 120;
}

function attemptPlacement(
  ordered: Array<{ id: string; text: string }>,
  rng: () => number,
): AttemptResult {
  const canvas = new Map<string, CanvasCell>();
  const placements: Placement[] = [];

  const anchor = ordered[0];
  const anchorLetters = lettersOf(anchor.text);
  const anchorRow = CENTER;
  const anchorCol = Math.round((CANVAS - anchorLetters.length) / 2);
  const anchorPlacement = candidatePlacement(canvas, anchor, 'across', anchorRow, anchorCol)!;
  for (let i = 0; i < anchorLetters.length; i++) canvas.set(key(anchorRow, anchorCol + i), { letter: anchorLetters[i], dir: 'across' });
  placements.push(anchorPlacement);

  const rest = ordered.slice(1);
  // Стохастический порядок размещения: иногда пробуем не по длине.
  rest.sort(() => rng() - 0.5);

  let crossings = 0;
  for (const word of rest) {
    const options = intersectingPlacements(canvas, word);
    if (options.length === 0) continue;
    // Лучшее: больше пересечений, потом компактнее bbox.
    options.sort((a, b) => {
      if (b.crossings !== a.crossings) return b.crossings - a.crossings;
      const areaA = bboxAreaWith(placements, a);
      const areaB = bboxAreaWith(placements, b);
      return areaA - areaB;
    });
    const best = options[0];
    const bestLetters = lettersOf(best.text);
    for (let i = 0; i < best.cells.length; i++) canvas.set(key(best.cells[i].row, best.cells[i].col), { letter: bestLetters[i], dir: best.dir });
    placements.push(best);
    crossings += best.crossings;
  }

  const bbox = boundingBox(placements.flatMap((p) => p.cells));
  // На телефоне поле уже 13×12 клеток — широкое поле отвергаем целиком.
  const bboxArea = bbox.w > 13 || bbox.h > 12 ? 1_000_000_000 : bbox.w * bbox.h;
  return { placements, crossings, bboxArea };
}

function bboxAreaWith(placements: Placement[], extra: Placement): number {
  const cells = [...placements.flatMap((p) => p.cells), ...extra.cells];
  const bbox = boundingBox(cells);
  return bbox.w * bbox.h;
}

function boundingBox(cells: CrosswordCell[]): { minRow: number; minCol: number; w: number; h: number } {
  let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
  for (const c of cells) {
    if (c.row < minRow) minRow = c.row;
    if (c.row > maxRow) maxRow = c.row;
    if (c.col < minCol) minCol = c.col;
    if (c.col > maxCol) maxCol = c.col;
  }
  return { minRow, minCol, w: maxCol - minCol + 1, h: maxRow - minRow + 1 };
}

/** «Лестница»: слова без пересечений — отдельными строками под блоком. */
function ladderPlacements(
  placements: Placement[],
  unplaced: Array<{ id: string; text: string }>,
): Placement[] {
  if (unplaced.length === 0) return placements;
  const out = [...placements];
  let row = placements.length ? boundingBox(placements.flatMap((p) => p.cells)).minRow + boundingBox(placements.flatMap((p) => p.cells)).h + 1 : CENTER;
  let col = 0;
  if (placements.length) {
    col = boundingBox(placements.flatMap((p) => p.cells)).minCol;
  }
  for (const word of unplaced) {
    const letters = lettersOf(word.text);
    const cells: CrosswordCell[] = [];
    for (let i = 0; i < letters.length; i++) cells.push({ row, col: col + i });
    out.push({ wordId: word.id, text: word.text, dir: 'across', row, col, cells, crossings: 0 });
    row += 2;
  }
  return out;
}

/**
 * Собрать доску из пула. `pool` — это уже «встреченные ребёнком» слова.
 * Возвращает null, если слов для сетки не хватает.
 */
export function buildCrossword(
  pool: ReadonlyArray<{ id: string; text: string }>,
  opts: BuildCrosswordOptions,
): CrosswordBoard | null {
  const { seed, maxWords = 6 } = opts;
  const candidates = pool
    .filter((w) => !w.text.includes(' '))
    .map((w) => ({ id: w.id, text: w.text }))
    .filter((w) => {
      const n = lettersOf(w.text).length;
      return n >= MIN_LEN && n <= MAX_LEN;
    });
  if (candidates.length < 3) return null;

  const ordered = [...candidates].sort(
    (a, b) => lettersOf(b.text).length - lettersOf(a.text).length || a.text.localeCompare(b.text, 'ru'),
  );
  const chosen = ordered.slice(0, maxWords);

  const rng = mulberry32(seed);
  let best: AttemptResult | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = attemptPlacement(chosen, rng);
    if (!best || scoreAttempt(result) > scoreAttempt(best)) best = result;
  }
  if (!best) return null;

  // «Лестница» для тех, кто не лёг в сеть.
  const placedIds = new Set(best.placements.map((p) => p.wordId));
  const unplaced = chosen.filter((w) => !placedIds.has(w.id));
  const all = ladderPlacements(best.placements, unplaced);

  // Обрезаем к содержимому и перенумеровываем слоты по строкам.
  const bbox = boundingBox(all.flatMap((p) => p.cells));
  const rows = bbox.h;
  const cols = bbox.w;
  const letters: Array<Array<string | null>> = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));

  const slotsOrdered = [...all].sort((a, b) => a.row - b.row || a.col - b.col || (a.dir === 'across' ? -1 : 1));
  const slots: CrosswordSlot[] = slotsOrdered.map((p, index) => {
    const cells = p.cells.map((c) => ({ row: c.row - bbox.minRow, col: c.col - bbox.minCol }));
    for (let i = 0; i < cells.length; i++) letters[cells[i].row][cells[i].col] = lettersOf(p.text)[i];
    return { slot: index + 1, dir: p.dir, wordId: p.wordId, text: p.text, cells };
  });

  // Пул: точное мультимножество УНИКАЛЬНЫХ клеток решения (перескёстные
  // буквы занимают одну клетку), перемешано детерминированно.
  const bag: string[] = [];
  const seenCells = new Set<string>();
  for (const slot of slots) {
    for (const cell of slot.cells) {
      const k = key(cell.row, cell.col);
      if (seenCells.has(k)) continue;
      seenCells.add(k);
      bag.push(letters[cell.row][cell.col] as string);
    }
  }
  const shuffleRng = mulberry32(seed ^ 0x9e3779b9);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(shuffleRng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }

  return { rows, cols, letters, slots, pool: bag };
}

export interface EvaluateFillsResult {
  filledCells: number;
  totalCells: number;
  /** Слоты, которые заполнены верно. */
  correct: number[];
  /** Слоты, которые заполнены, но неверно. */
  wrong: number[];
  /** Всё верно — победа. */
  win: boolean;
}

/** Проверка текущего заполнения по клеткам (ключ — `row,col`). */
export function evaluateFills(
  board: CrosswordBoard,
  fills: Readonly<Record<string, string>>,
): EvaluateFillsResult {
  const allCells = new Set<string>();
  for (const slot of board.slots) slot.cells.forEach((c) => allCells.add(key(c.row, c.col)));

  let filledCells = 0;
  for (const k of allCells) if (fills[k]) filledCells += 1;

  const correct: number[] = [];
  const wrong: number[] = [];
  for (const slot of board.slots) {
    const joined = slot.cells.map((c) => fills[key(c.row, c.col)] ?? '').join('');
    if (joined.length === 0) continue;
    if (joined.length < [...slot.text].length) continue;
    if (joined === lettersOf(slot.text).join('')) correct.push(slot.slot);
    else wrong.push(slot.slot);
  }

  return {
    filledCells,
    totalCells: allCells.size,
    correct,
    wrong,
    win: correct.length === board.slots.length,
  };
}
