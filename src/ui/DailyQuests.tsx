import { useState } from 'react';
import { useActiveProfile, useApp, dayKey } from '../state/store';
import {
  allQuestsDone,
  describeChest,
  dayMetrics,
  questId,
  questProgress,
  questsForDay,
  rollChest,
} from '../engine/quests';
import { Bar, Confetti } from './Bits';
import { sfx } from '../platform/sound';
import { haptic } from '../platform/haptics';

/**
 * Карточка «Задания дня» на главной (пункт 3 плана).
 *
 * Решения, которые здесь видны:
 *  • награда — кристаллы 💎, а не XP: цель дня не должна закрываться «сама собой»
 *    от выдач (решение по наградам: кристаллы + сундук);
 *  • закрытые задания не исчезают: ребёнок сам жмёт «Забрать» и видит, что получил;
 *  • сундук — за все три задания, один в день. Открытие — маленький праздник
 *    с конфетти, чтобы «дойти до конца списка» было приятно.
 */
export function DailyQuests() {
  const profile = useActiveProfile();
  const claimQuest = useApp((s) => s.claimQuest);
  const openChest = useApp((s) => s.openChest);
  const showToast = useApp((s) => s.showToast);
  const [chest, setChest] = useState<{ open: boolean; text: string } | null>(null);

  if (!profile) return null;

  const day = dayKey();
  const quests = questsForDay(day);
  const m = dayMetrics(profile.days[day]);
  const st = profile.daily && profile.daily.day === day ? profile.daily : null;
  const claimed = st?.claimed ?? [];
  const chestsToday = st?.chestsToday ?? 0;

  const items = quests.map((q) => ({ ...questProgress(q, m), id: questId(day, q.kind) }));
  const doneCount = items.filter((i) => i.done).length;
  const all = allQuestsDone(quests, m);
  const chestAvailable = all && chestsToday === 0;

  const claim = (id: string, gems: number) => {
    sfx.correct();
    haptic.correct();
    claimQuest(id, gems);
    showToast({ emoji: '💎', title: `+${gems} кристаллов`, text: 'Награда за задание дня' });
  };

  const takeChest = () => {
    const rolled = rollChest(chestsToday);
    openChest(rolled);
    const text = describeChest(rolled);
    setChest({ open: true, text });
    sfx.finish(3);
    haptic.finish();
    showToast({ emoji: '🎁', title: 'Сундук открыт!', text });
    setTimeout(() => setChest(null), 2600);
  };

  return (
    <div className="card mb">
      <Confetti show={!!chest} />
      <div className="row mb">
        <div className="grow">
          <h3 style={{ margin: 0 }}>Задания дня</h3>
          <div className="tiny">Каждый день — три новых задания</div>
        </div>
        <div className="stat-pill tasks">{doneCount} из {quests.length}</div>
      </div>

      <div className="col" style={{ gap: 10 }}>
        {items.map(({ spec, progress, done, id }) => {
          const isClaimed = claimed.includes(id);
          const canClaim = done && !isClaimed;
          return (
            <div key={id} className={`quest ${done ? 'done' : ''}`}>
              <div className="row">
                <span className="quest-emoji" aria-hidden="true">
                  {done ? '✅' : spec.emoji}
                </span>
                <div className="grow">
                  <div className="quest-title">{spec.title}</div>
                  <div className="tiny">
                    {isClaimed ? 'Награда получена' : `${progress} / ${spec.target}`}
                  </div>
                </div>
                {canClaim ? (
                  <button className="btn green sm" onClick={() => claim(id, spec.reward)}>
                    Забрать 💎{spec.reward}
                  </button>
                ) : (
                  <span className={`quest-gem ${isClaimed ? 'taken' : ''}`}>
                    {isClaimed ? '✓' : `💎${spec.reward}`}
                  </span>
                )}
              </div>
              {!done && (
                <div style={{ marginTop: 6 }}>
                  <Bar value={(progress / spec.target) * 100} tone="orange" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {chestAvailable ? (
        <button className="btn green wide lg mt chest" onClick={takeChest}>
          🎁 Открыть сундук
        </button>
      ) : all && chestsToday > 0 ? (
        <div className="banner mt center">
          🎁 Сундук открыт! Следующий — завтра
          {(profile.daily?.chestsTotal ?? 0) > 1 && (
            <div className="tiny">Всего открыто сундуков: {profile.daily?.chestsTotal}</div>
          )}
        </div>
      ) : (
        <p className="tiny center" style={{ margin: '12px 0 0' }}>
          Выполни все три задания — и получишь сундук с наградой 🎁
        </p>
      )}
    </div>
  );
}
