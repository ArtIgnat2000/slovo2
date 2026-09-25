export const XP = {
  task: 10,
  taskWithHint: 4,
  lessonDone: 40,
  perfectBonus: 30,
  review: 6,
} as const;

export const GEMS_PER_STREAK = 3;

/** Уровень профиля: 1 → 0 XP, дальше растём квадратично. */
export function levelOf(xp: number): number {
  return Math.floor(Math.sqrt(xp / 60)) + 1;
}

export function xpForLevel(level: number): number {
  return (level - 1) ** 2 * 60;
}

export function levelProgress(xp: number): number {
  const lvl = levelOf(xp);
  const from = xpForLevel(lvl);
  const to = xpForLevel(lvl + 1);
  return Math.min(1, Math.max(0, (xp - from) / Math.max(1, to - from)));
}

export interface Achievement {
  id: string;
  title: string;
  emoji: string;
  desc: string;
  test: (s: AchieveCtx) => boolean;
}

export interface AchieveCtx {
  streak: number;
  xp: number;
  mastered: number;
  lessonsDone: number;
  perfectLessons: number;
  wordsTrained: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', title: 'Первый шаг', emoji: '🌱', desc: 'Закончи первый урок', test: (c) => c.lessonsDone >= 1 },
  { id: 'streak3', title: 'Три дня подряд', emoji: '🔥', desc: 'Занимайся 3 дня подряд', test: (c) => c.streak >= 3 },
  { id: 'streak7', title: 'Неделя!', emoji: '🏆', desc: 'Серия 7 дней', test: (c) => c.streak >= 7 },
  { id: 'words25', title: 'Знаток', emoji: '⭐', desc: 'Освоено 25 слов', test: (c) => c.mastered >= 25 },
  { id: 'perfect', title: 'Без ошибок', emoji: '💎', desc: 'Урок на 100%', test: (c) => c.perfectLessons >= 1 },
  { id: 'xp500', title: 'Полтысячи', emoji: '⚡', desc: 'Набери 500 XP', test: (c) => c.xp >= 500 },
];

export function checkAchievements(ctx: AchieveCtx, have: string[]): string[] {
  return ACHIEVEMENTS.filter((a) => !have.includes(a.id) && a.test(ctx)).map((a) => a.id);
}

export function starsFor(correct: number, total: number): number {
  if (total === 0) return 0;
  const pct = correct / total;
  if (pct >= 0.99) return 3;
  if (pct >= 0.8) return 2;
  if (pct >= 0.6) return 1;
  return 0;
}
