// ── «Бродилка БУКа» — главная игра приложения ───────────────────────────────
//
// Замысел (docs/game-mechanics/README.md, Г1): уроки остаются уроками, но рядом
// появляется игра, где кубик ведёт БУКа по маршруту из 16 тем. Клетка-станция
// «ждёт» слово: собрал его (в задании с буквами-шпионами) — станция твоя.
//
// Правила, которые нельзя нарушать (принятые решения проекта):
//   • проиграть нельзя: кубик ведёт только вперёд, назад не отбрасывает;
//   • ошибка ничего не отнимает — буквы просто встают на место заново;
//   • нет таймеров и нет «жизней»;
//   • игра кормит обучение, а не заменяет его: собранное слово проходит через
//     обычный SRS (`answer`), поэтому игра идёт в тот же прогресс, что урок.
//
// Модуль чистый: ни React, ни стора, ни обращений к устройству. Всё, что зависит
// от случая, принимает `rng` — тесты подставляют свой (см. tests/board.test.ts).

import { LESSONS } from '../content/words';
import type { BoardGameState, Lesson, Task, Word, WordState } from '../types';

/** Кубик: 1..3. Больше шагов — длиннее партия; для 8 лет выбрали короткий ход. */
export const DICE_MIN = 1;
export const DICE_MAX = 3;

/** Привал после каждой четвёртой станции: передышка и небольшая награда. */
export const PRIVAL_EVERY = 4;

export const BOARD_REWARDS = {
  /** Станция взята впервые. */
  station: 5,
  /** Станция уже была твоей — тренировка всё равно считается, награда меньше. */
  replay: 1,
  /** Привал: отдых по дороге. */
  prival: 2,
  /** Маршрут пройден до конца — один раз. */
  finish: 10,
} as const;

export type BoardCellKind = 'station' | 'prival';

export interface BoardCell {
  /** Номер клетки, считая с 1: позиция БУКа `pos` указывает на клетку номер `pos`. */
  index: number;
  kind: BoardCellKind;
  /** Для станции — урок темы; у привала урока нет. */
  lessonId?: string;
  title: string;
  emoji: string;
}

/** Маршрут: станции по порядку уроков, после каждой четвёртой — привал. */
export function buildBoard(lessons: Lesson[] = LESSONS): BoardCell[] {
  const cells: BoardCell[] = [];
  let stations = 0;
  for (const lesson of lessons) {
    stations += 1;
    cells.push({
      index: cells.length + 1,
      kind: 'station',
      lessonId: lesson.id,
      title: lesson.title,
      emoji: lesson.emoji,
    });
    if (stations % PRIVAL_EVERY === 0) {
      cells.push({
        index: cells.length + 1,
        kind: 'prival',
        title: `Привал ${cells.filter((c) => c.kind === 'prival').length + 1}`,
        emoji: '🏕️',
      });
    }
  }
  return cells;
}

export const BOARD: BoardCell[] = buildBoard();

/** Клетка, на которой стоит БУК после `pos` шагов; null — маршрут ещё не начат. */
export function cellAt(pos: number, board: BoardCell[] = BOARD): BoardCell | null {
  if (pos <= 0) return null;
  return board[Math.min(pos, board.length) - 1] ?? null;
}

/** Позиция клетки урока (1-based) — чтобы тесты и отладка не искали её глазами. */
export function posOfLesson(lessonId: string, board: BoardCell[] = BOARD): number {
  const cell = board.find((c) => c.lessonId === lessonId);
  return cell ? cell.index : 0;
}

/**
 * Шаг вперёд. Кубик никогда не отбрасывает назад и не выводит за маршрут:
 * лишние шаги на финише просто упираются в последнюю клетку.
 */
export function advance(pos: number, dice: number, size: number = BOARD.length): number {
  const from = Math.max(0, Math.min(size, Math.floor(pos)));
  const steps = Math.max(0, Math.floor(dice));
  return Math.min(size, from + steps);
}

/** Бросок кубика: целое от 1 до 3. `rng` подменяется в тестах. */
export function rollDice(rng: () => number = Math.random): number {
  const r = Math.min(0.999999, Math.max(0, rng()));
  return DICE_MIN + Math.floor(r * (DICE_MAX - DICE_MIN + 1));
}

export interface RollOutcome {
  /** Куда встал БУК после шага. */
  pos: number;
  /** Клетка, на которой он оказался (null — маршрут уже пройден). */
  cell: BoardCell | null;
  /** Маршрут пройден именно этим шагом — награда выдана один раз. */
  finished: boolean;
  /** Кристаллы, которые уже начислены этим шагом (привал или финиш). */
  gems: number;
}

/**
 * Какое слово станция попросит собрать: самое слабое в теме (низкий `s`),
 * при равенстве — первое по порядку контента. Так игра тренирует то, что
 * у ребёнка хуже всего, и остаётся предсказуемой для тестов.
 */
export function stationWord(lessonId: string, words: Word[], states: Record<string, WordState> = {}): Word | null {
  // Фразы («до свидания») не собираются из букв — у них нет плитки пробела,
  // поэтому станция такие слова не спрашивает (та же логика, что в scheduler).
  const lesson = words.filter((w) => w.theme === lessonId && !w.text.includes(' '));
  if (!lesson.length) return null;
  let best = lesson[0];
  for (const w of lesson) {
    if ((states[w.id]?.s ?? 0) < (states[best.id]?.s ?? 0)) best = w;
  }
  return best;
}

/** Сколько букв-шпионов подсыпаем: короткому слову хватает одной. */
export function spyCount(word: Word): number {
  return word.text.length <= 5 ? 1 : 2;
}

/** Удвоенная согласная в слове (с, б, н…): её же и подсыпаем шпионом. */
function doubledConsonant(text: string): string | null {
  const lower = text.toLowerCase();
  for (let i = 0; i + 1 < lower.length; i++) {
    if (lower[i] === lower[i + 1] && 'бвгджзклмнпрстфхцчшщ'.includes(lower[i])) return lower[i];
  }
  return null;
}

const SPY_POOL = 'аоеистдкнп';

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Задание станции: собрать слово из букв, среди которых есть «шпионы» — буквы,
 * которых в слове нет (или лишняя пара к удвоенной согласной). Шпион на место
 * не встаёт: в `TaskView` тап по нему ничего не ставит и объясняет правило.
 */
export function makeStationTask(word: Word, rng: () => number = Math.random): Task {
  const target = [...word.text];
  const spies: string[] = [];
  // Удвоенная согласная — лучший шпион: проверяем «ровно две С», а не «хоть одна».
  const double = doubledConsonant(word.text);
  if (double) spies.push(double);
  const needed = Math.max(0, spyCount(word) - spies.length);
  const pool = [...SPY_POOL].filter((ch) => !target.some((t) => t.toLowerCase() === ch));
  for (let i = 0; i < needed && pool.length > 0; i++) {
    const [ch] = pool.splice(Math.floor(rng() * pool.length), 1);
    spies.push(target[0] === target[0]?.toUpperCase() ? ch.toUpperCase() : ch);
  }
  // Мешаем буквы вместе со шпионами, а «кто есть кто» помним по объектам:
  // после перемешивания остаётся только сложить список и индексы.
  const pile = shuffle(
    [
      ...target.map((ch) => ({ ch, spy: false })),
      ...spies.map((ch) => ({ ch, spy: true })),
    ],
    rng,
  );
  return {
    uid: `game_${word.id}`,
    kind: 'build',
    wordId: word.id,
    reason: 'practice',
    dangerIdx: word.danger[0] ?? Math.max(0, word.stress),
    letters: pile.map((p) => p.ch),
    spies: pile.map((p, i) => (p.spy ? i : -1)).filter((i) => i >= 0),
  };
}

/** Сколько станций уже открыто — для подписи на главной. */
export function stationsOpened(state: BoardGameState | undefined): number {
  return new Set(state?.claimed ?? []).size;
}

/**
 * Санитайз состояния игры при чтении профиля и при импорте выгрузки: чужие id,
 * дубликаты, отрицательные и запредельные позиции отбрасываются, старые профили
 * без поля получают пустую партию (поведение приложения не меняется).
 */
export function normalizeGame(raw: unknown, size: number = BOARD.length): BoardGameState {
  const empty: BoardGameState = { pos: 0, claimed: [], rolls: 0 };
  if (!raw || typeof raw !== 'object') return empty;
  const value = raw as Partial<BoardGameState>;
  const known = new Set(BOARD.map((c) => c.lessonId).filter((id): id is string => !!id));
  const claimed = Array.isArray(value.claimed)
    ? [...new Set(value.claimed.filter((id): id is string => typeof id === 'string' && known.has(id)))]
    : [];
  const pos = typeof value.pos === 'number' && Number.isFinite(value.pos) ? Math.floor(value.pos) : 0;
  const rolls = typeof value.rolls === 'number' && Number.isFinite(value.rolls) ? Math.floor(value.rolls) : 0;
  const finishedAt =
    typeof value.finishedAt === 'number' && Number.isFinite(value.finishedAt) && value.finishedAt > 0
      ? value.finishedAt
      : undefined;
  return {
    pos: Math.max(0, Math.min(size, pos)),
    claimed,
    rolls: Math.max(0, rolls),
    ...(finishedAt ? { finishedAt } : {}),
  };
}
