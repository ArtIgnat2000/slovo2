// «Слоговая мозаика» (0.106.0) — движок и экран.
//
// Игра похожа на «Собери слово», но единица другая — СЛОГ. Поэтому тест
// держит именно отличия: односложные слова не попадают, повторяющиеся слоги
// не путаются, порядок обязателен, а перемешивание не отдаёт готовое слово.
import './setup';
import {
  SYL_MAX_PARTS,
  syllableBoard,
  syllableFits,
  syllablePool,
  syllableSolved,
  type SyllableTile,
} from '../src/engine/syllable-board';
import { WORDS_BY_GRADE } from '../src/content/words';
import type { Word } from '../src/types';
import { check } from './ui-helpers';

const word = (over: Partial<Word>): Word =>
  ({
    id: over.text ?? 'tmp',
    text: 'молоко',
    stress: 4,
    syllables: ['мо', 'ло', 'ко'],
    danger: [1],
    dangerKind: 'vowel',
    hint: 'белая жидкость от коровы',
    emoji: '🥛',
    sentence: 'В стакане ____.',
    theme: 'food',
    grades: [1],
    ...over,
  }) as Word;

/** «Перемешивание», которое на самом деле переворачивает список — детерминизм. */
const reverse = (list: SyllableTile[]) => [...list].reverse();

export async function runSyllableBoardChecks(): Promise<void> {
  console.log('\n── Игры: слоговая мозаика ──');

  const milk = word({});
  // ── 1. Доска ─────────────────────────────────────────────────────────────
  const board = syllableBoard(milk, reverse)!;
  check('мозаика: слотов столько же, сколько слогов', board.slots.length === 3, board.slots.join('-'));
  check('мозаика: слоты идут в правильном порядке', board.slots.join('-') === 'мо-ло-ко', board.slots.join('-'));
  check('мозаика: плитки перемешаны, а не в порядке слова',
    board.tiles.map((t) => t.text).join('-') !== board.slots.join('-'),
    board.tiles.map((t) => t.text).join('-'));
  check('мозаика: плиток ровно столько же, сколько слотов', board.tiles.length === 3, String(board.tiles.length));
  check('мозаика: у плиток уникальные id', new Set(board.tiles.map((t) => t.id)).size === 3, '');

  // ── 2. Проверка порядка ─────────────────────────────────────────────────
  const byText = (text: string) => board.tiles.find((t) => t.text === text)!;
  check('мозаика: верный порядок засчитывается',
    syllableSolved(board, ['мо', 'ло', 'ко'].map(byText)), '');
  check('мозаика: неверный порядок не засчитывается',
    !syllableSolved(board, ['ло', 'мо', 'ко'].map(byText)), '');
  check('мозаика: неполное слово не победа',
    !syllableSolved(board, ['мо', 'ло'].map(byText)), '');

  // ── 3. Повторяющиеся слоги («ма-ма») ───────────────────────────────────
  const mama = word({ text: 'мама', syllables: ['ма', 'ма'], id: 'g1_мама' });
  const mamaBoard = syllableBoard(mama, reverse)!;
  check('мозаика: у одинаковых слогов разные id',
    mamaBoard.tiles[0].id !== mamaBoard.tiles[1].id, mamaBoard.tiles.map((t) => t.id).join(','));
  check('мозаика: «ма-ма» собирается', syllableSolved(mamaBoard, mamaBoard.tiles), '');

  // ── 4. Какие слова попадают ─────────────────────────────────────────────
  check('мозаика: односложное слово не попадает', !syllableFits(word({ text: 'дом', syllables: ['дом'] })), '');
  check('мозаика: фраза не попадает', !syllableFits(word({ text: 'до свидания', syllables: ['до', 'сви', 'да', 'ния'] })), '');
  check('мозаика: дефис не попадает', !syllableFits(word({ text: 'кто-то', syllables: ['кто', 'то'] })), '');
  check(`мозаика: больше ${SYL_MAX_PARTS} слогов не попадает`,
    !syllableFits(word({ syllables: Array.from({ length: SYL_MAX_PARTS + 1 }, () => 'ла') })), '');
  check('мозаика: у односложного доски нет', syllableBoard(word({ syllables: ['дом'] }), reverse) === null, '');
  check('мозаика: пустой слог не считается слогом',
    !syllableFits(word({ syllables: ['мо', ''] })), '');

  // ── 5. Пулы всех классов ────────────────────────────────────────────────
  let poolsOk = true;
  const sizes: string[] = [];
  for (const grade of [1, 2, 3, 4, 5] as const) {
    const pool = syllablePool(WORDS_BY_GRADE[grade]);
    sizes.push(String(pool.length));
    if (!pool.length || pool.some((w) => w.syllables.filter((s) => s.trim()).length < 2)) poolsOk = false;
  }
  check('мозаика: пул есть в каждом классе и только из 2+ слогов', poolsOk, sizes.join('/'));

  // Длинные слова — главный смысл игры: они физически не влезали в буквенные.
  const long = WORD_LONG();
  check('мозаика: длинное слово (10+ букв) собирается',
    !!long && long.slots.length >= 4, long ? `${long.slots.join('-')} (${long.word.text})` : 'нет');
}

/** Самое длинное слово банка в разбивке на слоги — для проверки длинных слов. */
function WORD_LONG() {
  const all = [1, 2, 3, 4, 5].flatMap((g) => syllablePool(WORDS_BY_GRADE[g as 1 | 2 | 3 | 4 | 5]));
  const longest = all.filter((w) => [...w.text].length >= 10).sort((a, b) => b.text.length - a.text.length)[0];
  return longest ? syllableBoard(longest, reverse) : null;
}
