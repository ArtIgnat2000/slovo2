// Награды за «Игры» (0.96.7): правила без DOM.
//
// Почему этот файл вообще существует. Игры бесконечны и бесплатны, поэтому
// любая ошибка в потолках превращает их в ферму кристаллов: ребёнок будет
// тапать «Новая сетка» вместо уроков. Здесь закреплено ровно то, о чём
// договорились с владельцем (вариант C + A):
//  • XP из игр малый и с суточным потолком — урок остаётся обязательным;
//  • кристаллов игра «печатает» один за первую сетку дня, не больше;
//  • слово игры весит в заданиях дня половину ответа урока;
//  • «Пройди 2 урока» и «Повтори 5 слов» играми НЕ закрываются;
//  • в приоритет игр попадают слова с ошибками, но не весь пул.
import './setup';
import {
  EMPTY_GAME_AWARDS,
  GAME_CORRECT_WEIGHT,
  GAME_DAY_GEMS,
  GAME_XP_CAP,
  GAME_XP_FIRST,
  GAME_XP_NEXT,
  gameAward,
  gameAwardHint,
  troubleWords,
  type GameAwardState,
} from '../src/engine/game-awards';
import { dayMetrics } from '../src/engine/quests';
import type { DayStat } from '../src/types';
import { check } from './ui-helpers';

export async function runGameAwardChecks(): Promise<void> {
  console.log('\n── Игры: награды и приоритет слов ──');

  // ── 1. XP: первое слово дороже, дальше по единице, потолок держится ──────
  const one = gameAward({ words: 1, today: EMPTY_GAME_AWARDS });
  check('игры: первое слово дня даёт GAME_XP_FIRST', one.xp === GAME_XP_FIRST, `xp=${one.xp}`);

  const second = gameAward({ words: 1, today: one.next });
  check('игры: второе слово дня даёт GAME_XP_NEXT', second.xp === GAME_XP_NEXT, `xp=${second.xp}`);

  // Потолок: сколько бы слов ни нашлось, больше GAME_XP_CAP за день не выдаём.
  let state: GameAwardState = EMPTY_GAME_AWARDS;
  let totalXp = 0;
  for (let i = 0; i < 40; i++) {
    const award = gameAward({ words: 1, today: state });
    state = award.next;
    totalXp += award.xp;
  }
  check('игры: суточный XP из игр не превышает потолок', totalXp === GAME_XP_CAP, `выдано ${totalXp}, потолок ${GAME_XP_CAP}`);
  check('игры: потолок заведомо мал рядом с уроком', GAME_XP_CAP < 40, `потолок ${GAME_XP_CAP}, урок 40`);
  check('игры: на потолке новая сетка не даёт XP', gameAward({ words: 5, today: state }).xp === 0, '');

  // ── 2. Кристаллы: одна штука за первую сетку дня, не за каждую ───────────
  const firstGems = gameAward({ words: 5, today: EMPTY_GAME_AWARDS });
  check('игры: первая сетка дня приносит GAME_DAY_GEMS', firstGems.gems === GAME_DAY_GEMS, `gems=${firstGems.gems}`);
  const againGems = gameAward({ words: 5, today: firstGems.next });
  check('игры: вторая сетка дня кристаллов не даёт', againGems.gems === 0, `gems=${againGems.gems}`);
  check('игры: за день игра не может «напечатать» больше GAME_DAY_GEMS',
    firstGems.gems + againGems.gems === GAME_DAY_GEMS, '');

  // ── 3. Вес в заданиях дня: половина ответа, дробь копится ───────────────
  const half = gameAward({ words: 1, today: EMPTY_GAME_AWARDS });
  check('игры: одно слово — половина верного ответа', GAME_CORRECT_WEIGHT === 0.5 && half.correct === 0,
    `correct=${half.correct}, вес=${GAME_CORRECT_WEIGHT}`);
  const full = gameAward({ words: 1, today: half.next });
  check('игры: две половинки складываются в целый «верный ответ»', full.correct === 1, `correct=${full.correct}`);

  const big = gameAward({ words: 5, today: EMPTY_GAME_AWARDS });
  check('игры: сетка из 5 слов даёт 2 целых ответа (2.5 округляется вниз)',
    big.correct === 2 && big.next.correct === 2.5, `correct=${big.correct}, накоплено=${big.next.correct}`);

  // ── 4. Задания дня: игры двигают только «верные ответы» ─────────────────
  const withGames: DayStat = { xp: 0, correct: 0, wrong: 0, lessons: 0, flawless: 0, reviewCorrect: 0, reviewWords: [], games: { xp: 0, correct: 3, words: 6 } };
  const metrics = dayMetrics(withGames);
  check('игры: «верные ответы» дня включают вес из игр', metrics.correct === 3, `correct=${metrics.correct}`);
  check('игры: задания «уроки» играми не двигаются', metrics.lessons === 0, `lessons=${metrics.lessons}`);
  check('игры: задание «повтори N слов» играми не двигается', metrics.reviewWords === 0, `reviewWords=${metrics.reviewWords}`);
  check('игры: «без ошибок» играми не начисляется', metrics.flawless === 0, `flawless=${metrics.flawless}`);

  const noGames: DayStat = { xp: 0, correct: 7, wrong: 0, lessons: 2, flawless: 1, reviewCorrect: 0, reviewWords: ['a', 'b'] };
  const plain = dayMetrics(noGames);
  check('игры: день без игр считается как раньше', plain.correct === 7 && plain.reviewWords === 2,
    `correct=${plain.correct}, reviewWords=${plain.reviewWords}`);

  // ── 5. Мусор на входе не ломает потолки ────────────────────────────────
  const junk = gameAward({ words: 3, today: { xp: -50, correct: -4, words: Number.NaN } as unknown as GameAwardState });
  check('игры: испорченное состояние дня не даёт отрицательных наград',
    junk.xp >= 0 && junk.correct >= 0 && junk.next.xp >= 0, JSON.stringify(junk));
  check('игры: нулевой запрос ничего не начисляет', gameAward({ words: 0, today: EMPTY_GAME_AWARDS }).xp === 0, '');

  // ── 6. Приоритет: слова с ошибками, но не весь пул ─────────────────────
  const words = {
    hard: { wrong: 5, s: 20 },
    medium: { wrong: 2, s: 50 },
    once: { wrong: 1, s: 10 },
    known: { wrong: 4, s: 95 },
    fresh: { s: 30 },
  };
  const trouble = troubleWords(words, 20);
  check('игры: в приоритет попадают слова с 2+ ошибками', trouble.includes('hard') && trouble.includes('medium'),
    trouble.join(','));
  check('игры: одна ошибка ещё не «трудное слово»', !trouble.includes('once'), trouble.join(','));
  check('игры: освоенное слово (s ≥ 90) в приоритет не попадает', !trouble.includes('known'), trouble.join(','));
  check('игры: слова без ошибок в приоритет не попадают', !trouble.includes('fresh'), trouble.join(','));
  check('игры: самые проблемные слова идут первыми', trouble[0] === 'hard', trouble.join(','));
  check('игры: приоритет ограничен по длине', troubleWords(words, 1).length === 1, '');

  // ── 7. Подпись на экране честная ────────────────────────────────────────
  check('игры: подпись не обещает награды сверх потолка',
    gameAwardHint({ xp: GAME_XP_CAP, correct: 3, words: 9 }).includes('завтра'), gameAwardHint({ xp: GAME_XP_CAP, correct: 3, words: 9 }));
  check('игры: до первой сетки подпись объясняет бонус',
    gameAwardHint(EMPTY_GAME_AWARDS).includes('кристалл'), gameAwardHint(EMPTY_GAME_AWARDS));
}
