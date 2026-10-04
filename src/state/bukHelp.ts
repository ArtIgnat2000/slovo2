/**
 * Правила помощи БУКа в уроке (2026-10-04, docs/buk-in-lesson.md).
 *
 * Модуль чистый: никакого React и DOM, поэтому правила проверяются без сборки
 * интерфейса. Методика держится на трёх вещах:
 *  1. первая ступень помощи — ВОПРОС, который не раскрывает букв: ребёнок
 *     продолжает вспоминать сам, а не читает ответ;
 *  2. вторая ступень — то же, что уже даёт кнопка «💡» в задании (опасные буквы
 *     и мнемоника), поэтому новых «читов» в приложении не появляется;
 *  3. помощь не притворяется самостоятельным ответом: вопрос → качество 4,
 *     показанная буква → 3. При этом звёзды урока зависят только от доли верных
 *     ответов, так что помощь не рушит результат.
 */
import type { TaskKind, TaskReason, Word } from '../types';
import { dangerSummary } from '../engine/word-facts';

/** Порог тихой паузы: столько ждём без действий, прежде чем предложить помощь. */
export const NUDGE_MS = 20_000;

/**
 * Где «застрять» действительно можно. В знакомстве и в проговаривании по слогам
 * задание само ведёт ребёнка, и предложение помощи там только мешает.
 */
export const HELPABLE_KINDS: readonly TaskKind[] = ['gap', 'build', 'write', 'visual', 'fix'];

/** Можно ли предлагать помощь по паузе для этого типа задания. */
export function canNudge(kind: TaskKind): boolean {
  return HELPABLE_KINDS.includes(kind);
}

/**
 * Порог паузы в миллисекундах. В тестах он короткий: сценарий «застрял»
 * проверяется за секунды, а не за двадцать. Продукт живёт на NUDGE_MS.
 */
export function nudgeMs(): number {
  const raw = Number((import.meta.env as { VITE_BUK_NUDGE_MS?: string } | undefined)?.VITE_BUK_NUDGE_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : NUDGE_MS;
}

/** Ступень помощи: 0 — закрыто, 1 — вопрос, 2 — показано опасное место. */
export type HelpStage = 0 | 1 | 2;

export interface NudgeState {
  kind: TaskKind;
  /** Сколько миллисекунд прошло с последнего действия ребёнка */
  idleMs: number;
  /** Ребёнок уже отказался в этом уроке */
  refused: boolean;
  /** Панель помощи открыта */
  panelOpen: boolean;
  /** На экране полоса вердикта — сейчас не время предлагать */
  hasVerdict: boolean;
  /** На этой карточке предложение уже показывали */
  shownOnCard: boolean;
  /** Порог паузы; по умолчанию — nudgeMs() */
  threshold?: number;
}

/** Тихое предложение помощи: ровно один раз на карточку и только по делу. */
export function shouldNudge(s: NudgeState): boolean {
  if (!canNudge(s.kind)) return false;
  if (s.refused || s.panelOpen || s.hasVerdict || s.shownOnCard) return false;
  return s.idleMs >= (s.threshold ?? nudgeMs());
}

/**
 * Первая ступень: вопрос про слово. Ни одна фраза не содержит само слово и не
 * называет опасные буквы — это проверяет тест (защита от «подсказки-ответа»).
 */
export function helperQuestion(kind: TaskKind, word: Word): string {
  const noDanger = word.danger.length === 0;
  switch (kind) {
    case 'gap':
      return noDanger
        ? 'В окошке буква, которая пишется как слышится. Проговори слово целиком.'
        : 'В окошке спряталась опасная буква. Проговори слово по слогам — где она?';
    case 'build':
      return noDanger
        ? 'Собирай по слогам — читай вслух, что уже получилось.'
        : 'Собирай по слогам. В слове есть место, которое надо запомнить.';
    case 'write':
      return noDanger
        ? 'Проговори слово по слогам, потом пиши — не спеши.'
        : 'Проговори слово по слогам, потом пиши. Не спеши с опасной буквой.';
    case 'visual':
      return 'Вспомни, как слово выглядело. Проговори его по слогам про себя.';
    case 'fix':
      return noDanger
        ? 'Робот ошибся. Проговори слово по слогам и найди, где не так.'
        : 'Робот ошибся в опасном месте. Проговори слово и найди его.';
    case 'syllables':
      return 'Читай по слогам — так слово запоминается лучше.';
    case 'intro':
      return 'Разгляди слово. Проговори его по слогам и найди опасную букву.';
  }
}

/** Вторая ступень: опасные буквы и мнемоника — то же, что даёт HintCard. */
export function helperReveal(word: Word): string {
  return word.mnemonic ?? dangerSummary(word);
}

export interface AfterAnswer {
  ok: boolean;
  /** Ступень, с которой ребёнок отвечал */
  stage: HelpStage;
  /** Серия верных ответов после этого ответа */
  streak: number;
  /** Задание было отработкой ошибки */
  reason: TaskReason;
}

/**
 * Строчка БУКа в полосе вердикта. Это единственное место в уроке, где ребёнок
 * его видит: плавающий БУК на карточках скрыт, а `say()` раньше пропадал в пустоту.
 */
export function helperAfterAnswer({ ok, stage, streak, reason }: AfterAnswer): string | null {
  if (!ok) {
    return reason === 'repair'
      ? 'Ещё разок посмотри на опасное место — и запомнится.'
      : 'Ошибаться не страшно: это слово вернётся в уроке — и ты его вспомнишь! 💪';
  }
  if (stage === 1) return 'Сам справился после вопроса — так и надо! 💪';
  if (streak >= 3) return `Серия ${streak}! Так держать!`;
  return null;
}

/**
 * Качество ответа с учётом помощи. Правила намеренно осторожные:
 *  • вопрос (ступень 1) не отдаёт букву, но и «самостоятельным» ответом не считается:
 *    в адаптации он не идёт в зачёт независимости (качество 4), а XP — как с подсказкой;
 *  • показанная буква (ступень 2) — обычная подсказка (качество 3, как у кнопки «💡»);
 *  • ошибка остаётся ошибкой.
 */
export function adjustQuality(quality: number | null, stage: HelpStage): number | null {
  if (quality === null) return null;
  if (quality === 0) return 0;
  if (quality >= 5 && stage === 2) return 3;
  if (quality >= 5 && stage === 1) return 4;
  return quality;
}
