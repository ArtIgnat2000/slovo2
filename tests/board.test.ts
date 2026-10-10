// «Бродилка БУКа» — чистые правила движка (src/engine/board.ts).
// Запускается внутри смоук-теста (import из tests/smoke.test.tsx), потому что
// проверяет то же, что и он: игру нельзя проиграть, кубик не отбрасывает назад,
// станция — это тема урока, а буквы-шпионы не могут собрать неправильное слово.
import { LESSONS, WORDS } from '../src/content/words';
import {
  BOARD,
  BOARD_REWARDS,
  DICE_MAX,
  DICE_MIN,
  PRIVAL_EVERY,
  advance,
  buildBoard,
  cellAt,
  makeStationTask,
  normalizeGame,
  posOfLesson,
  rollDice,
  spyCount,
  stationWord,
  stationsOpened,
} from '../src/engine/board';
import { check } from './ui-helpers';
import { initState } from '../src/engine/srs';

/** Предсказуемый «кубик» для тестов: значения задаются списком. */
function fakeRng(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)] ?? 0;
}

export function runBoardEngineChecks() {
  console.log('\n── Бродилка БУКа: правила движка ──');

  // ── Маршрут ───────────────────────────────────────────────────────────────
  check('бродилка: станция на каждый урок', BOARD.filter((c) => c.kind === 'station').length === LESSONS.length);
  check(
    'бродилка: привал после каждой четвёртой станции',
    BOARD.filter((c) => c.kind === 'prival').length === Math.floor(LESSONS.length / PRIVAL_EVERY),
  );
  check(
    'бродилка: клетки идут по порядку и без дыр',
    BOARD.every((c, i) => c.index === i + 1),
  );
  check(
    'бродилка: id уроков-станций совпадают с уроками',
    BOARD.filter((c) => c.kind === 'station').every((c, i) => c.lessonId === LESSONS[i].id),
  );
  check('бродилка: карта строится из переданных уроков', buildBoard(LESSONS.slice(0, 5)).length === 5 + 1);

  // ── Кубик ─────────────────────────────────────────────────────────────────
  check('бродилка: кубик не меньше минимума', rollDice(() => 0) === DICE_MIN);
  check('бродилка: кубик не больше максимума', rollDice(() => 0.999999) === DICE_MAX);
  check(
    'бродилка: кубик всегда целое в границах',
    [0, 0.1, 0.33, 0.5, 0.66, 0.9, 1].every((v) => {
      const d = rollDice(() => v);
      return Number.isInteger(d) && d >= DICE_MIN && d <= DICE_MAX;
    }),
  );

  // ── Движение: только вперёд, без вылета за маршрут ────────────────────────
  const size = BOARD.length;
  check('бродилка: шаг вперёд', advance(0, 2, size) === 2);
  check('бродилка: нулевой шаг не двигает', advance(3, 0, size) === 3);
  check('бродилка: кубик не отбрасывает назад', advance(5, 1, size) >= 5);
  check('бродилка: лишние шаги упираются в финиш', advance(size - 1, 3, size) === size);
  check('бродилка: за маршрут не выйти', advance(size, 3, size) === size);
  check('бродилка: испорченная позиция читается как начало', advance(-5, 1, size) === 1);
  check('бродилка: позиция всегда целая', Number.isInteger(advance(2.7, 1.2, size)));

  // ── Клетки ────────────────────────────────────────────────────────────────
  check('бродилка: в начале маршрута клетки нет', cellAt(0) === null);
  check('бродилка: первая клетка — первая станция', cellAt(1)?.lessonId === LESSONS[0].id);
  check('бродилка: на финише клетка последняя', cellAt(size)?.index === size);
  check('бродилка: позиция урока ищется по id', posOfLesson(LESSONS[2].id) === 3);
  check('бродилка: неизвестного урока на карте нет', posOfLesson('нет-такого') === 0);

  // ── Слово станции ─────────────────────────────────────────────────────────
  const lesson = LESSONS[0];
  const first = stationWord(lesson.id, WORDS, {});
  check('бродилка: станция берёт слово своей темы', !!first && first.theme === lesson.id);
  check('бродилка: без прогресса берётся первое слово темы', first?.id === lesson.wordIds[0]);
  const weak = lesson.wordIds[2];
  const stronger = stationWord(lesson.id, WORDS, {
    [lesson.wordIds[0]]: { ...initState(), s: 90 },
    [lesson.wordIds[1]]: { ...initState(), s: 80 },
  });
  check('бродилка: выбирается самое слабое слово темы', stronger?.id === weak);
  check('бродилка: у чужой темы слов не спрашиваем', stationWord('нет-темы', WORDS) === null);
  const polite = WORDS.filter((w) => w.theme === 'polite');
  check(
    'бродилка: фразы с пробелом станция не спрашивает',
    polite.some((w) => w.text.includes(' ')) &&
      !!stationWord('polite', WORDS) &&
      !stationWord('polite', WORDS)!.text.includes(' '),
  );

  // ── Буквы-шпионы ──────────────────────────────────────────────────────────
  const target = WORDS.find((w) => w.text === 'класс') ?? WORDS[0];
  const task = makeStationTask(target, fakeRng([0.2, 0.5, 0.31, 0.9, 0.1]));
  const letters = task.letters ?? [];
  check('бродилка: шпионы перечислены индексами', (task.spies ?? []).length === spyCount(target));
  check('бродилка: индексы шпионов указывают внутрь набора', (task.spies ?? []).every((i) => i >= 0 && i < letters.length));
  check(
    'бродилка: без шпионов буквы слова собираются ровно',
    [...letters.filter((_, i) => !(task.spies ?? []).includes(i))].sort().join('') === [...target.text].sort().join(''),
  );
  check(
    'бродилка: плиток ровно столько, сколько букв и шпионов',
    letters.length === target.text.length + (task.spies ?? []).length,
  );
  const doubles = WORDS.filter((w) => /([бвгджзклмнпрстфхцчшщ])\1/i.test(w.text) && !w.text.includes(' '));
  check(
    'бродилка: у удвоенной согласной шпион — та же буква (лишняя третья)',
    doubles.slice(0, 3).every((w) => {
      const t = makeStationTask(w, fakeRng([0.4, 0.7, 0.2]));
      return (t.spies ?? []).some((i) => (t.letters ?? [])[i]?.toLowerCase() === w.text.toLowerCase().match(/(.)\1/)![1]);
    }),
  );
  check(
    'бродилка: задание станции — сборка по картинке',
    task.kind === 'build' && task.wordId === target.id && (task.letters ?? []).length > target.text.length,
  );
  check('бродилка: шпионов не больше двух', WORDS.every((w) => spyCount(w) <= 2));

  // ── Состояние игры в профиле ──────────────────────────────────────────────
  check('бродилка: пустое состояние открывает ноль станций', stationsOpened(undefined) === 0);
  const normalized = normalizeGame({ pos: 999, claimed: ['нет-такого', LESSONS[0].id, LESSONS[0].id], rolls: -4 });
  check('бродилка: чужая станция отбрасывается', normalized.claimed.length === 1 && normalized.claimed[0] === LESSONS[0].id);
  check('бродилка: запредельная позиция подрезается', normalized.pos === size);
  check('бродилка: отрицательные броски читаются как ноль', normalized.rolls === 0);
  check('бродилка: мусор вместо состояния не ломает чтение', normalizeGame('чепуха').pos === 0 && normalizeGame(null).claimed.length === 0);
  check('бродилка: дата финиша сохраняется, мусор — нет', normalizeGame({ pos: 1, finishedAt: 123 }).finishedAt === 123 && normalizeGame({ finishedAt: -1 }).finishedAt === undefined);
  check(
    'бродилка: профиль старого формата читается как пустая игра',
    normalizeGame(undefined).pos === 0 && normalizeGame(undefined).claimed.length === 0,
  );

  // ── Награды ───────────────────────────────────────────────────────────────
  check('бродилка: награды заданы и положительны', BOARD_REWARDS.station > 0 && BOARD_REWARDS.prival > 0 && BOARD_REWARDS.finish > 0);
  check('бродилка: повторный визит приносит меньше первого', BOARD_REWARDS.replay < BOARD_REWARDS.station);
  check('бродилка: финиш заметнее привала', BOARD_REWARDS.finish > BOARD_REWARDS.prival);
}
