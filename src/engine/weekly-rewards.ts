import type { DayStat, Profile, WeeklyState } from '../types';
import { dayKey } from './day';

/** Награды за учебную активность в непоследовательные дни недели. */
export const WEEKLY_REWARD_MILESTONES = [
  { days: 3, gems: 5 },
  { days: 5, gems: 10 },
  { days: 7, gems: 15 },
] as const;

export type WeeklyMilestone = (typeof WEEKLY_REWARD_MILESTONES)[number];

export interface WeeklySettlement {
  state: WeeklyState;
  activeDays: number;
  rewards: WeeklyMilestone[];
}

/** Ключ недели — понедельник в локальном календаре устройства. */
export function weekStartKey(day: string = dayKey()): string {
  const [year, month, date] = day.split('-').map(Number);
  const start = new Date(year, month - 1, date);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return dayKey(start);
}

/** Семь календарных дней недели, начиная с понедельника. */
export function weekDayKeys(day: string = dayKey()): string[] {
  const start = weekStartKey(day);
  const [year, month, date] = start.split('-').map(Number);
  return Array.from({ length: 7 }, (_, offset) => {
    const current = new Date(year, month - 1, date + offset);
    return dayKey(current);
  });
}

/** Для недельной награды считаем только день с завершённым уроком. */
export function isStudyDay(stat: DayStat | undefined): boolean {
  return !!stat && stat.lessons > 0;
}

export function activeStudyDays(
  days: Record<string, DayStat>,
  day: string = dayKey(),
): number {
  return weekDayKeys(day).filter((key) => key <= day && isStudyDay(days[key])).length;
}

/**
 * Начисляет ещё не выданные недельные пороги. Уже полученные награды сохраняются,
 * а после понедельника начинается новый календарный цикл.
 */
export function settleWeeklyRewards(
  days: Record<string, DayStat>,
  previous: WeeklyState | undefined,
  day: string = dayKey(),
): WeeklySettlement {
  const week = weekStartKey(day);
  const claimed = previous?.week === week ? previous.claimed : [];
  const activeDays = activeStudyDays(days, day);
  const rewards = WEEKLY_REWARD_MILESTONES.filter(
    (milestone) => activeDays >= milestone.days && !claimed.includes(milestone.days),
  );
  return {
    state: { week, claimed: [...claimed, ...rewards.map((reward) => reward.days)] },
    activeDays,
    rewards,
  };
}

export function weeklyProgress(profile: Profile, day: string = dayKey()): WeeklySettlement {
  return settleWeeklyRewards(profile.days, profile.weekly, day);
}
