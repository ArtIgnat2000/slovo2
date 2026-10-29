import { buildRating } from '../../engine/rating';
import { dayKey } from '../../engine/day';
import { useActiveProfile } from '../../state/store';

/**
 * «Рейтинг» (0.73.0): игрок соревнуется своим настоящим XP с воображаемыми
 * соперниками. Честно подписано на самом экране: соперники выдуманные, это
 * игра-мотивация, а не таблица настоящих детей. Соперники «занимаются»
 * каждый день (engine/rating.ts), поэтому место может меняться и без уроков —
 * стрелки показывают движение за сутки.
 */
export function RatingScreen() {
  const profile = useActiveProfile();
  if (!profile) return null;

  const todayXp = profile.days[dayKey()]?.xp ?? 0;
  const table = buildRating({ name: profile.name, emoji: profile.avatar, xp: profile.xp }, Date.now(), todayXp);
  const player = table.entries[table.playerRank - 1];
  const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`);
  const trend = (value: number) => (value > 0 ? `▲${value}` : value < 0 ? `▼${-value}` : '•');
  return (
    <div className="screen rating-screen">
      <h2 className="mb">🏆 Рейтинг</h2>
      <div className="tiny muted mb">Соперники выдуманы. Твои XP настоящие.</div>

      <section className="rating-hero" aria-label="Твоё место">
        <div className="rating-hero-place">{medal(table.playerRank)}</div>
        <div className="rating-hero-main">
          <div className="rating-hero-title">
            {profile.avatar} {profile.name} — место {table.playerRank} из {table.entries.length}
          </div>
          <div className="tiny muted">
            {player.xp} XP · сегодня +{todayXp} XP{table.toNext ? ` · до следующего ${table.toNext} XP` : ' · лидер'}
          </div>
        </div>
      </section>

      <section className="rating-list" aria-label="Таблица соперников">
        {table.entries.map((entry, i) => {
          const rank = i + 1;
          return (
            <div key={entry.id} className={`rating-row${entry.isPlayer ? ' is-player' : ''}`}>
              <div className="rating-place">{medal(rank)}</div>
              <div className="rating-avatar" aria-hidden="true">{entry.emoji}</div>
              <div className="rating-main">
                <div className="rating-name">
                  {entry.name}
                  {entry.isPlayer && <span className="rating-you"> — это ты</span>}
                </div>
                <div className="rating-bar" aria-hidden="true">
                  <span style={{ width: `${table.leaderXp > 0 ? Math.max(4, Math.round((entry.xp / table.leaderXp) * 100)) : 0}%` }} />
                </div>
              </div>
              <div className="rating-side">
                <div className="rating-xp">{entry.xp} XP</div>
                <div className="tiny muted">
                  {entry.isPlayer ? `+${todayXp} сегодня` : `+${entry.gainToday} сегодня`} · {trend(entry.trend)}
                </div>
              </div>
            </div>
          );
        })}
      </section>

    </div>
  );
}
