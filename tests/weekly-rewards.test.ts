import assert from 'node:assert/strict';
import {
  activeStudyDays,
  settleWeeklyRewards,
  weekDayKeys,
  weekStartKey,
  WEEKLY_REWARD_MILESTONES,
} from '../src/engine/weekly-rewards';
import type { DayStat, WeeklyState } from '../src/types';

function dayStat(patch: Partial<DayStat> = {}): DayStat {
  return {
    xp: 0,
    correct: 0,
    wrong: 0,
    lessons: 0,
    flawless: 0,
    reviewCorrect: 0,
    reviewWords: [],
    ...patch,
  };
}

const week = weekDayKeys('2026-10-04');
assert.deepEqual(week, [
  '2026-09-28',
  '2026-09-29',
  '2026-09-30',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
  '2026-10-04',
]);
assert.equal(weekStartKey('2026-10-04'), '2026-09-28', 'воскресенье относится к начавшейся в понедельник неделе');
assert.equal(weekStartKey('2026-10-05'), '2026-10-05', 'понедельник начинает новую неделю');

const days: Record<string, DayStat> = {
  [week[0]]: dayStat({ lessons: 1 }),
  [week[2]]: dayStat({ correct: 1 }),
  [week[4]]: dayStat({ wrong: 4 }),
};
assert.equal(activeStudyDays(days, '2026-10-04'), 1, 'для недели засчитываются законченные уроки, а не одиночные ответы');

const thirdDay = settleWeeklyRewards(days, undefined, '2026-10-04');
assert.equal(thirdDay.activeDays, 1);
assert.deepEqual(thirdDay.rewards, [], 'до третьего активного дня награды нет');

const threeDays = {
  ...days,
  [week[1]]: dayStat({ lessons: 1 }),
  [week[6]]: dayStat({ lessons: 1 }),
};
const firstTier = settleWeeklyRewards(threeDays, undefined, '2026-10-04');
assert.deepEqual(firstTier.rewards.map((reward) => [reward.days, reward.gems]), [[3, 5]]);
assert.deepEqual(firstTier.state.claimed, [3]);
assert.deepEqual(settleWeeklyRewards(threeDays, firstTier.state, '2026-10-04').rewards, [], 'порог 3 дня повторно не начисляется');

const fiveDays = {
  ...threeDays,
  [week[2]]: dayStat({ lessons: 1 }),
  [week[3]]: dayStat({ lessons: 1 }),
};
const secondTier = settleWeeklyRewards(fiveDays, firstTier.state, '2026-10-04');
assert.equal(secondTier.activeDays, 5);
assert.deepEqual(secondTier.rewards.map((reward) => [reward.days, reward.gems]), [[5, 10]]);
assert.deepEqual(secondTier.state.claimed, [3, 5]);

const allDays = Object.fromEntries(week.map((date) => [date, dayStat({ lessons: 1 })]));
const thirdTier = settleWeeklyRewards(allDays, secondTier.state, '2026-10-04');
assert.equal(thirdTier.activeDays, 7);
assert.deepEqual(thirdTier.rewards.map((reward) => [reward.days, reward.gems]), [[7, 15]]);
assert.deepEqual(thirdTier.state.claimed, [3, 5, 7]);
assert.equal(WEEKLY_REWARD_MILESTONES.reduce((sum, reward) => sum + reward.gems, 0), 30);

const nextWeek = settleWeeklyRewards(allDays, thirdTier.state as WeeklyState, '2026-10-05');
assert.equal(nextWeek.activeDays, 0, 'новая неделя считает только свои дни');
assert.deepEqual(nextWeek.state.claimed, [], 'на новой неделе появляются новые пороги');
assert.deepEqual(nextWeek.rewards, []);

console.log('✓ недельные награды: непоследовательные дни, пороги, защита от повтора и сброс недели');
