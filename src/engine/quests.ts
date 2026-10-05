// ── Ежедневные задания и сундук ─────────────────────────────────────────────
//
// Замысел (пункт 3 плана): три задания в день, разные по типу, прогресс виден
// на главной, за каждое — кристаллы 💎, за все три — основной сундук.
// Отдельно за каждый завершённый обычный урок открывается бонусный сундук без суточного лимита.
//
// Принципы, вытекающие из принятых решений:
//  • никаких «потеряй серию» — задания не наказывают и не истекают втихую,
//    просто на новый день приходят новые;
//  • задания не дублируют цель дня по XP (иначе она закрывается «сама»): награда —
//    кристаллы, а не опыт;
//  • «без ошибок» считаем по всей дневной практике, а не по одному уроку —
//    иначе задание превращается в перфекционизм;
//  • «повтори N слов» считает потренированные слова (а не верные ответы): ошибка
//    в повторении не «замораживает» счётчик, а точность измеряет задание «без ошибок»;
//  • задание дня, которое нельзя выполнить, не выдаём: у нового профиля повторять
//    нечего, поэтому в наборе дня оно заменяется другим видом.
//
// Модуль чистый: ни React, ни стора. Сторы только хранят состояние.

import type { DailyState, DayStat, Profile, QuestKind, QuestPlanItem } from '../types';
import { dayKey } from './day';

export type { QuestKind, QuestPlanItem };

/** Все виды заданий дня — из них собираются три задания дня. */
export const ALL_QUEST_KINDS: QuestKind[] = ['lessons', 'flawless', 'correct', 'review'];

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
  reviewWords: number; // разных слов, потренированных в повторении за день
}

export interface QuestProgress {
  spec: QuestSpec;
  progress: number;
  done: boolean;
}

export const GEM_PER_QUEST = QUEST_POOL[0].reward;
/** Основной сундук за все три задания — заметно больше, чем сумма за задания. */
export const CHEST_GEMS = 15;
/** Бонусный сундук за каждый завершённый урок — без суточного потолка. */
export const BONUS_CHEST_GEMS = 5;

export type ChestKind = 'daily' | 'bonus';

/** Бонусные сундуки можно открывать независимо от основного ежедневного сундука. */
export function bonusChestsReady(lessons: number, claimed: number): number {
  return Math.max(0, Math.floor(lessons) - Math.floor(claimed));
}

/** В общем счётчике отделяем основной сундук от уже открытых бонусных. */
export function dailyChestClaimed(
  daily: Pick<DailyState, 'chestsToday' | 'bonusChestsClaimed'> | undefined,
): boolean {
  return !!daily && daily.chestsToday > Math.max(0, daily.bonusChestsClaimed ?? 0);
}

/** Какой набор заданий у дня: детерминированно от даты — обновил страницу, и он тот же. */
export function questsForDay(day: string): QuestSpec[] {
  const seed = hash(day);
  const kinds: QuestKind[] = [...ALL_QUEST_KINDS];
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

/** Задание по виду: в пуле ровно один шаблон каждого вида. */
export function specFor(kind: QuestKind): QuestSpec {
  return QUEST_POOL.find((q) => q.kind === kind) ?? QUEST_POOL[0];
}

/** Русская форма числительного: 1 слово / 2 слова / 5 слов. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Заголовок задания с учётом цели дня: «Повтори 3 слова» вместо жёстких «5 слов». */
export function questTitle(spec: QuestSpec, target: number): string {
  if (spec.kind !== 'review') return spec.title;
  return `Повтори ${target} ${plural(target, 'слово', 'слова', 'слов')}`;
}

/** Сколько слов ребёнок уже пробовал — только их и можно повторять. */
export function practisedCount(profile: Profile): number {
  return Object.values(profile.words).filter((st) => st.s > 0).length;
}

/** Меньше двух слов повторять бессмысленно: задание дня заменяется другим видом. */
export const MIN_REVIEW_WORDS = 2;

/**
 * Набор заданий дня для конкретного профиля.
 *
 * Виды берём из `questsForDay` (детерминированно от даты), но «Повтори N слов» нельзя
 * выдать, если повторять нечего: у нового профиля выученных слов нет вовсе, и задание
 * повисало бы на весь день — вместе с сундуком, который открывается по всем трём ключам.
 * Поэтому: совсем нечего повторять — заменяем четвёртым видом дня; слов мало — опускаем
 * цель до числа доступных слов (2..5), чтобы её можно было достичь за одну тренировку.
 *
 * План фиксируется на день и хранится в `profile.daily.plan`: иначе цель «уезжала» бы
 * посреди дня, как только ребёнок выучит новые слова.
 */
export function buildDayPlan(profile: Profile, day: string = dayKey()): QuestPlanItem[] {
  const specs = questsForDay(day);
  const practised = practisedCount(profile);
  return specs.map((spec) => {
    if (spec.kind !== 'review') return { kind: spec.kind, target: spec.target };
    if (practised < MIN_REVIEW_WORDS) {
      const spare = ALL_QUEST_KINDS.find((kind) => !specs.some((s) => s.kind === kind));
      if (!spare) return { kind: 'review', target: spec.target };
      return { kind: spare, target: specFor(spare).target };
    }
    return { kind: 'review', target: Math.min(spec.target, practised) };
  });
}

/** Задание дня, готовое к показу: шаблон + цель из плана. */
export interface PlannedQuest {
  spec: QuestSpec;
  target: number;
}

export function plannedQuests(plan: QuestPlanItem[]): PlannedQuest[] {
  return plan.map((item) => ({ spec: specFor(item.kind), target: item.target }));
}

/** План дня, если он ещё не зафиксирован (старые профили, новый день). */
export function planOf(profile: Profile, day: string = dayKey()): QuestPlanItem[] {
  const stored = profile.daily && profile.daily.day === day ? profile.daily.plan : undefined;
  return stored?.length ? stored : buildDayPlan(profile, day);
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
    reviewWords: day?.reviewWords?.length ?? 0,
  };
}

/** Прогресс задания: цель берём из плана дня, а не из шаблона. */
export function questProgress(spec: QuestSpec, target: number, m: DayMetrics): QuestProgress {
  const raw =
    spec.kind === 'lessons'
      ? m.lessons
      : spec.kind === 'flawless'
        ? m.flawless
        : spec.kind === 'correct'
          ? m.correct
          : m.reviewWords;
  const progress = Math.min(target, raw);
  return { spec, progress, done: raw >= target };
}

/** Все ли задания дня закрыты (значит, пора забирать сундук). */
export function allQuestsDone(plan: QuestPlanItem[], m: DayMetrics): boolean {
  return plan.every((item) => questProgress(specFor(item.kind), item.target, m).done);
}

export interface Chest {
  gems: number;
  xp: number;
  freezes: number;
}

/**
 * Содержимое основного или бонусного сундука БУКа.
 *
 * Награда прозрачная и воспроизводимая: основной сундук за три ключа даёт 15,
 * бонусный за завершённый урок — 5 кристаллов. Пустых сундуков нет.
 */
export function rollChest(kind: ChestKind = 'daily'): Chest {
  return { gems: kind === 'bonus' ? BONUS_CHEST_GEMS : CHEST_GEMS, xp: 0, freezes: 0 };
}

/**
 * Собрать награду за выполненные задания. Один и тот же день нельзя забрать
 * дважды: `claimed` — список id заданий дня (id = `<день>:<тип>`).
 */
export function claimableQuests(
  quests: PlannedQuest[],
  m: DayMetrics,
  claimed: string[],
  day: string,
): QuestProgress[] {
  return quests
    .map((q) => questProgress(q.spec, q.target, m))
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
  return allQuestsDone(planOf(profile, day), m) && !dailyChestClaimed(st);
}

export function dayStatOf(profile: Profile, day: string): DayStat | undefined {
  return profile.days[day];
}
