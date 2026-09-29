import { useEffect } from 'react';
import { scheduleWordImages } from '../../platform/word-images';
import { LESSONS, WORDS } from '../../content/words';
import { dayKey, masteredCount, todayStat, useActiveProfile, useApp } from '../../state/store';
import { lastDays } from '../../engine/day';
import { Bar, Crowns, Ring } from '../Bits';
import { DailyQuests } from '../DailyQuests';
import { levelOf, levelProgress, xpForLevel } from '../../engine/rewards';
import { ACHIEVEMENTS } from '../../engine/rewards';
import { pickReview } from '../../engine/srs';

interface Props {
  onStartLesson: (lessonId: string) => void;
  onOpenProfiles: () => void;
  /** «Пора повторить» — отдельный режим тренировки, id урока не нужен */
  onStartReview: () => void;
}

/** «1 день / 3 дня / 8 дней» — чтобы «Серия: 1 дней» не резало глаз. */
function dayWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

export function HomeScreen({ onStartLesson, onOpenProfiles, onStartReview }: Props) {
  const profile = useActiveProfile();
  const settings = useApp((s) => s.settings);
  const nextLesson = LESSONS.find((l) => (profile?.lessons[l.id]?.level ?? 0) < 5) ?? LESSONS[LESSONS.length - 1];
  useEffect(() => scheduleWordImages(WORDS.filter((w) => nextLesson.wordIds.includes(w.id))), [nextLesson]);
  if (!profile) return null;

  const today = todayStat(profile);
  const goal = settings.dailyGoal;
  const goalPct = Math.min(100, (today.xp / Math.max(1, goal)) * 100);
  const goalDone = today.xp >= goal;
  const over = Math.max(0, today.xp - goal);
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
        <div className="stat-pill gems">💎 {profile.gems}</div>
      </div>

      <div className="card mb">
        <div className="row">
          <Ring value={goalPct} main={String(today.xp)} sub={`цель ${goal}`} done={goalDone} />
          <div className="grow">
            <h3>Цель дня</h3>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              <p className="muted" style={{ margin: 0 }}>
                {goalDone ? 'Цель выполнена — молодец! 🎉' : `Ещё ${goal - today.xp} XP до цели`}
              </p>
              {over > 0 && <span className="goal-over">+{over} сверх цели</span>}
            </div>
            <Bar value={lvlPct} />
            <div className="tiny" style={{ marginTop: 4 }}>
              До уровня {lvl + 1}: {Math.max(0, xpForLevel(lvl + 1) - profile.xp)} XP
            </div>

            {/* Серия дней как «коллекция»: закрашенные дни — то, что ребёнок копит.
                Внутри карточки цели дня, чтобы не плодить блоки на главной. */}
            <div className="streak-label">
              {profile.streak > 0 ? `Серия: ${profile.streak} ${dayWord(profile.streak)} 🔥` : 'Серия дней'}
              {profile.freezes > 0 && <span className="tiny"> · 🧊 {profile.freezes}</span>}
            </div>
            <div className="streak-days">
              {lastDays(7).map((d) => {
                const st = profile.days[d];
                const busy = !!st && (st.lessons > 0 || st.correct > 0);
                return (
                  <span
                    key={d}
                    className={`streak-dot ${busy ? 'on' : ''} ${d === dayKey() ? 'today' : ''}`}
                    title={d}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <DailyQuests />

      {reviews.length > 0 && (
        <button className="card mb wide" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={onStartReview}>
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
