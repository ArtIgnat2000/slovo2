/**
 * Прогресс по классам 1–4 — чистая логика для трёх экранов.
 *
 * Слово в банке одно на все классы, а уроки у каждого класса свои. Поэтому
 * «класс пройден» — это не «все слова выучены», а «все уроки программы
 * закрыты хотя бы один раз» (уровень урока 5 — те же короны, что видит ребёнок
 * на «Моём пути»). Освоенность слов считается отдельно (s ≥ 90) и показывает,
 * насколько класс отработан по-настоящему.
 *
 * Этими числами пользуются:
 *  • главная — блок «Класс пройден» и переход к следующему классу;
 *  • лист «Какой класс учим?» — отметки «✓ пройден»;
 *  • «Родителям → Обзор» — таблица классов 1–4.
 */

import { AVAILABLE_CLASSES, CLASS_META, LESSONS_BY_GRADE, WORDS_BY_GRADE, availableClass } from '../content/words';
import type { ClassId, Profile } from '../types';

/** Порог «слово освоено» — тот же, что в `masteredCount` и отчёте родителя. */
export const MASTERED_SCORE = 90;
/** Уровень урока, начиная с которого урок считается пройденным (5 корон). */
export const LESSON_DONE_LEVEL = 5;

export interface ClassProgress {
  grade: ClassId;
  title: string;
  emoji: string;
  /** Слов в программе класса. */
  words: number;
  /** Освоено слов (s ≥ 90). */
  mastered: number;
  /** Слов, с которыми ребёнок хоть раз работал (s > 0). */
  started: number;
  /** Уроков в программе класса. */
  lessons: number;
  /** Уроков, закрытых до 5 уровня. */
  lessonsDone: number;
  /** Освоено слов, %. */
  pct: number;
  /** Все уроки класса пройдены. */
  complete: boolean;
  /** Это класс, который сейчас открыт у ребёнка. */
  current: boolean;
}

/** Прогресс по одному классу. Профиль может быть старым — все поля опциональны. */
export function classProgress(profile: Profile | null | undefined, grade: ClassId): ClassProgress {
  const lessons = LESSONS_BY_GRADE[grade] ?? [];
  const words = WORDS_BY_GRADE[grade] ?? [];
  const states = profile?.words ?? {};
  const lessonStates = profile?.lessons ?? {};
  const mastered = words.filter((w) => (states[w.id]?.s ?? 0) >= MASTERED_SCORE).length;
  const started = words.filter((w) => (states[w.id]?.s ?? 0) > 0).length;
  const lessonsDone = lessons.filter((l) => (lessonStates[l.id]?.level ?? 0) >= LESSON_DONE_LEVEL).length;
  return {
    grade,
    title: CLASS_META[grade].title,
    emoji: CLASS_META[grade].emoji,
    words: words.length,
    mastered,
    started,
    lessons: lessons.length,
    lessonsDone,
    pct: Math.round((mastered / Math.max(1, words.length)) * 100),
    complete: lessons.length > 0 && lessonsDone === lessons.length,
    current: availableClass(profile?.activeClass ?? 2) === grade,
  };
}

/** Таблица по всем классам, которые есть в сборке (для «Родителям → Обзор»). */
export function classTable(profile: Profile | null | undefined): ClassProgress[] {
  return AVAILABLE_CLASSES.map((grade) => classProgress(profile, grade));
}

/** Следующий класс программы после указанного; null — дальше программы нет. */
export function nextClass(grade: ClassId): ClassId | null {
  return AVAILABLE_CLASSES.find((g) => g > grade) ?? null;
}

/** Все уроки класса закрыты? Пустой класс пройденным не считается. */
export function classComplete(profile: Profile | null | undefined, grade: ClassId): boolean {
  const lessons = LESSONS_BY_GRADE[grade] ?? [];
  return lessons.length > 0 && lessons.every((l) => (profile?.lessons?.[l.id]?.level ?? 0) >= LESSON_DONE_LEVEL);
}

/** Классы, которые уже пройдены, — по возрастанию. */
export function completedClasses(profile: Profile | null | undefined): ClassId[] {
  return AVAILABLE_CLASSES.filter((grade) => classComplete(profile, grade));
}
