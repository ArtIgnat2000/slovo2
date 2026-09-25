// ── Модель контента ──────────────────────────────────────────────────────────
// Ключевое отличие от v1: у слова есть УДАРЕНИЕ, СЛОГИ и «ОПАСНАЯ» буква.
// Именно вокруг этого строится методика запоминания словарных слов.

export type DangerKind = 'vowel' | 'consonant' | 'other';

export interface Word {
  id: string;
  text: string;
  stress: number; // индекс ударной буквы
  syllables: string[];
  danger: number[]; // индексы «опасных» букв (непроверяемые, непроизносимые...)
  dangerKind: DangerKind;
  emoji: string;
  sentence: string; // предложение с пропуском ____
  hint: string; // короткое пояснение значения
  mnemonic?: string; // мнемоника / ассоциация
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
