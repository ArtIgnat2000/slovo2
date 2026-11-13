// «Колесо букв» и «Хитрая буква» (0.103.0) — движки без DOM.
//
// Почему отдельный файл. Это две новые игры, и обе держатся на правилах,
// которые легко сломать «улучшением»:
//  • колесо не перемешивает буквы и не пускает длинные слова на круг;
//  • «Хитрая буква» не отнимает попытки: ошибка даёт подсказку, а не провал;
//  • верная буква всегда есть среди вариантов и не стоит на фиксированном
//    месте (иначе ребёнок выучит место, а не букву).
import './setup';
import { WORDS_BY_GRADE } from '../src/content/words';
import { RING_MAX_LETTERS, ringBoard, ringDone, ringFits, ringPool, ringStep } from '../src/engine/ring';
import {
  TRICKY_ROUND_SIZE,
  TRICKY_STEPS,
  advanceRound,
  emptyRound,
  roundDone,
  trickyFits,
  trickyHint,
  trickyOptions,
  trickyPool,
  trickyTask,
} from '../src/engine/tricky-letter';
import type { Word } from '../src/types';
import { check } from './ui-helpers';

/** Детерминированный «рандом» для проверок: 0, 0.25, 0.5, 0.75, 0, … */
const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const word = (over: Partial<Word>): Word =>
  ({
    id: over.text ?? 'tmp',
    text: 'корова',
    stress: 1,
    syllables: ['ко', 'ро', 'ва'],
    danger: [1],
    dangerKind: 'vowel',
    hint: 'домашнее животное, даёт молоко',
    emoji: '🐄',
    sentence: 'Во дворе стоит ____.',
    theme: 'animals',
    grades: [2],
    ...over,
  }) as Word;

export async function runGamesLetterChecks(): Promise<void> {
  console.log('\n── Игры: колесо букв и хитрая буква ──');

  // ── 1. Колесо: раскладка ────────────────────────────────────────────────
  const board = ringBoard(word({}))!;
  check('колесо: круг из всех букв слова', board?.letters === 6 && board.dots.length === 6, String(board?.letters));
  check(
    'колесо: буквы идут в порядке слова, а не «как попало»',
    board.dots.map((d) => d.letter).join('') === 'корова',
    board.dots.map((d) => d.letter).join(''),
  );
  check(
    'колесо: первая буква — сверху, дальше по часовой стрелке',
    board.dots[0].angle === 0 && board.dots[1].angle === 60 && board.dots[5].angle === 300,
    board.dots.map((d) => d.angle).join(','),
  );
  check(
    'колесо: опасная буква отмечена на круге',
    board.dots.filter((d) => d.danger).map((d) => d.letter).join('') === 'о',
    board.dots.filter((d) => d.danger).map((d) => d.letter).join(''),
  );

  // ── 2. Колесо: шаги ─────────────────────────────────────────────────────
  check('колесо: первая буква принимается', ringStep(board, 0, 0) === 1, String(ringStep(board, 0, 0)));
  check('колесо: не следующая буква прогресс не меняет', ringStep(board, 0, 3) === 0, String(ringStep(board, 0, 3)));
  check('колесо: после двух букв следующая — третья', ringStep(board, 2, 2) === 3, '');
  check('колесо: назад по кругу не откатывает', ringStep(board, 3, 1) === 3, String(ringStep(board, 3, 1)));
  check('колесо: слово собрано только целиком', !ringDone(board, 5) && ringDone(board, 6), '');
  check('колесо: после победы шаги не меняют счёт', ringStep(board, 6, 0) === 6, String(ringStep(board, 6, 0)));

  // ── 3. Колесо: какие слова попадают ─────────────────────────────────────
  check('колесо: фраза не попадает', !ringFits(word({ text: 'до свидания' })), '');
  check('колесо: дефис не попадает', !ringFits(word({ text: 'кто-то' })), '');
  check('колесо: слово из одной буквы не попадает', !ringFits(word({ text: 'я' })), '');
  check(
    `колесо: на круг пускаем не длиннее ${RING_MAX_LETTERS} букв`,
    ringFits(word({ text: 'а'.repeat(RING_MAX_LETTERS) })) &&
      !ringFits(word({ text: 'а'.repeat(RING_MAX_LETTERS + 1) })),
    '',
  );
  const firstGrade = WORDS_BY_GRADE[1];
  const ringPoolShort = ringPool(firstGrade);
  check(
    'колесо: в пуле первого класса только короткие слова',
    ringPoolShort.length > 0 && ringPoolShort.every((w) => [...w.text].length <= RING_MAX_LETTERS),
    `слов: ${ringPoolShort.length} из ${firstGrade.length}`,
  );

  // ── 4. Хитрая буква: задание ────────────────────────────────────────────
  const task = trickyTask(word({}))!;
  check('хитрая буква: закрыта именно опасная буква', task.index === 1 && task.answer === 'о', `${task.index}:${task.answer}`);
  check('хитрая буква: четыре варианта', task.options.length === 4, task.options.join(','));
  check('хитрая буква: верная буква всегда среди вариантов', task.options.includes(task.answer), task.options.join(','));
  check(
    'хитрая буква: варианты не повторяются',
    new Set(task.options).size === task.options.length,
    task.options.join(','),
  );
  check('хитрая буква: фраза не попадает', !trickyFits(word({ text: 'Красная площадь' })), '');
  check('хитрая буква: слово без опасной буквы не попадает', !trickyFits(word({ danger: [] })), '');
  const noDanger = trickyTask(word({ danger: [] }));
  check('хитрая буква: без опасной буквы задания нет', noDanger === null, String(noDanger?.answer));

  // Соседки — из типичных ошибок: в «корова» для «о» это «а».
  const options = trickyOptions('о', [...'корова'], seq([0.1]));
  check(
    'хитрая буква: среди вариантов есть типичная ошибка (о → а)',
    options.includes('о') && options.includes('а'),
    options.join(','),
  );
  // Для согласной «д» соседка — «т»: д↔т, как в задании «Исправь робота».
  const consonantOptions = trickyOptions('д', [...'дрова'], seq([0.9]));
  check(
    'хитрая буква: для согласной соседка — парная (д → т)',
    consonantOptions.includes('д') && consonantOptions.includes('т'),
    consonantOptions.join(','),
  );

  // ── 5. Хитрая буква: лестница подсказок, а не попытки ───────────────────
  const withMnemonic = word({ mnemonic: 'молоко от кОровы — буква О как круглый бок' });
  check('хитрая буква: без ошибок подсказки нет', trickyHint(withMnemonic, 0) === 'none', '');
  check('хитрая буква: первая ошибка даёт мнемонику', trickyHint(withMnemonic, 1) === 'mnemonic', '');
  check('хитрая буква: вторая ошибка даёт предложение', trickyHint(withMnemonic, 2) === 'sentence', '');
  check('хитрая буква: третья ошибка открывает букву', trickyHint(withMnemonic, 3) === 'revealed', '');
  check('хитрая буква: буква остаётся открытой и дальше', trickyHint(withMnemonic, 9) === 'revealed', '');
  check('хитрая буква: ступеней ровно три', TRICKY_STEPS === 3, String(TRICKY_STEPS));
  const noMnemonic = word({});
  check(
    'хитрая буква: без мнемоники первая ошибка сразу даёт предложение',
    trickyHint(noMnemonic, 1) === 'sentence',
    trickyHint(noMnemonic, 1),
  );

  // ── 6. Хитрая буква: раунд ──────────────────────────────────────────────
  let round = emptyRound(TRICKY_ROUND_SIZE);
  check('хитрая буква: раунд — шесть слов', round.size === TRICKY_ROUND_SIZE && !roundDone(round), '');
  for (let i = 0; i < TRICKY_ROUND_SIZE; i++) round = advanceRound(round, i === 0);
  check('хитрая буква: после шести слов раунд закрыт', roundDone(round), `solved=${round.solved}`);
  check('хитрая буква: подсказка засчитывается, но не блокирует', round.hintsUsed === 1, String(round.hintsUsed));
  check(
    'хитрая буква: счёт не переполняется',
    advanceRound(round, true).solved === TRICKY_ROUND_SIZE,
    String(advanceRound(round, true).solved),
  );

  // ── 7. Пулы всех классов ────────────────────────────────────────────────
  let trickyOk = true;
  for (const grade of [1, 2, 3, 4, 5] as const) {
    const pool = trickyPool(WORDS_BY_GRADE[grade]);
    if (!pool.length || pool.some((w) => !w.danger.length || /\s/.test(w.text))) trickyOk = false;
  }
  check('хитрая буква: пул есть в каждом классе и без фраз', trickyOk, '');
}
