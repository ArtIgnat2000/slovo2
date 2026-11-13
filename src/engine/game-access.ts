/**
 * Доступ к «Играм» за успехи дня (0.99.1, план — `docs/proposals/games-development.md` §8).
 *
 * Зачем это здесь, а не в экране игр. Правило «игры открываются за успехи»
 * легко превращается в наказание, если его считать в разметке: тогда любой
 * рефактор вкладки может отнять у ребёнка единственную доступную игру. Поэтому
 * вся арифметика — чистые функции, а экран только показывает результат.
 *
 * ── Что изменилось против 0.99.0 и почему ─────────────────────────────────
 * В 0.99.0 ключи складывались из трёх источников, которые растут от ОДНОГО
 * действия: урок → закрытые задания дня → баллы дня. Замер по движку показал,
 * что даже слабый урок (5 верных из 14, 84 ⚡) давал 2 ключа и открывал все
 * три игры: то есть «игра за урок» на деле означала «игра за плохой урок».
 *
 * Теперь ключи — это ЛЕСТНИЦА ИЗ ТРЁХ РАЗНЫХ ДЕЛ, а не три множителя одного:
 *  1. **10 верных ответов** за день (урок или повторение; игры не считаются) —
 *     «позанимался», независимо от того, дошёл ли до конца;
 *  2. **урок доведён до конца** — сюда же нужен и первый шаг: «дошёл и
 *     справился», а не «нажал выход на третьей карточке»;
 *  3. **весь план дня закрыт** — то самое состояние, в котором готов сундук
 *     БУКа. Забирать сундук не обязательно: считаем задания, а не тап.
 *
 * Жёсткие границы (решения владельца 2026-11-12 и 2026-11-13):
 *  • базовая игра открыта ВСЕГДА, даже при нулевом дне;
 *  • ключи не отнимаются: ошибка, подсказка и потолок наград доступ не
 *    уменьшают — все три шага считаются по «сделано», а не по «не испорчено»;
 *  • ключи не хранятся в профиле — пересчитываются из дня, поэтому нет
 *    миграции, а полночь сбрасывает шкалу сама;
 *  • игры не открывают игры: в шаг «10 верных ответов» идёт только работа в
 *    уроке/повторении (`day.correct`), но не `day.games.correct`.
 *
 * Модуль чистый: ни React, ни стора, ни `window`.
 */
import type { DayStat, QuestPlanItem } from '../types';
import { dayMetrics, questProgress, specFor } from './quests';

/**
 * Сколько ключей нужно, чтобы открылась игра № n (по порядку в витрине).
 *
 * 0 — базовая игра, она открыта всегда; 1 — после первого шага, 2 — после
 * второго, 3 — полное открытие (решение владельца: 3 ключа = 4 игры).
 * Когда игр станет больше четырёх, сюда добавится четвёрка — и это будет
 * единственная правка схемы.
 */
export const GAME_GATE_KEYS: readonly number[] = [0, 1, 2, 3];

/**
 * Первый шаг: сколько верных ответов за день считаем «позанимался».
 *
 * 10, а не «любой ответ»: зашёл, ткнул одну карточку и вышел — это ещё не
 * занятие, и открывать за это вторую игру значит обесценить урок. При этом
 * 10 верных — это примерно половина короткого урока: доступно, но заметно.
 */
export const GATE_CORRECT_STEP = 10;

/** Режим доступа из настроек взрослого. */
export type GamesGates = 'open' | 'points';

/** Какой шаг лестницы закрыт: работа, доведённый урок, весь план дня. */
export interface GameAccessSteps {
  /** 10 верных ответов за день (только урок и повторение). */
  correct: boolean;
  /** Урок доведён до конца (и первый шаг уже есть). */
  lesson: boolean;
  /** Все задания дня закрыты — сундук БУКа готов (забирать не обязательно). */
  chest: boolean;
}

export interface DayGameAccess {
  /** Сколько ключей набрано сегодня (0..3). */
  keys: number;
  /** Сколько игр открыто (всегда ≥ 1). */
  openCount: number;
  /** Какие шаги уже сделаны — для тестов и честной подписи. */
  steps: GameAccessSteps;
  /** Сколько ключей осталось до полного открытия (0 — открыто всё). */
  leftToAll: number;
  /** Что осталось для следующей игры: 'за 10 верных ответов', 'за урок', 'за все задания дня'. */
  nextCondition: string;
  /** Подпись «Открыто 2 игры · ещё одна за урок» — для строки шкалы. */
  nextHint: string;
  /** Сколько верных ответов уже есть и сколько нужно (для подписи первого шага). */
  correctProgress: { have: number; need: number };
}

/**
 * Ключи дня и число открытых игр.
 *
 * `totalGames` — сколько игр на витрине сейчас. Передаём числом, а не выводим
 * из `GAME_GATE_KEYS`: витрина может знать больше игр, чем уже открыто
 * порогами, и тогда «открыто всё» не должно врать.
 */
export function dayGameAccess(params: {
  day: DayStat | undefined;
  plan: QuestPlanItem[];
  totalGames: number;
  gates?: GamesGates;
  /** Оставлено для совместимости вызовов: в 0.99.1 порог за баллы не нужен. */
  dailyGoal?: number;
  claimed?: string[];
}): DayGameAccess {
  const { day, plan, totalGames, gates = 'points' } = params;

  if (gates === 'open' || totalGames <= 0) {
    return {
      keys: lastKey(),
      openCount: Math.max(1, totalGames),
      steps: { correct: true, lesson: true, chest: true },
      leftToAll: 0,
      nextCondition: '',
      nextHint: 'Сегодня открыто всё',
      correctProgress: { have: 0, need: GATE_CORRECT_STEP },
    };
  }

  // Только работа в уроке и повторении. Награды игр лежат в `day.games` и в
  // этот счётчик не входят — игра не должна открывать игры (0.99.0, оставлено).
  const correct = Math.max(0, Math.floor(day?.correct ?? 0));
  const lessons = Math.max(0, Math.floor(day?.lessons ?? 0));

  // Задания считаем по прогрессу, а не по «забрано награду»: закрыл задание —
  // игра открылась, даже если сундук ещё не открыт.
  const metrics = dayMetrics(day);
  const questsDone = plan.filter(
    (item) => questProgress(specFor(item.kind), item.target, metrics).done,
  ).length;
  const allQuests = plan.length > 0 && questsDone === plan.length;

  // Лестница, а не сумма: второй шаг требует первого. Иначе «дошёл до конца и
  // всё провалил» открывало бы игру наравне с «дошёл и справился».
  const steps: GameAccessSteps = {
    correct: correct >= GATE_CORRECT_STEP,
    lesson: lessons >= 1 && correct >= GATE_CORRECT_STEP,
    chest: allQuests,
  };
  const keys = (steps.correct ? 1 : 0) + (steps.lesson ? 1 : 0) + (steps.chest ? 1 : 0);

  // Сколько игр открыто: считаем по порогам, но не больше, чем игр на витрине.
  const byThreshold = GAME_GATE_KEYS.filter((need) => need <= keys).length;
  const openCount = Math.max(1, Math.min(totalGames, byThreshold));

  const allKeys = GAME_GATE_KEYS[Math.min(totalGames, GAME_GATE_KEYS.length) - 1] ?? 0;
  const leftToAll = Math.max(0, allKeys - keys);
  const nextCondition = conditionForNext(steps, correct, plan.length);

  return {
    keys,
    openCount,
    steps,
    leftToAll,
    nextCondition,
    nextHint: hintFor(openCount, totalGames, nextCondition, correct),
    correctProgress: { have: correct, need: GATE_CORRECT_STEP },
  };
}

function lastKey(): number {
  return GAME_GATE_KEYS[GAME_GATE_KEYS.length - 1] ?? 0;
}

/**
 * Условие следующей игры одной короткой фразой.
 *
 * Порядок важен: ребёнку показываем СЛЕДУЮЩИЙ шаг, а не самый дальний —
 * иначе после пустого дня шкала говорила бы про задания дня, до которых
 * ещё два шага.
 */
export function conditionForNext(steps: GameAccessSteps, correct: number, planLength: number): string {
  if (!steps.correct) {
    const left = Math.max(1, GATE_CORRECT_STEP - correct);
    return `за ${left} ${pluralAnswers(left)}`;
  }
  if (!steps.lesson) return 'за урок';
  if (!steps.chest) return planLength > 0 ? 'за все задания дня' : 'за урок';
  return '';
}

/** «1 верный ответ / 2 верных ответа / 5 верных ответов». */
function pluralAnswers(n: number): string {
  const abs = Math.abs(Math.trunc(n)) % 100;
  const tail = abs % 10;
  if (abs > 10 && abs < 20) return 'верных ответов';
  if (tail === 1) return 'верный ответ';
  if (tail >= 2 && tail <= 4) return 'верных ответа';
  return 'верных ответов';
}

/**
 * Подпись к шкале. Одна короткая строка: ребёнок читает её, не открывая правил.
 *
 * Никаких «нельзя» и «не хватает»: только что уже открыто и что откроется.
 */
function hintFor(openCount: number, totalGames: number, nextCondition: string, correct: number): string {
  if (openCount >= totalGames || !nextCondition) return 'Сегодня открыто всё';
  const head = `Открыто ${openCount} ${pluralGames(openCount)}`;
  // Первый шаг показываем с прогрессом: «7 из 10» нагляднее, чем «ещё 3».
  if (nextCondition.startsWith('за ') && correct < GATE_CORRECT_STEP) {
    return `${head} · ${correct} из ${GATE_CORRECT_STEP} верных ответов`;
  }
  return `${head} · ещё одна ${nextCondition}`;
}

/** «1 игра / 2 игры / 5 игр» — подпись шкалы не должна говорить «игр» про одну. */
export function pluralGames(n: number): string {
  const abs = Math.abs(Math.trunc(n)) % 100;
  const tail = abs % 10;
  if (abs > 10 && abs < 20) return 'игр';
  if (tail === 1) return 'игра';
  if (tail >= 2 && tail <= 4) return 'игры';
  return 'игр';
}

/**
 * Открыта ли игра под номером `index` (0 — первая в витрине) сегодня.
 * Замок рисуется по этому ответу; сама игра проверяет его же, а не своё мнение.
 */
export function isGameOpen(access: DayGameAccess, index: number): boolean {
  return index >= 0 && index < access.openCount;
}

/**
 * Текст замка: одно условие, без «нельзя» и без счёта проигрышей.
 * При открытом доступе возвращает пустую строку — рисовать нечего.
 *
 * Условие одно на все закрытые карточки: оно про следующий шаг лестницы, а
 * не про «сколько ключей не хватает» — ребёнку нужно одно действие, а не арифметика.
 */
export function lockHint(access: DayGameAccess, index: number): string {
  if (isGameOpen(access, index)) return '';
  if (!access.nextCondition) return '';
  // Условие уже начинается с «за»: «Откроется за урок», «Откроется за все
  // задания дня». Никакой капитализации — иначе получается «Откроется За».
  return `Откроется ${access.nextCondition}`;
}
