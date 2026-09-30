import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { plural, type Chest } from '../engine/quests';
import { haptic } from '../platform/haptics';
import { sfx } from '../platform/sound';
import { ChestIllustration, KeySymbol } from './ChestArt';
import { Mascot, type Look } from './Mascot';

const UNLOCK_FEEDBACK_MS = 1_560;
const REWARD_REVEAL_MS = 2_550;
const CELEBRATION_MS = 4_350;
const BALANCE_COUNT_MS = 620;

type Phase = 'waiting' | 'showing' | 'reward' | 'final';

interface Props {
  reward: Chest;
  balance: number;
  look: Look;
  stage: number;
  learnerName?: string;
  /** false для повторного просмотра чека: он открывается сразу, без повтора шоу. */
  celebrate: boolean;
  onClose: () => void;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function GemIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`ceremony-gem-icon ${className}`} viewBox="0 0 52 52" aria-hidden="true" focusable="false">
      <path d="M7 14 16 5h20l9 9-4 14-15 19L10 28 4 18z" fill="url(#ceremony-gem-icon-fill)" stroke="#fff0bd" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M7 14h38M16 5l9 9 11-9M16 5l9 21 11-21M4 18l21 8 20-12M10 28l15-2 16 2M25 26v21M7 14l18 33 20-33" fill="none" stroke="#f5ffff" strokeWidth="1.65" strokeLinejoin="round" opacity=".86" />
      <path d="M42 2v7M38.5 5.5h7" stroke="#fff7ce" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="8" r="1.6" fill="#fff7ce" />
      <defs>
        <linearGradient id="ceremony-gem-icon-fill" x1=".05" y1=".95" x2=".98" y2=".08">
          <stop offset="0" stopColor="#48d6e8" />
          <stop offset=".36" stopColor="#56a9ff" />
          <stop offset=".68" stopColor="#9673ff" />
          <stop offset="1" stopColor="#ff74be" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ExtraRewards({ reward }: { reward: Chest }) {
  if (reward.xp <= 0 && reward.freezes <= 0) return null;
  return (
    <div className="ceremony-extra-rewards">
      {reward.xp > 0 && <span>⚡ +{reward.xp} XP</span>}
      {reward.freezes > 0 && (
        <span>
          🧊 +{reward.freezes} {plural(reward.freezes, 'заморозка', 'заморозки', 'заморозок')}
        </span>
      )}
    </div>
  );
}

/**
 * Короткая сцена открытия сундука. Состояние награды уже сохранено стором;
 * эта компонента отвечает только за представление и не выдаёт валюту.
 */
export function ChestCelebration({ reward, balance, look, stage, learnerName, celebrate, onClose }: Props) {
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState<Phase>(() =>
    celebrate && !prefersReducedMotion() ? 'waiting' : 'final',
  );
  const unlockTimerRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const feedbackPlayedRef = useRef(false);
  const countStartedRef = useRef(false);
  const sequenceStartedRef = useRef(false);
  const [displayBalance, setDisplayBalance] = useState(() =>
    celebrate && !prefersReducedMotion() ? Math.max(0, balance - reward.gems) : balance,
  );
  const skipRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    if (query.addEventListener) query.addEventListener('change', update);
    else query.addListener(update);
    return () => {
      if (query.removeEventListener) query.removeEventListener('change', update);
      else query.removeListener(update);
    };
  }, []);

  const clearSequenceTimers = () => {
    if (unlockTimerRef.current !== null) window.clearTimeout(unlockTimerRef.current);
    if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
    if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current);
    unlockTimerRef.current = null;
    revealTimerRef.current = null;
    finishTimerRef.current = null;
  };

  const playUnlockFeedback = () => {
    if (feedbackPlayedRef.current) return;
    feedbackPlayedRef.current = true;
    sfx.chestOpen();
    haptic.chestOpen();
  };

  useEffect(() => () => clearSequenceTimers(), []);

  useEffect(() => {
    if (!celebrate || !reducedMotion) return;
    clearSequenceTimers();
    playUnlockFeedback();
    setDisplayBalance(balance);
    setPhase('final');
  }, [celebrate, reducedMotion, balance]);

  useEffect(() => {
    if (!celebrate || reducedMotion || phase === 'final') {
      setDisplayBalance(balance);
      return;
    }
    if (phase !== 'reward' || countStartedRef.current) return;

    countStartedRef.current = true;
    const startBalance = Math.max(0, balance - reward.gems);
    const startedAt = window.performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / BALANCE_COUNT_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayBalance(Math.round(startBalance + (balance - startBalance) * eased));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [phase, celebrate, reducedMotion, balance, reward.gems]);

  useEffect(() => {
    const target = phase === 'waiting'
      ? openRef.current
      : phase === 'final'
        ? doneRef.current
        : skipRef.current;
    target?.focus();
  }, [phase]);

  const startSequence = () => {
    if (phase !== 'waiting' || sequenceStartedRef.current) return;
    sequenceStartedRef.current = true;
    setPhase('showing');
    sfx.tap();
    haptic.tap();
    unlockTimerRef.current = window.setTimeout(() => {
      unlockTimerRef.current = null;
      playUnlockFeedback();
    }, UNLOCK_FEEDBACK_MS);
    revealTimerRef.current = window.setTimeout(() => {
      revealTimerRef.current = null;
      setPhase((current) => current === 'showing' ? 'reward' : current);
    }, REWARD_REVEAL_MS);
    finishTimerRef.current = window.setTimeout(() => {
      finishTimerRef.current = null;
      setPhase('final');
    }, CELEBRATION_MS);
  };

  const skip = () => {
    clearSequenceTimers();
    feedbackPlayedRef.current = true;
    setDisplayBalance(balance);
    setPhase('final');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Tab') {
      // В сцене только два действия: повернуть ключи и пропустить. Фокус циклически остаётся в диалоге.
      event.preventDefault();
      if (phase === 'waiting') {
        (document.activeElement === skipRef.current ? openRef.current : skipRef.current)?.focus();
      } else {
        (phase === 'final' ? doneRef.current : skipRef.current)?.focus();
      }
      return;
    }
    if (event.key !== 'Escape') return;
    event.preventDefault();
    if (phase !== 'final') skip();
    else onClose();
  };

  const waitingForAction = phase === 'waiting' && celebrate && !reducedMotion;
  const animationActive = (phase === 'showing' || phase === 'reward') && celebrate && !reducedMotion;
  const showSequence = waitingForAction || animationActive;
  const introducing = phase === 'showing' && animationActive;
  const hideResult = waitingForAction || introducing;
  const sceneClass = waitingForAction ? 'is-waiting' : animationActive ? 'is-showing' : 'is-final';
  const firstName = learnerName?.trim().split(/\s+/)[0];
  const title = waitingForAction
    ? firstName ? `${firstName}, открываем?` : 'Три ключа готовы!'
    : introducing
      ? firstName ? `Все три ключа на месте, ${firstName}!` : 'Все три ключа на месте!'
      : 'Сундук открыт!';
  const bukLine = phase === 'final'
    ? firstName ? `Ура, ${firstName}!` : 'Вот это команда!'
    : waitingForAction
      ? firstName ? `${firstName}, жми!` : 'Откроем вместе!'
      : 'Открываем!';
  const gems = reward.gems;

  return (
    <div className={`chest-ceremony ${sceneClass}`}>
      <section
        className="chest-ceremony-stage"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chest-ceremony-title"
        aria-describedby="chest-ceremony-description"
        onKeyDown={handleKeyDown}
      >
        <div className="ceremony-spotlight" aria-hidden="true" />

        {showSequence && (
          <button ref={skipRef} className="chest-ceremony-skip" onClick={skip}>
            Пропустить <span aria-hidden="true">›</span>
          </button>
        )}

        <div className="chest-ceremony-content">
          <div className="chest-ceremony-kicker">
            <span className="ceremony-kicker-rule" />
            ПРАЗДНИК ТРЁХ КЛЮЧЕЙ
            <span className="ceremony-kicker-rule" />
          </div>

          <div className="chest-ceremony-copy">
            <h2 id="chest-ceremony-title">{title}</h2>
            <p id="chest-ceremony-description">
              {waitingForAction
                ? 'Нажми на кнопку — повернём ключи вместе!'
                : introducing ? 'Ключи поворачиваются — сундук просыпается!' : 'Три задания — выполнены. Вот твоя награда:'}
            </p>
          </div>

          <div className="chest-ceremony-scene" aria-hidden="true">
            <div className="ceremony-stage-halo" aria-hidden="true" />
            <div className="chest-ceremony-buk" aria-hidden="true">
              <div className="chest-ceremony-speech">{bukLine}</div>
              <Mascot mood={celebrate ? (phase === 'final' ? 'dance' : 'excited') : 'happy'} look={look} stage={stage} size={118} />
            </div>
            <ChestIllustration />
            <div className="ceremony-confetti" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => (
                <span key={index} className={`ceremony-confetti-piece piece-${index + 1}`} />
              ))}
            </div>
          </div>

          <div className={`chest-ceremony-result ${hideResult ? 'waiting' : 'revealed'}`} aria-hidden={hideResult}>
            <div className="chest-ceremony-result-label">ТВОЯ НАГРАДА</div>
            <div className="chest-ceremony-total">
              <span>+{gems}</span>
              <GemIcon />
            </div>
            <div className="chest-ceremony-balance">
              Теперь у тебя <strong>{displayBalance.toLocaleString('ru-RU')}</strong>{' '}
              {plural(displayBalance, 'кристалл', 'кристалла', 'кристаллов')}
            </div>
            <ExtraRewards reward={reward} />
          </div>

          {waitingForAction ? (
            <button ref={openRef} className="btn lg wide chest-ceremony-open" onClick={startSequence}>
              <KeySymbol lit />
              <span>Повернуть ключи!</span>
              <span className="chest-ceremony-open-spark" aria-hidden="true">✦</span>
            </button>
          ) : animationActive ? (
            <div className="chest-ceremony-wait" aria-hidden="true">
              {introducing ? 'Раз, два, три — ключи повернулись!' : 'Награда уже твоя!'}
            </div>
          ) : (
            <button ref={doneRef} className="btn green wide lg chest-ceremony-done" onClick={onClose}>
              Здорово!
            </button>
          )}
        </div>

        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {waitingForAction
            ? `Все три ключа готовы${firstName ? `, ${firstName}` : ''}. Нажми «Повернуть ключи», чтобы открыть сундук.`
            : introducing
              ? 'Ключи поворачиваются, БУК открывает сундук.'
              : `Сундук открыт. Получено ${gems} ${plural(gems, 'кристалл', 'кристалла', 'кристаллов')}. Теперь у тебя ${balance} ${plural(balance, 'кристалл', 'кристалла', 'кристаллов')}.`}
        </div>
      </section>
    </div>
  );
}
