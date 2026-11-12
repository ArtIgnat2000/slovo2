// Доступ к «Играм» за успехи дня (0.99.0) — правила без DOM.
//
// Почему отдельный файл. Схема «игры за уроки» — единственное место в проекте,
// где что-то может стать недоступным ребёнку. Ошибка здесь выглядит как
// «пришёл поиграть, а играть нечего», поэтому правила закреплены тестом:
//  • базовая игра открыта всегда, даже при пустом дне;
//  • ключи только прибавляются: ошибки, подсказки и потолок наград доступ
//    не уменьшают;
//  • XP из игр в ключи не идёт — иначе игра оплачивала бы доступ к играм;
//  • ключи не хранятся в профиле: считаются из дня, полночь сбрасывает сама;
//  • взрослый может вернуть «всё открыто» настройкой.
import './setup';
import {
  GATE_XP_MIN,
  GATE_XP_SHARE,
  GAME_GATE_KEYS,
  MAX_LESSON_KEYS,
  dayGameAccess,
  isGameOpen,
  lockHint,
  pluralGames,
} from '../src/engine/game-access';
import type { DayStat, QuestPlanItem } from '../src/types';
import { check } from './ui-helpers';

const TOTAL = 3;

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
    ...over,
  };
}

const access = (d: DayStat, goal = 120, opts: { gates?: 'open' | 'points' } = {}) =>
  dayGameAccess({ day: d, dailyGoal: goal, plan: PLAN, totalGames: TOTAL, gates: opts.gates ?? 'points' });

export async function runGameAccessChecks(): Promise<void> {
  console.log('\n── Игры: доступ за успехи дня ──');

  // ── 1. Пустой день: играть всё равно можно ──────────────────────────────
  const zero = access(day());
  check('доступ: в пустой день открыта одна игра', zero.openCount === 1, `openCount=${zero.openCount}`);
  check('доступ: базовая игра открыта при нуле ключей', isGameOpen(zero, 0), '');
  check('доступ: остальные игры в пустой день закрыты',
    !isGameOpen(zero, 1) && !isGameOpen(zero, 2), `openCount=${zero.openCount}`);
  check('доступ: шкала не «нельзя», а «ещё за урок»',
    zero.nextHint.includes('за урок') && !/нельзя/i.test(zero.nextHint), zero.nextHint);

  // ── 2. Один урок = одна новая игра (решение владельца) ──────────────────
  const one = access(day({ lessons: 1, xp: 40 }));
  check('доступ: первый урок открывает вторую игру', one.openCount === 2, `openCount=${one.openCount}`);
  check('доступ: за уроки начисляется максимум MAX_LESSON_KEYS',
    one.parts.lessons === 1 && access(day({ lessons: 5 })).parts.lessons === MAX_LESSON_KEYS,
    `уроки: ${access(day({ lessons: 5 })).parts.lessons}`);

  const two = access(day({ lessons: 2, xp: 80 }));
  check('доступ: два урока открывают три игры', two.openCount === 3, `openCount=${two.openCount}`);
  check('доступ: на двух уроках открыто всё', two.nextHint === 'Сегодня открыто всё', two.nextHint);

  // ── 3. Задания дня тоже дают ключи ──────────────────────────────────────
  // План дня: 2 урока + 12 верных ответов + серия из 5 без ошибок. Закрываем
  // все три задания (уроки тоже!), иначе ключей будет меньше.
  const questDay = access(day({ lessons: 2, xp: 0, correct: 12, flawless: 5 }));
  check('доступ: закрытые задания дня дают ключи',
    questDay.parts.quests === 3 && questDay.openCount === TOTAL,
    `openCount=${questDay.openCount}, задания: ${questDay.parts.quests}`);
  check('доступ: три задания дают три ключа', questDay.parts.quests === 3, `задания: ${questDay.parts.quests}`);

  // ── 4. Ключ за баллы: половина цели, и без XP из игр ─────────────────────
  const threshold = Math.max(GATE_XP_MIN, Math.round(120 * GATE_XP_SHARE));
  const xpLow = access(day({ xp: threshold - 1 }));
  const xpHigh = access(day({ xp: threshold }));
  check('доступ: до порога баллов ключа нет', xpLow.parts.xp === 0, `xp=${threshold - 1}`);
  check('доступ: на пороге баллов ключ появляется', xpHigh.parts.xp === 1, `xp=${threshold}`);

  // Главное правило схемы: игра не оплачивает доступ к играм.
  const onlyGames = access(day({ xp: 6, games: { xp: 6, correct: 0, words: 9 } }));
  check('доступ: XP из игр не считаются в ключи',
    onlyGames.parts.xp === 0 && onlyGames.openCount === 1, `xp из игр: ${onlyGames.parts.xp}`);
  const workPlusGames = access(day({ xp: threshold + 6, games: { xp: 6, correct: 0, words: 9 } }));
  check('доступ: баллы уроков считаются вместе с наградой игр в дне',
    workPlusGames.parts.xp === 1, `xp дня: ${threshold + 6}`);

  // ── 5. Шкала не растёт выше витрины ─────────────────────────────────────
  const everything = access(day({ lessons: 2, xp: 400, correct: 40, flawless: 20 }));
  check('доступ: открыто не больше игр на витрине', everything.openCount === TOTAL, `openCount=${everything.openCount}`);
  check('доступ: «открыто всё» — честная строка', everything.nextHint === 'Сегодня открыто всё', everything.nextHint);
  check('доступ: до полного открытия не остаётся ключей', everything.leftToAll === 0, '');

  // ── 6. Взрослый может отключить шкалу ───────────────────────────────────
  const openMode = access(day(), 120, { gates: 'open' });
  check('доступ: режим «все открыты» показывает всё', openMode.openCount === TOTAL, `openCount=${openMode.openCount}`);
  check('доступ: в режиме «все открыты» замков нет',
    lockHint(openMode, 0) === '' && lockHint(openMode, 2) === '', '');

  // ── 7. Текст замка: одно условие, без «нельзя» ──────────────────────────
  check('доступ: замок объясняет условие', lockHint(zero, 1).includes('урок'), lockHint(zero, 1));
  check('доступ: замок не ругается', !/нельзя|нет доступа/i.test(lockHint(zero, 2)), lockHint(zero, 2));
  check('доступ: у открытой игры замка нет', lockHint(zero, 0) === '', lockHint(zero, 0));

  // ── 8. Пороги и подписи ─────────────────────────────────────────────────
  check('доступ: пороги по возрастанию, базовая игра — нулевой',
    GAME_GATE_KEYS[0] === 0 && GAME_GATE_KEYS.every((v, i) => i === 0 || v > GAME_GATE_KEYS[i - 1]),
    GAME_GATE_KEYS.join(','));
  check('доступ: «1 игра», а не «1 игр»', pluralGames(1) === 'игра', pluralGames(1));
  check('доступ: «2 игры» и «5 игр»', pluralGames(2) === 'игры' && pluralGames(5) === 'игр', '');

  // ── 9. Ключи только прибавляются ────────────────────────────────────────
  // Ошибки и подсказки не трогают счётчики, по которым считаются ключи:
  // в `DayStat` для этого просто нет полей, а `wrong` в ключи не входит.
  const withErrors = access(day({ lessons: 1, xp: 40, wrong: 12 }));
  check('доступ: ошибки ключей не отнимают', withErrors.openCount === one.openCount, `${withErrors.openCount}`);
  check('доступ: испорченный день не даёт отрицательных ключей',
    access(day({ lessons: -5, xp: -100, correct: -3 })).keys === 0, '');
}
