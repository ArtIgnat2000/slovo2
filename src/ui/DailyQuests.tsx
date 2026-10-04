import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { dayKey, dayPlan, masteredCount, useActiveProfile, useApp, useLook } from '../state/store';
import {
  allQuestsDone,
  dayMetrics,
  planOf,
  plural,
  questId,
  questProgress,
  questTitle,
  bonusChestsReady,
  dailyChestClaimed,
  type Chest,
  type ChestKind,
  type QuestKind,
} from '../engine/quests';
import { Bar } from './Bits';
import { ChestCelebration } from './ChestCelebration';
import { ChestGlyph, KeySymbol, prewarmChestArt } from './ChestArt';
import { growthStage } from '../engine/shop';
import { sfx } from '../platform/sound';
import { haptic } from '../platform/haptics';

type ChestView = { reward: Chest; kind: ChestKind; celebrate: boolean };
type ChestKeyItem = { id: string; done: boolean };

/** Ключи анимируются только при новом выполнении, а не при каждом возврате на главную. */
function ChestKeyProgress({ items }: { items: ChestKeyItem[] }) {
  const signature = items.filter((item) => item.done).map((item) => item.id).join('|');
  const previous = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const [recentlyLit, setRecentlyLit] = useState<Record<string, number>>({});

  useEffect(() => {
    if (previous.current !== null) {
      const before = new Set(previous.current.split('|').filter(Boolean));
      const newlyDone = items.filter((item) => item.done && !before.has(item.id)).map((item) => item.id);
      if (newlyDone.length) {
        setRecentlyLit(Object.fromEntries(newlyDone.map((id, index) => [id, index])));
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          timer.current = null;
          setRecentlyLit({});
        }, 1_250);
      }
    }
    previous.current = signature;
  }, [signature]);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  return (
    <div
      className="chest-keys"
      role="progressbar"
      aria-label={`Ключи сундука: ${items.filter((item) => item.done).length} из ${items.length}`}
      aria-valuemin={0}
      aria-valuemax={items.length}
      aria-valuenow={items.filter((item) => item.done).length}
    >
      {items.map(({ id, done }) => (
        <span
          key={id}
          className={`chest-key ${done ? 'on' : ''} ${recentlyLit[id] !== undefined ? 'newly-lit' : ''}`}
          style={recentlyLit[id] !== undefined ? ({ '--key-delay': `${recentlyLit[id] * 140}ms` } as CSSProperties) : undefined}
        >
          <KeySymbol lit={done} />
        </span>
      ))}
    </div>
  );
}

function ChestRewards({ reward }: { reward: Chest }) {
  return (
    <div className="chest-rewards" aria-label="Награда сундука">
      {reward.gems > 0 && <span className="chest-reward">💎 +{reward.gems}</span>}
      {reward.xp > 0 && <span className="chest-reward">⚡ +{reward.xp} XP</span>}
      {reward.freezes > 0 && (
        <span className="chest-reward">
          🧊 +{reward.freezes} {plural(reward.freezes, 'заморозка', 'заморозки', 'заморозок')}
        </span>
      )}
    </div>
  );
}

/**
 * Карточка «Задания дня» на главной.
 *
 * Три задания — это три ключа сундука БУКа. Ключи считаются по прогрессу
 * заданий и поэтому переживают перезагрузку без отдельного счётчика.
 */
/** Что делать ребёнку для каждого задания — короткая подпись рядом с кнопкой «Начать». */
const QUEST_HINT: Record<QuestKind, string> = {
  review: 'Откроется режим 🔁 Повторение',
  lessons: 'Уроки ждут на карте «Мой путь»',
  correct: 'Верные ответы считаются в уроках',
  flawless: 'Отвечай верно один за другим',
};

interface Props {
  /** Запустить задание: «Повтори N слов» открывает повторение, остальные — урок. */
  onStart: (kind: QuestKind) => void;
}

export function DailyQuests({ onStart }: Props) {
  const profile = useActiveProfile();
  const look = useLook();
  const claimQuest = useApp((s) => s.claimQuest);
  const openChest = useApp((s) => s.openChest);
  const showToast = useApp((s) => s.showToast);
  const [chest, setChest] = useState<ChestView | null>(null);
  const receiptButtonRef = useRef<HTMLButtonElement>(null);

  const day = dayKey();
  const plan = profile ? planOf(profile, day) : [];
  const quests = dayPlan(profile);
  const st = profile?.daily && profile.daily.day === day ? profile.daily : null;
  const claimed = st?.claimed ?? [];
  const chestsToday = st?.chestsToday ?? 0;
  const bonusClaimed = st?.bonusChestsClaimed ?? 0;
  const metrics = dayMetrics(profile?.days[day]);
  const items = quests.map((q) => ({ ...questProgress(q.spec, q.target, metrics), id: questId(day, q.spec.kind), target: q.target }));
  const doneCount = items.filter((i) => i.done).length;
  const all = profile ? allQuestsDone(plan, metrics) : false;
  const chestOpened = dailyChestClaimed(st ?? undefined);
  const chestReady = all && !chestOpened;
  const bonusReady = bonusChestsReady(metrics.lessons, bonusClaimed);
  const storedReward = st?.lastChest;
  const storedChestKind = st?.lastChestKind ?? 'daily';

  useEffect(() => {
    if (doneCount >= 2 || chestReady || chestOpened || bonusReady > 0) prewarmChestArt();
  }, [doneCount, chestReady, chestOpened, bonusReady]);

  if (!profile) return null;

  const claim = (id: string, gems: number) => {
    sfx.correct();
    haptic.correct();
    claimQuest(id, gems);
    showToast({
      emoji: '💎',
      title: `+${gems} ${plural(gems, 'кристалл', 'кристалла', 'кристаллов')}`,
      text: 'Награда за задание дня',
    });
  };

  const takeChest = (kind: ChestKind) => {
    // Сначала надёжно применяем и сохраняем награду, затем начинаем сцену.
    // Анимация никогда не является условием получения кристаллов.
    const reward = openChest(kind);
    if (!reward) return;
    setChest({ reward, kind, celebrate: true });
    sfx.tap();
  };

  const showStoredChest = () => {
    if (storedReward) setChest({ reward: storedReward, kind: storedChestKind, celebrate: false });
  };

  const closeChest = () => {
    setChest(null);
    window.requestAnimationFrame(() => receiptButtonRef.current?.focus());
  };

  return (
    <div className="card mb">
      <div className="row mb">
        <div className="grow">
          <h3 style={{ margin: 0 }}>Задания дня</h3>
          <div className="tiny">3 ключа дают 15 💎, каждый пройденный урок — ещё один сундук на 5 💎</div>
        </div>
        <div className="stat-pill tasks">{doneCount} из {quests.length}</div>
      </div>

      <div className="col" style={{ gap: 10 }}>
        {items.map(({ spec, progress, done, id, target }) => {
          const isClaimed = claimed.includes(id);
          const canClaim = done && !isClaimed;
          return (
            <div key={id} className={`quest ${done ? 'done' : ''}`}>
              <div className="row">
                <span className="quest-emoji" aria-hidden="true">
                  {done ? '✅' : spec.emoji}
                </span>
                <div className="grow">
                  <div className="quest-title">{questTitle(spec, target)}</div>
                  <div className="tiny">
                    {isClaimed ? 'Награда получена' : `${progress} / ${target}`}
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
                <>
                  <div style={{ marginTop: 6 }}>
                    <Bar value={(progress / target) * 100} tone="orange" />
                  </div>
                  {/* Раньше карточка была «мёртвой»: непонятно, что делать и где.
                      Теперь у каждого задания есть действие и подпись, куда оно приведёт. */}
                  <div className="row quest-action">
                    <span className="tiny grow">{QUEST_HINT[spec.kind]}</span>
                    <button className="btn primary sm" onClick={() => onStart(spec.kind)}>
                      Начать ▸
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className={`chest-progress ${chestReady || bonusReady > 0 ? 'ready' : chestOpened ? 'opened' : ''}`}>
        <div className="row">
          <div className="chest-glyph" aria-hidden="true">
            <ChestGlyph state={chestReady || bonusReady > 0 ? 'ready' : chestOpened ? 'opened' : 'locked'} />
          </div>
          <div className="grow">
            <div className="chest-title">Сундук БУКа</div>
            <div className="tiny">
              Ключи: {doneCount} из {quests.length}
              {chestOpened ? ' · основной открыт' : chestReady ? ' · все собраны!' : ''}
              {bonusReady > 0 ? ` · бонусных готово: ${bonusReady}` : ''}
            </div>
          </div>
        </div>
        <ChestKeyProgress items={items} />
      </div>

      {chestReady && (
        <button className="btn green wide lg mt chest" onClick={() => takeChest('daily')}>
          <ChestGlyph state="ready" />
          <span>Открыть сундук БУКа</span>
          <span className="tiny">+15 💎</span>
        </button>
      )}

      {bonusReady > 0 && (
        <button className="btn green wide lg mt chest bonus-chest" onClick={() => takeChest('bonus')}>
          <ChestGlyph state="ready" />
          <span>Открыть бонусный сундук</span>
          <span className="tiny">+5 💎{bonusReady > 1 ? ` · готово: ${bonusReady}` : ''}</span>
        </button>
      )}

      {chestsToday > 0 && (
        <div className="chest-receipt mt">
          <div className="row">
            <span className="chest-receipt-icon" aria-hidden="true">✅</span>
            <div className="grow">
              <div className="quest-title">Награда получена</div>
              {storedReward ? <ChestRewards reward={storedReward} /> : <div className="tiny">Сундук открыт сегодня</div>}
            </div>
          </div>
          {storedReward && (
            <button ref={receiptButtonRef} className="btn ghost wide sm mt" onClick={showStoredChest}>
              Посмотреть награду
            </button>
          )}
        </div>
      )}

      {!chestReady && !chestOpened && bonusReady === 0 && (
        <p className="tiny center" style={{ margin: '12px 0 0' }}>
          Выполни задания и собери все три ключа 🔑
        </p>
      )}

      <p className="tiny center bonus-chest-note">
        Каждый завершённый урок приносит ещё один бонусный сундук с 5 💎 — без дневного лимита.
      </p>

      {chest && (
        <ChestCelebration
          reward={chest.reward}
          kind={chest.kind}
          balance={profile.gems}
          look={look}
          stage={growthStage(masteredCount(profile)).index}
          learnerName={profile.name}
          celebrate={chest.celebrate}
          onClose={closeChest}
        />
      )}
    </div>
  );
}
