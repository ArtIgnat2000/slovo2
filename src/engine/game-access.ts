/**
 * Доступ к «Играм» за успехи дня (0.99.0, план — `docs/proposals/games-development.md` §8).
 *
 * Зачем это здесь, а не в экране игр. Правило «игры открываются за успехи»
 * легко превращается в наказание, если его считать в разметке: тогда любой
 * рефактор вкладки может отнять у ребёнка единственную доступную игру. Поэтому
 * вся арифметика — чистые функции, а экран только показывает результат.
 *
 * Что считается «успехом дня» (новая валюта не вводится):
 *  • урок — `DayStat.lessons`, не больше `MAX_LESSON_KEYS` в зачёт;
 *  • закрытое задание дня — то же, что закрывает сундук (`quests.ts`);
 *  • баллы дня — `DayStat.xp` без наград игр, порог `GATE_XP_SHARE` от цели.
 *
 * Жёсткие границы (решение владельца 2026-11-12):
 *  • базовая игра открыта ВСЕГДА, даже при нулевом дне;
 *  • ключи не отнимаются: ошибка, подсказка и потолок наград доступ не
 *    уменьшают;
 *  • ключи не хранятся в профиле — пересчитываются из дня, поэтому нет
 *    миграции, а полночь сбрасывает шкалу сама;
 *  • XP из игр в ключи не идёт: иначе «играть → получать доступ к играм».
 *
 * Модуль чистый: ни React, ни стора, ни `window`.
 */
import type { DayStat, QuestPlanItem } from '../types';
import { dayMetrics, questProgress, specFor } from './quests';

/**
 * Сколько ключей нужно, чтобы открылась игра № n (по порядку в витрине).
 *
 * 0 — базовая игра, она открыта всегда; 1 — после первого урока; 2 — после
 * второго; 3 — полное открытие (решение владельца: 3 ключа = все игры).
 * Когда игр станет больше четырёх, сюда добавится четвёрка — и это будет
 * единственная правка схемы.
 */
export const GAME_GATE_KEYS: readonly number[] = [0, 1, 2, 3];

/** Больше двух уроков в день ключей не дают: гриндить уроки ради игр не нужно. */
export const MAX_LESSON_KEYS = 2;

/**
 * Доля дневной цели, которая даёт ключ за баллы.
 *
 * Половина `dailyGoal` (при цели 120 — 60 ⚡), а не «ровно один урок»: иначе
 * ключ за баллы был бы дублем ключа за урок — прошёл урок и получил два ключа
 * за одно действие.
 */
export const GATE_XP_SHARE = 0.5;

/** Ниже этого порога ключ за баллы не выдаём, даже если цель дня крошечная. */
export const GATE_XP_MIN = 30;

/** Режим доступа из настроек взрослого. */
export type GamesGates = 'open' | 'points';

export interface DayGameAccess {
  /** Сколько ключей набрано сегодня. */
  keys: number;
  /** Сколько игр открыто (всегда ≥ 1). */
  openCount: number;
  /** Из чего сложились ключи — для тестов и честной подписи. */
  parts: { lessons: number; quests: number; xp: number };
  /** Сколько ключей осталось до полного открытия (0 — открыто всё). */
  leftToAll: number;
  /** Подпись «ещё 1 за урок» / «сегодня открыто всё» — для строки шкалы. */
  nextHint: string;
}

/**
 * Ключи дня и число открытых игр.
 *
 * `totalGames` — сколько игр на витрине сейчас (три в 0.99.0). Передаём
 * числом, а не выводим из `GAME_GATE_KEYS`: витрина может знать больше игр,
 * чем уже открыто порогами, и тогда «открыто всё» не должно врать.
 */
export function dayGameAccess(params: {
  day: DayStat | undefined;
  dailyGoal: number;
  plan: QuestPlanItem[];
  claimed?: string[];
  totalGames: number;
  gates?: GamesGates;
}): DayGameAccess {
  const { day, dailyGoal, plan, totalGames, gates = 'points' } = params;

  if (gates === 'open' || totalGames <= 0) {
    return {
      keys: GAME_GATE_KEYS[GAME_GATE_KEYS.length - 1] ?? 0,
      openCount: Math.max(1, totalGames),
      parts: { lessons: 0, quests: 0, xp: 0 },
      leftToAll: 0,
      nextHint: 'Сегодня открыто всё',
    };
  }

  // Задания считаем по прогрессу, а не по «забрано награду»: закрыл задание —
  // игра открылась, даже если сундук ещё не открыт (иначе награда висела бы
  // в зависимости от того, догадался ли ребёнок нажать «Забрать»).
  const metrics = dayMetrics(day);
  const questsDone = plan.filter(
    (item) => questProgress(specFor(item.kind), item.target, metrics).done,
  ).length;

  // Награды игр лежат в том же `DayStat.xp` (`store.ts`, `playGame`), поэтому
  // их обязательно вычитаем: иначе игра сама оплачивала бы доступ к играм.
  const xpFromWork = Math.max(0, (day?.xp ?? 0) - (day?.games?.xp ?? 0));
  const xpThreshold = Math.max(GATE_XP_MIN, Math.round(dailyGoal * GATE_XP_SHARE));

  const lessons = Math.min(Math.max(0, day?.lessons ?? 0), MAX_LESSON_KEYS);
  const quests = Math.max(0, questsDone);
  const xp = xpFromWork >= xpThreshold ? 1 : 0;
  const keys = lessons + quests + xp;

  // Сколько игр открыто: считаем по порогам, но не больше, чем игр на витрине.
  const byThreshold = GAME_GATE_KEYS.filter((need) => need <= keys).length;
  const openCount = Math.max(1, Math.min(totalGames, byThreshold));

  const allKeys = GAME_GATE_KEYS[Math.min(totalGames, GAME_GATE_KEYS.length) - 1] ?? 0;
  const leftToAll = Math.max(0, allKeys - keys);

  return {
    keys,
    openCount,
    parts: { lessons, quests, xp },
    leftToAll,
    nextHint: hintFor({ lessons, quests, xp, xpThreshold, xpFromWork }, openCount, totalGames),
  };
}

/**
 * Подпись к шкале. Одна короткая строка: ребёнок читает её, не открывая правил.
 *
 * Никаких «нельзя» и «не хватает»: только что уже открыто и что откроется.
 */
function hintFor(
  p: { lessons: number; quests: number; xp: number; xpThreshold: number; xpFromWork: number },
  openCount: number,
  totalGames: number,
): string {
  if (openCount >= totalGames) return 'Сегодня открыто всё';
  if (p.lessons < MAX_LESSON_KEYS) {
    return `Открыто ${openCount} ${pluralGames(openCount)} · ещё одна за урок`;
  }
  if (p.quests < 1) return `Открыто ${openCount} ${pluralGames(openCount)} · ещё одна за задание дня`;
  if (p.xp === 0) {
    const left = Math.max(1, p.xpThreshold - p.xpFromWork);
    return `Открыто ${openCount} ${pluralGames(openCount)} · ещё ${left} ⚡ до новой игры`;
  }
  return `Открыто ${openCount} ${pluralGames(openCount)}`;
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
 */
export function lockHint(access: DayGameAccess, index: number): string {
  if (isGameOpen(access, index)) return '';
  const need = GAME_GATE_KEYS[index] ?? GAME_GATE_KEYS[GAME_GATE_KEYS.length - 1] ?? 0;
  const missing = Math.max(1, need - access.keys);
  return missing === 1 ? 'Откроется за урок' : `Откроется за ${missing} урока`;
}
