/**
 * Что предложить ребёнку в первую очередь (навигатор БУКа, 0.85.0).
 *
 * Правило совпадает с героем главного экрана (ui/screens/HomeScreen): если
 * есть созревшие повторения — «Пора повторить» важнее нового урока, иначе —
 * ближайший не пройденный урок активного класса. Формула живёт здесь одна,
 * чтобы кнопка «📖 Урок» в навигаторе и кнопка «Начать» на главной никогда
 * не разъезжались (раньше пришлось бы дублировать выбор в двух местах).
 */
import { LESSONS_BY_GRADE, WORDS, availableClass } from '../content/words';
import { dayKey } from './day';
import { pickReviewWords } from './srs';
import type { Profile } from '../types';

export interface NextStart {
  /** Есть созревшие повторения — сегодня их показывают первыми. */
  reviewDue: boolean;
  /** Сколько слов готово к повторению (подпись под кнопкой «Начать»). */
  reviewCount: number;
  /** Ближайший урок активного класса; null — профиля ещё нет. */
  lessonId: string | null;
}

/**
 * Считает первый шаг дня для профиля. `today` вынесена параметром, чтобы
 * правило повторения проверялось в тестах на любой дате.
 */
export function nextStartAction(profile: Profile | null, today: string = dayKey()): NextStart {
  if (!profile) return { reviewDue: false, reviewCount: 0, lessonId: null };
  // Правило повторения — то же, что в самом уроке повторения (engine/srs):
  // созревшие слова первыми, слова, которые сегодня уже были, — последними.
  const pick = pickReviewWords(
    WORDS,
    profile.words,
    new Set(),
    12,
    new Set(profile.days[today]?.reviewWords ?? []),
  );
  const reviewDue = pick.words.length > 0 && pick.kind === 'due';
  // Ближайший урок — как в HomeScreen: первый непройденный активного класса,
  // в конце программы — последний урок (иначе «Дальше» некуда вести).
  const lessons = LESSONS_BY_GRADE[availableClass(profile.activeClass ?? 2)];
  const current = lessons.find((l) => (profile.lessons[l.id]?.level ?? 0) < 5) ?? lessons[lessons.length - 1] ?? null;
  return { reviewDue, reviewCount: pick.words.length, lessonId: current?.id ?? null };
}
