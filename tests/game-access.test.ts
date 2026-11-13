// Доступ к «Играм» за успехи дня (0.99.1) — правила без DOM.
//
// Почему отдельный файл. Схема «игры за успехи дня» — единственное место в
// проекте, где что-то может стать недоступным ребёнку. Ошибка здесь выглядит
// как «пришёл поиграть, а играть нечего», поэтому правила закреплены тестом:
//  • базовая игра открыта всегда, даже при пустом дне;
//  • лестница из трёх разных дел: 10 верных ответов → урок до конца → весь
//    план дня (готовый сундук), а не «три множителя одного урока»;
//  • ключи только прибавляются: ошибки, подсказки и потолок наград доступ
//    не уменьшают;
//  • игры не открывают игры: найденные слова в филворде в шаг не идут;
//  • ключи не хранятся в профиле: считаются из дня, полночь сбрасывает сама;
//  • взрослый может вернуть «всё открыто» настройкой.
import './setup';
import {
  GATE_CORRECT_STEP,
  GAME_GATE_KEYS,
  dayGameAccess,
  isGameOpen,
  lockHint,
  pluralGames,
} from '../src/engine/game-access';
import type { DayStat, QuestPlanItem } from '../src/types';
import { check } from './ui-helpers';

const TOTAL = 4;

/** План дня по умолчанию — как у `buildDayPlan`: три задания. */
const PLAN: QuestPlanItem[] = [
  { kind: 'lessons', target: 2 },
  { kind: 'correct', target: 12 },
  { kind: 'flawless', target: 5 },
];

function day(over: Partial<DayStat> = {}): DayStat {
  return {
    xp: 0,
    correct: 0,
    wrong: 0,
    lessons: 0,
    flawless: 0,
    reviewCorrect: 0,
    reviewWords: [],
    ...over,
  };
}

const access = (d: DayStat, opts: { gates?: 'open' | 'points'; plan?: QuestPlanItem[] } = {}) =>
  dayGameAccess({
    day: d,
    plan: opts.plan ?? PLAN,
    totalGames: TOTAL,
    gates: opts.gates ?? 'points',
  });

/** Весь план дня закрыт: 2 урока, 12 верных ответов, серия 5. */
const fullDay = () => day({ lessons: 2, correct: 12, flawless: 5 });

export async function runGameAccessChecks(): Promise<void> {
  console.log('\n── Игры: доступ за успехи дня ──');

  // ── 1. Пустой день: играть всё равно можно ──────────────────────────────
  const zero = access(day());
  check('доступ: в пустой день открыта одна игра', zero.openCount === 1, `openCount=${zero.openCount}`);
  check('доступ: базовая игра открыта при нуле ключей', isGameOpen(zero, 0), '');
  check('доступ: остальные игры в пустой день закрыты',
    !isGameOpen(zero, 1) && !isGameOpen(zero, 2) && !isGameOpen(zero, 3), `openCount=${zero.openCount}`);
  check('доступ: шкала не «нельзя», а прогресс верных ответов',
    zero.nextHint.includes('из') && !/нельзя/i.test(zero.nextHint), zero.nextHint);

  // ── 2. Первый шаг — верные ответы, и он не требует урока ────────────────
  const almost = access(day({ correct: GATE_CORRECT_STEP - 1 }));
  const step = access(day({ correct: GATE_CORRECT_STEP }));
  check('доступ: до 10 верных ответов вторая игра закрыта', almost.openCount === 1, `openCount=${almost.openCount}`);
  check('доступ: 10 верных ответов открывают вторую игру', step.openCount === 2, `openCount=${step.openCount}`);
  // Повторение пишет верные ответы в тот же `day.correct` (`answer()` → ok),
  // а `reviewCorrect` — отдельный счётчик точности. Проверяем именно то, что
  // шаг не требует урока: 10 верных без единого урока уже открывают игру.
  check('доступ: 10 верных ответов без урока открывают вторую игру',
    access(day({ lessons: 0, correct: 10, reviewCorrect: 10 })).openCount === 2, 'повторение без урока');

  // ── 3. Второй шаг — урок ДО КОНЦА, и он требует первого ─────────────────
  // Главная правка 0.99.1: «дошёл до конца и всё провалил» больше не даёт то
  // же, что «дошёл и справился».
  const badLesson = access(day({ lessons: 1, correct: 5, xp: 84 }));
  check('доступ: слабый урок НЕ открывает третью игру', badLesson.openCount === 1,
    `openCount=${badLesson.openCount}, правильных=${badLesson.correctProgress.have}`);
  const weakButLong = access(day({ lessons: 3, correct: 8 }));
  check('доступ: три слабых урока тоже не открывают третью игру', weakButLong.openCount === 1,
    `openCount=${weakButLong.openCount}`);

  const lessonDone = access(day({ lessons: 1, correct: 12 }));
  check('доступ: урок до конца при 10 верных открывает третью игру', lessonDone.openCount === 3,
    `openCount=${lessonDone.openCount}`);

  // «Мемори» — четвёртая игра витрины (0.101.0): ей нужны все три ключа.
  const twoKeysInLadder = access(day({ lessons: 1, correct: 12 }));
  check('доступ: при двух ключах «Мемори» (четвёртая игра) закрыта',
    twoKeysInLadder.openCount === 3 && !isGameOpen(twoKeysInLadder, 3), `openCount=${twoKeysInLadder.openCount}`);
  check('доступ: третий ключ (весь план дня) открывает «Мемори»',
    isGameOpen(access(fullDay()), 3) && access(fullDay()).openCount === TOTAL, '');

  // ── 4. Третий шаг — весь план дня (готовый сундук) ───────────────────────
  const questsOnly = access(day({ lessons: 0, correct: 12, flawless: 5 }));
  check('доступ: закрытые задания без урока — не полный день',
    questsOnly.steps.chest === false && questsOnly.openCount < TOTAL, `openCount=${questsOnly.openCount}`);

  const chestReady = access(fullDay());
  check('доступ: весь план дня открывает все игры', chestReady.openCount === TOTAL, `openCount=${chestReady.openCount}`);
  check('доступ: «открыто всё» — честная строка', chestReady.nextHint === 'Сегодня открыто всё', chestReady.nextHint);
  check('доступ: до полного открытия ключей не остаётся', chestReady.leftToAll === 0, '');
  // Сундук не обязательно забирать: считаем задания, а не тап.
  check('доступ: забор сундука для доступа не нужен',
    access({ ...fullDay(), bonusChestsClaimed: 0 } as DayStat).openCount === TOTAL, 'claimed не влияет');

  // ── 5. Игра не открывает игру ───────────────────────────────────────────
  // 24 найденных слова в филворде = 12 половинных «верных ответов» и задание
  // «12 верных» закрыто, но шаг «10 верных в уроке» — нет.
  const onlyGames = access(day({ correct: 0, flawless: 0, games: { xp: 6, correct: 12, words: 24, dayGemTaken: true } }));
  check('доступ: награды игр не дают шаг «10 верных ответов»',
    onlyGames.steps.correct === false && onlyGames.correctProgress.have === 0,
    `have=${onlyGames.correctProgress.have}`);
  // Сетка может закрыть задание «12 верных ответов» (половинный вес — это
  // честное правило наград), и это один ключ. Но весь день игрой не собрать:
  // без урока и без серии «без ошибок» до всех игр не дойти.
  check('доступ: даже две сетки не открывают все игры',
    onlyGames.openCount < TOTAL && onlyGames.steps.lesson === false,
    `openCount=${onlyGames.openCount}, steps=${JSON.stringify(onlyGames.steps)}`);

  // ── 6. Шкала не растёт выше витрины ─────────────────────────────────────
  const everything = access(day({ lessons: 5, correct: 60, flawless: 30, reviewWords: ['a', 'b', 'c', 'd', 'e'] }));
  check('доступ: открыто не больше игр на витрине', everything.openCount === TOTAL, `openCount=${everything.openCount}`);

  // ── 7. Взрослый может отключить шкалу ───────────────────────────────────
  const openMode = access(day(), { gates: 'open' });
  check('доступ: режим «все открыты» показывает всё', openMode.openCount === TOTAL, `openCount=${openMode.openCount}`);
  check('доступ: в режиме «все открыты» замков нет',
    lockHint(openMode, 0) === '' && lockHint(openMode, 3) === '', '');

  // ── 8. Текст замка: одно условие, без «нельзя» ──────────────────────────
  check('доступ: замок объясняет первое действие', /Откроется за \d+ верн/.test(lockHint(zero, 1)), lockHint(zero, 1));
  check('доступ: после 10 верных замок говорит про урок',
    lockHint(step, 2) === 'Откроется за урок', lockHint(step, 2));
  check('доступ: перед последней игрой замок говорит про задания дня',
    lockHint(lessonDone, 3) === 'Откроется за все задания дня', lockHint(lessonDone, 3));
  check('доступ: замок не ругается', !/нельзя|нет доступа/i.test(lockHint(zero, 3)), lockHint(zero, 3));
  check('доступ: у открытой игры замка нет', lockHint(zero, 0) === '', lockHint(zero, 0));

  // ── 9. Пороги и подписи ─────────────────────────────────────────────────
  check('доступ: пороги по возрастанию, базовая игра — нулевой',
    GAME_GATE_KEYS[0] === 0 && GAME_GATE_KEYS.every((v, i) => i === 0 || v > GAME_GATE_KEYS[i - 1]),
    GAME_GATE_KEYS.join(','));
  check('доступ: «1 игра», а не «1 игр»', pluralGames(1) === 'игра', pluralGames(1));
  check('доступ: «2 игры» и «5 игр»', pluralGames(2) === 'игры' && pluralGames(5) === 'игр', '');

  // ── 10. Ключи только прибавляются ───────────────────────────────────────
  const withErrors = access(day({ correct: 12, wrong: 12 }));
  check('доступ: ошибки ключей не отнимают', withErrors.openCount === step.openCount, `${withErrors.openCount}`);
  check('доступ: испорченный день не даёт отрицательных ключей',
    access(day({ lessons: -5, correct: -3, xp: -100 })).keys === 0, '');
  // Лестница монотонна: любой рост дня не уменьшает доступ.
  const ladder: DayStat[] = [
    day(),
    day({ correct: 5 }),
    day({ correct: 10 }),
    day({ correct: 10, lessons: 1 }),
    fullDay(),
  ];
  let monotone = true;
  let prev = 0;
  for (const d of ladder) {
    const now = access(d).openCount;
    if (now < prev) monotone = false;
    prev = now;
  }
  check('доступ: шкала не убывает по ходу дня', monotone, `открыто по шагам: ${ladder.map((d) => access(d).openCount).join(' → ')}`);
}
