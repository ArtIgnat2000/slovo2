// ── Модель контента ──────────────────────────────────────────────────────────
// Ключевое отличие от v1: у слова есть УДАРЕНИЕ, СЛОГИ и «ОПАСНАЯ» буква.
// Именно вокруг этого строится методика запоминания словарных слов.

export type DangerKind = 'vowel' | 'consonant' | 'other';

export interface Word {
  id: string;
  text: string;
  stress: number; // индекс ударной буквы
  syllables: string[];
  danger: number[]; // индексы «опасных» букв (безударные гласные, двойные и непроизносимые согласные)
  dangerKind: DangerKind; // 'other' — в слове есть и гласные, и согласные опасности («Россия»)
  hint: string; // короткое пояснение значения — показывается и в заданиях, где слова не видно
  emoji: string;
  sentence: string; // предложение с пропуском ____
  mnemonic?: string; // мнемоника / ассоциация
  /** Имя файла картинки в public/words/ (без расширения). Нет — показываем эмодзи. */
  image?: string;
  theme: string; // id темы (урока)
}

export interface Lesson {
  id: string;
  title: string;
  emoji: string;
  order: number;
  wordIds: string[];
}

// ── Прогресс ─────────────────────────────────────────────────────────────────

export interface WordState {
  s: number; // score 0..100 (освоенность)
  due: number; // timestamp следующего повторения
  iv: number; // интервал в днях
  n: number; // число успешных повторений подряд
  seen: number; // когда видели последний раз
  ok: number; // сколько раз отвечал верно
  wrong: number;
}

export interface LessonState {
  level: number; // 0..5 — «короны» навыка
  best: number; // лучший результат в %
  doneAt: number;
  plays: number;
}

export interface DayStat {
  xp: number;
  correct: number;
  wrong: number;
  lessons: number;
  /** Лучшая серия верных ответов подряд за день — для задания «без ошибок» */
  flawless: number;
  /** Верных ответов в режиме «Повторение» (точность тренировки; задание дня считает слова) */
  reviewCorrect: number;
  /**
   * Слова, которые ребёнок потренировал в повторении сегодня (уникальные id).
   * Задание «Повтори N слов» считает именно потренированные слова, а не верные ответы:
   * ошибка в повторении не должна «замораживать» прогресс (см. PLAN, 2026-09-29).
   */
  reviewWords?: string[];
}

/** Слоты, по которым БУК может носить вещи: шапка, очки, шея, значок. */
export type ShopSlot = 'head' | 'face' | 'neck' | 'badge';

/** Размер базовой очереди урока; настройки принадлежат профилю ребёнка. */
export type LessonSize = 'short' | 'standard' | 'full';

/** Что ребёнок купил и что носит прямо сейчас (магазин — пункт 4 плана). */
export interface ShopState {
  owned: string[];
  equipped: Partial<Record<ShopSlot, string>>;
}

/** Вид ежедневного задания; «повтори N слов» — тренировка в режиме «Повторение». */
export type QuestKind = 'lessons' | 'flawless' | 'correct' | 'review';

/** Задание дня с уже решённой целью: план фиксируется на день при первом обращении. */
export interface QuestPlanItem {
  kind: QuestKind;
  target: number;
}

/**
 * Состояние ежедневных заданий (пункт 3 плана). Метрики дня отдельно не храним —
 * они считаются из `days[day]`; здесь только «что уже забрано», счётчики сундуков,
 * чек последней награды и зафиксированный на день план заданий.
 */
export interface DailyState {
  day: string; // YYYY-MM-DD, к которому относятся claimed/chestsToday
  claimed: string[]; // id выполненных и забранных заданий: `<день>:<вид>`
  chestsToday: number;
  chestsTotal: number;
  /** Последняя награда сундука этого дня — чтобы чек не пропадал после закрытия окна. */
  lastChest?: { gems: number; xp: number; freezes: number };
  /**
   * План заданий этого дня. Нужен, потому что набор дня зависит от профиля: у ребёнка,
   * которому ещё нечего повторять, «Повтори N слов» заменяется другим заданием, а цель
   * повторения подстраивается под число выученных слов. План нельзя пересчитывать на лету —
   * иначе цель «уезжала» бы прямо посреди дня (см. журнал PLAN, 2026-09-29).
   */
  plan?: QuestPlanItem[];
}

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
  xp: number;
  gems: number;
  streak: number;
  lastDay: string; // YYYY-MM-DD
  freezes: number; // «заморозки» серии
  words: Record<string, WordState>;
  lessons: Record<string, LessonState>;
  errors: Record<string, number>;
  days: Record<string, DayStat>;
  achievements: string[];
  /** Размер базовой очереди урока; у старых профилей по умолчанию «standard». */
  lessonSize?: LessonSize;
  adaptiveCards?: number;
  adaptiveGood?: number;
  daily?: DailyState; // опционально: профили, созданные до этой версии, живут без него
  shop?: ShopState; // опционально: появилось вместе с магазином
}

// ── Задания ──────────────────────────────────────────────────────────────────

export type TaskKind = 'intro' | 'syllables' | 'gap' | 'build' | 'write' | 'visual' | 'fix';

export type TaskReason = 'learn' | 'practice' | 'review' | 'repair';

export interface Task {
  uid: string;
  kind: TaskKind;
  wordId: string;
  reason: TaskReason;
  /** Индекс опасной буквы, вокруг которой построено задание */
  dangerIdx: number;
  /** Варианты ответа (для gap / fix) */
  options?: string[];
  /** Перемешанные буквы (для build) */
  letters?: string[];
  /** Неправильное написание, которое показываем в задании «исправь робота» */
  wrong?: string;
  /** Сколько секунд показываем слово (для visual) */
  showMs?: number;
}

export interface LessonRun {
  lessonId: string;
  tasks: Task[];
  index: number;
  correct: number;
  wrong: number;
  streakBest: number;
  startedAt: number;
  xp: number;
  results: { wordId: string; ok: boolean }[];
}
