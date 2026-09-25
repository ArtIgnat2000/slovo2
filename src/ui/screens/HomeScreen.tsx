import { LESSONS, WORDS } from '../../content/words';
import { masteredCount, todayStat, useActiveProfile, useApp } from '../../state/store';
import { Bar, Crowns, Ring } from '../Bits';
import { levelOf, levelProgress, xpForLevel } from '../../engine/rewards';
import { ACHIEVEMENTS } from '../../engine/rewards';
import { pickReview } from '../../engine/srs';

interface Props {
  onStartLesson: (lessonId: string) => void;
  onOpenProfiles: () => void;
  onStartReview: (lessonId: string) => void;
}

export function HomeScreen({ onStartLesson, onOpenProfiles, onStartReview }: Props) {
  const profile = useActiveProfile();
  const settings = useApp((s) => s.settings);
  if (!profile) return null;

  const today = todayStat(profile);
  const goal = settings.dailyGoal;
  const goalPct = Math.min(100, (today.xp / Math.max(1, goal)) * 100);
  const lvl = levelOf(profile.xp);
  const lvlPct = levelProgress(profile.xp) * 100;

  // Первый урок, который ещё не пройден полностью
  const current = LESSONS.find((l) => (profile.lessons[l.id]?.level ?? 0) < 5) ?? LESSONS[LESSONS.length - 1];
  const reviews = pickReview(WORDS, profile.words, new Set(), 12);

  return (
    <div className="screen">
      <div className="topbar">
        <button className="avatar" onClick={onOpenProfiles} title="Профили">
          {profile.avatar}
        </button>
        <div className="grow">
          <div style={{ fontWeight: 800, fontSize: 18 }}>{profile.name}</div>
          <div className="tiny">
            Уровень {lvl} · освоено {masteredCount(profile)} из {WORDS.length}
          </div>
        </div>
        <div className="stat-pill fire">🔥 {profile.streak}</div>
        <div className="stat-pill xp">⚡ {profile.xp}</div>
      </div>

      <div className="card mb">
        <div className="row">
          <Ring value={goalPct} label={`${today.xp}/${goal}`} />
          <div className="grow">
            <h3>Цель дня</h3>
            <p className="muted" style={{ marginBottom: 6 }}>
              {goalPct >= 100 ? 'Цель выполнена — молодец! 🎉' : `Ещё ${Math.max(0, goal - today.xp)} XP до цели`}
            </p>
            <Bar value={lvlPct} />
            <div className="tiny" style={{ marginTop: 4 }}>
              До уровня {lvl + 1}: {Math.max(0, xpForLevel(lvl + 1) - profile.xp)} XP
            </div>
          </div>
        </div>
      </div>

      {reviews.length > 0 && (
        <button className="card mb wide" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => onStartReview(current.id)}>
          <div className="row">
            <span style={{ fontSize: 30 }}>🔁</span>
            <div className="grow">
              <h3 style={{ margin: 0 }}>Пора повторить</h3>
              <p className="muted" style={{ margin: 0 }}>
                {reviews.length} слов(а) готовы забыться — освежим память
              </p>
            </div>
            <span style={{ fontSize: 22 }}>▸</span>
          </div>
        </button>
      )}

      <h2 className="mb">Мой путь</h2>
      <div className="path">
        {LESSONS.map((l) => {
          const st = profile.lessons[l.id];
          const level = st?.level ?? 0;
          const doneWords = l.wordIds.filter((id) => (profile.words[id]?.s ?? 0) > 0).length;
          return (
            <div className={`node ${l.id === current.id ? '' : ''}`} key={l.id}>
              <button
                className={`node-btn ${l.id === current.id ? 'current' : ''}`}
                onClick={() => onStartLesson(l.id)}
              >
                <span className="node-emoji">{l.emoji}</span>
                <span className="grow">
                  <span className="node-title">{l.title}</span>
                  <Crowns level={level} />
                  <div className="tiny">
                    {doneWords} / {l.wordIds.length} слов
                  </div>
                </span>
                <span style={{ fontSize: 22 }}>{l.id === current.id ? '▶' : '▸'}</span>
              </button>
            </div>
          );
        })}
      </div>

      {profile.achievements.length > 0 && (
        <>
          <h2 className="mt mb">Достижения</h2>
          <div className="card">
            <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
              {profile.achievements.map((id) => {
                const a = ACHIEVEMENTS.find((x) => x.id === id);
                return a ? (
                  <div key={id} className="center" style={{ width: 76 }}>
                    <div style={{ fontSize: 30 }}>{a.emoji}</div>
                    <div className="tiny">{a.title}</div>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        </>
      )}

      <p className="tiny center mt">Слов в курсе: {WORDS.length}</p>
    </div>
  );
}
