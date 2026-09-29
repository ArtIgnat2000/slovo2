import type { Word, WordState } from '../types';

export const DAY = 86_400_000;

export function initState(now = Date.now()): WordState {
  return { s: 0, due: now, iv: 0, n: 0, seen: 0, ok: 0, wrong: 0 };
}

/**
 * Обновление состояния слова (упрощённый SM-2 + школьная логика).
 * quality: 0..1 — ошибка, 2..3 — верно с подсказкой, 4..5 — верно сам.
 */
export function applyAnswer(st: WordState, quality: number, now = Date.now()): WordState {
  const next: WordState = { ...st, seen: now };

  if (quality >= 3) {
    next.n = st.n + 1;
    next.ok = st.ok + 1;
    next.iv = st.n === 0 ? 1 : st.n === 1 ? 2 : Math.min(60, Math.round(st.iv * 2.1));
    next.s = Math.min(100, st.s + (quality >= 5 ? 15 : quality === 4 ? 11 : 6));
    // С подсказкой интервал растёт медленнее
    if (quality === 3) next.iv = Math.max(1, Math.round(next.iv / 2));
  } else {
    next.n = 0;
    next.wrong = st.wrong + 1;
    next.iv = 0;
    next.s = Math.max(0, st.s - 25);
  }

  next.due = now + Math.max(0.35, next.iv) * DAY;
  return next;
}

export function isDue(st: WordState | undefined, now = Date.now()): boolean {
  if (!st) return true;
  return st.due <= now;
}

/** Приоритет слова для повторения: чем больше — тем нужнее. */
export function priority(st: WordState | undefined, now = Date.now()): number {
  if (!st) return 1000; // новое слово
  const overdue = (now - st.due) / DAY;
  return Math.max(0, 100 - st.s) * 3 + overdue * 12 + (st.wrong > st.ok ? 15 : 0);
}

/** Слова, которые пора повторить (не из текущего урока), по убыванию приоритета. */
export function pickReview(
  all: Word[],
  states: Record<string, WordState>,
  exclude: Set<string>,
  limit: number,
  now = Date.now(),
): Word[] {
  return all
    .filter((w) => !exclude.has(w.id))
    .filter((w) => {
      const st = states[w.id];
      return st && st.s > 0 && isDue(st, now);
    })
    .sort((a, b) => priority(states[b.id], now) - priority(states[a.id], now))
    .slice(0, limit);
}

/**
 * Что тренировать в режиме «Повторение».
 *
 * Раньше главная и сам урок повторения считали слова по-разному: главная — все
 * просроченные, урок — просроченные, кроме слов активного урока. Из-за этого блок
 * «Пора повторить» мог обещать слова, которых урок не показывал («Повторять нечего!»).
 * Теперь правило одно и живёт здесь.
 *
 *  • `due` — слова, у которых истёк срок повторения (сначала самые «забытые»);
 *  • `training` — если таких нет, тренируем самые слабые из уже пройденных слов:
 *    иначе задание дня «Повтори N слов» нечем закрыть, когда всё свежо в памяти.
 *  • В обоих случаях сначала идут слова, которых сегодня ещё не было: так повторный
 *    заход не крутит одни и те же слова, а прогресс задания растёт.
 *
 * Слова, которые ребёнок ещё не проходил (s = 0), в повторение не попадают никогда.
 */
export interface ReviewPick {
  kind: 'due' | 'training';
  words: Word[];
}

export function pickReviewWords(
  all: Word[],
  states: Record<string, WordState>,
  exclude: Set<string>,
  limit: number,
  practisedToday: Set<string> = new Set(),
  now = Date.now(),
): ReviewPick {
  const pool = all.filter((w) => !exclude.has(w.id) && (states[w.id]?.s ?? 0) > 0);
  const order = (a: Word, b: Word) => {
    // Слова, которых сегодня ещё не было, идут первыми (компаратор: < 0 — «a» раньше)
    const seenToday = Number(practisedToday.has(a.id)) - Number(practisedToday.has(b.id));
    if (seenToday !== 0) return seenToday;
    return priority(states[b.id], now) - priority(states[a.id], now);
  };
  const due = pool.filter((w) => isDue(states[w.id], now)).sort(order);
  if (due.length) return { kind: 'due', words: due.slice(0, limit) };
  return { kind: 'training', words: [...pool].sort(order).slice(0, limit) };
}

export function mastered(st: WordState | undefined): boolean {
  return (st?.s ?? 0) >= 90;
}
