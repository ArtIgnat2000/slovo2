// «Кроссворд дня» (0.95.0): движок решётки — без DOM.
import './setup';
import {
  buildCrossword,
  evaluateFills,
  cellKey,
  type CrosswordCell,
} from '../src/engine/crossword';
import { WORDS_BY_GRADE } from '../src/content/words';
import { check } from './ui-helpers';

const poolOf = (grade: 1 | 2 | 3 | 4 | 5, n = 60) =>
  WORDS_BY_GRADE[grade].filter((w) => !w.text.includes(' ')).slice(0, n);

const multiset = (chars: string[]) => [...chars].sort().join('');

export async function runCrosswordChecks(): Promise<void> {
  console.log('\n── Кроссворд дня: движок решётки ──');

  // ── 1. Доска собирается и детерминирована ───────────────────────────────
  const a = buildCrossword(poolOf(2), { seed: 42 });
  const b = buildCrossword(poolOf(2), { seed: 42 });
  check('кроссворд: доска со seed=42 собирается', !!a, '');
  check('кроссворд: одинаковый seed → одинаковая доска', !!a && !!b && JSON.stringify(a) === JSON.stringify(b), '');
  if (!a) return;
  check('кроссворд: 6 слов, не больше', a.slots.length > 0 && a.slots.length <= 6, `слоты: ${a.slots.length}`);
  check('кроссворд: поле ≤ 13×12', a.cols <= 13 && a.rows <= 12, `${a.rows}×${a.cols}`);
  check('кроссворд: клетки ровно столько, сколько лита букв',
    a.slots.every((s) => s.cells.length === [...s.text].length), '');
  check('кроссворд: буквы сетки совпадают со словами',
    a.slots.every((s) =>
      [...s.text.toLowerCase()].every((ch, i) =>
        a.letters[s.cells[i].row][s.cells[i].col] === ch)), '');
  const uniqueCellLetters = [...new Map(
    a.slots.flatMap((s) => {
      const letters = [...s.text.toLowerCase()];
      return s.cells.map((c, i) => [cellKey(c), letters[i]] as const);
    }),
  ).values()];
  check('кроссворд: пул — точное мультимножество БУКВ КЛЕТОК (пересечения один раз)',
    multiset(a.pool) === multiset(uniqueCellLetters), '');

  // Пересечения для типового сида
  const uniqueCells = new Set(a.slots.flatMap((s) => s.cells.map((c) => cellKey(c))));
  const totalCells = a.slots.reduce((n, s) => n + s.cells.length, 0);
  const crossings = totalCells - uniqueCells.size;
  check('кроссворд: слова пересекаются (≥ 3 общих клеток)', crossings >= 3, `пересечения: ${crossings}`);

  // ── 2. Направления и границы ─────────────────────────────────────────────
  check('кроссворд: направления идут ровными линиями',
    a.slots.every((s) => {
      for (let i = 1; i < s.cells.length; i++) {
        const prev = s.cells[i - 1];
        const cur = s.cells[i];
        if (s.dir === 'across' && (prev.row !== cur.row || cur.col !== prev.col + 1)) return false;
        if (s.dir === 'down' && (prev.col !== cur.col || cur.row !== prev.row + 1)) return false;
      }
      return true;
    }), '');
  const inside = a.slots.every((s) =>
    s.cells.every((c: CrosswordCell) => c.row >= 0 && c.row < a.rows && c.col >= 0 && c.col < a.cols));
  check('кроссворд: все клетки внутри поля', inside, '');

  // ── 2b. Набор слов меняется, повторов нет (0.96.3) ──────────────────────
  const richPool2 = WORDS_BY_GRADE[2].filter((w) => !w.text.includes(' ') && !w.text.includes(' ')).slice(0, 30);
  const setOf = (b: NonNullable<ReturnType<typeof buildCrossword>>) => b.slots.map((s) => s.wordId);
  const boards = Array.from({ length: 6 }, (_, i) => buildCrossword(richPool2, { seed: 700 + i })).filter(
    (b): b is NonNullable<typeof b> => !!b,
  );
  check('кроссворд: разные seed → разные наборы слов',
    boards.length > 1 && boards.some((b) => setOf(b).join(',') !== setOf(boards[0]).join(',')),
    boards.map((b) => setOf(b).length).join('/'));
  check('кроссворд: одно слово не занимает два слота',
    boards.every((b) => setOf(b).length === new Set(setOf(b)).size), '');
  const dupPool = [...richPool2, ...richPool2];
  const dedup = buildCrossword(dupPool, { seed: 3 });
  check('кроссворд: дубликаты во входном пуле не дают двойных слотов',
    !!dedup && setOf(dedup).length === new Set(setOf(dedup)).size, '');

  // «Ещё кроссворд» не повторяет слова прошлой сетки, пока есть свежие.
  let prevIds: string[] = [];
  let cwOverlap = 0;
  for (let i = 0; i < 5; i++) {
    const next = buildCrossword(richPool2, { seed: 800 + i, avoidIds: prevIds });
    if (!next) continue;
    const ids = setOf(next);
    if (i > 0) cwOverlap += ids.filter((id) => prevIds.includes(id)).length;
    prevIds = ids;
  }
  check('кроссворд: новая сетка не повторяет слова прошлой', cwOverlap === 0, `повторов: ${cwOverlap}`);

  // ── 2c. Смена набора работает на любом пуле (0.96.4) ────────────────────
  // Было: решётка забирала весь пул (и даже добавляла в «лестницу» слова,
  // не поместившиеся в лимит), поэтому «Ещё кроссворд» не менял слова.
  for (const size of [4, 6, 9]) {
    const poolN = WORDS_BY_GRADE[2].filter((w) => !w.text.includes(' ') && [...w.text].length <= 9).slice(0, size);
    let prevIds: string[] = [];
    let firstSlots = 0;
    let sameSet = 0;
    let withoutNew = 0;
    let boards = 0;
    for (let i = 0; i < 4; i++) {
      const b = buildCrossword(poolN, { seed: 600 + i, avoidIds: prevIds });
      if (!b) break;
      const ids = b.slots.map((s) => s.wordId);
      if (i === 0) firstSlots = ids.length;
      if (i > 0) {
        boards++;
        if (ids.slice().sort().join(',') === prevIds.slice().sort().join(',')) sameSet++;
        if (ids.every((id) => prevIds.includes(id))) withoutNew++;
      }
      prevIds = ids;
    }
    check(`кроссворд: на пуле ${size} слов набор не повторяется один в один`, sameSet === 0, `совпадений: ${sameSet}`);
    check(`кроссворд: на пуле ${size} слов в каждой сетке есть новое слово`, boards > 0 && withoutNew === 0,
      `без новых: ${withoutNew} из ${boards}`);
    check(`кроссворд: на пуле ${size} слов сетка не забирает весь пул`, firstSlots < size, `слотов: ${firstSlots}`);
  }

  // ── 3. Входной фильтр ────────────────────────────────────────────────────
  const tooFew = buildCrossword(poolOf(2, 2), { seed: 1 });
  check('кроссворд: меньше трёх слов — честный null', tooFew === null, '');
  const onlyPhrases = WORDS_BY_GRADE[2].filter((w) => w.text.includes(' ')).slice(0, 6);
  check('кроссворд: только фразы — null', buildCrossword(onlyPhrases, { seed: 1 }) === null, '');

  // Длиннее 9 букв не берём — поле на телефоне обязано вместиться
  const longWords = WORDS_BY_GRADE[5].filter((w) => !w.text.includes(' ') && [...w.text].length > 9);
  const short = WORDS_BY_GRADE[5].filter((w) => !w.text.includes(' ') && [...w.text].length <= 9);
  const fit = buildCrossword([...short.slice(0, 30), ...longWords.slice(0, 10)], { seed: 5 });
  check('кроссворд: длинные слова (>9 букв) не попадают в сетку',
    !!fit && fit.slots.every((s) => [...s.text].length <= 9), '');

  // Все классы дают играбельную доску
  for (const grade of [1, 2, 3, 4, 5] as const) {
    const board = buildCrossword(poolOf(grade), { seed: 7 });
    check(`кроссворд: ${grade} класс собирается`, !!board && board.slots.length >= 3, `${board?.rows}×${board?.cols}, слоты: ${board?.slots.length}`);
  }

  // ── 4. evaluateFills ─────────────────────────────────────────────────────
  const solution: Record<string, string> = {};
  for (const slot of a.slots) {
    const letters = [...slot.text.toLowerCase()];
    slot.cells.forEach((cell, i) => {
      solution[cellKey(cell)] = solution[cellKey(cell)] ?? letters[i];
    });
  }
  const win = evaluateFills(a, solution);
  check('кроссворд: полное решение — победа', win.win && win.correct.length === a.slots.length, '');
  const empty = evaluateFills(a, {});
  check('кроссворд: пустое заполнение — не победа, ошибок 0', !empty.win && empty.wrong.length === 0, '');

  // Сломаем первую букву первого слота — РОВНО его слово станет неверным.
  const first = a.slots[0];
  const broken = { ...solution };
  const target = first.cells[0];
  const original = broken[cellKey(target)];
  broken[cellKey(target)] = original === 'а' ? 'о' : 'а';
  const ev = evaluateFills(a, broken);
  check('кроссворд: одна сломанная буква → слот в wrong', ev.wrong.includes(first.slot) && !ev.win, '');
}
