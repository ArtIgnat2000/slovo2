/**
 * Награды за «Игры» — малый XP с потолком и учёт кристаллов через задания дня
 * (0.96.7, решение пользователя 2026-11-11: вариант C + A).
 *
 * Зачем отдельный модуль. Игры бесконечны и бесплатны, поэтому «награда за
 * действие» в них — это ферма кристаллов: ребёнок будет тапать «Новая сетка»,
 * а не учиться. Отсюда жёсткие правила, которые живут здесь, а не в UI:
 *
 *  • **XP только малый и с суточным потолком** (`GAME_XP_*`): одна игра не
 *    должна закрывать цель дня, иначе уроки станут необязательными;
 *  • **кристаллы игра не печатает**: найденное/собранное слово идёт в счётчик
 *    заданий дня так же, как ответ в уроке, а задания и сундук уже имеют
 *    суточный потолок (≈34 💎 в день у активного ребёнка). Это и есть
 *    «игры кормят задания дня», а не второй кран;
 *  • **задания «уроки» и «повторение» играми не двигаются вовсе**: урок
 *    остаётся уроком, а «Повтори N слов» — про тренировку по SRS;
 *  • **SRS не трогаем**: ошибка в игре не наказывается и не «портит» слово.
 *    Игра поднимает на поле слова с ошибками (`priorityIds`), но не меняет
 *    расписание повторений.
 *
 * Модуль чистый: ни React, ни стора. Стор только применяет результат.
 */

/**
 * Сколько «верных ответов» даёт одно найденное или собранное слово.
 *
 * 0.5, а не 1: игра — мягкая тренировка, и полный вес позволял бы закрыть
 * задание «12 верных ответов» одной сеткой филворда, не открывая урок.
 */
export const GAME_CORRECT_WEIGHT = 0.5;

/** XP за первое собранное/найденное слово в календарный день. */
export const GAME_XP_FIRST = 2;
/** XP за каждое следующее слово дня (пока не упёрлись в потолок). */
export const GAME_XP_NEXT = 1;
/** Суточный потолок XP из игр: две игры не заменяют урок (урок — 40 XP). */
export const GAME_XP_CAP = 6;

/** Кристаллы за первую сетку/решётку дня — символические, с общим потолком. */
export const GAME_DAY_GEMS = 1;

/**
 * Что игра сообщает о наградном прогрессе дня. Хранится в `DayStat`, чтобы
 * потолки считались по календарю, а не по длине сессии.
 */
export interface GameAwardState {
  /** Сколько XP из игр уже выдано сегодня. */
  xp: number;
  /** Сколько «верных ответов» игра добавила в задания дня (дробное, 0.5). */
  correct: number;
  /** Найдено/собрано слов за день — только для честной подписи на экране. */
  words: number;
  /** Брал ли ребёнок символический бонус кристаллов за сетку сегодня. */
  dayGemTaken?: boolean;
}

export const EMPTY_GAME_AWARDS: GameAwardState = { xp: 0, correct: 0, words: 0 };

export interface GameAwardInput {
  /** Сколько слов ребёнок закрыл в этой игре (найдено или собрано). */
  words: number;
  /** Сегодняшнее состояние наград — из профиля, а не из памяти компонента. */
  today: GameAwardState;
}

export interface GameAwardResult {
  /** Сколько XP начислить сейчас (уже с учётом потолка). */
  xp: number;
  /** Сколько «верных ответов» добавить в задания дня (дробное). */
  correct: number;
  /** Новое состояние наград дня. */
  next: GameAwardState;
  /** Сколько кристаллов выдать сейчас (0 или GAME_DAY_GEMS). */
  gems: number;
}

/**
 * Награда за `words` закрытых слов игры.
 *
 * Дроби копятся в состоянии дня и складываются в «верный ответ» только когда
 * набирается целое: задание дня считает целые ответы, и «половинка» не должна
 * показываться ребёнку как прогресс.
 */
/**
 * Неотрицательное конечное число из чего угодно. Состояние дня приходит из
 * сохранённого профиля и из файла выгрузки, поэтому `NaN`, `Infinity` и строки
 * здесь — не «теория»: без этой чистки `NaN` расползался в XP и кристаллы.
 */
function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export function gameAward({ words, today }: GameAwardInput): GameAwardResult {
  const safeWords = Math.max(0, Math.floor(safeCount(words)));
  const state: GameAwardState = {
    xp: safeCount(today?.xp),
    correct: safeCount(today?.correct),
    words: safeCount(today?.words),
    dayGemTaken: !!today?.dayGemTaken,
  };
  if (safeWords === 0) {
    return { xp: 0, correct: 0, next: state, gems: 0 };
  }

  // XP: первое слово дня стоит 2, каждое следующее — 1, пока не упёрлись в
  // потолок. Считаем «сколько дали бы всего» и берём разницу с уже выданным —
  // так повторный вход в игру не выдаёт бонус заново.
  const totalXpWould = Math.min(
    GAME_XP_CAP,
    (state.words > 0 ? GAME_XP_FIRST : GAME_XP_FIRST) + Math.max(0, state.words + safeWords - 1) * GAME_XP_NEXT,
  );
  const xpNow = Math.max(0, Math.min(GAME_XP_CAP - state.xp, totalXpWould - state.xp));

  // «Верные ответы» для заданий дня: 0.5 за слово, отдаём целыми порциями.
  const rawCorrect = state.correct + safeWords * GAME_CORRECT_WEIGHT;
  const correctNow = Math.floor(rawCorrect) - Math.floor(state.correct);

  // Символический бонус за первую сетку дня — отдельно от круга заданий.
  const gems = state.dayGemTaken ? 0 : GAME_DAY_GEMS;

  return {
    xp: xpNow,
    correct: correctNow,
    gems,
    next: {
      xp: state.xp + xpNow,
      correct: rawCorrect,
      words: state.words + safeWords,
      dayGemTaken: true,
    },
  };
}

/**
 * Подпись на игровом экране. Никаких обещаний, которых не будет: если потолок
 * выбран, честно говорим «на сегодня всё», а не показываем «+0».
 */
export function gameAwardHint(state: GameAwardState): string {
  if (state.xp >= GAME_XP_CAP) return 'На сегодня кристаллов и опыта из игр хватит — приходи завтра';
  if (state.words > 0) return `За игру сегодня: +${state.xp} ⚡`;
  return 'Первая сетка дня приносит кристалл';
}

/**
 * Слова для приоритета в играх: в которых ребёнок ошибался.
 *
 * Берём `profile.words`, а не ошибки дня: ошибся вчера — всё равно полезно
 * потренировать. Порог мягкий: одно неверное касание ещё не «трудное слово»,
 * иначе приоритет захватит весь пул.
 */
export function troubleWords(
  words: Record<string, { wrong?: number; s?: number }>,
  limit = 20,
): string[] {
  return Object.entries(words)
    .filter(([, st]) => (st?.wrong ?? 0) >= 2 && (st?.s ?? 0) < 90)
    .sort((a, b) => (b[1].wrong ?? 0) - (a[1].wrong ?? 0) || (a[1].s ?? 0) - (b[1].s ?? 0))
    .slice(0, limit)
    .map(([id]) => id);
}
