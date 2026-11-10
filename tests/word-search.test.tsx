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
  check('филворд: 2–5 слов на поле', a.words.length >= 2 && a.words.length <= WS_MAX_WORDS,
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
