import type { StudySession, StudySessionStatus } from '../types';

/** Детальная хронология хранится локально только за последние 30 календарных дней. */
export const STUDY_SESSION_RETENTION_DAYS = 30;
/** Пауза после отсутствия действий — эвристика для оценки активного времени, не мера внимания. */
export const STUDY_IDLE_MS = 90_000;

export function createStudySessionId(now = Date.now()): string {
  return `study_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function validCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function normalizeCounts(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .filter(([id, count]) => !!id && validCount(count) > 0)
      .map(([id, count]) => [id, validCount(count)]),
  );
}

const TASK_KINDS = new Set(['intro', 'syllables', 'gap', 'build', 'write', 'visual', 'fix']);
const STATUSES = new Set<StudySessionStatus>(['active', 'completed', 'stopped', 'interrupted']);

/** Санитизация старых/импортированных записей; активная запись после перезапуска — прервана. */
export function normalizeStudySessions(raw: unknown, today: string, now = Date.now()): StudySession[] {
  if (!Array.isArray(raw)) return [];
  const oldest = new Date(`${today}T12:00:00`);
  oldest.setDate(oldest.getDate() - (STUDY_SESSION_RETENTION_DAYS - 1));
  const cutoff = `${oldest.getFullYear()}-${String(oldest.getMonth() + 1).padStart(2, '0')}-${String(oldest.getDate()).padStart(2, '0')}`;
  return raw
    .filter((item): item is Partial<StudySession> & { id: string; day: string } =>
      !!item && typeof item === 'object' && typeof (item as StudySession).id === 'string' && typeof (item as StudySession).day === 'string' &&
      (item as StudySession).day >= cutoff && (item as StudySession).day <= today,
    )
    .map((item) => {
      const startedAt = typeof item.startedAt === 'number' && Number.isFinite(item.startedAt) ? item.startedAt : now;
      const status = STATUSES.has(item.status as StudySessionStatus) ? item.status as StudySessionStatus : 'interrupted';
      const endedAt = typeof item.endedAt === 'number' && Number.isFinite(item.endedAt) ? item.endedAt : undefined;
      return {
        id: item.id,
        day: item.day,
        startedAt,
        ...(endedAt !== undefined ? { endedAt } : {}),
        activeSeconds: validCount(item.activeSeconds),
        mode: item.mode === 'review' ? 'review' : 'lesson',
        ...(typeof item.lessonId === 'string' ? { lessonId: item.lessonId } : {}),
        tasks: validCount(item.tasks),
        correct: validCount(item.correct),
        wrong: validCount(item.wrong),
        errorWords: normalizeCounts(item.errorWords),
        taskKindErrors: Object.fromEntries(
          Object.entries(normalizeCounts(item.taskKindErrors)).filter(([kind]) => TASK_KINDS.has(kind)),
        ),
        recoveredWords: Array.isArray(item.recoveredWords)
          ? [...new Set(item.recoveredWords.filter((id): id is string => typeof id === 'string'))]
          : [],
        lastActivityAt: typeof item.lastActivityAt === 'number' && Number.isFinite(item.lastActivityAt)
          ? item.lastActivityAt
          : startedAt,
        status: status === 'active' ? 'interrupted' : status,
        ...(status === 'active' && endedAt === undefined ? { endedAt: typeof item.lastActivityAt === 'number' ? item.lastActivityAt : startedAt } : {}),
      };
    });
}

export type StudyClockNow = () => number;

/**
 * Считает видимые интервалы между действиями. Ограничивает хвост бездействия,
 * паузит при скрытии документа и округляет только при записи полных секунд.
 */
export class StudyClock {
  private sessionStarted = false;
  private cursor: number | null = null;
  private lastActivity: number | null = null;
  private ended = false;

  constructor(
    private readonly onStart: () => void,
    private readonly onSeconds: (seconds: number) => void,
    private readonly onFinish: (status: Exclude<StudySessionStatus, 'active' | 'interrupted'>) => void,
    private readonly now: StudyClockNow = () => performance.now(),
    private readonly idleMs = STUDY_IDLE_MS,
  ) {}

  /** Вызывается на действие пользователя; первая активность начинает сессию. */
  activity(): void {
    if (this.ended) return;
    const now = this.now();
    if (!this.sessionStarted) {
      this.sessionStarted = true;
      this.onStart();
      this.cursor = now;
    } else if (this.cursor !== null) {
      this.flush(false, now);
      if (this.cursor === null) this.cursor = now;
    } else {
      // После долгой паузы/возврата из фона считаем только с нового действия.
      this.cursor = now;
    }
    this.lastActivity = now;
  }

  /** Сохраняет уже прошедшие секунды; hidden=true закрывает текущий видимый интервал. */
  flush(hidden = false, now = this.now()): void {
    if (this.cursor === null || this.lastActivity === null || this.ended) return;
    const idleEnd = this.lastActivity + this.idleMs;
    const end = Math.min(now, idleEnd);
    const seconds = Math.floor(Math.max(0, end - this.cursor) / 1000);
    if (seconds > 0) {
      this.onSeconds(seconds);
      this.cursor += seconds * 1000;
    }
    if (hidden || now >= idleEnd) {
      this.cursor = null;
      this.lastActivity = null;
    }
  }

  finish(status: 'completed' | 'stopped'): void {
    if (this.ended) return;
    this.flush(true);
    this.ended = true;
    if (this.sessionStarted) this.onFinish(status);
  }
}
