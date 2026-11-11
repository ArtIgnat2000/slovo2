// «Филворд» (0.94.0): движок буквенного поля — без DOM.
import './setup';
import {
  buildWordSearch,
  matchSelection,
  selectionCells,
  sameCell,
  WS_MAX_WORDS,
  type WsCell,
  type WsPlacedWord,
} from '../src/engine/word-search';
import { WORDS } from '../src/content/words';
import { check } from './ui-helpers';

const poolOf = (n: number) =>
  WORDS.filter((w) => !w.text.includes(' ')).slice(0, n);

/** Сколько уникальных значений в списке (для проверки повторов). */
const dd = (list: string[]) => new Set(list).size;

const someShortWords = () =>
  WORDS.filter((w) => !w.text.includes(' ') && [...w.text].length <= 8).slice(0, 5);

export async function runWordSearchChecks(): Promise<void> {
  console.log('\n── Филворд: движок поля ──');

  // ── 1. Доска собирается и детерминирована ───────────────────────────────
  const a = buildWordSearch(someShortWords(), { grade: 2, seed: 42 });
  const b = buildWordSearch(someShortWords(), { grade: 2, seed: 42 });
  check('филворд: доска со seed=42 собирается', !!a, '');
  check('филворд: одинаковый seed → одинаковая доска', !!a && !!b && JSON.stringify(a) === JSON.stringify(b), '');
  if (!a) return;
  check('филворд: поле 8×8 в младших классах', a.size === 8, `size=${a.size}`);
  check('филворд: 3–5 слов на поле', a.words.length >= 3 && a.words.length <= 5,
    `слов: ${a.words.length}`);

  const cyrillic = /^[а-яё]$/;
  check('филворд: все клетки заполнены русскими буквами',
    a.cells.every((row) => row.every((ch) => cyrillic.test(ch))), '');
  check('филворд: каждое слово лежит ровной линией и совпадает по буквам',
    a.words.every((w) => {
      const text = [...w.text.toLowerCase()];
      if (w.cells.length !== text.length) return false;
      return w.cells.every((cell, i) => a.cells[cell.row][cell.col] === text[i]);
    }), '');
  check('филворд: опасные буквы указывают на клетки слова',
    a.words.every((w) => {
      const source = someShortWords().find((s) => s.id === w.wordId);
      if (!source) return true;
      return (source.danger ?? []).every((d) =>
        d < w.cells.length && w.dangerCells.some((c) => sameCell(c, w.cells[d])));
    }), '');

  // ── 2. Размеры поля ──────────────────────────────────────────────────────
  const grade4 = buildWordSearch(someShortWords(), { grade: 4, seed: 7 });
  check('филворд: 4 класс → поле 9×9', !!grade4 && grade4.size === 9, `size=${grade4?.size}`);
  const longWords = WORDS.filter((w) => !w.text.includes(' ') && [...w.text].length >= 10).slice(0, 4);
  const grown = buildWordSearch(longWords, { grade: 2, seed: 7 });
  check('филворд: на длинных словах поле вырастает (до 12×12)', !!grown && grown.size > 8, `size=${grown?.size}`);

  const tooFew = buildWordSearch(poolOf(2), { grade: 2, seed: 1 });
  check('филворд: меньше трёх слов — честный null', tooFew === null, '');
  const phraseOnly = WORDS.filter((w) => w.text.includes(' ')).slice(0, 5);
  const noPhrases = buildWordSearch([...someShortWords(), ...phraseOnly], { grade: 2, seed: 1 });
  check('филворд: фразы не попадают на поле', !!noPhrases && noPhrases.words.every((w) => !w.text.includes(' ')), '');

  // ── 2b. Слова разные, а не «жёстко один набор» (0.96.2) ─────────────────
  const richPool = WORDS.filter((w) => !w.text.includes(' ')).slice(0, 60);
  const sets = Array.from({ length: 8 }, (_, i) =>
    new Set(buildWordSearch(richPool, { grade: 2, seed: 500 + i })!.words.map((w) => w.wordId)),
  );
  const firstSet = [...sets[0]].join(',');
  check('филворд: разные seed → разные наборы слов',
    sets.some((set) => [...set].join(',') !== firstSet), `наборы: ${sets.map((s2) => s2.size).join('/')}`);
  check('филворд: поле не пустое и не из одного слова',
    sets.every((set) => set.size >= 3 && set.size <= WS_MAX_WORDS), sets.map((set) => set.size).join(','));

  // «Новая сетка» не повторяет слова прошлой, пока есть свежие: движок
  // получает avoidIds и ставит их в конец очереди.
  let prev: string[] = [];
  let overlaps = 0;
  for (let i = 0; i < 6; i++) {
    const next = buildWordSearch(richPool, { grade: 2, seed: 900 + i, avoidIds: prev })!;
    const ids = next.words.map((w) => w.wordId);
    if (i > 0) overlaps += ids.filter((id) => prev.includes(id)).length;
    prev = ids;
  }
  check('филворд: «новая сетка» не повторяет слова прошлой (большой пул)', overlaps === 0, `повторов: ${overlaps}`);

  // Малый пул: без прошлых слов сетку не собрать — лучше повтор, чем пустота.
  const tiny = WORDS.filter((w) => !w.text.includes(' ')).slice(0, 4);
  const tinyBoard = buildWordSearch(tiny, { grade: 2, seed: 1, avoidIds: tiny.map((w) => w.id) });
  check('филворд: на крошечном пуле доска всё равно собирается', !!tinyBoard, tinyBoard ? tinyBoard.words.length.toString() : 'null');

  // ── 2c. Ошибка «три телефон в одной сетке» (0.96.3) ─────────────────────
  // На телефоне владельца в одном поле стояли три «телефон», три «беседа» и
  // три «человек»: слово повторялось, а matchSelection засчитывает первое,
  // поэтому остальные чипы становились нерешаемыми. Движок обязан не класть
  // слово дважды ни на каком пуле и ни с какими avoidIds.
  const six = WORDS.filter((w) => !w.text.includes(' ')).slice(0, 6);
  let dupes = 0;
  for (let i = 0; i < 12; i++) {
    const b = buildWordSearch(six, { grade: 2, seed: 300 + i, avoidIds: six.map((w) => w.id) });
    if (!b) continue;
    const ids = b.words.map((w) => w.wordId);
    dupes += ids.length - new Set(ids).size;
  }
  check('филворд: одно слово не появляется в сетке дважды (малый пул)', dupes === 0, `повторов: ${dupes}`);

  const doubled = [...six, ...six];
  const deduped = buildWordSearch(doubled, { grade: 2, seed: 11 });
  check('филворд: дубликаты во входном пуле тоже не дают повторов на поле',
    !!deduped && deduped.words.length === new Set(deduped.words.map((w) => w.wordId)).size,
    deduped ? deduped.words.map((w) => w.text).join(',') : 'null');
  check('филворд: чипы на поле уникальны по тексту',
    !!deduped && dd(deduped.words.map((w) => w.text)) === deduped.words.length,
    deduped ? deduped.words.map((w) => w.text).join(',') : 'null');

  // ── 2d. Смена слов работает на любом пуле (0.96.4) ──────────────────────
  // Было: на пуле из 6 слов движок забирал ВСЕ шесть, и «Новая сетка»
  // меняла только расположение букв — «смена слов не работает». Теперь за
  // сетку берётся ~60% пула, остальное остаётся на следующий раз.
  // На пуле из N слов поле берёт ceil(0.6N): соседние сетки не совпадают
  // и всегда приносят хотя бы одно новое слово (на 4 словах сетка = 3,
  // «запас» всего один — требовать нуля повторов нельзя, это арифметика).
  for (const size of [4, 6, 9]) {
    const poolN = WORDS.filter((w) => !w.text.includes(' ')).slice(0, size);
    let prevIds: string[] = [];
    let identical = 0;
    let boardsWithoutNew = 0;
    let boards = 0;
    for (let i = 0; i < 4; i++) {
      const b = buildWordSearch(poolN, { grade: 2, seed: 400 + i, avoidIds: prevIds });
      if (!b) break;
      const ids = b.words.map((w) => w.wordId);
      if (i > 0) {
        boards++;
        if (ids.join(',') === prevIds.join(',')) identical++;
        if (ids.every((id) => prevIds.includes(id))) boardsWithoutNew++;
      }
      prevIds = ids;
    }
    check(`филворд: на пуле ${size} слов сетки не повторяются один в один`, identical === 0, `совпадений: ${identical}`);
    check(`филворд: на пуле ${size} слов в каждой сетке есть новое слово`, boards > 0 && boardsWithoutNew === 0,
      `без новых: ${boardsWithoutNew} из ${boards}`);
  }

  // Большой пул: новые слова не кончаются и повторов нет совсем.
  {
    const bigPool = WORDS.filter((w) => !w.text.includes(' ')).slice(0, 40);
    let prevIds: string[] = [];
    let repeats = 0;
    for (let i = 0; i < 6; i++) {
      const b = buildWordSearch(bigPool, { grade: 2, seed: 460 + i, avoidIds: prevIds });
      if (!b) break;
      const ids = b.words.map((w) => w.wordId);
      if (i > 0) repeats += ids.filter((id) => prevIds.includes(id)).length;
      prevIds = ids;
    }
    check('филворд: на большом пуле новая сетка без повторов', repeats === 0, `повторов: ${repeats}`);
  }

  // ── 3. selectionCells ────────────────────────────────────────────────────
  const line = selectionCells({ row: 2, col: 1 }, { row: 2, col: 6 });
  check('филворд: горизонтальная линия из 6 клеток', !!line && line.length === 6 && line.every((c) => c.row === 2), '');
  const diag = selectionCells({ row: 0, col: 0 }, { row: 3, col: 3 });
  check('филворд: диагональ из 4 клеток', !!diag && diag.length === 4 && diag.every((c, i) => c.row === i && c.col === i), '');
  check('филворд: не-линия — null', selectionCells({ row: 0, col: 0 }, { row: 1, col: 2 }) === null, '');
  check('филворд: одна клетка — сама клетка', !!selectionCells({ row: 1, col: 1 }, { row: 1, col: 1 }) && selectionCells({ row: 1, col: 1 }, { row: 1, col: 1 })!.length === 1, '');

  // ── 4. matchSelection ────────────────────────────────────────────────────
  const placed: WsPlacedWord[] = [
    { wordId: 'w1', text: 'мороз', cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }, { row: 0, col: 4 }], dangerCells: [] },
    { wordId: 'w2', text: 'весна', cells: [{ row: 1, col: 0 }, { row: 2, col: 0 }, { row: 3, col: 0 }, { row: 4, col: 0 }, { row: 5, col: 0 }], dangerCells: [] },
  ];
  const fwd = matchSelection(placed, new Set(), [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }, { row: 0, col: 4 }]);
  check('филворд: линия вперёд совпадает', fwd?.wordId === 'w1', '');
  const bwd = matchSelection(placed, new Set(), [{ row: 0, col: 4 }, { row: 0, col: 3 }, { row: 0, col: 2 }, { row: 0, col: 1 }, { row: 0, col: 0 }]);
  check('филворд: линия назад совпадает', bwd?.wordId === 'w1', '');
  const already = matchSelection(placed, new Set(['w1']), [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }, { row: 0, col: 4 }]);
  check('филворд: уже найденное слово не засчитывается дважды', already === null, '');
  const wrong = matchSelection(placed, new Set(), [{ row: 0, col: 0 }, { row: 0, col: 1 }]);
  check('филворд: слишком короткая линия — null', wrong === null, '');
  const vertical = matchSelection(placed, new Set(), placed[1].cells);
  check('филворд: вертикальная линия совпадает', vertical?.wordId === 'w2', '');

  // ── 5. Клетка-константы ──────────────────────────────────────────────────
  const cell: WsCell = { row: 3, col: 4 };
  check('филворд: sameCell совпадает сама с собой', sameCell(cell, { row: 3, col: 4 }), '');
  check('филворд: sameCell различает клетки', !sameCell(cell, { row: 3, col: 5 }), '');
}
