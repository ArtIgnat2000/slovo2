// ── Ежедневные задания и сундук ─────────────────────────────────────────────
//
// Замысел (пункт 3 плана): три задания в день, разные по типу, прогресс виден
// на главной, за каждое — кристаллы 💎, за все три — сундук.
//
// Принципы, вытекающие из принятых решений:
//  • никаких «потеряй серию» — задания не наказывают и не истекают втихую,
//    просто на новый день приходят новые;
//  • задания не дублируют цель дня по XP (иначе она закрывается «сама»): награда —
//    кристаллы, а не опыт;
//  • «без ошибок» считаем по всей дневной практике, а не по одному уроку —
//    иначе задание превращается в перфекционизм.
//
// Модуль чистый: ни React, ни стора. Сторы только хранят состояние.

import type { DayStat, Profile } from '../types';
import { dayKey } from './day';

export type QuestKind =
  /** Пройти N уроков (урок = дошедший до конца LessonScreen, включая «Повторение») */
  | 'lessons'
  /** Ответить верно N раз без ошибок подряд */
  | 'flawless'
  /** Ответить верно N заданий */
  | 'correct'
  /** Потренировать N слов, которые пора повторить (режим «Повторение») */
  | 'review';

export interface QuestSpec {
  kind: QuestKind;
  target: number;
  title: string;
  emoji: string;
  reward: number; // кристаллы за выполнение
}

/** Пул шаблонов: каждый день берём три разных по типу. */
export const QUEST_POOL: QuestSpec[] = [
  { kind: 'lessons', target: 2, title: 'Пройди 2 урока', emoji: '📚', reward: 3 },
  { kind: 'flawless', target: 6, title: '6 верных ответов подряд', emoji: '🎯', reward: 3 },
  { kind: 'correct', target: 12, title: '12 верных ответов за день', emoji: '✅', reward: 3 },
  { kind: 'review', target: 5, title: 'Повтори 5 слов', emoji: '🔁', reward: 3 },
];

/** Ежедневные метрики — считаются из данных дня, хранить их отдельно не нужно. */
export interface DayMetrics {
  lessons: number; // уроков пройдено за день
  correct: number; // верных ответов за день
  flawless: number; // лучшая серия верных ответов без ошибок за день
  reviewCorrect: number; // верных ответов в режиме «Повторение»
}

export interface QuestProgress {
  spec: QuestSpec;
  progress: number;
  done: boolean;
}

export const GEM_PER_QUEST = QUEST_POOL[0].reward;
/** Сундук за все три задания — заметно больше, чем сумма за задания. */
export const CHEST_GEMS = 15;

/** Какой набор заданий у дня: детерминированно от даты — обновил страницу, и он тот же. */
export function questsForDay(day: string): QuestSpec[] {
  const seed = hash(day);
  const kinds: QuestKind[] = ['lessons', 'flawless', 'correct', 'review'];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = (seed + i * 7) % (i + 1);
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const chosen = kinds.slice(0, 3);
  return chosen.map((k, i) => {
    const variants = QUEST_POOL.filter((q) => q.kind === k);
    // на 0-м и 2-м месте — первый (он же «базовый») вариант, на 1-м — другой (если есть)
    const pick = i === 1 && variants.length > 1 ? variants[1] : variants[0];
    return pick;
  });
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Сводка метрик дня по профилю. */
export function dayMetrics(day: DayStat | undefined): DayMetrics {
  return {
    lessons: day?.lessons ?? 0,
    correct: day?.correct ?? 0,
    flawless: day?.flawless ?? 0,
    reviewCorrect: day?.reviewCorrect ?? 0,
  };
}

export function questProgress(spec: QuestSpec, m: DayMetrics): QuestProgress {
  const raw =
    spec.kind === 'lessons'
      ? m.lessons
      : spec.kind === 'flawless'
        ? m.flawless
        : spec.kind === 'correct'
          ? m.correct
          : m.reviewCorrect;
  const progress = Math.min(spec.target, raw);
  return { spec, progress, done: raw >= spec.target };
}

/** Все ли задания дня закрыты (значит, пора забирать сундук). */
export function allQuestsDone(quests: QuestSpec[], m: DayMetrics): boolean {
  return quests.every((q) => questProgress(q, m).done);
}

export interface Chest {
  gems: number;
  xp: number;
  freezes: number;
}

/**
 * Содержимое ежедневного сундука БУКа.
 *
 * Сейчас награда намеренно прозрачная и воспроизводимая: за три ключа ребёнок
 * всегда получает базовые 15 кристаллов. Пустых сундуков нет, а редкие бонусы
 * можно добавить позже, не заменяя гарантированную награду.
 */
export function rollChest(): Chest {
  return { gems: CHEST_GEMS, xp: 0, freezes: 0 };
}

/**
 * Собрать награду за выполненные задания. Один и тот же день нельзя забрать
 * дважды: `claimed` — список id заданий дня (id = `<день>:<тип>`).
 */
export function claimableQuests(
  quests: QuestSpec[],
  m: DayMetrics,
  claimed: string[],
  day: string,
): QuestProgress[] {
  return quests
    .map((q) => questProgress(q, m))
    .filter((p) => p.done && !claimed.includes(questId(day, p.spec.kind)));
}

export function questId(day: string, kind: QuestKind): string {
  return `${day}:${kind}`;
}

/** Есть ли у профиля сегодня незакрытый сундук. */
export function chestReady(profile: Profile): boolean {
  const day = dayKey();
  const st = profile.daily;
  if (!st || st.day !== day) return false;
  const m = dayMetrics(profile.days[day]);
  return allQuestsDone(questsForDay(day), m) && st.chestsToday === 0;
}

export function dayStatOf(profile: Profile, day: string): DayStat | undefined {
  return profile.days[day];
}
