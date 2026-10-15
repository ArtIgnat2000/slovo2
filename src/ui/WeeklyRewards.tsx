import { activeStudyDays, weekStartKey, WEEKLY_REWARD_MILESTONES } from '../engine/weekly-rewards';
import { useActiveProfile } from '../state/store';

/** Недельные награды за учебные дни — дни не обязаны идти подряд. */
export function WeeklyRewards() {
  const profile = useActiveProfile();
  if (!profile) return null;

  const week = weekStartKey();
  const activeDays = activeStudyDays(profile.days);
  const claimed = new Set(profile.weekly?.week === week ? profile.weekly.claimed : []);

  return (
    <section className="card flat mb weekly-rewards" aria-label="Награды недели">
      <div className="row mb">
        <div className="grow">
          <h3 style={{ margin: 0 }}>Награды недели</h3>
        </div>
        <div className="stat-pill tasks">{activeDays} из 7</div>
      </div>

      <div
        className="weekly-reward-bar"
        role="progressbar"
        aria-label={`Учебные дни этой недели: ${activeDays} из 7`}
        aria-valuemin={0}
        aria-valuemax={7}
        aria-valuenow={activeDays}
      >
        <span style={{ width: `${(activeDays / 7) * 100}%` }} />
      </div>

      <div className="weekly-marks">
        {WEEKLY_REWARD_MILESTONES.map((milestone) => {
          const reached = activeDays >= milestone.days;
          const awarded = claimed.has(milestone.days);
          return (
            <div
              key={milestone.days}
              className={`weekly-mark ${reached ? 'reached' : ''} ${awarded ? 'awarded' : ''}`}
            >
              {milestone.days}д · +{milestone.gems} 💎
            </div>
          );
        })}
      </div>
    </section>
  );
}
