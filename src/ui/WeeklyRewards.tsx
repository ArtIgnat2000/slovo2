import { activeStudyDays, weekStartKey, WEEKLY_REWARD_MILESTONES } from '../engine/weekly-rewards';
import { plural } from '../engine/quests';
import { useActiveProfile } from '../state/store';

/** Недельные награды за учебные дни — дни не обязаны идти подряд. */
export function WeeklyRewards() {
  const profile = useActiveProfile();
  if (!profile) return null;

  const week = weekStartKey();
  const activeDays = activeStudyDays(profile.days);
  const claimed = new Set(profile.weekly?.week === week ? profile.weekly.claimed : []);

  return (
    <section className="card mb weekly-rewards" aria-label="Награды недели">
      <div className="row mb">
        <div className="grow">
          <h3 style={{ margin: 0 }}>Награды недели 🗓️</h3>
          <div className="tiny">Занимайся в разные дни — подряд не обязательно.</div>
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

      <div className="weekly-reward-milestones">
        {WEEKLY_REWARD_MILESTONES.map((milestone) => {
          const reached = activeDays >= milestone.days;
          const awarded = claimed.has(milestone.days);
          const remaining = milestone.days - activeDays;
          return (
            <div
              key={milestone.days}
              className={`weekly-reward-milestone ${reached ? 'reached' : ''} ${awarded ? 'awarded' : ''}`}
            >
              <div className="row">
                <b>{milestone.days} {plural(milestone.days, 'день', 'дня', 'дней')}</b>
                <b>+{milestone.gems} 💎</b>
              </div>
              <div className="tiny">
                {awarded
                  ? 'Получено'
                  : reached
                    ? 'Заверши урок — награда начислится'
                    : `Ещё ${remaining} ${plural(remaining, 'день', 'дня', 'дней')}`}
              </div>
            </div>
          );
        })}
      </div>

      <p className="tiny weekly-reward-note">
        Неделя считается с понедельника. День засчитывается после завершённого урока; заниматься
        подряд не нужно, а уже полученные кристаллы не пропадают.
      </p>
    </section>
  );
}
