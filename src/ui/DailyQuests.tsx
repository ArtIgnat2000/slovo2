import { useState } from 'react';
import { useActiveProfile, useApp, dayKey } from '../state/store';
import {
  allQuestsDone,
  dayMetrics,
  questId,
  questProgress,
  questsForDay,
  rollChest,
  type Chest,
} from '../engine/quests';
import { Bar, Confetti } from './Bits';
import { sfx } from '../platform/sound';
import { haptic } from '../platform/haptics';

type ChestView = { reward: Chest };

function ChestRewards({ reward }: { reward: Chest }) {
  return (
    <div className="chest-rewards" aria-label="Награда сундука">
      {reward.gems > 0 && <span className="chest-reward">💎 +{reward.gems}</span>}
      {reward.xp > 0 && <span className="chest-reward">⚡ +{reward.xp} XP</span>}
      {reward.freezes > 0 && <span className="chest-reward">🧊 +{reward.freezes} заморозка</span>}
    </div>
  );
}

/**
 * Карточка «Задания дня» на главной.
 *
 * Три задания — это три ключа сундука БУКа. Ключи считаются по прогрессу
 * заданий и поэтому переживают перезагрузку без отдельного счётчика.
 */
export function DailyQuests() {
  const profile = useActiveProfile();
  const claimQuest = useApp((s) => s.claimQuest);
  const openChest = useApp((s) => s.openChest);
  const showToast = useApp((s) => s.showToast);
  const [chest, setChest] = useState<ChestView | null>(null);

  if (!profile) return null;

  const day = dayKey();
  const quests = questsForDay(day);
  const st = profile.daily && profile.daily.day === day ? profile.daily : null;
  const claimed = st?.claimed ?? [];
  const chestsToday = st?.chestsToday ?? 0;
  const metrics = dayMetrics(profile.days[day]);
  const items = quests.map((q) => ({ ...questProgress(q, metrics), id: questId(day, q.kind) }));
  const doneCount = items.filter((i) => i.done).length;
  const all = allQuestsDone(quests, metrics);
  const chestReady = all && chestsToday === 0;
  const chestOpened = chestsToday > 0;
  const storedReward = st?.lastChest;

  const claim = (id: string, gems: number) => {
    sfx.correct();
    haptic.correct();
    claimQuest(id, gems);
    showToast({ emoji: '💎', title: `+${gems} кристаллов`, text: 'Награда за задание дня' });
  };

  const takeChest = () => {
    const reward = rollChest();
    if (!openChest(reward)) return;
    setChest({ reward });
    sfx.finish(3);
    haptic.finish();
  };

  const showStoredChest = () => {
    if (storedReward) setChest({ reward: storedReward });
  };

  return (
    <div className="card mb">
      <Confetti show={!!chest} />

      <div className="row mb">
        <div className="grow">
          <h3 style={{ margin: 0 }}>Задания дня</h3>
          <div className="tiny">Собери 3 ключа — открой сундук БУКа</div>
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

      <div className={`chest-progress ${chestOpened ? 'opened' : chestReady ? 'ready' : ''}`}>
        <div className="row">
          <div className="chest-glyph" aria-hidden="true">
            {chestOpened ? '📦' : chestReady ? '🎁' : '🔒'}
          </div>
          <div className="grow">
            <div className="chest-title">Сундук БУКа</div>
            <div className="tiny">
              Ключи: {doneCount} из {quests.length}
              {chestOpened ? ' · сегодня уже открыт' : chestReady ? ' · все собраны!' : ''}
            </div>
          </div>
        </div>
        <div className="chest-keys" role="progressbar" aria-label={`Ключи сундука: ${doneCount} из ${quests.length}`} aria-valuemin={0} aria-valuemax={quests.length} aria-valuenow={doneCount}>
          {items.map(({ id, done }) => (
            <span key={id} className={`chest-key ${done ? 'on' : ''}`} aria-hidden="true">
              {done ? '🔑' : '▫️'}
            </span>
          ))}
        </div>
      </div>

      {chestReady ? (
        <button className="btn green wide lg mt chest" onClick={takeChest}>
          🎁 Открыть сундук БУКа
        </button>
      ) : chestOpened ? (
        <div className="chest-receipt mt">
          <div className="row">
            <span className="chest-receipt-icon" aria-hidden="true">✅</span>
            <div className="grow">
              <div className="quest-title">Награда получена</div>
              {storedReward ? <ChestRewards reward={storedReward} /> : <div className="tiny">Сундук открыт сегодня</div>}
            </div>
          </div>
          {storedReward && (
            <button className="btn ghost wide sm mt" onClick={showStoredChest}>
              Посмотреть награду
            </button>
          )}
        </div>
      ) : (
        <p className="tiny center" style={{ margin: '12px 0 0' }}>
          Выполни задания и собери все три ключа 🔑
        </p>
      )}

      {chest && (
        <div className="overlay" role="presentation">
          <div className="dialog chest-dialog" role="dialog" aria-modal="true" aria-labelledby="chest-title">
            <div className="dialog-emoji" aria-hidden="true">🎉</div>
            <h2 id="chest-title">Сундук БУКа открыт!</h2>
            <p className="muted">Ты собрал все три ключа. Вот твоя награда:</p>
            <ChestRewards reward={chest.reward} />
            <div className="tiny mt">Теперь у тебя 💎 {profile.gems}</div>
            <button className="btn green wide lg mt" onClick={() => setChest(null)}>
              Отлично!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
