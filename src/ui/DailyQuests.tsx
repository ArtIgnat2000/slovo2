import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { dayKey, dayPlan, masteredCount, useActiveProfile, useApp, useChestSkin, useLook } from '../state/store';
import {
  allQuestsDone,
  chestAwake,
  chestPreview,
  chestWakeBonus,
  countWakeTap,
  dayMetrics,
  planOf,
  plural,
  questId,
  questProgress,
  questTitle,
  bonusChestsReady,
  CHEST_WAKE_TAPS,
  dailyChestClaimed,
  type Chest,
  type ChestKind,
  type QuestKind,
} from '../engine/quests';
import { Bar } from './Bits';
import { ChestCelebration } from './ChestCelebration';
import { ChestGlyph, KeySymbol, prewarmChestArt } from './ChestArt';
import { ChestSkins } from './ChestSkins';
import {
  nextSkinState,
  newlyUnlockedSkins,
  skinById,
  skinUnlockMessage,
  type ChestSkinId,
} from '../engine/chests';
import { nudge } from './motion';
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
  const wake = reward.wakeBonus ?? 0;
  return (
    <div className="chest-rewards" aria-label="Награда сундука">
      {reward.gems > 0 && <span className="chest-reward">💎 +{reward.gems}</span>}
      {wake > 0 && <span className="chest-reward wake">🌟 разбудил сундук · +{wake}</span>}
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
 * Карточка «Задания дня» в листе наград с главной.
 *
 * Три задания — это три ключа сундука БУКа. Ключи считаются по прогрессу
 * заданий и поэтому переживают перезагрузку без отдельного счётчика.
 */
interface Props {
  /** Запустить задание: «Повтори N слов» открывает повторение, остальные — урок. */
  onStart: (kind: QuestKind) => void;
}

export function DailyQuests({ onStart }: Props) {
  const profile = useActiveProfile();
  const look = useLook();
  const claimQuest = useApp((s) => s.claimQuest);
  const openChest = useApp((s) => s.openChest);
  const wakeChest = useApp((s) => s.wakeChest);
  const showToast = useApp((s) => s.showToast);
  const [chest, setChest] = useState<ChestView | null>(null);
  /**
   * «Разбуди сундук»: сколько раз ребёнок тапнул по закрытому сундуку.
   * Состояние одно на карточку и на сцену: будить можно и на главной, и в
   * сцене, а награда одна. Обнуляется, когда сцена закрыта, — следующий сундук
   * начинается со «спящего» состояния.
   */
  const [wakeTaps, setWakeTaps] = useState(0);
  /** Открыта ли полка «Облики сундука» (выбор внешнего вида). */
  const [shelfOpen, setShelfOpen] = useState(false);
  /** Облики, открывшиеся в этом заходе: на полке они помечены «новый». */
  const [sessionFresh, setSessionFresh] = useState<ChestSkinId[]>([]);
  const skinId = useChestSkin();
  const skin = skinById(skinId);
  const chooseChestSkin = useApp((s) => s.chooseChestSkin);
  const recordChestSkins = useApp((s) => s.recordChestSkins);
  const tapsRef = useRef(0);
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
  /** Какой сундук ребёнок видит закрытым прямо сейчас (основной в приоритете). */
  const nextChestKind: ChestKind | null = chestReady ? 'daily' : bonusReady > 0 ? 'bonus' : null;
  const wakeAwake = chestAwake(wakeTaps);
  /** Надбавку за текущий сундук ещё не платили — значит, будить есть смысл. */
  const wakeAvailable = (st?.wakePaid ?? 0) < chestsToday;
  /** До какого облика ребёнок «добирает» — для подписи в карточке и в чеке. */
  const next = profile ? nextSkinState(profile) : null;

  useEffect(() => {
    if (doneCount >= 2 || chestReady || chestOpened || bonusReady > 0) prewarmChestArt(skinId);
  }, [doneCount, chestReady, chestOpened, bonusReady, skinId]);

  /**
   * Новый облик открылся — записываем и говорим об этом один раз. Запись живёт
   * в профиле, а не в телефоне: перенос прогресса файлом должен переносить и
   * коллекцию (и не повторять тост на новом устройстве).
   *
   * `sessionFresh` — отдельно от профиля: бейдж «новый» на полке должен
   * продержаться до конца этого захода, хотя тост и запись случаются сразу.
   */
  useEffect(() => {
    if (!profile) return;
    const fresh = newlyUnlockedSkins(profile);
    if (!fresh.length) return;
    const message = skinUnlockMessage(fresh);
    recordChestSkins(fresh);
    setSessionFresh((current) => [...new Set([...current, ...fresh])]);
    if (message) showToast({ emoji: '🎁', title: message.title, text: message.text });
  }, [profile, recordChestSkins, showToast]);

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

  /**
   * Тап по сундуку — ребёнок его будит. Пять тапов, и сундук просыпается:
   * надбавка к награде. Платим за разбуженный сундук, а не за каждый тап
   * (см. `CHEST_WAKE_GEMS` в engine/quests.ts).
   */
  const tapChest = (onWoken?: () => void) => {
    const next = countWakeTap(tapsRef.current);
    if (next === tapsRef.current) return;
    tapsRef.current = next;
    setWakeTaps(next);
    if (next >= CHEST_WAKE_TAPS) {
      sfx.chestWake();
      haptic.chestWake();
      onWoken?.();
    } else {
      sfx.chestKnock();
      haptic.chestKnock();
    }
  };

  const takeChest = (kind: ChestKind) => {
    // Сначала надёжно применяем и сохраняем награду, затем начинаем сцену.
    // Анимация никогда не является условием получения кристаллов.
    const reward = openChest(kind, chestAwake(tapsRef.current));
    if (!reward) return;
    setChest({ reward, kind, celebrate: true });
    sfx.tap();
  };

  const showStoredChest = () => {
    if (storedReward) setChest({ reward: storedReward, kind: storedChestKind, celebrate: false });
  };

  const closeChest = () => {
    setChest(null);
    // Сундук открыт и закрыт — следующий начнём будить заново.
    tapsRef.current = 0;
    setWakeTaps(0);
    window.requestAnimationFrame(() => receiptButtonRef.current?.focus());
  };

  /**
   * Сундук разбудили уже в сцене (награду стор выдал до шоу, поэтому надбавку
   * доплачиваем отдельно и один раз на сундук).
   */
  const payWake = (kind: ChestKind) => {
    const paid = wakeChest(kind);
    if (paid <= 0) return;
    setChest((current) =>
      current
        ? {
            ...current,
            reward: {
              ...current.reward,
              gems: current.reward.gems + paid,
              wakeBonus: (current.reward.wakeBonus ?? 0) + paid,
            },
          }
        : current,
    );
  };

  return (
    <div className="card flat mb home-quests">
      <div className="row mb">
        <div className="grow">
          <h3 style={{ margin: 0 }}>Задания дня</h3>
        </div>
        <div className="stat-pill tasks">{doneCount} из {quests.length}</div>
      </div>

      <div className="col quest-list">
        {items.map(({ spec, progress, done, id, target }) => {
          const isClaimed = claimed.includes(id);
          const canClaim = done && !isClaimed;
          return (
            <div key={id} className={`quest ${done ? 'done' : ''}`}>
              <div className="row">
                {done ? (
                  <span className="quest-emoji" aria-hidden="true">
                    ✅
                  </span>
                ) : null}
                {done ? (
                  <div className="grow">
                    <div className="quest-title">{questTitle(spec, target)}</div>
                    <div className="tiny">{isClaimed ? 'Награда получена' : `${progress} / ${target}`}</div>
                  </div>
                ) : (
                  <button type="button" className="quest-main" onClick={() => onStart(spec.kind)}>
                    <span className="quest-emoji" aria-hidden="true">
                      {spec.emoji}
                    </span>
                    <span className="grow">
                      <span className="quest-title">{questTitle(spec, target)}</span>
                      <span className="tiny">
                        {progress} / {target}
                      </span>
                    </span>
                  </button>
                )}
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
                <div className="quest-bar">
                  <Bar value={(progress / target) * 100} tone="orange" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={`chest-progress ${chestReady || bonusReady > 0 ? 'ready' : chestOpened ? 'opened' : ''}`}>
        <div className="row">
          {nextChestKind ? (
            <button
              type="button"
              className={`chest-glyph wake ${wakeAwake ? 'awake' : ''} ${wakeTaps > 0 ? 'waking' : ''}`}
              onClick={(event) => {
                nudge(event.currentTarget, { amplitude: 3 + wakeTaps, awake: wakeTaps + 1 >= CHEST_WAKE_TAPS });
                tapChest();
              }}
              aria-label={
                wakeAwake
                  ? 'Сундук проснулся'
                  : `Разбудить сундук: тап ${Math.min(wakeTaps + 1, CHEST_WAKE_TAPS)} из ${CHEST_WAKE_TAPS}`
              }
            >
              <ChestGlyph state="ready" skin={skin} />
            </button>
          ) : (
            <div className="chest-glyph" aria-hidden="true">
              <ChestGlyph state={chestOpened ? 'opened' : 'locked'} skin={skin} />
            </div>
          )}
          <div className="grow">
            <div className="chest-title">
              Сундук БУКа
              <button type="button" className="chest-skin-line" onClick={() => setShelfOpen(true)}>
                Облик: <b>{skin.title}</b>
              </button>
            </div>
            <div className="tiny">
              Ключи: {doneCount} из {quests.length}
              {chestOpened ? ' · основной открыт' : chestReady ? ' · все собраны!' : ''}
              {bonusReady > 0 ? ` · бонусных готово: ${bonusReady}` : ''}
            </div>
          </div>
        </div>

        {/* «Разбуди сундук»: пока сундук закрыт, по нему можно тапать. Ребёнок
            ждёт от тапа смысла — даём его: пять тапов, и награда больше. */}
        {nextChestKind && (
          <div className={`chest-wake ${wakeAwake ? 'awake' : ''}`}>
            <div className="chest-wake-dots" aria-hidden="true">
              {Array.from({ length: CHEST_WAKE_TAPS }, (_, index) => (
                <span key={index} className={`chest-wake-dot ${index < wakeTaps ? 'on' : ''}`} />
              ))}
            </div>
            <div className="tiny">
              {wakeAwake
                ? `Сундук проснулся! +${chestWakeBonus(nextChestKind)} 💎 к награде 🌟`
                : wakeTaps > 0
                  ? `Сундук просыпается: ${wakeTaps} из ${CHEST_WAKE_TAPS}. Тапни ещё!`
                  : `Сундук спит. Тапни его ${CHEST_WAKE_TAPS} раз — проснётся и даст +${chestWakeBonus(nextChestKind)} 💎`}
            </div>
          </div>
        )}

        <ChestKeyProgress items={items} />
      </div>

      {chestReady && (
        <button className="btn green wide lg mt chest" onClick={() => takeChest('daily')}>
          <ChestGlyph state="ready" skin={skin} />
          <span>Открыть сундук БУКа</span>
          <span className="tiny">
            +{chestPreview('daily', wakeAwake).gems} 💎
            {wakeAwake ? ` · разогрет +${chestWakeBonus('daily')}` : ''}
          </span>
        </button>
      )}

      {bonusReady > 0 && (
        <button className="btn green wide lg mt chest bonus-chest" onClick={() => takeChest('bonus')}>
          <ChestGlyph state="ready" skin={skin} />
          <span>Открыть бонусный сундук</span>
          <span className="tiny">
            +{chestPreview('bonus', wakeAwake).gems} 💎
            {wakeAwake ? ` · разогрет +${chestWakeBonus('bonus')}` : ''}
            {bonusReady > 1 ? ` · готово: ${bonusReady}` : ''}
          </span>
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

      {shelfOpen && (
        <ChestSkins
          profile={profile}
          active={skinId}
          fresh={sessionFresh}
          onPick={(id: ChestSkinId) => {
            // Выбрал — значит открыл: записываем сразу, чтобы облик остался
            // даже если условие (серия дней) к следующему заходу перестанет выполняться.
            recordChestSkins([id]);
            chooseChestSkin(id);
          }}
          onClose={() => setShelfOpen(false)}
        />
      )}

      {chest && (
        <ChestCelebration
          reward={chest.reward}
          kind={chest.kind}
          skinId={skinId}
          nextSkin={next ? { title: next.skin.title, left: next.left } : null}
          balance={profile.gems}
          look={look}
          stage={growthStage(masteredCount(profile)).index}
          learnerName={profile.name}
          celebrate={chest.celebrate}
          onClose={closeChest}
          /* В чеке (повторный просмотр) будить нечего: награда уже зачислена. */
          wake={
            chest.celebrate
              ? {
                  taps: wakeTaps,
                  target: CHEST_WAKE_TAPS,
                  bonus: chestWakeBonus(chest.kind),
                  available: wakeAvailable,
                  onTap: () => tapChest(() => payWake(chest.kind)),
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
